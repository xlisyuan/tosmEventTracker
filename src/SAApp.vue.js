import { ref, onMounted, onUnmounted, provide, watch } from "vue";
import { v4 as uuidv4 } from "uuid";
import { ElMessage } from "element-plus";
import { Sunny, Moon } from "@element-plus/icons-vue";
import { onAuthStateChanged, signInWithEmailAndPassword } from "firebase/auth";
import { collection, deleteDoc, doc, onSnapshot, serverTimestamp, setDoc, } from "firebase/firestore";
import NoteInput from "./components/NoteInput.vue";
import NoteList from "./components/NoteList.vue";
import UpdateStatusDialog from "./components/UpdateStatusDialog.vue";
import { maps as originalMaps } from "./data/maps";
import { isFirebaseConfigured, saAuth, saDb } from "./firebase-sa";
const featureFlags = ref({
    nosec: false,
    pic: false,
    en: false,
});
provide("feature-flags", featureFlags);
const notes = ref([]);
const maps = ref(JSON.parse(JSON.stringify(originalMaps)));
const mapImageCache = ref({});
const isDark = ref(false);
const currentSortMode = ref("time");
const hasInputSoundOn = ref(true);
const showUpdateDialog = ref(false);
const currentNoteToUpdate = ref(null);
const updateMapName = ref("");
const isVerified = ref(false);
const isCheckingAuth = ref(false);
const passwordInput = ref("");
const clientId = getClientId();
let unsubscribeNotes = null;
let unsubscribeAuth = null;
let sortTimer = null;
const SA_AUTH_EMAIL = import.meta.env.VITE_SA_AUTH_EMAIL || "";
const ON_TIME_LIMIT_MS = 30 * 60 * 1000;
watch(isDark, (newValue) => {
    if (newValue) {
        document.documentElement.classList.add("dark");
        localStorage.setItem("theme", "dark");
    }
    else {
        document.documentElement.classList.remove("dark");
        localStorage.setItem("theme", "light");
    }
});
const loadMapImage = async (noteText) => {
    const mapData = maps.value.find((m) => m.name === noteText);
    if (featureFlags.value.pic && mapData?.imagePath && !mapImageCache.value[mapData.name]) {
        try {
            const image = new Image();
            await new Promise((resolve, reject) => {
                image.onload = resolve;
                image.onerror = reject;
                image.src = mapData.imagePath;
            });
            mapImageCache.value[mapData.name] = mapData.imagePath;
        }
        catch (e) {
            console.error(`無法載入地圖圖片: ${mapData.imagePath}`, e);
        }
    }
};
const getDocId = (mapLevel, channel, noteText) => `${mapLevel}_${channel}_${encodeURIComponent(noteText.trim())}`;
const SA_NOTE_SOUND_STORAGE_KEY = "sa-note-sound-settings";
const SA_INPUT_SOUND_STORAGE_KEY = "sa-input-sound-on";
const getNoteSoundSettings = () => {
    const saved = localStorage.getItem(SA_NOTE_SOUND_STORAGE_KEY);
    if (!saved)
        return {};
    try {
        return JSON.parse(saved);
    }
    catch {
        return {};
    }
};
const setNoteSoundSetting = (noteId, hasSound) => {
    const settings = getNoteSoundSettings();
    settings[noteId] = hasSound;
    localStorage.setItem(SA_NOTE_SOUND_STORAGE_KEY, JSON.stringify(settings));
};
const getNoteSoundSetting = (noteId) => {
    const settings = getNoteSoundSettings();
    if (noteId in settings)
        return settings[noteId];
    return hasInputSoundOn.value;
};
const sortNotesArray = (a, b) => {
    const now = Date.now();
    const getCategory = (state) => {
        if (state.toLowerCase() === "on")
            return "ON";
        if (state.includes("_"))
            return "STAGE";
        return "CD";
    };
    const aStateCategory = getCategory(a.state);
    const bStateCategory = getCategory(b.state);
    if (currentSortMode.value === "map") {
        if (a.mapLevel !== b.mapLevel)
            return b.mapLevel - a.mapLevel;
        if (a.channel !== b.channel)
            return a.channel - b.channel;
    }
    const aIsOnOverLimit = aStateCategory === "ON" && now - (a.onTime || now) > ON_TIME_LIMIT_MS;
    const bIsOnOverLimit = bStateCategory === "ON" && now - (b.onTime || now) > ON_TIME_LIMIT_MS;
    if (aIsOnOverLimit && !bIsOnOverLimit)
        return 1;
    if (!aIsOnOverLimit && bIsOnOverLimit)
        return -1;
    const stateOrder = { ON: 1, STAGE: 2, CD: 3 };
    if (stateOrder[aStateCategory] !== stateOrder[bStateCategory]) {
        return stateOrder[aStateCategory] - stateOrder[bStateCategory];
    }
    if (aStateCategory === "ON")
        return (a.onTime || 0) - (b.onTime || 0);
    if (aStateCategory === "STAGE") {
        const aStage = parseInt(a.state.replace("STAGE_", ""), 10);
        const bStage = parseInt(b.state.replace("STAGE_", ""), 10);
        return bStage - aStage;
    }
    return (a.respawnTime || 0) - (b.respawnTime || 0);
};
const saveNoteToFirestore = async (note) => {
    if (!saDb)
        return;
    const docId = getDocId(note.mapLevel, note.channel, note.noteText);
    await setDoc(doc(collection(saDb, "saNotes"), docId), {
        mapLevel: note.mapLevel,
        channel: note.channel,
        noteText: note.noteText,
        onTime: note.onTime ?? null,
        respawnTime: note.respawnTime ?? null,
        state: note.state,
        maxStages: note.maxStages ?? 4,
        updatedBy: clientId,
        updatedAt: serverTimestamp(),
    });
};
const subscribeNotes = () => {
    if (!saDb)
        return;
    unsubscribeNotes = onSnapshot(collection(saDb, "saNotes"), (snapshot) => {
        const nextNotes = [];
        snapshot.forEach((snap) => {
            const d = snap.data();
            const mapData = maps.value.find((m) => m.level === d.mapLevel && m.name === d.noteText);
            const mapName = d.noteText || mapData?.name;
            if (!mapName)
                return;
            const noteId = getDocId(d.mapLevel, d.channel, mapName);
            nextNotes.push({
                id: noteId,
                mapLevel: d.mapLevel,
                channel: d.channel,
                noteText: mapName,
                respawnTime: d.respawnTime ?? 0,
                state: d.state ?? "CD",
                isStarred: mapData?.isStarred ?? false,
                hasSound: getNoteSoundSetting(noteId),
                maxStages: d.maxStages ?? mapData?.maxStages ?? 4,
                onTime: d.onTime ?? null,
                hasAlerted: false,
                stageTime: null,
            });
        });
        notes.value = nextNotes.sort(sortNotesArray);
    });
};
const handleAddNewNote = async (newNote) => {
    const mapData = maps.value.find((m) => m.name === newNote.noteText);
    if (!mapData) {
        ElMessage.error("找不到對應的地圖資料");
        return;
    }
    await loadMapImage(mapData.name);
    const finalNote = {
        ...newNote,
        id: getDocId(newNote.mapLevel, newNote.channel, mapData.name),
        noteText: mapData.name,
        isStarred: mapData.isStarred,
        hasSound: newNote.hasSound,
        maxStages: mapData.maxStages,
        respawnTime: newNote.respawnTime || 0,
        onTime: newNote.onTime || null,
        hasAlerted: false,
    };
    setNoteSoundSetting(finalNote.id, finalNote.hasSound);
    await saveNoteToFirestore(finalNote);
    ElMessage({
        type: "success",
        message: `已同步更新 ${finalNote.noteText} 分流: ${finalNote.channel}`,
    });
};
const handleDeleteNote = async (id) => {
    if (!saDb)
        return;
    await deleteDoc(doc(saDb, "saNotes", id));
    ElMessage({ type: "success", message: "記錄已刪除" });
};
const handleClearAllNotes = async () => {
    if (!saDb)
        return;
    const db = saDb;
    const current = [...notes.value];
    await Promise.all(current.map((n) => deleteDoc(doc(db, "saNotes", n.id))));
};
const handleUpdateNoteStatus = async (id, newState, newTime) => {
    const noteToUpdate = notes.value.find((note) => note.id === id);
    if (!noteToUpdate)
        return;
    noteToUpdate.state = newState;
    noteToUpdate.onTime = null;
    noteToUpdate.stageTime = null;
    noteToUpdate.hasAlerted = false;
    switch (newState) {
        case "ON":
            noteToUpdate.onTime = newTime;
            break;
        case "CD": {
            const map = maps.value.find((m) => m.level === noteToUpdate.mapLevel);
            if (map)
                noteToUpdate.respawnTime = Date.now() + map.respawnTime * 1000;
            break;
        }
        default:
            noteToUpdate.stageTime = newTime;
            break;
    }
    await saveNoteToFirestore(noteToUpdate);
};
const handleUpdateNoteCd = async (id, respawnTime) => {
    const note = notes.value.find((n) => n.id === id);
    if (!note)
        return;
    note.respawnTime = respawnTime;
    note.state = "CD";
    note.onTime = null;
    note.stageTime = null;
    note.hasAlerted = false;
    await saveNoteToFirestore(note);
};
const handleUpdateNoteChannel = async (id, newChannel) => {
    const note = notes.value.find((n) => n.id === id);
    if (!note)
        return;
    await deleteDoc(doc(saDb, "saNotes", id));
    note.channel = newChannel;
    note.id = getDocId(note.mapLevel, note.channel, note.noteText);
    await saveNoteToFirestore(note);
};
const handleToggleInputSound = (state) => {
    hasInputSoundOn.value = state;
    localStorage.setItem(SA_INPUT_SOUND_STORAGE_KEY, JSON.stringify(state));
};
const handleUpdateNoteSound = (id, hasSound) => {
    const note = notes.value.find((n) => n.id === id);
    if (!note)
        return;
    note.hasSound = hasSound;
    setNoteSoundSetting(id, hasSound);
};
const handleUpdateAllNoteSound = (hasSound) => {
    if (notes.value.length === 0)
        return;
    notes.value.forEach((note) => {
        note.hasSound = hasSound;
        setNoteSoundSetting(note.id, hasSound);
    });
};
const handleUpdateMapStar = (mapLevel) => {
    const map = maps.value.find((m) => m.level === mapLevel);
    if (!map)
        return;
    map.isStarred = !map.isStarred;
    localStorage.setItem("sa-mapData", JSON.stringify(maps.value));
};
const handleShowUpdateDialog = (noteId) => {
    const note = notes.value.find((n) => n.id === noteId);
    if (!note)
        return;
    currentNoteToUpdate.value = note;
    showUpdateDialog.value = true;
    updateMapName.value = `Lv. ${note.mapLevel} ${note.noteText} Ch. ${note.channel}`;
};
const toggleSort = () => {
    currentSortMode.value = currentSortMode.value === "time" ? "map" : "time";
    notes.value.sort(sortNotesArray);
};
const verifyPassword = async () => {
    if (!passwordInput.value.trim())
        return;
    isCheckingAuth.value = true;
    try {
        if (!isFirebaseConfigured || !saAuth) {
            ElMessage.error("Firebase 設定不完整，無法進行線上驗證。");
            return;
        }
        if (!SA_AUTH_EMAIL) {
            ElMessage.error("尚未設定 VITE_SA_AUTH_EMAIL");
            return;
        }
        await signInWithEmailAndPassword(saAuth, SA_AUTH_EMAIL, passwordInput.value);
        passwordInput.value = "";
        ElMessage.success("驗證成功");
    }
    catch (error) {
        const message = getAuthErrorMessage(error?.code);
        ElMessage.error(message);
    }
    finally {
        isCheckingAuth.value = false;
    }
};
const getAuthErrorMessage = (code) => {
    switch (code) {
        case "auth/invalid-credential":
        case "auth/wrong-password":
            return "密碼錯誤，請再試一次。";
        case "auth/user-not-found":
            return "驗證帳號不存在，請檢查 VITE_SA_AUTH_EMAIL。";
        case "auth/too-many-requests":
            return "嘗試次數過多，請稍後再試。";
        case "auth/network-request-failed":
            return "網路連線失敗，請檢查網路後再試。";
        default:
            return "登入失敗，請稍後再試。";
    }
};
function getClientId() {
    const key = "sa-client-id";
    const existing = localStorage.getItem(key);
    if (existing)
        return existing;
    const created = uuidv4();
    localStorage.setItem(key, created);
    return created;
}
onMounted(() => {
    const savedTheme = localStorage.getItem("theme");
    isDark.value =
        savedTheme === "dark" ||
            (savedTheme === null &&
                window.matchMedia("(prefers-color-scheme: dark)").matches);
    if (isDark.value) {
        document.documentElement.classList.add("dark");
    }
    else {
        document.documentElement.classList.remove("dark");
    }
    const urlParams = new URLSearchParams(window.location.search);
    const settingsParam = urlParams.get("setting");
    if (settingsParam) {
        const enabledFeatures = settingsParam.split(",");
        featureFlags.value.nosec = enabledFeatures.includes("nosec");
        featureFlags.value.pic = enabledFeatures.includes("pic");
        featureFlags.value.en = enabledFeatures.includes("en");
    }
    const savedMaps = localStorage.getItem("sa-mapData");
    if (savedMaps)
        maps.value = JSON.parse(savedMaps);
    const savedInputSound = localStorage.getItem(SA_INPUT_SOUND_STORAGE_KEY);
    if (savedInputSound !== null) {
        hasInputSoundOn.value = savedInputSound === "true";
    }
    if (isFirebaseConfigured && saAuth) {
        unsubscribeAuth = onAuthStateChanged(saAuth, (user) => {
            isVerified.value = !!user;
            if (user) {
                if (!unsubscribeNotes)
                    subscribeNotes();
            }
            else if (unsubscribeNotes) {
                unsubscribeNotes();
                unsubscribeNotes = null;
                notes.value = [];
            }
        });
    }
    sortTimer = window.setInterval(() => {
        notes.value.sort(sortNotesArray);
    }, 1000);
});
onUnmounted(() => {
    if (unsubscribeNotes)
        unsubscribeNotes();
    if (unsubscribeAuth)
        unsubscribeAuth();
    if (sortTimer)
        window.clearInterval(sortTimer);
});
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_elements;
let __VLS_components;
let __VLS_directives;
// CSS variable injection 
// CSS variable injection end 
const __VLS_0 = {}.ElContainer;
/** @type {[typeof __VLS_components.ElContainer, typeof __VLS_components.elContainer, typeof __VLS_components.ElContainer, typeof __VLS_components.elContainer, ]} */ ;
// @ts-ignore
ElContainer;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent(__VLS_0, new __VLS_0({
    ...{ class: "app-container" },
}));
const __VLS_2 = __VLS_1({
    ...{ class: "app-container" },
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
var __VLS_4 = {};
const { default: __VLS_5 } = __VLS_3.slots;
const __VLS_6 = {}.ElHeader;
/** @type {[typeof __VLS_components.ElHeader, typeof __VLS_components.elHeader, typeof __VLS_components.ElHeader, typeof __VLS_components.elHeader, ]} */ ;
// @ts-ignore
ElHeader;
// @ts-ignore
const __VLS_7 = __VLS_asFunctionalComponent(__VLS_6, new __VLS_6({
    ...{ class: "app-header" },
}));
const __VLS_8 = __VLS_7({
    ...{ class: "app-header" },
}, ...__VLS_functionalComponentArgsRest(__VLS_7));
const { default: __VLS_10 } = __VLS_9.slots;
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "header-content" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({});
const __VLS_11 = {}.ElSwitch;
/** @type {[typeof __VLS_components.ElSwitch, typeof __VLS_components.elSwitch, ]} */ ;
// @ts-ignore
ElSwitch;
// @ts-ignore
const __VLS_12 = __VLS_asFunctionalComponent(__VLS_11, new __VLS_11({
    modelValue: (__VLS_ctx.isDark),
    inlinePrompt: true,
    activeIcon: (__VLS_ctx.Moon),
    inactiveIcon: (__VLS_ctx.Sunny),
    size: "large",
    ...{ class: "dark-mode-switch" },
}));
const __VLS_13 = __VLS_12({
    modelValue: (__VLS_ctx.isDark),
    inlinePrompt: true,
    activeIcon: (__VLS_ctx.Moon),
    inactiveIcon: (__VLS_ctx.Sunny),
    size: "large",
    ...{ class: "dark-mode-switch" },
}, ...__VLS_functionalComponentArgsRest(__VLS_12));
// @ts-ignore
[isDark, Moon, Sunny,];
var __VLS_9;
const __VLS_16 = {}.ElMain;
/** @type {[typeof __VLS_components.ElMain, typeof __VLS_components.elMain, typeof __VLS_components.ElMain, typeof __VLS_components.elMain, ]} */ ;
// @ts-ignore
ElMain;
// @ts-ignore
const __VLS_17 = __VLS_asFunctionalComponent(__VLS_16, new __VLS_16({
    ...{ class: "app-main" },
}));
const __VLS_18 = __VLS_17({
    ...{ class: "app-main" },
}, ...__VLS_functionalComponentArgsRest(__VLS_17));
const { default: __VLS_20 } = __VLS_19.slots;
if (!__VLS_ctx.isVerified) {
    // @ts-ignore
    [isVerified,];
    const __VLS_21 = {}.ElCard;
    /** @type {[typeof __VLS_components.ElCard, typeof __VLS_components.elCard, typeof __VLS_components.ElCard, typeof __VLS_components.elCard, ]} */ ;
    // @ts-ignore
    ElCard;
    // @ts-ignore
    const __VLS_22 = __VLS_asFunctionalComponent(__VLS_21, new __VLS_21({
        ...{ class: "auth-card" },
    }));
    const __VLS_23 = __VLS_22({
        ...{ class: "auth-card" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_22));
    const { default: __VLS_25 } = __VLS_24.slots;
    __VLS_asFunctionalElement(__VLS_elements.h3, __VLS_elements.h3)({});
    __VLS_asFunctionalElement(__VLS_elements.p, __VLS_elements.p)({
        ...{ class: "auth-desc" },
    });
    const __VLS_26 = {}.ElInput;
    /** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
    // @ts-ignore
    ElInput;
    // @ts-ignore
    const __VLS_27 = __VLS_asFunctionalComponent(__VLS_26, new __VLS_26({
        ...{ 'onKeyup': {} },
        modelValue: (__VLS_ctx.passwordInput),
        type: "password",
        showPassword: true,
        placeholder: "請輸入密碼",
    }));
    const __VLS_28 = __VLS_27({
        ...{ 'onKeyup': {} },
        modelValue: (__VLS_ctx.passwordInput),
        type: "password",
        showPassword: true,
        placeholder: "請輸入密碼",
    }, ...__VLS_functionalComponentArgsRest(__VLS_27));
    let __VLS_30;
    let __VLS_31;
    const __VLS_32 = ({ keyup: {} },
        { onKeyup: (__VLS_ctx.verifyPassword) });
    // @ts-ignore
    [passwordInput, verifyPassword,];
    var __VLS_29;
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "auth-actions" },
    });
    const __VLS_34 = {}.ElButton;
    /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
    // @ts-ignore
    ElButton;
    // @ts-ignore
    const __VLS_35 = __VLS_asFunctionalComponent(__VLS_34, new __VLS_34({
        ...{ 'onClick': {} },
        type: "primary",
        loading: (__VLS_ctx.isCheckingAuth),
    }));
    const __VLS_36 = __VLS_35({
        ...{ 'onClick': {} },
        type: "primary",
        loading: (__VLS_ctx.isCheckingAuth),
    }, ...__VLS_functionalComponentArgsRest(__VLS_35));
    let __VLS_38;
    let __VLS_39;
    const __VLS_40 = ({ click: {} },
        { onClick: (__VLS_ctx.verifyPassword) });
    const { default: __VLS_41 } = __VLS_37.slots;
    // @ts-ignore
    [verifyPassword, isCheckingAuth,];
    var __VLS_37;
    if (!__VLS_ctx.isFirebaseConfigured) {
        // @ts-ignore
        [isFirebaseConfigured,];
        __VLS_asFunctionalElement(__VLS_elements.p, __VLS_elements.p)({
            ...{ class: "auth-warning" },
        });
    }
    var __VLS_24;
}
else {
    const __VLS_42 = {}.ElAlert;
    /** @type {[typeof __VLS_components.ElAlert, typeof __VLS_components.elAlert, ]} */ ;
    // @ts-ignore
    ElAlert;
    // @ts-ignore
    const __VLS_43 = __VLS_asFunctionalComponent(__VLS_42, new __VLS_42({
        title: "社恐收容所 共編頁面：更新會即時同步給所有開啟此頁的人",
        type: "success",
        closable: (false),
        showIcon: true,
        ...{ class: "sync-tip" },
    }));
    const __VLS_44 = __VLS_43({
        title: "社恐收容所 共編頁面：更新會即時同步給所有開啟此頁的人",
        type: "success",
        closable: (false),
        showIcon: true,
        ...{ class: "sync-tip" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_43));
    /** @type {[typeof NoteInput, ]} */ ;
    // @ts-ignore
    const __VLS_47 = __VLS_asFunctionalComponent(NoteInput, new NoteInput({
        ...{ 'onAddNote': {} },
        ...{ 'onUpdateMapStar': {} },
        hasSound: (__VLS_ctx.hasInputSoundOn),
        maps: (__VLS_ctx.maps),
    }));
    const __VLS_48 = __VLS_47({
        ...{ 'onAddNote': {} },
        ...{ 'onUpdateMapStar': {} },
        hasSound: (__VLS_ctx.hasInputSoundOn),
        maps: (__VLS_ctx.maps),
    }, ...__VLS_functionalComponentArgsRest(__VLS_47));
    let __VLS_50;
    let __VLS_51;
    const __VLS_52 = ({ addNote: {} },
        { onAddNote: (__VLS_ctx.handleAddNewNote) });
    const __VLS_53 = ({ updateMapStar: {} },
        { onUpdateMapStar: (__VLS_ctx.handleUpdateMapStar) });
    // @ts-ignore
    [hasInputSoundOn, maps, handleAddNewNote, handleUpdateMapStar,];
    var __VLS_49;
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "list-card-container" },
    });
    /** @type {[typeof NoteList, ]} */ ;
    // @ts-ignore
    const __VLS_55 = __VLS_asFunctionalComponent(NoteList, new NoteList({
        ...{ 'onDeleteNote': {} },
        ...{ 'onClearNotes': {} },
        ...{ 'onToggleSort': {} },
        ...{ 'onUpdateNoteStatus': {} },
        ...{ 'onUpdateNoteChannel': {} },
        ...{ 'onUpdateNoteSound': {} },
        ...{ 'onUpdateAllNoteSound': {} },
        ...{ 'onToggleInputSound': {} },
        ...{ 'onUpdateMapStar': {} },
        ...{ 'onShowUpdateDialog': {} },
        notes: (__VLS_ctx.notes),
        currentSortMode: (__VLS_ctx.currentSortMode),
        maps: (__VLS_ctx.maps),
        mapImageCache: (__VLS_ctx.mapImageCache),
    }));
    const __VLS_56 = __VLS_55({
        ...{ 'onDeleteNote': {} },
        ...{ 'onClearNotes': {} },
        ...{ 'onToggleSort': {} },
        ...{ 'onUpdateNoteStatus': {} },
        ...{ 'onUpdateNoteChannel': {} },
        ...{ 'onUpdateNoteSound': {} },
        ...{ 'onUpdateAllNoteSound': {} },
        ...{ 'onToggleInputSound': {} },
        ...{ 'onUpdateMapStar': {} },
        ...{ 'onShowUpdateDialog': {} },
        notes: (__VLS_ctx.notes),
        currentSortMode: (__VLS_ctx.currentSortMode),
        maps: (__VLS_ctx.maps),
        mapImageCache: (__VLS_ctx.mapImageCache),
    }, ...__VLS_functionalComponentArgsRest(__VLS_55));
    let __VLS_58;
    let __VLS_59;
    const __VLS_60 = ({ deleteNote: {} },
        { onDeleteNote: (__VLS_ctx.handleDeleteNote) });
    const __VLS_61 = ({ clearNotes: {} },
        { onClearNotes: (__VLS_ctx.handleClearAllNotes) });
    const __VLS_62 = ({ toggleSort: {} },
        { onToggleSort: (__VLS_ctx.toggleSort) });
    const __VLS_63 = ({ updateNoteStatus: {} },
        { onUpdateNoteStatus: (__VLS_ctx.handleUpdateNoteStatus) });
    const __VLS_64 = ({ updateNoteChannel: {} },
        { onUpdateNoteChannel: (__VLS_ctx.handleUpdateNoteChannel) });
    const __VLS_65 = ({ updateNoteSound: {} },
        { onUpdateNoteSound: (__VLS_ctx.handleUpdateNoteSound) });
    const __VLS_66 = ({ updateAllNoteSound: {} },
        { onUpdateAllNoteSound: (__VLS_ctx.handleUpdateAllNoteSound) });
    const __VLS_67 = ({ toggleInputSound: {} },
        { onToggleInputSound: (__VLS_ctx.handleToggleInputSound) });
    const __VLS_68 = ({ updateMapStar: {} },
        { onUpdateMapStar: (__VLS_ctx.handleUpdateMapStar) });
    const __VLS_69 = ({ showUpdateDialog: {} },
        { onShowUpdateDialog: (__VLS_ctx.handleShowUpdateDialog) });
    // @ts-ignore
    [maps, handleUpdateMapStar, notes, currentSortMode, mapImageCache, handleDeleteNote, handleClearAllNotes, toggleSort, handleUpdateNoteStatus, handleUpdateNoteChannel, handleUpdateNoteSound, handleUpdateAllNoteSound, handleToggleInputSound, handleShowUpdateDialog,];
    var __VLS_57;
    /** @type {[typeof UpdateStatusDialog, ]} */ ;
    // @ts-ignore
    const __VLS_71 = __VLS_asFunctionalComponent(UpdateStatusDialog, new UpdateStatusDialog({
        ...{ 'onUpdateNoteStatus': {} },
        ...{ 'onUpdateNoteCd': {} },
        modelValue: (__VLS_ctx.showUpdateDialog),
        currentNote: (__VLS_ctx.currentNoteToUpdate),
        showName: (__VLS_ctx.updateMapName),
    }));
    const __VLS_72 = __VLS_71({
        ...{ 'onUpdateNoteStatus': {} },
        ...{ 'onUpdateNoteCd': {} },
        modelValue: (__VLS_ctx.showUpdateDialog),
        currentNote: (__VLS_ctx.currentNoteToUpdate),
        showName: (__VLS_ctx.updateMapName),
    }, ...__VLS_functionalComponentArgsRest(__VLS_71));
    let __VLS_74;
    let __VLS_75;
    const __VLS_76 = ({ updateNoteStatus: {} },
        { onUpdateNoteStatus: (__VLS_ctx.handleUpdateNoteStatus) });
    const __VLS_77 = ({ updateNoteCd: {} },
        { onUpdateNoteCd: (__VLS_ctx.handleUpdateNoteCd) });
    // @ts-ignore
    [handleUpdateNoteStatus, showUpdateDialog, currentNoteToUpdate, updateMapName, handleUpdateNoteCd,];
    var __VLS_73;
}
var __VLS_19;
var __VLS_3;
/** @type {__VLS_StyleScopedClasses['app-container']} */ ;
/** @type {__VLS_StyleScopedClasses['app-header']} */ ;
/** @type {__VLS_StyleScopedClasses['header-content']} */ ;
/** @type {__VLS_StyleScopedClasses['dark-mode-switch']} */ ;
/** @type {__VLS_StyleScopedClasses['app-main']} */ ;
/** @type {__VLS_StyleScopedClasses['auth-card']} */ ;
/** @type {__VLS_StyleScopedClasses['auth-desc']} */ ;
/** @type {__VLS_StyleScopedClasses['auth-actions']} */ ;
/** @type {__VLS_StyleScopedClasses['auth-warning']} */ ;
/** @type {__VLS_StyleScopedClasses['sync-tip']} */ ;
/** @type {__VLS_StyleScopedClasses['list-card-container']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup: () => ({
        Sunny: Sunny,
        Moon: Moon,
        NoteInput: NoteInput,
        NoteList: NoteList,
        UpdateStatusDialog: UpdateStatusDialog,
        isFirebaseConfigured: isFirebaseConfigured,
        notes: notes,
        maps: maps,
        mapImageCache: mapImageCache,
        isDark: isDark,
        currentSortMode: currentSortMode,
        hasInputSoundOn: hasInputSoundOn,
        showUpdateDialog: showUpdateDialog,
        currentNoteToUpdate: currentNoteToUpdate,
        updateMapName: updateMapName,
        isVerified: isVerified,
        isCheckingAuth: isCheckingAuth,
        passwordInput: passwordInput,
        handleAddNewNote: handleAddNewNote,
        handleDeleteNote: handleDeleteNote,
        handleClearAllNotes: handleClearAllNotes,
        handleUpdateNoteStatus: handleUpdateNoteStatus,
        handleUpdateNoteCd: handleUpdateNoteCd,
        handleUpdateNoteChannel: handleUpdateNoteChannel,
        handleToggleInputSound: handleToggleInputSound,
        handleUpdateNoteSound: handleUpdateNoteSound,
        handleUpdateAllNoteSound: handleUpdateAllNoteSound,
        handleUpdateMapStar: handleUpdateMapStar,
        handleShowUpdateDialog: handleShowUpdateDialog,
        toggleSort: toggleSort,
        verifyPassword: verifyPassword,
    }),
});
export default (await import('vue')).defineComponent({});
; /* PartiallyEnd: #4569/main.vue */
