import { ref, defineProps, defineEmits, onMounted, onUnmounted, h, computed, } from "vue";
import { ElMessage, ElMessageBox, ElButton } from "element-plus";
import { StarFilled, Bell, BellFilled } from "@element-plus/icons-vue";
const props = defineProps();
const emit = defineEmits([
    "delete-note",
    "clear-notes",
    "toggle-sort",
    "update-note-status",
    "toggle-input-sound",
    "update-map-star",
]);
const currentTime = ref(Date.now());
let timer = null;
let soundChecker = null;
const showLocalTime = ref(false);
const ON_TIME_LIMIT_MS = 30 * 60 * 1000;
const isAllSoundOn = ref(true);
const toggleTimeDisplay = () => {
    showLocalTime.value = !showLocalTime.value;
};
const getMapName = (level) => {
    const map = props.maps.find((m) => m.level === level);
    return map ? map.name : "未知地圖";
};
const speakNoteDetails = (note) => {
    if ("speechSynthesis" in window) {
        const mapName = getMapName(note.mapLevel);
        const utterance = new SpeechSynthesisUtterance();
        utterance.text = `E P ${getEpisode(note.mapLevel)}, ${mapName} 分流 ${note.channel}, CD已結束`;
        utterance.lang = "zh-TW";
        window.speechSynthesis.speak(utterance);
    }
    else {
        console.error("瀏覽器不支持語音合成 API。");
    }
};
const checkAndPlaySound = () => {
    const now = Date.now();
    for (const note of props.notes) {
        if (note.state === "CD" &&
            note.hasSound &&
            !note.hasAlerted &&
            note.respawnTime <= now) {
            speakNoteDetails(note);
            note.hasAlerted = true;
        }
    }
};
const sortButtonText = computed(() => {
    if (props.currentSortMode === "time") {
        return "依地圖等級排序";
    }
    else {
        return "依時間排序";
    }
});
const toggleAllSoundButtonText = computed(() => {
    return isAllSoundOn.value ? "提示聲全關" : "提示聲全開";
});
const handleExpiredClick = (note) => {
    ElMessageBox({
        title: "更新狀態",
        message: h("div", { style: "display: flex; flex-direction: column; align-items: center;" }, [
            h("div", { style: "width: 120px; margin-bottom: 10px;" }, [
                h(ElButton, {
                    type: "success",
                    onClick: () => handleSelection("on"),
                    style: "width: 100%;",
                }, () => "ON"),
            ]),
            ...Array.from({ length: note.maxStages || 5 }, (_, i) => h("div", { style: "width: 120px; margin-bottom: 10px;" }, [
                h(ElButton, {
                    type: "",
                    onClick: () => handleSelection(`stage_${i + 1}`),
                    style: "width: 100%;",
                }, () => `階段 ${i + 1}/${note.maxStages || 5}`),
            ])),
        ]),
        showCancelButton: false,
        showConfirmButton: false,
        showClose: true,
        center: true,
    });
    const handleSelection = (action) => {
        ElMessageBox.close();
        let newState;
        let newTime = null;
        if (action === "on") {
            newState = "ON";
            newTime = Date.now();
        }
        else {
            const stage = action.split("_")[1];
            newState = `STAGE_${stage}`;
            newTime = null;
        }
        emit("update-note-status", note.id, newState, newTime);
    };
};
onMounted(() => {
    timer = setInterval(() => {
        currentTime.value = Date.now();
    }, 1000);
    soundChecker = setInterval(checkAndPlaySound, 500);
});
onUnmounted(() => {
    if (timer) {
        clearInterval(timer);
    }
    if (soundChecker) {
        clearInterval(soundChecker);
    }
});
const getEpisode = (level) => {
    const map = props.maps.find((m) => m.level === level);
    return map ? map.episode : "未知";
};
const formatTime = (seconds) => {
    if (seconds < 0)
        seconds = 0;
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`;
};
const getStatusText = (note) => {
    const now = currentTime.value;
    if (note.state === "ON") {
        const elapsedSeconds = Math.floor((now - (note.onTime || now)) / 1000);
        return `ON 已出現 ${formatTime(elapsedSeconds)}+`;
    }
    else if (note.state.startsWith("STAGE_")) {
        const stage = note.state.replace("STAGE_", "");
        return `階段 ${stage}/${note.maxStages}`;
    }
    else if (note.state === "CD") {
        const diffInSeconds = Math.floor((note.respawnTime - now) / 1000);
        if (diffInSeconds > 0) {
            if (showLocalTime.value) {
                const localTime = new Date(note.respawnTime || 0).toLocaleTimeString("zh-TW", { hour12: false });
                return `開始於 ${localTime}`;
            }
            else {
                return `CD時間 ${formatTime(diffInSeconds)}`;
            }
        }
        else {
            const elapsedSeconds = Math.abs(diffInSeconds);
            return `CD已過 ${formatTime(elapsedSeconds)}`;
        }
    }
    return "";
};
const isOverTimeLimit = (note) => {
    if (note.state === "ON" && note.onTime) {
        return currentTime.value - note.onTime > ON_TIME_LIMIT_MS;
    }
    return false;
};
const isMapStarred = (mapLevel) => {
    const map = props.maps.find((m) => m.level === mapLevel);
    return map ? map.isStarred : false;
};
const toggleStar = (mapLevel) => {
    emit("update-map-star", mapLevel);
};
const toggleSound = (note) => {
    note.hasSound = !note.hasSound;
};
const handleToggleAllSound = () => {
    isAllSoundOn.value = !isAllSoundOn.value;
    props.notes.forEach((note) => {
        note.hasSound = isAllSoundOn.value;
    });
    emit("toggle-input-sound", isAllSoundOn.value);
};
const sortNotes = () => {
    emit("toggle-sort");
};
const handleDelete = (id) => {
    emit("delete-note", id);
};
const handleClearAll = async () => {
    try {
        await ElMessageBox.confirm("確定要清空所有記錄嗎？此操作無法復原。", "警告", {
            confirmButtonText: "確定",
            cancelButtonText: "取消",
            type: "warning",
        });
        emit("clear-notes");
        ElMessage({
            type: "success",
            message: "所有記錄已清空",
        });
    }
    catch (err) {
        ElMessage({
            type: "info",
            message: "已取消清空",
        });
    }
};
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_elements;
let __VLS_components;
let __VLS_directives;
/** @type {__VLS_StyleScopedClasses['star-icon']} */ ;
// CSS variable injection 
// CSS variable injection end 
const __VLS_0 = {}.ElCard;
/** @type {[typeof __VLS_components.ElCard, typeof __VLS_components.elCard, typeof __VLS_components.ElCard, typeof __VLS_components.elCard, ]} */ ;
// @ts-ignore
ElCard;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent(__VLS_0, new __VLS_0({}));
const __VLS_2 = __VLS_1({}, ...__VLS_functionalComponentArgsRest(__VLS_1));
var __VLS_4 = {};
const { default: __VLS_5 } = __VLS_3.slots;
if (__VLS_ctx.notes.length === 0) {
    // @ts-ignore
    [notes,];
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "no-notes-message" },
    });
}
else {
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({});
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "list-actions" },
    });
    const __VLS_6 = {}.ElButton;
    /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
    // @ts-ignore
    ElButton;
    // @ts-ignore
    const __VLS_7 = __VLS_asFunctionalComponent(__VLS_6, new __VLS_6({
        ...{ 'onClick': {} },
    }));
    const __VLS_8 = __VLS_7({
        ...{ 'onClick': {} },
    }, ...__VLS_functionalComponentArgsRest(__VLS_7));
    let __VLS_10;
    let __VLS_11;
    const __VLS_12 = ({ click: {} },
        { onClick: (__VLS_ctx.sortNotes) });
    const { default: __VLS_13 } = __VLS_9.slots;
    // @ts-ignore
    [sortNotes,];
    (__VLS_ctx.sortButtonText);
    // @ts-ignore
    [sortButtonText,];
    var __VLS_9;
    const __VLS_14 = {}.ElButton;
    /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
    // @ts-ignore
    ElButton;
    // @ts-ignore
    const __VLS_15 = __VLS_asFunctionalComponent(__VLS_14, new __VLS_14({
        ...{ 'onClick': {} },
        disabled: (__VLS_ctx.notes.length === 0),
    }));
    const __VLS_16 = __VLS_15({
        ...{ 'onClick': {} },
        disabled: (__VLS_ctx.notes.length === 0),
    }, ...__VLS_functionalComponentArgsRest(__VLS_15));
    let __VLS_18;
    let __VLS_19;
    const __VLS_20 = ({ click: {} },
        { onClick: (__VLS_ctx.handleToggleAllSound) });
    const { default: __VLS_21 } = __VLS_17.slots;
    // @ts-ignore
    [notes, handleToggleAllSound,];
    (__VLS_ctx.toggleAllSoundButtonText);
    // @ts-ignore
    [toggleAllSoundButtonText,];
    var __VLS_17;
    const __VLS_22 = {}.ElButton;
    /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
    // @ts-ignore
    ElButton;
    // @ts-ignore
    const __VLS_23 = __VLS_asFunctionalComponent(__VLS_22, new __VLS_22({
        ...{ 'onClick': {} },
        type: "danger",
        disabled: (__VLS_ctx.notes.length === 0),
    }));
    const __VLS_24 = __VLS_23({
        ...{ 'onClick': {} },
        type: "danger",
        disabled: (__VLS_ctx.notes.length === 0),
    }, ...__VLS_functionalComponentArgsRest(__VLS_23));
    let __VLS_26;
    let __VLS_27;
    const __VLS_28 = ({ click: {} },
        { onClick: (__VLS_ctx.handleClearAll) });
    const { default: __VLS_29 } = __VLS_25.slots;
    // @ts-ignore
    [notes, handleClearAll,];
    var __VLS_25;
    const __VLS_30 = {}.ElRow;
    /** @type {[typeof __VLS_components.ElRow, typeof __VLS_components.elRow, typeof __VLS_components.ElRow, typeof __VLS_components.elRow, ]} */ ;
    // @ts-ignore
    ElRow;
    // @ts-ignore
    const __VLS_31 = __VLS_asFunctionalComponent(__VLS_30, new __VLS_30({
        ...{ class: "list-header" },
        gutter: (10),
    }));
    const __VLS_32 = __VLS_31({
        ...{ class: "list-header" },
        gutter: (10),
    }, ...__VLS_functionalComponentArgsRest(__VLS_31));
    const { default: __VLS_34 } = __VLS_33.slots;
    const __VLS_35 = {}.ElCol;
    /** @type {[typeof __VLS_components.ElCol, typeof __VLS_components.elCol, typeof __VLS_components.ElCol, typeof __VLS_components.elCol, ]} */ ;
    // @ts-ignore
    ElCol;
    // @ts-ignore
    const __VLS_36 = __VLS_asFunctionalComponent(__VLS_35, new __VLS_35({
        span: (1),
    }));
    const __VLS_37 = __VLS_36({
        span: (1),
    }, ...__VLS_functionalComponentArgsRest(__VLS_36));
    const __VLS_40 = {}.ElCol;
    /** @type {[typeof __VLS_components.ElCol, typeof __VLS_components.elCol, typeof __VLS_components.ElCol, typeof __VLS_components.elCol, ]} */ ;
    // @ts-ignore
    ElCol;
    // @ts-ignore
    const __VLS_41 = __VLS_asFunctionalComponent(__VLS_40, new __VLS_40({
        span: (3),
    }));
    const __VLS_42 = __VLS_41({
        span: (3),
    }, ...__VLS_functionalComponentArgsRest(__VLS_41));
    const { default: __VLS_44 } = __VLS_43.slots;
    var __VLS_43;
    const __VLS_45 = {}.ElCol;
    /** @type {[typeof __VLS_components.ElCol, typeof __VLS_components.elCol, typeof __VLS_components.ElCol, typeof __VLS_components.elCol, ]} */ ;
    // @ts-ignore
    ElCol;
    // @ts-ignore
    const __VLS_46 = __VLS_asFunctionalComponent(__VLS_45, new __VLS_45({
        span: (6),
    }));
    const __VLS_47 = __VLS_46({
        span: (6),
    }, ...__VLS_functionalComponentArgsRest(__VLS_46));
    const { default: __VLS_49 } = __VLS_48.slots;
    var __VLS_48;
    const __VLS_50 = {}.ElCol;
    /** @type {[typeof __VLS_components.ElCol, typeof __VLS_components.elCol, typeof __VLS_components.ElCol, typeof __VLS_components.elCol, ]} */ ;
    // @ts-ignore
    ElCol;
    // @ts-ignore
    const __VLS_51 = __VLS_asFunctionalComponent(__VLS_50, new __VLS_50({
        span: (3),
    }));
    const __VLS_52 = __VLS_51({
        span: (3),
    }, ...__VLS_functionalComponentArgsRest(__VLS_51));
    const { default: __VLS_54 } = __VLS_53.slots;
    var __VLS_53;
    const __VLS_55 = {}.ElCol;
    /** @type {[typeof __VLS_components.ElCol, typeof __VLS_components.elCol, typeof __VLS_components.ElCol, typeof __VLS_components.elCol, ]} */ ;
    // @ts-ignore
    ElCol;
    // @ts-ignore
    const __VLS_56 = __VLS_asFunctionalComponent(__VLS_55, new __VLS_55({
        span: (5),
    }));
    const __VLS_57 = __VLS_56({
        span: (5),
    }, ...__VLS_functionalComponentArgsRest(__VLS_56));
    const { default: __VLS_59 } = __VLS_58.slots;
    const __VLS_60 = {}.ElButton;
    /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
    // @ts-ignore
    ElButton;
    // @ts-ignore
    const __VLS_61 = __VLS_asFunctionalComponent(__VLS_60, new __VLS_60({
        ...{ 'onClick': {} },
        size: "small",
        type: "info",
    }));
    const __VLS_62 = __VLS_61({
        ...{ 'onClick': {} },
        size: "small",
        type: "info",
    }, ...__VLS_functionalComponentArgsRest(__VLS_61));
    let __VLS_64;
    let __VLS_65;
    const __VLS_66 = ({ click: {} },
        { onClick: (__VLS_ctx.toggleTimeDisplay) });
    const { default: __VLS_67 } = __VLS_63.slots;
    // @ts-ignore
    [toggleTimeDisplay,];
    var __VLS_63;
    var __VLS_58;
    const __VLS_68 = {}.ElCol;
    /** @type {[typeof __VLS_components.ElCol, typeof __VLS_components.elCol, typeof __VLS_components.ElCol, typeof __VLS_components.elCol, ]} */ ;
    // @ts-ignore
    ElCol;
    // @ts-ignore
    const __VLS_69 = __VLS_asFunctionalComponent(__VLS_68, new __VLS_68({
        span: (6),
    }));
    const __VLS_70 = __VLS_69({
        span: (6),
    }, ...__VLS_functionalComponentArgsRest(__VLS_69));
    const { default: __VLS_72 } = __VLS_71.slots;
    var __VLS_71;
    var __VLS_33;
    const __VLS_73 = {}.TransitionGroup;
    /** @type {[typeof __VLS_components.TransitionGroup, typeof __VLS_components.transitionGroup, typeof __VLS_components.TransitionGroup, typeof __VLS_components.transitionGroup, ]} */ ;
    // @ts-ignore
    TransitionGroup;
    // @ts-ignore
    const __VLS_74 = __VLS_asFunctionalComponent(__VLS_73, new __VLS_73({
        name: "list-item",
        tag: "div",
    }));
    const __VLS_75 = __VLS_74({
        name: "list-item",
        tag: "div",
    }, ...__VLS_functionalComponentArgsRest(__VLS_74));
    const { default: __VLS_77 } = __VLS_76.slots;
    for (const [note] of __VLS_getVForSourceType((__VLS_ctx.notes))) {
        // @ts-ignore
        [notes,];
        const __VLS_78 = {}.ElRow;
        /** @type {[typeof __VLS_components.ElRow, typeof __VLS_components.elRow, typeof __VLS_components.ElRow, typeof __VLS_components.elRow, ]} */ ;
        // @ts-ignore
        ElRow;
        // @ts-ignore
        const __VLS_79 = __VLS_asFunctionalComponent(__VLS_78, new __VLS_78({
            key: (note.id),
            ...{ class: "list-item" },
            ...{ class: ({ 'over-time-limit': __VLS_ctx.isOverTimeLimit(note) }) },
            gutter: (10),
        }));
        const __VLS_80 = __VLS_79({
            key: (note.id),
            ...{ class: "list-item" },
            ...{ class: ({ 'over-time-limit': __VLS_ctx.isOverTimeLimit(note) }) },
            gutter: (10),
        }, ...__VLS_functionalComponentArgsRest(__VLS_79));
        const { default: __VLS_82 } = __VLS_81.slots;
        // @ts-ignore
        [isOverTimeLimit,];
        const __VLS_83 = {}.ElCol;
        /** @type {[typeof __VLS_components.ElCol, typeof __VLS_components.elCol, typeof __VLS_components.ElCol, typeof __VLS_components.elCol, ]} */ ;
        // @ts-ignore
        ElCol;
        // @ts-ignore
        const __VLS_84 = __VLS_asFunctionalComponent(__VLS_83, new __VLS_83({
            span: (1),
        }));
        const __VLS_85 = __VLS_84({
            span: (1),
        }, ...__VLS_functionalComponentArgsRest(__VLS_84));
        const { default: __VLS_87 } = __VLS_86.slots;
        const __VLS_88 = {}.ElIcon;
        /** @type {[typeof __VLS_components.ElIcon, typeof __VLS_components.elIcon, typeof __VLS_components.ElIcon, typeof __VLS_components.elIcon, ]} */ ;
        // @ts-ignore
        ElIcon;
        // @ts-ignore
        const __VLS_89 = __VLS_asFunctionalComponent(__VLS_88, new __VLS_88({
            ...{ 'onClick': {} },
            ...{ class: "sound-icon" },
        }));
        const __VLS_90 = __VLS_89({
            ...{ 'onClick': {} },
            ...{ class: "sound-icon" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_89));
        let __VLS_92;
        let __VLS_93;
        const __VLS_94 = ({ click: {} },
            { onClick: (...[$event]) => {
                    if (!!(__VLS_ctx.notes.length === 0))
                        return;
                    __VLS_ctx.toggleSound(note);
                    // @ts-ignore
                    [toggleSound,];
                } });
        const { default: __VLS_95 } = __VLS_91.slots;
        if (note.hasSound) {
            const __VLS_96 = {}.BellFilled;
            /** @type {[typeof __VLS_components.BellFilled, ]} */ ;
            // @ts-ignore
            BellFilled;
            // @ts-ignore
            const __VLS_97 = __VLS_asFunctionalComponent(__VLS_96, new __VLS_96({}));
            const __VLS_98 = __VLS_97({}, ...__VLS_functionalComponentArgsRest(__VLS_97));
        }
        else {
            const __VLS_101 = {}.Bell;
            /** @type {[typeof __VLS_components.Bell, ]} */ ;
            // @ts-ignore
            Bell;
            // @ts-ignore
            const __VLS_102 = __VLS_asFunctionalComponent(__VLS_101, new __VLS_101({}));
            const __VLS_103 = __VLS_102({}, ...__VLS_functionalComponentArgsRest(__VLS_102));
        }
        var __VLS_91;
        var __VLS_86;
        const __VLS_106 = {}.ElCol;
        /** @type {[typeof __VLS_components.ElCol, typeof __VLS_components.elCol, typeof __VLS_components.ElCol, typeof __VLS_components.elCol, ]} */ ;
        // @ts-ignore
        ElCol;
        // @ts-ignore
        const __VLS_107 = __VLS_asFunctionalComponent(__VLS_106, new __VLS_106({
            span: (3),
        }));
        const __VLS_108 = __VLS_107({
            span: (3),
        }, ...__VLS_functionalComponentArgsRest(__VLS_107));
        const { default: __VLS_110 } = __VLS_109.slots;
        (__VLS_ctx.getEpisode(note.mapLevel));
        // @ts-ignore
        [getEpisode,];
        var __VLS_109;
        const __VLS_111 = {}.ElCol;
        /** @type {[typeof __VLS_components.ElCol, typeof __VLS_components.elCol, typeof __VLS_components.ElCol, typeof __VLS_components.elCol, ]} */ ;
        // @ts-ignore
        ElCol;
        // @ts-ignore
        const __VLS_112 = __VLS_asFunctionalComponent(__VLS_111, new __VLS_111({
            span: (6),
        }));
        const __VLS_113 = __VLS_112({
            span: (6),
        }, ...__VLS_functionalComponentArgsRest(__VLS_112));
        const { default: __VLS_115 } = __VLS_114.slots;
        __VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({
            ...{ class: "map-name-content" },
        });
        __VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({});
        (note.mapLevel);
        (__VLS_ctx.getMapName(note.mapLevel));
        // @ts-ignore
        [getMapName,];
        const __VLS_116 = {}.ElIcon;
        /** @type {[typeof __VLS_components.ElIcon, typeof __VLS_components.elIcon, typeof __VLS_components.ElIcon, typeof __VLS_components.elIcon, ]} */ ;
        // @ts-ignore
        ElIcon;
        // @ts-ignore
        const __VLS_117 = __VLS_asFunctionalComponent(__VLS_116, new __VLS_116({
            ...{ 'onClick': {} },
            ...{ class: "star-icon" },
            ...{ class: ({ 'is-starred': __VLS_ctx.isMapStarred(note.mapLevel) }) },
        }));
        const __VLS_118 = __VLS_117({
            ...{ 'onClick': {} },
            ...{ class: "star-icon" },
            ...{ class: ({ 'is-starred': __VLS_ctx.isMapStarred(note.mapLevel) }) },
        }, ...__VLS_functionalComponentArgsRest(__VLS_117));
        let __VLS_120;
        let __VLS_121;
        const __VLS_122 = ({ click: {} },
            { onClick: (...[$event]) => {
                    if (!!(__VLS_ctx.notes.length === 0))
                        return;
                    __VLS_ctx.toggleStar(note.mapLevel);
                    // @ts-ignore
                    [isMapStarred, toggleStar,];
                } });
        const { default: __VLS_123 } = __VLS_119.slots;
        const __VLS_124 = {}.StarFilled;
        /** @type {[typeof __VLS_components.StarFilled, ]} */ ;
        // @ts-ignore
        StarFilled;
        // @ts-ignore
        const __VLS_125 = __VLS_asFunctionalComponent(__VLS_124, new __VLS_124({}));
        const __VLS_126 = __VLS_125({}, ...__VLS_functionalComponentArgsRest(__VLS_125));
        var __VLS_119;
        var __VLS_114;
        const __VLS_129 = {}.ElCol;
        /** @type {[typeof __VLS_components.ElCol, typeof __VLS_components.elCol, typeof __VLS_components.ElCol, typeof __VLS_components.elCol, ]} */ ;
        // @ts-ignore
        ElCol;
        // @ts-ignore
        const __VLS_130 = __VLS_asFunctionalComponent(__VLS_129, new __VLS_129({
            span: (3),
        }));
        const __VLS_131 = __VLS_130({
            span: (3),
        }, ...__VLS_functionalComponentArgsRest(__VLS_130));
        const { default: __VLS_133 } = __VLS_132.slots;
        (note.channel);
        var __VLS_132;
        const __VLS_134 = {}.ElCol;
        /** @type {[typeof __VLS_components.ElCol, typeof __VLS_components.elCol, typeof __VLS_components.ElCol, typeof __VLS_components.elCol, ]} */ ;
        // @ts-ignore
        ElCol;
        // @ts-ignore
        const __VLS_135 = __VLS_asFunctionalComponent(__VLS_134, new __VLS_134({
            span: (5),
        }));
        const __VLS_136 = __VLS_135({
            span: (5),
        }, ...__VLS_functionalComponentArgsRest(__VLS_135));
        const { default: __VLS_138 } = __VLS_137.slots;
        if (note.state === 'CD' && note.respawnTime <= __VLS_ctx.currentTime) {
            // @ts-ignore
            [currentTime,];
            __VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({});
            const __VLS_139 = {}.ElButton;
            /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
            // @ts-ignore
            ElButton;
            // @ts-ignore
            const __VLS_140 = __VLS_asFunctionalComponent(__VLS_139, new __VLS_139({
                ...{ 'onClick': {} },
                type: "warning",
                size: "small",
            }));
            const __VLS_141 = __VLS_140({
                ...{ 'onClick': {} },
                type: "warning",
                size: "small",
            }, ...__VLS_functionalComponentArgsRest(__VLS_140));
            let __VLS_143;
            let __VLS_144;
            const __VLS_145 = ({ click: {} },
                { onClick: (...[$event]) => {
                        if (!!(__VLS_ctx.notes.length === 0))
                            return;
                        if (!(note.state === 'CD' && note.respawnTime <= __VLS_ctx.currentTime))
                            return;
                        __VLS_ctx.handleExpiredClick(note);
                        // @ts-ignore
                        [handleExpiredClick,];
                    } });
            const { default: __VLS_146 } = __VLS_142.slots;
            (__VLS_ctx.getStatusText(note));
            // @ts-ignore
            [getStatusText,];
            var __VLS_142;
        }
        else if (note.state.startsWith('STAGE_')) {
            __VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({});
            const __VLS_147 = {}.ElButton;
            /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
            // @ts-ignore
            ElButton;
            // @ts-ignore
            const __VLS_148 = __VLS_asFunctionalComponent(__VLS_147, new __VLS_147({
                ...{ 'onClick': {} },
                type: "primary",
                size: "small",
            }));
            const __VLS_149 = __VLS_148({
                ...{ 'onClick': {} },
                type: "primary",
                size: "small",
            }, ...__VLS_functionalComponentArgsRest(__VLS_148));
            let __VLS_151;
            let __VLS_152;
            const __VLS_153 = ({ click: {} },
                { onClick: (...[$event]) => {
                        if (!!(__VLS_ctx.notes.length === 0))
                            return;
                        if (!!(note.state === 'CD' && note.respawnTime <= __VLS_ctx.currentTime))
                            return;
                        if (!(note.state.startsWith('STAGE_')))
                            return;
                        __VLS_ctx.handleExpiredClick(note);
                        // @ts-ignore
                        [handleExpiredClick,];
                    } });
            const { default: __VLS_154 } = __VLS_150.slots;
            (__VLS_ctx.getStatusText(note));
            // @ts-ignore
            [getStatusText,];
            var __VLS_150;
        }
        else {
            __VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({});
            (__VLS_ctx.getStatusText(note));
            // @ts-ignore
            [getStatusText,];
        }
        var __VLS_137;
        const __VLS_155 = {}.ElCol;
        /** @type {[typeof __VLS_components.ElCol, typeof __VLS_components.elCol, typeof __VLS_components.ElCol, typeof __VLS_components.elCol, ]} */ ;
        // @ts-ignore
        ElCol;
        // @ts-ignore
        const __VLS_156 = __VLS_asFunctionalComponent(__VLS_155, new __VLS_155({
            span: (6),
        }));
        const __VLS_157 = __VLS_156({
            span: (6),
        }, ...__VLS_functionalComponentArgsRest(__VLS_156));
        const { default: __VLS_159 } = __VLS_158.slots;
        const __VLS_160 = {}.ElButton;
        /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
        // @ts-ignore
        ElButton;
        // @ts-ignore
        const __VLS_161 = __VLS_asFunctionalComponent(__VLS_160, new __VLS_160({
            ...{ 'onClick': {} },
            type: "danger",
            size: "small",
        }));
        const __VLS_162 = __VLS_161({
            ...{ 'onClick': {} },
            type: "danger",
            size: "small",
        }, ...__VLS_functionalComponentArgsRest(__VLS_161));
        let __VLS_164;
        let __VLS_165;
        const __VLS_166 = ({ click: {} },
            { onClick: (...[$event]) => {
                    if (!!(__VLS_ctx.notes.length === 0))
                        return;
                    __VLS_ctx.handleDelete(note.id);
                    // @ts-ignore
                    [handleDelete,];
                } });
        const { default: __VLS_167 } = __VLS_163.slots;
        var __VLS_163;
        var __VLS_158;
        var __VLS_81;
    }
    var __VLS_76;
}
var __VLS_3;
/** @type {__VLS_StyleScopedClasses['no-notes-message']} */ ;
/** @type {__VLS_StyleScopedClasses['list-actions']} */ ;
/** @type {__VLS_StyleScopedClasses['list-header']} */ ;
/** @type {__VLS_StyleScopedClasses['list-item']} */ ;
/** @type {__VLS_StyleScopedClasses['over-time-limit']} */ ;
/** @type {__VLS_StyleScopedClasses['sound-icon']} */ ;
/** @type {__VLS_StyleScopedClasses['map-name-content']} */ ;
/** @type {__VLS_StyleScopedClasses['star-icon']} */ ;
/** @type {__VLS_StyleScopedClasses['is-starred']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup: () => ({
        ElButton: ElButton,
        StarFilled: StarFilled,
        Bell: Bell,
        BellFilled: BellFilled,
        currentTime: currentTime,
        toggleTimeDisplay: toggleTimeDisplay,
        getMapName: getMapName,
        sortButtonText: sortButtonText,
        toggleAllSoundButtonText: toggleAllSoundButtonText,
        handleExpiredClick: handleExpiredClick,
        getEpisode: getEpisode,
        getStatusText: getStatusText,
        isOverTimeLimit: isOverTimeLimit,
        isMapStarred: isMapStarred,
        toggleStar: toggleStar,
        toggleSound: toggleSound,
        handleToggleAllSound: handleToggleAllSound,
        sortNotes: sortNotes,
        handleDelete: handleDelete,
        handleClearAll: handleClearAll,
    }),
    emits: {},
    __typeProps: {},
});
export default (await import('vue')).defineComponent({
    emits: {},
    __typeProps: {},
});
; /* PartiallyEnd: #4569/main.vue */
