import { ref, onMounted, watch, h } from "vue";
import { v4 as uuidv4 } from "uuid";
import NoteInput from "./components/NoteInput.vue";
import NoteList from "./components/NoteList.vue";
import UpdateStatusDialog from "./components/UpdateStatusDialog.vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { maps as originalMaps } from "./data/maps";
import packageInfo from "../package.json";
// 嘗試從 localStorage 載入地圖資料，如果沒有則使用原始資料並存入
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
    if (mapData?.imagePath && !mapImageCache.value[mapData.level]) {
        try {
            const image = new Image();
            await new Promise((resolve, reject) => {
                image.onload = resolve;
                image.onerror = reject;
                image.src = mapData.imagePath;
            });
            mapImageCache.value[mapData.level] = mapData.imagePath;
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
    const mapData = newNote.noteText != null
        ? maps.value.find((m) => m.name === newNote.noteText)
        : maps.value.find((m) => m.level === newNote.mapLevel);
    // 圖片載入函式
    await loadMapImage(newNote.noteText);
    const finalNote = {
        ...newNote,
        id: uuidv4(),
        noteText: mapData ? mapData.name : newNote.noteText,
        isStarred: mapData ? mapData.isStarred : false,
        hasSound: newNote.hasSound,
        maxStages: mapData ? mapData.maxStages : 0,
    };
    // 在新增前，檢查是否有相同地圖和分流的項目
    notes.value.forEach((note) => {
        if (note.mapLevel === finalNote.mapLevel &&
            note.noteText === finalNote.noteText &&
            note.channel === finalNote.channel) {
            note.isWarning = true;
        }
        else {
            // 重置
            note.isWarning = false;
        }
    });
    notes.value.unshift(finalNote);
    notes.value.sort(sortNotesArray);
    saveNotes();
    const message = mapData?.name
        ? `記錄新增成功! ${mapData.name} 分流: ${finalNote.channel}`
        : `記錄新增成功!`;
    ElMessage({
        type: "success",
        message: message,
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
        return (b.onTime || 0) - (a.onTime || 0); // ON 狀態：ON 最久的排最前
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
        for (const note of importedNotes) {
            await loadMapImage(note.noteText);
        }
        const currentNotesMap = new Map(notes.value.map((note) => [`${note.mapLevel}-${note.channel}`, note]));
        const nonDuplicateNotes = [];
        const duplicateNotes = [];
        importedNotes.forEach((importedNote) => {
            const existingKey = `${importedNote.mapLevel}-${importedNote.channel}`;
            const existingNote = currentNotesMap.get(existingKey);
            const mapData = maps.value.find((m) => m.level === importedNote.mapLevel);
            const isExpired = importedNote.respawnTime <= Date.now();
            const processedNote = {
                ...importedNote,
                id: uuidv4(),
                hasSound: hasInputSoundOn.value,
                isStarred: existingNote ? existingNote.isStarred : false,
                onTime: importedNote.onTime || null,
                respawnTime: importedNote.respawnTime || null,
                hasAlerted: isExpired,
                maxStages: mapData ? mapData.maxStages : 0,
            };
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
                    }, duplicateNotes.map((item) => h("li", `地圖: ${item.newNote.mapLevel} 分流: ${item.newNote.channel}`))),
                    h("p", "您希望如何處理這些重複項目？"),
                ]),
                showCancelButton: true,
                confirmButtonText: "一鍵覆蓋",
                cancelButtonText: "全部跳過",
                distinguishCancelAndClose: true,
            })
                .then((action) => {
                if (action === "confirm") {
                    // 覆蓋模式
                    const finalNotesMap = new Map(notes.value.map((note) => [
                        `${note.mapLevel}-${note.channel}`,
                        note,
                    ]));
                    duplicateNotes.forEach((item) => finalNotesMap.set(`${item.newNote.mapLevel}-${item.newNote.channel}`, item.newNote));
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
                    // 跳過模式
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
            // 沒有重複項目，直接新增
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
const __VLS_11 = {}.ElMain;
/** @type {[typeof __VLS_components.ElMain, typeof __VLS_components.elMain, typeof __VLS_components.ElMain, typeof __VLS_components.elMain, ]} */ ;
// @ts-ignore
ElMain;
// @ts-ignore
const __VLS_12 = __VLS_asFunctionalComponent(__VLS_11, new __VLS_11({
    ...{ class: "app-main" },
}));
const __VLS_13 = __VLS_12({
    ...{ class: "app-main" },
}, ...__VLS_functionalComponentArgsRest(__VLS_12));
const { default: __VLS_15 } = __VLS_14.slots;
/** @type {[typeof NoteInput, ]} */ ;
// @ts-ignore
const __VLS_16 = __VLS_asFunctionalComponent(NoteInput, new NoteInput({
    ...{ 'onAddNote': {} },
    ...{ 'onUpdateMapStar': {} },
    hasSound: (__VLS_ctx.hasInputSoundOn),
    maps: (__VLS_ctx.maps),
}));
const __VLS_17 = __VLS_16({
    ...{ 'onAddNote': {} },
    ...{ 'onUpdateMapStar': {} },
    hasSound: (__VLS_ctx.hasInputSoundOn),
    maps: (__VLS_ctx.maps),
}, ...__VLS_functionalComponentArgsRest(__VLS_16));
let __VLS_19;
let __VLS_20;
const __VLS_21 = ({ addNote: {} },
    { onAddNote: (__VLS_ctx.handleAddNewNote) });
const __VLS_22 = ({ updateMapStar: {} },
    { onUpdateMapStar: (__VLS_ctx.handleUpdateMapStar) });
// @ts-ignore
[hasInputSoundOn, maps, handleAddNewNote, handleUpdateMapStar,];
var __VLS_18;
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "list-card-container" },
});
/** @type {[typeof NoteList, ]} */ ;
// @ts-ignore
const __VLS_24 = __VLS_asFunctionalComponent(NoteList, new NoteList({
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
const __VLS_25 = __VLS_24({
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
}, ...__VLS_functionalComponentArgsRest(__VLS_24));
let __VLS_27;
let __VLS_28;
const __VLS_29 = ({ deleteNote: {} },
    { onDeleteNote: (__VLS_ctx.handleDeleteNote) });
const __VLS_30 = ({ clearNotes: {} },
    { onClearNotes: (__VLS_ctx.handleClearAllNotes) });
const __VLS_31 = ({ toggleSort: {} },
    { onToggleSort: (__VLS_ctx.toggleSort) });
const __VLS_32 = ({ updateNoteStatus: {} },
    { onUpdateNoteStatus: (__VLS_ctx.handleUpdateNoteStatus) });
const __VLS_33 = ({ updateNoteChannel: {} },
    { onUpdateNoteChannel: (__VLS_ctx.handleUpdateNoteChannel) });
const __VLS_34 = ({ toggleInputSound: {} },
    { onToggleInputSound: (__VLS_ctx.handleToggleInputSound) });
const __VLS_35 = ({ updateMapStar: {} },
    { onUpdateMapStar: (__VLS_ctx.handleUpdateMapStar) });
const __VLS_36 = ({ showUpdateDialog: {} },
    { onShowUpdateDialog: (__VLS_ctx.handleShowUpdateDialog) });
// @ts-ignore
[maps, handleUpdateMapStar, notes, currentSortMode, mapImageCache, handleDeleteNote, handleClearAllNotes, toggleSort, handleUpdateNoteStatus, handleUpdateNoteChannel, handleToggleInputSound, handleShowUpdateDialog,];
var __VLS_26;
/** @type {[typeof UpdateStatusDialog, ]} */ ;
// @ts-ignore
const __VLS_38 = __VLS_asFunctionalComponent(UpdateStatusDialog, new UpdateStatusDialog({
    ...{ 'onUpdateNoteStatus': {} },
    ...{ 'onUpdateNoteCd': {} },
    modelValue: (__VLS_ctx.showUpdateDialog),
    currentNote: (__VLS_ctx.currentNoteToUpdate),
}));
const __VLS_39 = __VLS_38({
    ...{ 'onUpdateNoteStatus': {} },
    ...{ 'onUpdateNoteCd': {} },
    modelValue: (__VLS_ctx.showUpdateDialog),
    currentNote: (__VLS_ctx.currentNoteToUpdate),
}, ...__VLS_functionalComponentArgsRest(__VLS_38));
let __VLS_41;
let __VLS_42;
const __VLS_43 = ({ updateNoteStatus: {} },
    { onUpdateNoteStatus: (__VLS_ctx.handleUpdateNoteStatus) });
const __VLS_44 = ({ updateNoteCd: {} },
    { onUpdateNoteCd: (__VLS_ctx.handleUpdateNoteCd) });
// @ts-ignore
[handleUpdateNoteStatus, showUpdateDialog, currentNoteToUpdate, handleUpdateNoteCd,];
var __VLS_40;
var __VLS_14;
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "import-export-section" },
});
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "import-export-buttons" },
});
const __VLS_46 = {}.ElButton;
/** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
// @ts-ignore
ElButton;
// @ts-ignore
const __VLS_47 = __VLS_asFunctionalComponent(__VLS_46, new __VLS_46({
    ...{ 'onClick': {} },
    type: "primary",
}));
const __VLS_48 = __VLS_47({
    ...{ 'onClick': {} },
    type: "primary",
}, ...__VLS_functionalComponentArgsRest(__VLS_47));
let __VLS_50;
let __VLS_51;
const __VLS_52 = ({ click: {} },
    { onClick: (__VLS_ctx.exportNotes) });
const { default: __VLS_53 } = __VLS_49.slots;
// @ts-ignore
[exportNotes,];
var __VLS_49;
const __VLS_54 = {}.ElButton;
/** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
// @ts-ignore
ElButton;
// @ts-ignore
const __VLS_55 = __VLS_asFunctionalComponent(__VLS_54, new __VLS_54({
    ...{ 'onClick': {} },
    type: "success",
}));
const __VLS_56 = __VLS_55({
    ...{ 'onClick': {} },
    type: "success",
}, ...__VLS_functionalComponentArgsRest(__VLS_55));
let __VLS_58;
let __VLS_59;
const __VLS_60 = ({ click: {} },
    { onClick: (__VLS_ctx.handleImportClick) });
const { default: __VLS_61 } = __VLS_57.slots;
// @ts-ignore
[handleImportClick,];
var __VLS_57;
const __VLS_62 = {}.ElInput;
/** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
// @ts-ignore
ElInput;
// @ts-ignore
const __VLS_63 = __VLS_asFunctionalComponent(__VLS_62, new __VLS_62({
    modelValue: (__VLS_ctx.importExportData),
    type: "textarea",
    rows: (5),
    placeholder: "匯出的記錄會顯示在此處，或在此處貼上要匯入的資料",
}));
const __VLS_64 = __VLS_63({
    modelValue: (__VLS_ctx.importExportData),
    type: "textarea",
    rows: (5),
    placeholder: "匯出的記錄會顯示在此處，或在此處貼上要匯入的資料",
}, ...__VLS_functionalComponentArgsRest(__VLS_63));
// @ts-ignore
[importExportData,];
var __VLS_3;
/** @type {__VLS_StyleScopedClasses['app-container']} */ ;
/** @type {__VLS_StyleScopedClasses['app-header']} */ ;
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
