import { ref, onMounted, watch } from "vue";
import { v4 as uuidv4 } from "uuid";
import NoteInput from "./components/NoteInput.vue";
import NoteList from "./components/NoteList.vue";
import { ElMessage } from "element-plus";
import { maps as originalMaps } from "./data/maps";
const activeIndex = ref("0");
const notes = ref([]);
const currentSortMode = ref("time");
const ON_TIME_LIMIT_MS = 30 * 60 * 1000;
const hasInputSoundOn = ref(true);
const maps = ref([...originalMaps]);
const toggleSort = () => {
    currentSortMode.value = currentSortMode.value === "time" ? "map" : "time";
    notes.value.sort(sortNotesArray);
};
const loadNotes = () => {
    const savedNotes = localStorage.getItem("notes");
    if (savedNotes) {
        notes.value = JSON.parse(savedNotes).map((note) => {
            const mapData = maps.value.find((m) => m.level === note.mapLevel);
            return { ...note, isStarred: mapData ? mapData.isStarred : false };
        });
    }
};
const saveNotes = () => {
    localStorage.setItem("notes", JSON.stringify(notes.value));
};
const handleAddNewNote = (newNote) => {
    const mapData = maps.value.find((m) => m.level === newNote.mapLevel);
    const finalNote = {
        ...newNote,
        id: uuidv4(),
        noteText: mapData ? mapData.name : newNote.noteText,
        isStarred: mapData ? mapData.isStarred : false,
        hasSound: hasInputSoundOn.value,
    };
    notes.value.unshift(finalNote);
    notes.value.sort(sortNotesArray);
    saveNotes();
    if (finalNote.hasSound) {
        new Audio("/sound/new_note.mp3").play();
    }
    ElMessage({
        type: "success",
        message: "記錄新增成功",
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
    if (state.includes("/"))
        return "STAGE";
    return "CD";
};
const sortNotesArray = (a, b) => {
    const now = Date.now();
    const aStateCategory = getNoteStateCategory(a.state);
    const bStateCategory = getNoteStateCategory(b.state);
    if (currentSortMode.value === "map") {
        const aMapName = maps.value.find((m) => m.level === a.mapLevel)?.name || "";
        const bMapName = maps.value.find((m) => m.level === b.mapLevel)?.name || "";
        return aMapName.localeCompare(bMapName);
    }
    const aIsOnOverLimit = aStateCategory === "ON" && now - (a.onTime || now) > ON_TIME_LIMIT_MS;
    const bIsOnOverLimit = bStateCategory === "ON" && now - (b.onTime || now) > ON_TIME_LIMIT_MS;
    if (aIsOnOverLimit && !bIsOnOverLimit)
        return 1;
    if (!aIsOnOverLimit && bIsOnOverLimit)
        return -1;
    const stateOrder = { ON: 1, STAGE: 2, CD: 3 };
    if (stateOrder[aStateCategory] !==
        stateOrder[bStateCategory]) {
        return (stateOrder[aStateCategory] -
            stateOrder[bStateCategory]);
    }
    if (aStateCategory === "ON") {
        return (b.onTime || 0) - (a.onTime || 0);
    }
    else if (aStateCategory === "STAGE") {
        const aStage = parseInt(a.state.replace("STAGE_", ""), 10);
        const bStage = parseInt(b.state.replace("STAGE_", ""), 10);
        return bStage - aStage;
    }
    else if (aStateCategory === "CD") {
        return (a.respawnTime || 0) - (b.respawnTime || 0);
    }
    return 0;
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
    }
    notes.value.sort(sortNotesArray);
    saveNotes();
};
const handleToggleInputSound = (state) => {
    hasInputSoundOn.value = state;
};
const handleUpdateMapStar = (mapLevel) => {
    const map = maps.value.find((m) => m.level === mapLevel);
    if (map) {
        map.isStarred = !map.isStarred;
    }
};
onMounted(() => {
    loadNotes();
    setInterval(() => {
        notes.value.sort(sortNotesArray);
    }, 1000);
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
    ...{ 'onToggleInputSound': {} },
    ...{ 'onUpdateMapStar': {} },
    notes: (__VLS_ctx.notes),
    currentSortMode: (__VLS_ctx.currentSortMode),
    maps: (__VLS_ctx.maps),
}));
const __VLS_25 = __VLS_24({
    ...{ 'onDeleteNote': {} },
    ...{ 'onClearNotes': {} },
    ...{ 'onToggleSort': {} },
    ...{ 'onUpdateNoteStatus': {} },
    ...{ 'onToggleInputSound': {} },
    ...{ 'onUpdateMapStar': {} },
    notes: (__VLS_ctx.notes),
    currentSortMode: (__VLS_ctx.currentSortMode),
    maps: (__VLS_ctx.maps),
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
const __VLS_33 = ({ toggleInputSound: {} },
    { onToggleInputSound: (__VLS_ctx.handleToggleInputSound) });
const __VLS_34 = ({ updateMapStar: {} },
    { onUpdateMapStar: (__VLS_ctx.handleUpdateMapStar) });
// @ts-ignore
[maps, handleUpdateMapStar, notes, currentSortMode, handleDeleteNote, handleClearAllNotes, toggleSort, handleUpdateNoteStatus, handleToggleInputSound,];
var __VLS_26;
var __VLS_14;
var __VLS_3;
/** @type {__VLS_StyleScopedClasses['app-container']} */ ;
/** @type {__VLS_StyleScopedClasses['app-header']} */ ;
/** @type {__VLS_StyleScopedClasses['app-main']} */ ;
/** @type {__VLS_StyleScopedClasses['list-card-container']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup: () => ({
        NoteInput: NoteInput,
        NoteList: NoteList,
        notes: notes,
        currentSortMode: currentSortMode,
        hasInputSoundOn: hasInputSoundOn,
        maps: maps,
        toggleSort: toggleSort,
        handleAddNewNote: handleAddNewNote,
        handleDeleteNote: handleDeleteNote,
        handleClearAllNotes: handleClearAllNotes,
        handleUpdateNoteStatus: handleUpdateNoteStatus,
        handleToggleInputSound: handleToggleInputSound,
        handleUpdateMapStar: handleUpdateMapStar,
    }),
});
export default (await import('vue')).defineComponent({});
; /* PartiallyEnd: #4569/main.vue */
