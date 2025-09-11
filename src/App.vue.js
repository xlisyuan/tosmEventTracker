import { ref, onMounted, watch, h } from "vue";
import { v4 as uuidv4 } from "uuid";
import NoteInput from "./components/NoteInput.vue";
import NoteList from "./components/NoteList.vue";
import UpdateStatusDialog from "./components/UpdateStatusDialog.vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { maps as originalMaps } from "./data/maps";
import packageInfo from "../package.json";
import { Sunny, Moon } from "@element-plus/icons-vue";
// --------------------- 主題模式狀態 ---------------------
const isDark = ref(false);
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
// --------------------- 地圖與圖片快取 ---------------------
const savedMaps = localStorage.getItem("mapData");
const maps = ref(savedMaps ? JSON.parse(savedMaps) : [...originalMaps]);
if (!savedMaps) {
    localStorage.setItem("mapData", JSON.stringify(originalMaps));
}
// 用來快取已載入的圖片路徑
const mapImageCache = ref({});
// 獨立的圖片載入函式
const loadMapImage = async (noteText) => {
    const mapData = maps.value.find((m) => m.name === noteText);
    if (mapData?.imagePath && !mapImageCache.value[mapData.name]) {
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
const activeIndex = ref("0");
const notes = ref([]);
const currentSortMode = ref("time");
const ON_TIME_LIMIT_MS = 30 * 60 * 1000;
const hasInputSoundOn = ref(true);
const importExportData = ref("");
const showUpdateDialog = ref(false);
const currentNoteToUpdate = ref(null);
const handleShowUpdateDialog = (noteId) => {
    const note = notes.value.find((n) => n.id === noteId);
    if (note) {
        currentNoteToUpdate.value = note;
        showUpdateDialog.value = true;
    }
};
const toggleSort = () => {
    currentSortMode.value = currentSortMode.value === "time" ? "map" : "time";
    notes.value.sort(sortNotesArray);
};
const loadNotes = () => {
    const savedNotes = localStorage.getItem("notes");
    if (savedNotes) {
        notes.value = JSON.parse(savedNotes).map((note) => {
            const mapData = maps.value.find((m) => m.level === note.mapLevel && m.name === note.noteText);
            if (mapData) {
                return {
                    ...note,
                    isStarred: mapData.isStarred,
                    noteText: mapData.name,
                    maxStages: mapData.maxStages,
                    // 如果 note 物件沒有 imagePath，則在這裡添加
                    imagePath: note.imagePath || mapData.imagePath,
                };
            }
            return note;
        });
    }
};
const saveNotes = () => {
    localStorage.setItem("notes", JSON.stringify(notes.value));
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
        id: uuidv4(),
        noteText: mapData.name,
        isStarred: mapData.isStarred,
        hasSound: newNote.hasSound,
        maxStages: mapData.maxStages,
    };
    notes.value.forEach((note) => {
        if (note.mapLevel === finalNote.mapLevel &&
            note.noteText === finalNote.noteText &&
            note.channel === finalNote.channel) {
            note.isWarning = true;
        }
        else {
            note.isWarning = false;
        }
    });
    notes.value.unshift(finalNote);
    notes.value.sort(sortNotesArray);
    saveNotes();
    ElMessage({
        type: "success",
        message: `記錄新增成功! ${finalNote.noteText} 分流: ${finalNote.channel}`,
    });
};
const handleDeleteNote = (id) => {
    const index = notes.value.findIndex((note) => note.id === id);
    if (index !== -1) {
        notes.value.splice(index, 1);
        saveNotes();
        ElMessage({
            type: "success",
            message: "記錄已刪除",
        });
    }
};
const handleClearAllNotes = () => {
    notes.value = [];
    saveNotes();
};
const getNoteStateCategory = (state) => {
    if (state.toLowerCase() === "on")
        return "ON";
    if (state.includes("_"))
        return "STAGE";
    return "CD";
};
const sortNotesArray = (a, b) => {
    const now = Date.now();
    const aStateCategory = getNoteStateCategory(a.state);
    const bStateCategory = getNoteStateCategory(b.state);
    if (currentSortMode.value === "map") {
        // 優先依照地圖等級降冪排序 (由大到小)
        if (a.mapLevel !== b.mapLevel) {
            return b.mapLevel - a.mapLevel;
        }
        // 地圖等級相同時，依照分流升冪排序 (由小到大)
        if (a.channel !== b.channel) {
            return a.channel - b.channel;
        }
    }
    // 檢查 ON 的時間限制
    const aIsOnOverLimit = aStateCategory === "ON" && now - (a.onTime || now) > ON_TIME_LIMIT_MS;
    const bIsOnOverLimit = bStateCategory === "ON" && now - (b.onTime || now) > ON_TIME_LIMIT_MS;
    // 將 ON 超過時間限制的項目排在最後
    if (aIsOnOverLimit && !bIsOnOverLimit)
        return 1;
    if (!aIsOnOverLimit && bIsOnOverLimit)
        return -1;
    // 依據類別進行排序
    const stateOrder = { ON: 1, STAGE: 2, CD: 3 };
    if (stateOrder[aStateCategory] !==
        stateOrder[bStateCategory]) {
        return (stateOrder[aStateCategory] -
            stateOrder[bStateCategory]);
    }
    // 在同一個狀態類別內，再依時間或階段排序
    if (aStateCategory === "ON") {
        return (a.onTime || 0) - (b.onTime || 0); // ON 狀態：ON 最久的排最前
    }
    else if (aStateCategory === "STAGE") {
        const aStage = parseInt(a.state.replace("STAGE_", ""), 10);
        const bStage = parseInt(b.state.replace("STAGE_", ""), 10);
        return bStage - aStage; // STAGE 狀態：階段號碼大的排最前
    }
    else if (aStateCategory === "CD") {
        // CD 狀態：CD 越短的排越前
        return (a.respawnTime || 0) - (b.respawnTime || 0);
    }
    return 0;
};
const handleUpdateNoteChannel = (id, newChannel) => {
    const noteToUpdate = notes.value.find((note) => note.id === id);
    if (noteToUpdate) {
        noteToUpdate.channel = newChannel;
    }
    saveNotes();
};
const handleUpdateNoteStatus = (id, newState, newTime) => {
    const noteToUpdate = notes.value.find((note) => note.id === id);
    if (noteToUpdate) {
        noteToUpdate.state = newState;
        noteToUpdate.onTime = newTime;
        noteToUpdate.hasAlerted = false;
        if (newState === "CD") {
            const map = maps.value.find((m) => m.level === noteToUpdate.mapLevel);
            if (map) {
                noteToUpdate.respawnTime = Date.now() + map.respawnTime * 1000;
            }
        }
        notes.value.sort(sortNotesArray);
    }
    saveNotes();
};
const handleUpdateNoteCd = (id, respawnTime) => {
    const note = notes.value.find((n) => n.id === id);
    if (note) {
        note.respawnTime = respawnTime;
        note.state = "CD";
        note.onTime = null;
        note.hasAlerted = false;
        note.isWarning = false;
        saveNotes();
    }
};
const handleToggleInputSound = (state) => {
    hasInputSoundOn.value = state;
};
const handleUpdateMapStar = (mapLevel) => {
    const map = maps.value.find((m) => m.level === mapLevel);
    if (map) {
        map.isStarred = !map.isStarred;
        localStorage.setItem("mapData", JSON.stringify(maps.value));
    }
};
const exportNotes = async () => {
    const exportedNotes = notes.value.map((note) => ({
        mapLevel: note.mapLevel,
        channel: note.channel,
        onTime: note.onTime,
        respawnTime: note.respawnTime,
        state: note.state,
        noteText: note.noteText,
    }));
    // importExportData.value = JSON.stringify(exportedNotes, null, 2);
    importExportData.value = JSON.stringify(exportedNotes);
    try {
        // 將 JSON 字串複製到剪貼簿
        await navigator.clipboard.writeText(importExportData.value);
        // 複製成功時跳出提示
        ElMessage({
            type: "success",
            message: "記錄已匯出並複製到剪貼簿。",
        });
    }
    catch (err) {
        // 複製失敗時（例如使用者拒絕授權），跳出警告
        ElMessage({
            type: "warning",
            message: "無法自動複製到剪貼簿，請手動複製上方文字。",
        });
        console.error("Failed to copy notes to clipboard: ", err);
    }
};
const handleImportClick = async () => {
    if (!importExportData.value) {
        ElMessage({ type: "warning", message: "請先貼上要匯入的記錄。" });
        return;
    }
    try {
        const importedNotes = JSON.parse(importExportData.value);
        if (!Array.isArray(importedNotes) ||
            importedNotes.some((n) => !n.mapLevel || !n.channel)) {
            ElMessage({ type: "error", message: "匯入的資料格式不正確。" });
            return;
        }
        // 預載入圖片
        for (const note of importedNotes) {
            await loadMapImage(note.noteText);
        }
        // 在建立 Map 時將 noteText 納入鍵中
        const currentNotesMap = new Map(notes.value.map((note) => [
            `${note.mapLevel}-${note.channel}-${note.noteText}`,
            note,
        ]));
        const nonDuplicateNotes = [];
        const duplicateNotes = [];
        importedNotes.forEach((importedNote) => {
            const mapData = maps.value.find((m) => m.level === importedNote.mapLevel && m.name === importedNote.noteText);
            const isExpired = importedNote.respawnTime <= Date.now();
            const processedNote = {
                ...importedNote,
                id: uuidv4(),
                hasSound: hasInputSoundOn.value,
                isStarred: mapData ? mapData.isStarred : false,
                onTime: importedNote.onTime || null,
                respawnTime: importedNote.respawnTime || null,
                hasAlerted: isExpired,
                maxStages: mapData ? mapData.maxStages : 0,
            };
            // 在判斷重複時將 noteText 納入鍵中
            const existingKey = `${importedNote.mapLevel}-${importedNote.channel}-${importedNote.noteText}`;
            const existingNote = currentNotesMap.get(existingKey);
            if (existingNote) {
                duplicateNotes.push({ newNote: processedNote, oldNote: existingNote });
            }
            else {
                nonDuplicateNotes.push(processedNote);
            }
        });
        if (duplicateNotes.length > 0) {
            ElMessageBox({
                title: "發現重複的記錄",
                message: h("div", null, [
                    h("p", `本次匯入共發現 ${duplicateNotes.length} 筆重複記錄。`),
                    h("ul", {
                        style: "max-height: 200px; overflow-y: auto; padding-left: 20px;",
                    }, duplicateNotes.map((item) => h("li", `地圖: ${item.newNote.mapLevel} - ${item.newNote.noteText} 分流: ${item.newNote.channel}`))),
                    h("p", "您希望如何處理這些重複項目？"),
                ]),
                showCancelButton: true,
                confirmButtonText: "一鍵覆蓋",
                cancelButtonText: "全部跳過",
                distinguishCancelAndClose: true,
            })
                .then((action) => {
                if (action === "confirm") {
                    const finalNotesMap = new Map(notes.value.map((note) => [
                        `${note.mapLevel}-${note.channel}-${note.noteText}`,
                        note,
                    ]));
                    duplicateNotes.forEach((item) => finalNotesMap.set(`${item.newNote.mapLevel}-${item.newNote.channel}-${item.newNote.noteText}`, item.newNote));
                    const finalNotes = [
                        ...finalNotesMap.values(),
                        ...nonDuplicateNotes,
                    ];
                    notes.value = finalNotes;
                    notes.value.sort(sortNotesArray);
                    saveNotes();
                    ElMessage({
                        type: "success",
                        message: `成功覆蓋 ${duplicateNotes.length} 筆並新增 ${nonDuplicateNotes.length} 筆記錄。`,
                    });
                }
                else if (action === "cancel") {
                    const finalNotes = [...notes.value, ...nonDuplicateNotes];
                    notes.value = finalNotes;
                    notes.value.sort(sortNotesArray);
                    saveNotes();
                    ElMessage({
                        type: "success",
                        message: `成功新增 ${nonDuplicateNotes.length} 筆記錄。`,
                    });
                }
            })
                .catch(() => {
                ElMessage({ type: "info", message: "已取消匯入。" });
            });
        }
        else {
            notes.value = [...notes.value, ...nonDuplicateNotes];
            notes.value.sort(sortNotesArray);
            saveNotes();
            ElMessage({
                type: "success",
                message: `成功新增 ${nonDuplicateNotes.length} 筆記錄。`,
            });
        }
    }
    catch (e) {
        ElMessage({ type: "error", message: "匯入失敗，請檢查格式。" });
    }
};
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
    loadNotes();
    // 確保只更新必要的欄位，並保留使用者設定
    if (notes.value.length > 0) {
        // 頁面載入時，為已存在的記錄載入圖片
        notes.value.forEach((note) => {
            loadMapImage(note.noteText);
        });
    }
    setInterval(() => {
        notes.value.sort(sortNotesArray);
    }, 1000);
    console.log(`版本：v${packageInfo.version}`);
});
watch(notes, saveNotes, { deep: true });
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
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "header-left" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "header-right" },
});
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
/** @type {[typeof NoteInput, ]} */ ;
// @ts-ignore
const __VLS_21 = __VLS_asFunctionalComponent(NoteInput, new NoteInput({
    ...{ 'onAddNote': {} },
    ...{ 'onUpdateMapStar': {} },
    hasSound: (__VLS_ctx.hasInputSoundOn),
    maps: (__VLS_ctx.maps),
}));
const __VLS_22 = __VLS_21({
    ...{ 'onAddNote': {} },
    ...{ 'onUpdateMapStar': {} },
    hasSound: (__VLS_ctx.hasInputSoundOn),
    maps: (__VLS_ctx.maps),
}, ...__VLS_functionalComponentArgsRest(__VLS_21));
let __VLS_24;
let __VLS_25;
const __VLS_26 = ({ addNote: {} },
    { onAddNote: (__VLS_ctx.handleAddNewNote) });
const __VLS_27 = ({ updateMapStar: {} },
    { onUpdateMapStar: (__VLS_ctx.handleUpdateMapStar) });
// @ts-ignore
[hasInputSoundOn, maps, handleAddNewNote, handleUpdateMapStar,];
var __VLS_23;
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "list-card-container" },
});
/** @type {[typeof NoteList, ]} */ ;
// @ts-ignore
const __VLS_29 = __VLS_asFunctionalComponent(NoteList, new NoteList({
    ...{ 'onDeleteNote': {} },
    ...{ 'onClearNotes': {} },
    ...{ 'onToggleSort': {} },
    ...{ 'onUpdateNoteStatus': {} },
    ...{ 'onUpdateNoteChannel': {} },
    ...{ 'onToggleInputSound': {} },
    ...{ 'onUpdateMapStar': {} },
    ...{ 'onShowUpdateDialog': {} },
    notes: (__VLS_ctx.notes),
    currentSortMode: (__VLS_ctx.currentSortMode),
    maps: (__VLS_ctx.maps),
    mapImageCache: (__VLS_ctx.mapImageCache),
}));
const __VLS_30 = __VLS_29({
    ...{ 'onDeleteNote': {} },
    ...{ 'onClearNotes': {} },
    ...{ 'onToggleSort': {} },
    ...{ 'onUpdateNoteStatus': {} },
    ...{ 'onUpdateNoteChannel': {} },
    ...{ 'onToggleInputSound': {} },
    ...{ 'onUpdateMapStar': {} },
    ...{ 'onShowUpdateDialog': {} },
    notes: (__VLS_ctx.notes),
    currentSortMode: (__VLS_ctx.currentSortMode),
    maps: (__VLS_ctx.maps),
    mapImageCache: (__VLS_ctx.mapImageCache),
}, ...__VLS_functionalComponentArgsRest(__VLS_29));
let __VLS_32;
let __VLS_33;
const __VLS_34 = ({ deleteNote: {} },
    { onDeleteNote: (__VLS_ctx.handleDeleteNote) });
const __VLS_35 = ({ clearNotes: {} },
    { onClearNotes: (__VLS_ctx.handleClearAllNotes) });
const __VLS_36 = ({ toggleSort: {} },
    { onToggleSort: (__VLS_ctx.toggleSort) });
const __VLS_37 = ({ updateNoteStatus: {} },
    { onUpdateNoteStatus: (__VLS_ctx.handleUpdateNoteStatus) });
const __VLS_38 = ({ updateNoteChannel: {} },
    { onUpdateNoteChannel: (__VLS_ctx.handleUpdateNoteChannel) });
const __VLS_39 = ({ toggleInputSound: {} },
    { onToggleInputSound: (__VLS_ctx.handleToggleInputSound) });
const __VLS_40 = ({ updateMapStar: {} },
    { onUpdateMapStar: (__VLS_ctx.handleUpdateMapStar) });
const __VLS_41 = ({ showUpdateDialog: {} },
    { onShowUpdateDialog: (__VLS_ctx.handleShowUpdateDialog) });
// @ts-ignore
[maps, handleUpdateMapStar, notes, currentSortMode, mapImageCache, handleDeleteNote, handleClearAllNotes, toggleSort, handleUpdateNoteStatus, handleUpdateNoteChannel, handleToggleInputSound, handleShowUpdateDialog,];
var __VLS_31;
/** @type {[typeof UpdateStatusDialog, ]} */ ;
// @ts-ignore
const __VLS_43 = __VLS_asFunctionalComponent(UpdateStatusDialog, new UpdateStatusDialog({
    ...{ 'onUpdateNoteStatus': {} },
    ...{ 'onUpdateNoteCd': {} },
    modelValue: (__VLS_ctx.showUpdateDialog),
    currentNote: (__VLS_ctx.currentNoteToUpdate),
}));
const __VLS_44 = __VLS_43({
    ...{ 'onUpdateNoteStatus': {} },
    ...{ 'onUpdateNoteCd': {} },
    modelValue: (__VLS_ctx.showUpdateDialog),
    currentNote: (__VLS_ctx.currentNoteToUpdate),
}, ...__VLS_functionalComponentArgsRest(__VLS_43));
let __VLS_46;
let __VLS_47;
const __VLS_48 = ({ updateNoteStatus: {} },
    { onUpdateNoteStatus: (__VLS_ctx.handleUpdateNoteStatus) });
const __VLS_49 = ({ updateNoteCd: {} },
    { onUpdateNoteCd: (__VLS_ctx.handleUpdateNoteCd) });
// @ts-ignore
[handleUpdateNoteStatus, showUpdateDialog, currentNoteToUpdate, handleUpdateNoteCd,];
var __VLS_45;
var __VLS_19;
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "import-export-section" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "import-export-buttons" },
});
const __VLS_51 = {}.ElButton;
/** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
// @ts-ignore
ElButton;
// @ts-ignore
const __VLS_52 = __VLS_asFunctionalComponent(__VLS_51, new __VLS_51({
    ...{ 'onClick': {} },
    type: "primary",
}));
const __VLS_53 = __VLS_52({
    ...{ 'onClick': {} },
    type: "primary",
}, ...__VLS_functionalComponentArgsRest(__VLS_52));
let __VLS_55;
let __VLS_56;
const __VLS_57 = ({ click: {} },
    { onClick: (__VLS_ctx.exportNotes) });
const { default: __VLS_58 } = __VLS_54.slots;
// @ts-ignore
[exportNotes,];
var __VLS_54;
const __VLS_59 = {}.ElButton;
/** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
// @ts-ignore
ElButton;
// @ts-ignore
const __VLS_60 = __VLS_asFunctionalComponent(__VLS_59, new __VLS_59({
    ...{ 'onClick': {} },
    type: "success",
}));
const __VLS_61 = __VLS_60({
    ...{ 'onClick': {} },
    type: "success",
}, ...__VLS_functionalComponentArgsRest(__VLS_60));
let __VLS_63;
let __VLS_64;
const __VLS_65 = ({ click: {} },
    { onClick: (__VLS_ctx.handleImportClick) });
const { default: __VLS_66 } = __VLS_62.slots;
// @ts-ignore
[handleImportClick,];
var __VLS_62;
const __VLS_67 = {}.ElInput;
/** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
// @ts-ignore
ElInput;
// @ts-ignore
const __VLS_68 = __VLS_asFunctionalComponent(__VLS_67, new __VLS_67({
    modelValue: (__VLS_ctx.importExportData),
    type: "textarea",
    rows: (5),
    placeholder: "匯出的記錄會顯示在此處，或在此處貼上要匯入的資料",
}));
const __VLS_69 = __VLS_68({
    modelValue: (__VLS_ctx.importExportData),
    type: "textarea",
    rows: (5),
    placeholder: "匯出的記錄會顯示在此處，或在此處貼上要匯入的資料",
}, ...__VLS_functionalComponentArgsRest(__VLS_68));
// @ts-ignore
[importExportData,];
var __VLS_3;
/** @type {__VLS_StyleScopedClasses['app-container']} */ ;
/** @type {__VLS_StyleScopedClasses['app-header']} */ ;
/** @type {__VLS_StyleScopedClasses['header-content']} */ ;
/** @type {__VLS_StyleScopedClasses['header-left']} */ ;
/** @type {__VLS_StyleScopedClasses['header-right']} */ ;
/** @type {__VLS_StyleScopedClasses['dark-mode-switch']} */ ;
/** @type {__VLS_StyleScopedClasses['app-main']} */ ;
/** @type {__VLS_StyleScopedClasses['list-card-container']} */ ;
/** @type {__VLS_StyleScopedClasses['import-export-section']} */ ;
/** @type {__VLS_StyleScopedClasses['import-export-buttons']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup: () => ({
        NoteInput: NoteInput,
        NoteList: NoteList,
        UpdateStatusDialog: UpdateStatusDialog,
        Sunny: Sunny,
        Moon: Moon,
        isDark: isDark,
        maps: maps,
        mapImageCache: mapImageCache,
        notes: notes,
        currentSortMode: currentSortMode,
        hasInputSoundOn: hasInputSoundOn,
        importExportData: importExportData,
        showUpdateDialog: showUpdateDialog,
        currentNoteToUpdate: currentNoteToUpdate,
        handleShowUpdateDialog: handleShowUpdateDialog,
        toggleSort: toggleSort,
        handleAddNewNote: handleAddNewNote,
        handleDeleteNote: handleDeleteNote,
        handleClearAllNotes: handleClearAllNotes,
        handleUpdateNoteChannel: handleUpdateNoteChannel,
        handleUpdateNoteStatus: handleUpdateNoteStatus,
        handleUpdateNoteCd: handleUpdateNoteCd,
        handleToggleInputSound: handleToggleInputSound,
        handleUpdateMapStar: handleUpdateMapStar,
        exportNotes: exportNotes,
        handleImportClick: handleImportClick,
    }),
});
export default (await import('vue')).defineComponent({});
; /* PartiallyEnd: #4569/main.vue */
