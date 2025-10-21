import { ref, defineProps, defineEmits, onMounted, onUnmounted, computed, inject, } from "vue";
import { ElMessage, ElMessageBox, ElButton, ElIcon } from "element-plus";
import { StarFilled, Bell, BellFilled, Setting, Delete, } from "@element-plus/icons-vue";
const featureFlags = inject("feature-flags");
const props = defineProps();
const emit = defineEmits([
    "delete-note",
    "clear-notes",
    "toggle-sort",
    "update-note-status",
    "update-note-channel",
    "toggle-input-sound",
    "update-map-star",
    "show-update-dialog",
]);
// --------------------- 響應式邏輯 ---------------------
const isXs = ref(false);
const checkXs = () => {
    isXs.value = window.innerWidth < 768;
};
onMounted(() => {
    checkXs();
    window.addEventListener("resize", checkXs);
});
onUnmounted(() => {
    window.removeEventListener("resize", checkXs);
});
// ----------------------------------------------------
const currentTime = ref(Date.now());
let timer = null;
let soundChecker = null;
const showLocalTime = ref(false);
const showChannelAdjust = ref(false);
const ON_TIME_LIMIT_MS = 30 * 60 * 1000;
const isAllSoundOn = ref(true);
const toggleTimeDisplay = () => {
    showLocalTime.value = !showLocalTime.value;
};
const toggleChannelAdjust = () => {
    showChannelAdjust.value = !showChannelAdjust.value;
    if (!showChannelAdjust.value) {
        toggleHightlight(false);
    }
};
const channelAdjust = (note, delta) => {
    let currentChannel = note.channel;
    const newChannel = currentChannel + delta;
    if (newChannel >= 1) {
        emit("update-note-channel", note.id, newChannel);
        if (!note.isHighlight) {
            toggleHightlight(true, note.mapLevel);
        }
    }
    else {
        ElMessage({
            message: "分流已是最小，無法再減少",
            type: "warning",
        });
    }
};
const toggleHightlight = (on, target = 0) => {
    for (const note of props.notes) {
        // 編輯分流時提示所有相同地圖
        if (on && note.mapLevel == target) {
            note.isHighlight = on;
        }
        // 結束編輯分流時關閉提示
        if (note.isHighlight) {
            note.isHighlight = on;
        }
        if (!on && note.isWarning) {
            note.isWarning = on;
        }
    }
};
const getMapName = (level) => {
    const map = props.maps.find((m) => m.level === level);
    return map ? map.name : "未知地圖";
};
const getMapEnName = (name) => {
    const map = props.maps.find((m) => m.name === name);
    return map ? map.enName : "unknown";
};
const speakNoteDetails = (note) => {
    if ("speechSynthesis" in window) {
        const mapName = note.noteText || getMapName(note.mapLevel);
        const utterance = new SpeechSynthesisUtterance();
        utterance.text = `E P ${getEpisode(note.mapLevel)}, ${mapName} 分流 ${note.channel}, CD已結束`;
        utterance.lang = "zh-TW";
        if (featureFlags?.value.en) {
            const mapEnName = getMapEnName(mapName);
            utterance.text = `Episode ${getEpisode(note.mapLevel)}, ${mapEnName} channel ${note.channel}, Cooldown is finished`;
            utterance.lang = "en-US";
        }
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
            // 重開網頁時 CD到期三分鐘內的分流 才語音提醒?
            if (now - note.respawnTime < 3 * 60 * 1000) {
                speakNoteDetails(note);
            }
            else {
                let msg = `EP.${getEpisode(note.mapLevel)} ${note.noteText || getMapName(note.mapLevel)} CH.${note.channel} CD已結束`;
                ElMessage({ type: "warning", message: msg });
            }
            note.hasAlerted = true;
        }
    }
};
const sortButtonText = computed(() => {
    if (props.currentSortMode === "time") {
        return "依地圖排序";
    }
    else {
        return "依時間排序";
    }
});
const toggleAllSoundButtonText = computed(() => {
    return isAllSoundOn.value ? "提示聲全關" : "提示聲全開";
});
const handleExpiredClick = (note) => {
    // 不再使用 ElMessageBox，直接發出事件
    emit("show-update-dialog", note.id);
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
    // note: 即使nosec也要顯示秒數 因為會出現00:00(分)的倒數
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
        if (note.stageTime) {
            const elapsedSeconds = Math.floor((now - (note.stageTime || now)) / 1000);
            return `${stage} 階段 ${formatTime(elapsedSeconds)}+ `;
        }
        else {
            return `階段 ${stage} / ${note.maxStages}`;
        }
    }
    else if (note.state === "CD") {
        const diffInSeconds = Math.floor((note.respawnTime - now) / 1000);
        if (diffInSeconds > 0) {
            if (showLocalTime.value) {
                const localTime = new Date(note.respawnTime || 0).toLocaleTimeString("zh-TW", { hour12: false });
                return `開始於 ${localTime}`;
            }
            else {
                return featureFlags?.value.en ? `Cooldown ${formatTime(diffInSeconds)}` : `CD時間 ${formatTime(diffInSeconds)}`;
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
    __VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({});
    (__VLS_ctx.toggleAllSoundButtonText);
    // @ts-ignore
    [toggleAllSoundButtonText,];
    const __VLS_22 = {}.ElIcon;
    /** @type {[typeof __VLS_components.ElIcon, typeof __VLS_components.elIcon, typeof __VLS_components.ElIcon, typeof __VLS_components.elIcon, ]} */ ;
    // @ts-ignore
    ElIcon;
    // @ts-ignore
    const __VLS_23 = __VLS_asFunctionalComponent(__VLS_22, new __VLS_22({
        ...{ style: {} },
    }));
    const __VLS_24 = __VLS_23({
        ...{ style: {} },
    }, ...__VLS_functionalComponentArgsRest(__VLS_23));
    const { default: __VLS_26 } = __VLS_25.slots;
    if (__VLS_ctx.isAllSoundOn) {
        // @ts-ignore
        [isAllSoundOn,];
        const __VLS_27 = {}.Bell;
        /** @type {[typeof __VLS_components.Bell, ]} */ ;
        // @ts-ignore
        Bell;
        // @ts-ignore
        const __VLS_28 = __VLS_asFunctionalComponent(__VLS_27, new __VLS_27({}));
        const __VLS_29 = __VLS_28({}, ...__VLS_functionalComponentArgsRest(__VLS_28));
    }
    else {
        const __VLS_32 = {}.BellFilled;
        /** @type {[typeof __VLS_components.BellFilled, ]} */ ;
        // @ts-ignore
        BellFilled;
        // @ts-ignore
        const __VLS_33 = __VLS_asFunctionalComponent(__VLS_32, new __VLS_32({}));
        const __VLS_34 = __VLS_33({}, ...__VLS_functionalComponentArgsRest(__VLS_33));
    }
    var __VLS_25;
    var __VLS_17;
    const __VLS_37 = {}.ElButton;
    /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
    // @ts-ignore
    ElButton;
    // @ts-ignore
    const __VLS_38 = __VLS_asFunctionalComponent(__VLS_37, new __VLS_37({
        ...{ 'onClick': {} },
        type: "danger",
        disabled: (__VLS_ctx.notes.length === 0),
    }));
    const __VLS_39 = __VLS_38({
        ...{ 'onClick': {} },
        type: "danger",
        disabled: (__VLS_ctx.notes.length === 0),
    }, ...__VLS_functionalComponentArgsRest(__VLS_38));
    let __VLS_41;
    let __VLS_42;
    const __VLS_43 = ({ click: {} },
        { onClick: (__VLS_ctx.handleClearAll) });
    const { default: __VLS_44 } = __VLS_40.slots;
    // @ts-ignore
    [notes, handleClearAll,];
    var __VLS_40;
    const __VLS_45 = {}.ElRow;
    /** @type {[typeof __VLS_components.ElRow, typeof __VLS_components.elRow, typeof __VLS_components.ElRow, typeof __VLS_components.elRow, ]} */ ;
    // @ts-ignore
    ElRow;
    // @ts-ignore
    const __VLS_46 = __VLS_asFunctionalComponent(__VLS_45, new __VLS_45({
        ...{ class: "list-header" },
        gutter: (10),
    }));
    const __VLS_47 = __VLS_46({
        ...{ class: "list-header" },
        gutter: (10),
    }, ...__VLS_functionalComponentArgsRest(__VLS_46));
    const { default: __VLS_49 } = __VLS_48.slots;
    const __VLS_50 = {}.ElCol;
    /** @type {[typeof __VLS_components.ElCol, typeof __VLS_components.elCol, typeof __VLS_components.ElCol, typeof __VLS_components.elCol, ]} */ ;
    // @ts-ignore
    ElCol;
    // @ts-ignore
    const __VLS_51 = __VLS_asFunctionalComponent(__VLS_50, new __VLS_50({
        span: (1),
        xs: (0),
    }));
    const __VLS_52 = __VLS_51({
        span: (1),
        xs: (0),
    }, ...__VLS_functionalComponentArgsRest(__VLS_51));
    const __VLS_55 = {}.ElCol;
    /** @type {[typeof __VLS_components.ElCol, typeof __VLS_components.elCol, typeof __VLS_components.ElCol, typeof __VLS_components.elCol, ]} */ ;
    // @ts-ignore
    ElCol;
    // @ts-ignore
    const __VLS_56 = __VLS_asFunctionalComponent(__VLS_55, new __VLS_55({
        span: (3),
    }));
    const __VLS_57 = __VLS_56({
        span: (3),
    }, ...__VLS_functionalComponentArgsRest(__VLS_56));
    const { default: __VLS_59 } = __VLS_58.slots;
    var __VLS_58;
    const __VLS_60 = {}.ElCol;
    /** @type {[typeof __VLS_components.ElCol, typeof __VLS_components.elCol, typeof __VLS_components.ElCol, typeof __VLS_components.elCol, ]} */ ;
    // @ts-ignore
    ElCol;
    // @ts-ignore
    const __VLS_61 = __VLS_asFunctionalComponent(__VLS_60, new __VLS_60({
        span: (7),
        xs: (6),
    }));
    const __VLS_62 = __VLS_61({
        span: (7),
        xs: (6),
    }, ...__VLS_functionalComponentArgsRest(__VLS_61));
    const { default: __VLS_64 } = __VLS_63.slots;
    var __VLS_63;
    const __VLS_65 = {}.ElCol;
    /** @type {[typeof __VLS_components.ElCol, typeof __VLS_components.elCol, typeof __VLS_components.ElCol, typeof __VLS_components.elCol, ]} */ ;
    // @ts-ignore
    ElCol;
    // @ts-ignore
    const __VLS_66 = __VLS_asFunctionalComponent(__VLS_65, new __VLS_65({
        span: (3),
    }));
    const __VLS_67 = __VLS_66({
        span: (3),
    }, ...__VLS_functionalComponentArgsRest(__VLS_66));
    const { default: __VLS_69 } = __VLS_68.slots;
    if (!__VLS_ctx.isXs) {
        // @ts-ignore
        [isXs,];
        const __VLS_70 = {}.ElButton;
        /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
        // @ts-ignore
        ElButton;
        // @ts-ignore
        const __VLS_71 = __VLS_asFunctionalComponent(__VLS_70, new __VLS_70({
            ...{ 'onClick': {} },
            size: "small",
            type: "",
            icon: (__VLS_ctx.Setting),
        }));
        const __VLS_72 = __VLS_71({
            ...{ 'onClick': {} },
            size: "small",
            type: "",
            icon: (__VLS_ctx.Setting),
        }, ...__VLS_functionalComponentArgsRest(__VLS_71));
        let __VLS_74;
        let __VLS_75;
        const __VLS_76 = ({ click: {} },
            { onClick: (__VLS_ctx.toggleChannelAdjust) });
        // @ts-ignore
        [Setting, toggleChannelAdjust,];
        var __VLS_73;
    }
    var __VLS_68;
    const __VLS_78 = {}.ElCol;
    /** @type {[typeof __VLS_components.ElCol, typeof __VLS_components.elCol, typeof __VLS_components.ElCol, typeof __VLS_components.elCol, ]} */ ;
    // @ts-ignore
    ElCol;
    // @ts-ignore
    const __VLS_79 = __VLS_asFunctionalComponent(__VLS_78, new __VLS_78({
        span: (6),
        xs: (9),
    }));
    const __VLS_80 = __VLS_79({
        span: (6),
        xs: (9),
    }, ...__VLS_functionalComponentArgsRest(__VLS_79));
    const { default: __VLS_82 } = __VLS_81.slots;
    const __VLS_83 = {}.ElButton;
    /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
    // @ts-ignore
    ElButton;
    // @ts-ignore
    const __VLS_84 = __VLS_asFunctionalComponent(__VLS_83, new __VLS_83({
        ...{ 'onClick': {} },
        size: "small",
        type: "",
    }));
    const __VLS_85 = __VLS_84({
        ...{ 'onClick': {} },
        size: "small",
        type: "",
    }, ...__VLS_functionalComponentArgsRest(__VLS_84));
    let __VLS_87;
    let __VLS_88;
    const __VLS_89 = ({ click: {} },
        { onClick: (__VLS_ctx.toggleTimeDisplay) });
    const { default: __VLS_90 } = __VLS_86.slots;
    // @ts-ignore
    [toggleTimeDisplay,];
    var __VLS_86;
    var __VLS_81;
    const __VLS_91 = {}.ElCol;
    /** @type {[typeof __VLS_components.ElCol, typeof __VLS_components.elCol, typeof __VLS_components.ElCol, typeof __VLS_components.elCol, ]} */ ;
    // @ts-ignore
    ElCol;
    // @ts-ignore
    const __VLS_92 = __VLS_asFunctionalComponent(__VLS_91, new __VLS_91({
        span: (4),
        xs: (3),
    }));
    const __VLS_93 = __VLS_92({
        span: (4),
        xs: (3),
    }, ...__VLS_functionalComponentArgsRest(__VLS_92));
    const { default: __VLS_95 } = __VLS_94.slots;
    var __VLS_94;
    var __VLS_48;
    const __VLS_96 = {}.TransitionGroup;
    /** @type {[typeof __VLS_components.TransitionGroup, typeof __VLS_components.transitionGroup, typeof __VLS_components.TransitionGroup, typeof __VLS_components.transitionGroup, ]} */ ;
    // @ts-ignore
    TransitionGroup;
    // @ts-ignore
    const __VLS_97 = __VLS_asFunctionalComponent(__VLS_96, new __VLS_96({
        name: "list-item",
        tag: "div",
    }));
    const __VLS_98 = __VLS_97({
        name: "list-item",
        tag: "div",
    }, ...__VLS_functionalComponentArgsRest(__VLS_97));
    const { default: __VLS_100 } = __VLS_99.slots;
    for (const [note] of __VLS_getVForSourceType((__VLS_ctx.notes))) {
        // @ts-ignore
        [notes,];
        const __VLS_101 = {}.ElRow;
        /** @type {[typeof __VLS_components.ElRow, typeof __VLS_components.elRow, typeof __VLS_components.ElRow, typeof __VLS_components.elRow, ]} */ ;
        // @ts-ignore
        ElRow;
        // @ts-ignore
        const __VLS_102 = __VLS_asFunctionalComponent(__VLS_101, new __VLS_101({
            key: (note.id),
            ...{ class: "list-item" },
            ...{ class: ({
                    'over-time-limit': __VLS_ctx.isOverTimeLimit(note),
                    'warning-row': note.isWarning,
                    'highlight-row': note.isHighlight,
                }) },
            gutter: (10),
        }));
        const __VLS_103 = __VLS_102({
            key: (note.id),
            ...{ class: "list-item" },
            ...{ class: ({
                    'over-time-limit': __VLS_ctx.isOverTimeLimit(note),
                    'warning-row': note.isWarning,
                    'highlight-row': note.isHighlight,
                }) },
            gutter: (10),
        }, ...__VLS_functionalComponentArgsRest(__VLS_102));
        const { default: __VLS_105 } = __VLS_104.slots;
        // @ts-ignore
        [isOverTimeLimit,];
        const __VLS_106 = {}.ElCol;
        /** @type {[typeof __VLS_components.ElCol, typeof __VLS_components.elCol, typeof __VLS_components.ElCol, typeof __VLS_components.elCol, ]} */ ;
        // @ts-ignore
        ElCol;
        // @ts-ignore
        const __VLS_107 = __VLS_asFunctionalComponent(__VLS_106, new __VLS_106({
            span: (1),
            xs: (0),
        }));
        const __VLS_108 = __VLS_107({
            span: (1),
            xs: (0),
        }, ...__VLS_functionalComponentArgsRest(__VLS_107));
        const { default: __VLS_110 } = __VLS_109.slots;
        const __VLS_111 = {}.ElIcon;
        /** @type {[typeof __VLS_components.ElIcon, typeof __VLS_components.elIcon, typeof __VLS_components.ElIcon, typeof __VLS_components.elIcon, ]} */ ;
        // @ts-ignore
        ElIcon;
        // @ts-ignore
        const __VLS_112 = __VLS_asFunctionalComponent(__VLS_111, new __VLS_111({
            ...{ 'onClick': {} },
            ...{ class: "sound-icon" },
        }));
        const __VLS_113 = __VLS_112({
            ...{ 'onClick': {} },
            ...{ class: "sound-icon" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_112));
        let __VLS_115;
        let __VLS_116;
        const __VLS_117 = ({ click: {} },
            { onClick: (...[$event]) => {
                    if (!!(__VLS_ctx.notes.length === 0))
                        return;
                    __VLS_ctx.toggleSound(note);
                    // @ts-ignore
                    [toggleSound,];
                } });
        const { default: __VLS_118 } = __VLS_114.slots;
        if (note.hasSound) {
            const __VLS_119 = {}.BellFilled;
            /** @type {[typeof __VLS_components.BellFilled, ]} */ ;
            // @ts-ignore
            BellFilled;
            // @ts-ignore
            const __VLS_120 = __VLS_asFunctionalComponent(__VLS_119, new __VLS_119({}));
            const __VLS_121 = __VLS_120({}, ...__VLS_functionalComponentArgsRest(__VLS_120));
        }
        else {
            const __VLS_124 = {}.Bell;
            /** @type {[typeof __VLS_components.Bell, ]} */ ;
            // @ts-ignore
            Bell;
            // @ts-ignore
            const __VLS_125 = __VLS_asFunctionalComponent(__VLS_124, new __VLS_124({}));
            const __VLS_126 = __VLS_125({}, ...__VLS_functionalComponentArgsRest(__VLS_125));
        }
        var __VLS_114;
        var __VLS_109;
        const __VLS_129 = {}.ElCol;
        /** @type {[typeof __VLS_components.ElCol, typeof __VLS_components.elCol, typeof __VLS_components.ElCol, typeof __VLS_components.elCol, ]} */ ;
        // @ts-ignore
        ElCol;
        // @ts-ignore
        const __VLS_130 = __VLS_asFunctionalComponent(__VLS_129, new __VLS_129({
            span: (3),
            xs: (2),
        }));
        const __VLS_131 = __VLS_130({
            span: (3),
            xs: (2),
        }, ...__VLS_functionalComponentArgsRest(__VLS_130));
        const { default: __VLS_133 } = __VLS_132.slots;
        if (!__VLS_ctx.isXs) {
            // @ts-ignore
            [isXs,];
            __VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({});
        }
        (__VLS_ctx.getEpisode(note.mapLevel));
        // @ts-ignore
        [getEpisode,];
        var __VLS_132;
        const __VLS_134 = {}.ElCol;
        /** @type {[typeof __VLS_components.ElCol, typeof __VLS_components.elCol, typeof __VLS_components.ElCol, typeof __VLS_components.elCol, ]} */ ;
        // @ts-ignore
        ElCol;
        // @ts-ignore
        const __VLS_135 = __VLS_asFunctionalComponent(__VLS_134, new __VLS_134({
            span: (7),
            xs: (8),
        }));
        const __VLS_136 = __VLS_135({
            span: (7),
            xs: (8),
        }, ...__VLS_functionalComponentArgsRest(__VLS_135));
        const { default: __VLS_138 } = __VLS_137.slots;
        __VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({
            ...{ class: "map-name-content" },
        });
        if ((!__VLS_ctx.isXs && __VLS_ctx.featureFlags?.pic)) {
            // @ts-ignore
            [isXs, featureFlags,];
            const __VLS_139 = {}.ElPopover;
            /** @type {[typeof __VLS_components.ElPopover, typeof __VLS_components.elPopover, typeof __VLS_components.ElPopover, typeof __VLS_components.elPopover, ]} */ ;
            // @ts-ignore
            ElPopover;
            // @ts-ignore
            const __VLS_140 = __VLS_asFunctionalComponent(__VLS_139, new __VLS_139({
                placement: "top",
                trigger: "hover",
                width: (425),
                hideAfter: (200),
            }));
            const __VLS_141 = __VLS_140({
                placement: "top",
                trigger: "hover",
                width: (425),
                hideAfter: (200),
            }, ...__VLS_functionalComponentArgsRest(__VLS_140));
            const { default: __VLS_143 } = __VLS_142.slots;
            {
                const { reference: __VLS_144 } = __VLS_142.slots;
                if (__VLS_ctx.featureFlags?.en) {
                    // @ts-ignore
                    [featureFlags,];
                    __VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({});
                    (note.mapLevel);
                    (__VLS_ctx.getMapEnName(note.noteText || __VLS_ctx.getMapName(note.mapLevel)));
                    // @ts-ignore
                    [getMapEnName, getMapName,];
                }
                else {
                    __VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({});
                    (note.mapLevel);
                    (note.noteText || __VLS_ctx.getMapName(note.mapLevel));
                    // @ts-ignore
                    [getMapName,];
                }
            }
            {
                const { default: __VLS_145 } = __VLS_142.slots;
                if (__VLS_ctx.mapImageCache[note.noteText]) {
                    // @ts-ignore
                    [mapImageCache,];
                    __VLS_asFunctionalElement(__VLS_elements.img)({
                        src: (__VLS_ctx.mapImageCache[note.noteText]),
                        alt: "地圖圖片",
                        ...{ class: "popover-map-image" },
                    });
                    // @ts-ignore
                    [mapImageCache,];
                }
                else {
                    __VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({});
                }
            }
            var __VLS_142;
        }
        else {
            __VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({});
            (note.mapLevel);
            (note.noteText || __VLS_ctx.getMapName(note.mapLevel));
            // @ts-ignore
            [getMapName,];
        }
        const __VLS_146 = {}.ElIcon;
        /** @type {[typeof __VLS_components.ElIcon, typeof __VLS_components.elIcon, typeof __VLS_components.ElIcon, typeof __VLS_components.elIcon, ]} */ ;
        // @ts-ignore
        ElIcon;
        // @ts-ignore
        const __VLS_147 = __VLS_asFunctionalComponent(__VLS_146, new __VLS_146({
            ...{ 'onClick': {} },
            ...{ class: "star-icon" },
            ...{ class: ({ 'is-starred': __VLS_ctx.isMapStarred(note.mapLevel) }) },
        }));
        const __VLS_148 = __VLS_147({
            ...{ 'onClick': {} },
            ...{ class: "star-icon" },
            ...{ class: ({ 'is-starred': __VLS_ctx.isMapStarred(note.mapLevel) }) },
        }, ...__VLS_functionalComponentArgsRest(__VLS_147));
        let __VLS_150;
        let __VLS_151;
        const __VLS_152 = ({ click: {} },
            { onClick: (...[$event]) => {
                    if (!!(__VLS_ctx.notes.length === 0))
                        return;
                    __VLS_ctx.toggleStar(note.mapLevel);
                    // @ts-ignore
                    [isMapStarred, toggleStar,];
                } });
        const { default: __VLS_153 } = __VLS_149.slots;
        const __VLS_154 = {}.StarFilled;
        /** @type {[typeof __VLS_components.StarFilled, ]} */ ;
        // @ts-ignore
        StarFilled;
        // @ts-ignore
        const __VLS_155 = __VLS_asFunctionalComponent(__VLS_154, new __VLS_154({}));
        const __VLS_156 = __VLS_155({}, ...__VLS_functionalComponentArgsRest(__VLS_155));
        var __VLS_149;
        var __VLS_137;
        const __VLS_159 = {}.ElCol;
        /** @type {[typeof __VLS_components.ElCol, typeof __VLS_components.elCol, typeof __VLS_components.ElCol, typeof __VLS_components.elCol, ]} */ ;
        // @ts-ignore
        ElCol;
        // @ts-ignore
        const __VLS_160 = __VLS_asFunctionalComponent(__VLS_159, new __VLS_159({
            span: (3),
            xs: (2),
            ...{ style: {} },
        }));
        const __VLS_161 = __VLS_160({
            span: (3),
            xs: (2),
            ...{ style: {} },
        }, ...__VLS_functionalComponentArgsRest(__VLS_160));
        const { default: __VLS_163 } = __VLS_162.slots;
        if (__VLS_ctx.showChannelAdjust) {
            // @ts-ignore
            [showChannelAdjust,];
            const __VLS_164 = {}.ElButton;
            /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
            // @ts-ignore
            ElButton;
            // @ts-ignore
            const __VLS_165 = __VLS_asFunctionalComponent(__VLS_164, new __VLS_164({
                ...{ 'onClick': {} },
                size: "small",
            }));
            const __VLS_166 = __VLS_165({
                ...{ 'onClick': {} },
                size: "small",
            }, ...__VLS_functionalComponentArgsRest(__VLS_165));
            let __VLS_168;
            let __VLS_169;
            const __VLS_170 = ({ click: {} },
                { onClick: (...[$event]) => {
                        if (!!(__VLS_ctx.notes.length === 0))
                            return;
                        if (!(__VLS_ctx.showChannelAdjust))
                            return;
                        __VLS_ctx.channelAdjust(note, -1);
                        // @ts-ignore
                        [channelAdjust,];
                    } });
            const { default: __VLS_171 } = __VLS_167.slots;
            var __VLS_167;
        }
        __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({});
        (note.channel);
        if (__VLS_ctx.showChannelAdjust) {
            // @ts-ignore
            [showChannelAdjust,];
            const __VLS_172 = {}.ElButton;
            /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
            // @ts-ignore
            ElButton;
            // @ts-ignore
            const __VLS_173 = __VLS_asFunctionalComponent(__VLS_172, new __VLS_172({
                ...{ 'onClick': {} },
                size: "small",
            }));
            const __VLS_174 = __VLS_173({
                ...{ 'onClick': {} },
                size: "small",
            }, ...__VLS_functionalComponentArgsRest(__VLS_173));
            let __VLS_176;
            let __VLS_177;
            const __VLS_178 = ({ click: {} },
                { onClick: (...[$event]) => {
                        if (!!(__VLS_ctx.notes.length === 0))
                            return;
                        if (!(__VLS_ctx.showChannelAdjust))
                            return;
                        __VLS_ctx.channelAdjust(note, 1);
                        // @ts-ignore
                        [channelAdjust,];
                    } });
            const { default: __VLS_179 } = __VLS_175.slots;
            var __VLS_175;
        }
        var __VLS_162;
        const __VLS_180 = {}.ElCol;
        /** @type {[typeof __VLS_components.ElCol, typeof __VLS_components.elCol, typeof __VLS_components.ElCol, typeof __VLS_components.elCol, ]} */ ;
        // @ts-ignore
        ElCol;
        // @ts-ignore
        const __VLS_181 = __VLS_asFunctionalComponent(__VLS_180, new __VLS_180({
            span: (6),
            xs: (9),
        }));
        const __VLS_182 = __VLS_181({
            span: (6),
            xs: (9),
        }, ...__VLS_functionalComponentArgsRest(__VLS_181));
        const { default: __VLS_184 } = __VLS_183.slots;
        if (note.state === 'CD' && note.respawnTime <= __VLS_ctx.currentTime) {
            // @ts-ignore
            [currentTime,];
            __VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({});
            const __VLS_185 = {}.ElButton;
            /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
            // @ts-ignore
            ElButton;
            // @ts-ignore
            const __VLS_186 = __VLS_asFunctionalComponent(__VLS_185, new __VLS_185({
                ...{ 'onClick': {} },
                type: "warning",
                size: "small",
            }));
            const __VLS_187 = __VLS_186({
                ...{ 'onClick': {} },
                type: "warning",
                size: "small",
            }, ...__VLS_functionalComponentArgsRest(__VLS_186));
            let __VLS_189;
            let __VLS_190;
            const __VLS_191 = ({ click: {} },
                { onClick: (...[$event]) => {
                        if (!!(__VLS_ctx.notes.length === 0))
                            return;
                        if (!(note.state === 'CD' && note.respawnTime <= __VLS_ctx.currentTime))
                            return;
                        __VLS_ctx.handleExpiredClick(note);
                        // @ts-ignore
                        [handleExpiredClick,];
                    } });
            const { default: __VLS_192 } = __VLS_188.slots;
            (__VLS_ctx.getStatusText(note));
            // @ts-ignore
            [getStatusText,];
            var __VLS_188;
        }
        else if (note.state.startsWith('STAGE_')) {
            __VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({});
            const __VLS_193 = {}.ElButton;
            /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
            // @ts-ignore
            ElButton;
            // @ts-ignore
            const __VLS_194 = __VLS_asFunctionalComponent(__VLS_193, new __VLS_193({
                ...{ 'onClick': {} },
                plain: true,
                type: "primary",
                size: "small",
            }));
            const __VLS_195 = __VLS_194({
                ...{ 'onClick': {} },
                plain: true,
                type: "primary",
                size: "small",
            }, ...__VLS_functionalComponentArgsRest(__VLS_194));
            let __VLS_197;
            let __VLS_198;
            const __VLS_199 = ({ click: {} },
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
            const { default: __VLS_200 } = __VLS_196.slots;
            (__VLS_ctx.getStatusText(note));
            // @ts-ignore
            [getStatusText,];
            var __VLS_196;
        }
        else if (note.state === 'ON') {
            __VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({});
            const __VLS_201 = {}.ElButton;
            /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
            // @ts-ignore
            ElButton;
            // @ts-ignore
            const __VLS_202 = __VLS_asFunctionalComponent(__VLS_201, new __VLS_201({
                ...{ 'onClick': {} },
                plain: true,
                type: "info",
                size: "small",
            }));
            const __VLS_203 = __VLS_202({
                ...{ 'onClick': {} },
                plain: true,
                type: "info",
                size: "small",
            }, ...__VLS_functionalComponentArgsRest(__VLS_202));
            let __VLS_205;
            let __VLS_206;
            const __VLS_207 = ({ click: {} },
                { onClick: (...[$event]) => {
                        if (!!(__VLS_ctx.notes.length === 0))
                            return;
                        if (!!(note.state === 'CD' && note.respawnTime <= __VLS_ctx.currentTime))
                            return;
                        if (!!(note.state.startsWith('STAGE_')))
                            return;
                        if (!(note.state === 'ON'))
                            return;
                        __VLS_ctx.handleExpiredClick(note);
                        // @ts-ignore
                        [handleExpiredClick,];
                    } });
            const { default: __VLS_208 } = __VLS_204.slots;
            (__VLS_ctx.getStatusText(note));
            // @ts-ignore
            [getStatusText,];
            var __VLS_204;
        }
        else {
            __VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({
                ...{ onClick: (...[$event]) => {
                        if (!!(__VLS_ctx.notes.length === 0))
                            return;
                        if (!!(note.state === 'CD' && note.respawnTime <= __VLS_ctx.currentTime))
                            return;
                        if (!!(note.state.startsWith('STAGE_')))
                            return;
                        if (!!(note.state === 'ON'))
                            return;
                        __VLS_ctx.handleExpiredClick(note);
                        // @ts-ignore
                        [handleExpiredClick,];
                    } },
            });
            (__VLS_ctx.getStatusText(note));
            // @ts-ignore
            [getStatusText,];
        }
        var __VLS_183;
        const __VLS_209 = {}.ElCol;
        /** @type {[typeof __VLS_components.ElCol, typeof __VLS_components.elCol, typeof __VLS_components.ElCol, typeof __VLS_components.elCol, ]} */ ;
        // @ts-ignore
        ElCol;
        // @ts-ignore
        const __VLS_210 = __VLS_asFunctionalComponent(__VLS_209, new __VLS_209({
            span: (4),
            xs: (3),
        }));
        const __VLS_211 = __VLS_210({
            span: (4),
            xs: (3),
        }, ...__VLS_functionalComponentArgsRest(__VLS_210));
        const { default: __VLS_213 } = __VLS_212.slots;
        if (!__VLS_ctx.isXs) {
            // @ts-ignore
            [isXs,];
            const __VLS_214 = {}.ElButton;
            /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
            // @ts-ignore
            ElButton;
            // @ts-ignore
            const __VLS_215 = __VLS_asFunctionalComponent(__VLS_214, new __VLS_214({
                ...{ 'onClick': {} },
                type: "danger",
                size: "small",
            }));
            const __VLS_216 = __VLS_215({
                ...{ 'onClick': {} },
                type: "danger",
                size: "small",
            }, ...__VLS_functionalComponentArgsRest(__VLS_215));
            let __VLS_218;
            let __VLS_219;
            const __VLS_220 = ({ click: {} },
                { onClick: (...[$event]) => {
                        if (!!(__VLS_ctx.notes.length === 0))
                            return;
                        if (!(!__VLS_ctx.isXs))
                            return;
                        __VLS_ctx.handleDelete(note.id);
                        // @ts-ignore
                        [handleDelete,];
                    } });
            const { default: __VLS_221 } = __VLS_217.slots;
            var __VLS_217;
        }
        else {
            const __VLS_222 = {}.ElButton;
            /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
            // @ts-ignore
            ElButton;
            // @ts-ignore
            const __VLS_223 = __VLS_asFunctionalComponent(__VLS_222, new __VLS_222({
                ...{ 'onClick': {} },
                type: "danger",
                size: "small",
            }));
            const __VLS_224 = __VLS_223({
                ...{ 'onClick': {} },
                type: "danger",
                size: "small",
            }, ...__VLS_functionalComponentArgsRest(__VLS_223));
            let __VLS_226;
            let __VLS_227;
            const __VLS_228 = ({ click: {} },
                { onClick: (...[$event]) => {
                        if (!!(__VLS_ctx.notes.length === 0))
                            return;
                        if (!!(!__VLS_ctx.isXs))
                            return;
                        __VLS_ctx.handleDelete(note.id);
                        // @ts-ignore
                        [handleDelete,];
                    } });
            const { default: __VLS_229 } = __VLS_225.slots;
            const __VLS_230 = {}.ElIcon;
            /** @type {[typeof __VLS_components.ElIcon, typeof __VLS_components.elIcon, typeof __VLS_components.ElIcon, typeof __VLS_components.elIcon, ]} */ ;
            // @ts-ignore
            ElIcon;
            // @ts-ignore
            const __VLS_231 = __VLS_asFunctionalComponent(__VLS_230, new __VLS_230({}));
            const __VLS_232 = __VLS_231({}, ...__VLS_functionalComponentArgsRest(__VLS_231));
            const { default: __VLS_234 } = __VLS_233.slots;
            const __VLS_235 = {}.Delete;
            /** @type {[typeof __VLS_components.Delete, ]} */ ;
            // @ts-ignore
            Delete;
            // @ts-ignore
            const __VLS_236 = __VLS_asFunctionalComponent(__VLS_235, new __VLS_235({}));
            const __VLS_237 = __VLS_236({}, ...__VLS_functionalComponentArgsRest(__VLS_236));
            var __VLS_233;
            var __VLS_225;
        }
        var __VLS_212;
        var __VLS_104;
    }
    var __VLS_99;
}
var __VLS_3;
/** @type {__VLS_StyleScopedClasses['no-notes-message']} */ ;
/** @type {__VLS_StyleScopedClasses['list-actions']} */ ;
/** @type {__VLS_StyleScopedClasses['list-header']} */ ;
/** @type {__VLS_StyleScopedClasses['list-item']} */ ;
/** @type {__VLS_StyleScopedClasses['over-time-limit']} */ ;
/** @type {__VLS_StyleScopedClasses['warning-row']} */ ;
/** @type {__VLS_StyleScopedClasses['highlight-row']} */ ;
/** @type {__VLS_StyleScopedClasses['sound-icon']} */ ;
/** @type {__VLS_StyleScopedClasses['map-name-content']} */ ;
/** @type {__VLS_StyleScopedClasses['popover-map-image']} */ ;
/** @type {__VLS_StyleScopedClasses['star-icon']} */ ;
/** @type {__VLS_StyleScopedClasses['is-starred']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup: () => ({
        ElButton: ElButton,
        ElIcon: ElIcon,
        StarFilled: StarFilled,
        Bell: Bell,
        BellFilled: BellFilled,
        Setting: Setting,
        Delete: Delete,
        featureFlags: featureFlags,
        isXs: isXs,
        currentTime: currentTime,
        showChannelAdjust: showChannelAdjust,
        isAllSoundOn: isAllSoundOn,
        toggleTimeDisplay: toggleTimeDisplay,
        toggleChannelAdjust: toggleChannelAdjust,
        channelAdjust: channelAdjust,
        getMapName: getMapName,
        getMapEnName: getMapEnName,
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
