import { ref, defineEmits, computed, watch, h, defineProps } from "vue";
import { ElMessage, ElMessageBox, ElButton } from "element-plus";
import { ArrowUp, ArrowDown, StarFilled } from "@element-plus/icons-vue";
const props = defineProps({
    hasSound: Boolean,
    maps: Array,
});
const emit = defineEmits(["add-note", "update-map-star"]);
const inputContent = ref("");
const timeInput = ref("");
const hasSound = ref(true);
const selectedEpisode = ref(0);
const isStarSelection = ref(false);
const isCollapsed = ref(false);
const isChannelConfirmed = ref(false);
const isInputFocused = ref(false);
watch(() => props.hasSound, (newVal) => {
    hasSound.value = newVal;
});
const hintText = ref(`
  <strong>支援格式</strong>: 地圖等級 (空格) 分流 (空格) CD時間或狀態<br>
  <strong>CD時間</strong>: <code>1.30.7</code> (時.分.秒) 或 <code>25.10</code> (分.秒) 或 <code>5</code> (分)<br>
  <strong>狀態</strong>: 階段 <code>1/4</code> 到 <code>3/4</code> 或 <code>ON</code><br>
  輸入完可以直接enter
`);
const toggleCollapse = () => {
    isCollapsed.value = !isCollapsed.value;
};
const episodes = computed(() => {
    const uniqueEpisodes = new Set(props.maps.map((map) => map.episode));
    return Array.from(uniqueEpisodes).sort((a, b) => a - b);
});
const filteredMaps = computed(() => {
    if (isStarSelection.value) {
        return props.maps.filter((map) => map.isStarred);
    }
    return props.maps.filter((map) => map.episode === selectedEpisode.value);
});
const parseInput = (value) => {
    const parts = value.trim().split(/\s+/);
    const result = {
        mapLevel: null,
        mapName: null,
        channel: null,
        timeStr: null,
    };
    if (parts.length === 0)
        return result;
    // 第一部分：解析地圖等級
    result.mapLevel = parseInt(parts[0]);
    if (isNaN(result.mapLevel))
        return result;
    // 第二部分：判斷是地圖名稱還是分流
    if (parts.length > 1) {
        const potentialMapName = parts[1];
        // 檢查是否有地圖同時符合等級和名稱
        const isMapName = props.maps.some((m) => m.level === result.mapLevel &&
            m.name.trim() === potentialMapName);
        // 如果是地圖名稱
        if (isMapName) {
            result.mapName = potentialMapName;
            // 繼續解析分流與時間
            if (parts.length > 2) {
                result.channel = parseInt(parts[2]);
                if (parts.length > 3) {
                    result.timeStr = parts[3];
                }
            }
        }
        else {
            // 否則，將其視為分流
            result.channel = parseInt(potentialMapName);
            // 繼續解析時間
            if (parts.length > 2) {
                result.timeStr = parts[2];
            }
        }
    }
    return result;
};
const hasValidMapLevel = computed(() => {
    const { mapLevel } = parseInput(inputContent.value);
    return (!isNaN(mapLevel) && props.maps.some((m) => m.level === mapLevel));
});
const selectedMap = computed(() => {
    const { mapLevel, mapName } = parseInput(inputContent.value);
    if (mapName) {
        return props.maps.find((m) => m.level === mapLevel && m.name === mapName);
    }
    return props.maps.find((m) => m.level === mapLevel);
});
const selectedMapMaxStages = computed(() => {
    const map = selectedMap.value;
    return map ? map.maxStages : 5;
});
const getMapButtonType = (map) => {
    const { mapLevel, mapName } = parseInput(inputContent.value);
    if (mapName) {
        return mapLevel === map.level && mapName === map.name ? "primary" : "";
    }
    return mapLevel === map.level ? "primary" : "";
};
const getChannelButtonType = (channel) => {
    const { channel: currentChannel } = parseInput(inputContent.value);
    return currentChannel === channel ? "primary" : "";
};
const getStateButtonType = (state) => {
    return timeInput.value === state ? "primary" : "";
};
const handleEpisodeSelection = (ep) => {
    if (ep === "star") {
        isStarSelection.value = true;
        selectedEpisode.value = 0;
    }
    else if (ep === 0) {
        isStarSelection.value = false;
        selectedEpisode.value = 0;
    }
    else {
        isStarSelection.value = false;
        selectedEpisode.value = ep;
    }
    isChannelConfirmed.value = false;
};
const fillMapLevel = (map) => {
    inputContent.value = `${map.level} ${map.name}`.trim();
    isChannelConfirmed.value = false;
};
const fillChannel = (channel) => {
    const { mapLevel, mapName } = parseInput(inputContent.value);
    if (mapName) {
        inputContent.value = `${mapLevel} ${mapName} ${channel}`.trim();
    }
    else {
        inputContent.value = `${mapLevel} ${channel}`.trim();
    }
    isChannelConfirmed.value = true;
};
const changeChannel = (delta) => {
    const { mapLevel, mapName, channel } = parseInput(inputContent.value);
    let currentChannel = channel || 1;
    const newChannel = currentChannel + delta;
    if (newChannel >= 1) {
        fillChannel(newChannel);
    }
    else {
        ElMessage({
            message: "分流已是最小，無法再減少",
            type: "warning",
        });
    }
};
const fillState = (state) => {
    timeInput.value = state;
};
const toggleStar = (map) => {
    emit("update-map-star", map.level);
};
const handleAdd = async () => {
    const parsed = parseInput(inputContent.value);
    const finalTimeStr = parsed.timeStr || timeInput.value.trim();
    if (!parsed.mapLevel || !parsed.channel || !finalTimeStr) {
        ElMessage.error("輸入格式錯誤");
        return;
    }
    let map;
    if (parsed.mapName != null) {
        map = props.maps.find((m) => m.name === parsed.mapName);
    }
    else {
        map = (await getMapData(parsed.mapLevel));
    }
    if (!map) {
        return;
    }
    let respawnTime = 0;
    let state = "CD";
    let maxStages = map.maxStages;
    let onTime = null;
    if (finalTimeStr.toLowerCase() === "on") {
        state = "ON";
        onTime = Date.now();
    }
    else if (finalTimeStr.includes("/")) {
        const [current, max] = finalTimeStr.split("/").map(Number);
        if (!isNaN(current) && !isNaN(max)) {
            state = `STAGE_${current}`;
            maxStages = max;
        }
        else {
            ElMessage.error("階段格式錯誤");
            return;
        }
    }
    else if (finalTimeStr.includes(".") || finalTimeStr.includes(":")) {
        const timeParts = finalTimeStr.split(/[.:]/).map(Number);
        let totalSeconds = 0;
        if (timeParts.length === 2) {
            totalSeconds = timeParts[0] * 60 + (timeParts[1] || 0);
        }
        else {
            totalSeconds =
                timeParts[0] * 3600 + timeParts[1] * 60 + (timeParts[2] || 0);
        }
        respawnTime = Date.now() + totalSeconds * 1000;
    }
    else if (!isNaN(parseInt(finalTimeStr))) {
        const minutes = parseInt(finalTimeStr);
        respawnTime = Date.now() + minutes * 60 * 1000;
    }
    else {
        ElMessage.error("時間或階段格式錯誤");
        return;
    }
    const noteData = {
        mapLevel: map.level,
        channel: parsed.channel,
        respawnTime,
        state,
        isStarred: false,
        hasSound: hasSound.value,
        maxStages,
        onTime,
        noteText: parsed.mapName || map.name,
    };
    emit("add-note", noteData);
    inputContent.value = "";
    timeInput.value = "";
    selectedEpisode.value = 0;
    isStarSelection.value = false;
    isChannelConfirmed.value = false;
};
const getMapData = async (mapLevel) => {
    const matchingMaps = props.maps.filter((m) => m.level === mapLevel);
    let map;
    if (matchingMaps.length > 1) {
        matchingMaps.sort((a, b) => {
            if (a.episode !== b.episode) {
                return a.episode - b.episode;
            }
            return a.level - b.level;
        });
        try {
            const selectedMapName = await new Promise((resolve, reject) => {
                const message = h("div", null, matchingMaps.map((m) => h(ElButton, {
                    onClick: () => {
                        resolve(m.name);
                        ElMessageBox.close();
                    },
                    style: { margin: "5px" },
                }, () => `EP${m.episode} - Lv.${m.level} ${m.name}`)));
                ElMessageBox.alert(message, "地圖選擇", {
                    showConfirmButton: false,
                    callback: (action) => {
                        if (action === "cancel") {
                            reject("cancel");
                        }
                    },
                });
            });
            map = matchingMaps.find((m) => m.name === selectedMapName);
        }
        catch (action) {
            if (action === "cancel") {
                ElMessage.info("已取消新增");
            }
            return;
        }
    }
    else {
        map = matchingMaps[0];
    }
    if (!map) {
        ElMessage.error("找不到對應的地圖");
        return;
    }
    return map;
};
watch(inputContent, (newValue) => {
    const { mapLevel, mapName, timeStr, channel } = parseInput(newValue);
    if (!isNaN(mapLevel)) {
        const map = props.maps.find((m) => m.level === mapLevel);
        if (map) {
            selectedEpisode.value = map.episode;
            isStarSelection.value = false;
        }
        else {
            selectedEpisode.value = 0;
            isStarSelection.value = false;
        }
    }
    else {
        selectedEpisode.value = 0;
        isStarSelection.value = false;
    }
    if (timeStr) {
        timeInput.value = timeStr;
        isChannelConfirmed.value = true;
    }
    else {
        timeInput.value = "";
        if (isNaN(channel)) {
            isChannelConfirmed.value = false;
        }
    }
});
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_elements;
let __VLS_components;
let __VLS_directives;
/** @type {__VLS_StyleScopedClasses['input-form']} */ ;
/** @type {__VLS_StyleScopedClasses['el-form-item']} */ ;
/** @type {__VLS_StyleScopedClasses['input-hint']} */ ;
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
const __VLS_6 = {}.ElForm;
/** @type {[typeof __VLS_components.ElForm, typeof __VLS_components.elForm, typeof __VLS_components.ElForm, typeof __VLS_components.elForm, ]} */ ;
// @ts-ignore
ElForm;
// @ts-ignore
const __VLS_7 = __VLS_asFunctionalComponent(__VLS_6, new __VLS_6({
    ...{ 'onSubmit': {} },
    ...{ class: "input-form" },
}));
const __VLS_8 = __VLS_7({
    ...{ 'onSubmit': {} },
    ...{ class: "input-form" },
}, ...__VLS_functionalComponentArgsRest(__VLS_7));
let __VLS_10;
let __VLS_11;
const __VLS_12 = ({ submit: {} },
    { onSubmit: () => { } });
const { default: __VLS_13 } = __VLS_9.slots;
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "input-form-left" },
});
const __VLS_14 = {}.ElFormItem;
/** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
// @ts-ignore
ElFormItem;
// @ts-ignore
const __VLS_15 = __VLS_asFunctionalComponent(__VLS_14, new __VLS_14({
    label: "地圖 分流 時間or狀態",
}));
const __VLS_16 = __VLS_15({
    label: "地圖 分流 時間or狀態",
}, ...__VLS_functionalComponentArgsRest(__VLS_15));
const { default: __VLS_18 } = __VLS_17.slots;
const __VLS_19 = {}.ElInput;
/** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
// @ts-ignore
ElInput;
// @ts-ignore
const __VLS_20 = __VLS_asFunctionalComponent(__VLS_19, new __VLS_19({
    ...{ 'onKeyup': {} },
    ...{ 'onFocus': {} },
    ...{ 'onBlur': {} },
    modelValue: (__VLS_ctx.inputContent),
    placeholder: "e.g., 83 2 1.35.45",
}));
const __VLS_21 = __VLS_20({
    ...{ 'onKeyup': {} },
    ...{ 'onFocus': {} },
    ...{ 'onBlur': {} },
    modelValue: (__VLS_ctx.inputContent),
    placeholder: "e.g., 83 2 1.35.45",
}, ...__VLS_functionalComponentArgsRest(__VLS_20));
let __VLS_23;
let __VLS_24;
const __VLS_25 = ({ keyup: {} },
    { onKeyup: (__VLS_ctx.handleAdd) });
const __VLS_26 = ({ focus: {} },
    { onFocus: (...[$event]) => {
            __VLS_ctx.isInputFocused = true;
            // @ts-ignore
            [inputContent, handleAdd, isInputFocused,];
        } });
const __VLS_27 = ({ blur: {} },
    { onBlur: (...[$event]) => {
            __VLS_ctx.isInputFocused = false;
            // @ts-ignore
            [isInputFocused,];
        } });
var __VLS_22;
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "input-hint" },
});
__VLS_asFunctionalDirective(__VLS_directives.vShow)(null, { ...__VLS_directiveBindingRestFields, value: (__VLS_ctx.isInputFocused) }, null, null);
__VLS_asFunctionalDirective(__VLS_directives.vHtml)(null, { ...__VLS_directiveBindingRestFields, value: (__VLS_ctx.hintText) }, null, null);
// @ts-ignore
[isInputFocused, vShow, vHtml, hintText,];
var __VLS_17;
const __VLS_29 = {}.ElFormItem;
/** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
// @ts-ignore
ElFormItem;
// @ts-ignore
const __VLS_30 = __VLS_asFunctionalComponent(__VLS_29, new __VLS_29({}));
const __VLS_31 = __VLS_30({}, ...__VLS_functionalComponentArgsRest(__VLS_30));
const { default: __VLS_33 } = __VLS_32.slots;
const __VLS_34 = {}.ElCheckbox;
/** @type {[typeof __VLS_components.ElCheckbox, typeof __VLS_components.elCheckbox, ]} */ ;
// @ts-ignore
ElCheckbox;
// @ts-ignore
const __VLS_35 = __VLS_asFunctionalComponent(__VLS_34, new __VLS_34({
    modelValue: (__VLS_ctx.hasSound),
    label: "提示聲",
}));
const __VLS_36 = __VLS_35({
    modelValue: (__VLS_ctx.hasSound),
    label: "提示聲",
}, ...__VLS_functionalComponentArgsRest(__VLS_35));
// @ts-ignore
[hasSound,];
var __VLS_32;
const __VLS_39 = {}.ElFormItem;
/** @type {[typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, typeof __VLS_components.ElFormItem, typeof __VLS_components.elFormItem, ]} */ ;
// @ts-ignore
ElFormItem;
// @ts-ignore
const __VLS_40 = __VLS_asFunctionalComponent(__VLS_39, new __VLS_39({}));
const __VLS_41 = __VLS_40({}, ...__VLS_functionalComponentArgsRest(__VLS_40));
const { default: __VLS_43 } = __VLS_42.slots;
const __VLS_44 = {}.ElButton;
/** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
// @ts-ignore
ElButton;
// @ts-ignore
const __VLS_45 = __VLS_asFunctionalComponent(__VLS_44, new __VLS_44({
    ...{ 'onClick': {} },
    type: "primary",
}));
const __VLS_46 = __VLS_45({
    ...{ 'onClick': {} },
    type: "primary",
}, ...__VLS_functionalComponentArgsRest(__VLS_45));
let __VLS_48;
let __VLS_49;
const __VLS_50 = ({ click: {} },
    { onClick: (__VLS_ctx.handleAdd) });
const { default: __VLS_51 } = __VLS_47.slots;
// @ts-ignore
[handleAdd,];
var __VLS_47;
var __VLS_42;
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "input-form-right" },
});
const __VLS_52 = {}.ElButton;
/** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
// @ts-ignore
ElButton;
// @ts-ignore
const __VLS_53 = __VLS_asFunctionalComponent(__VLS_52, new __VLS_52({
    ...{ 'onClick': {} },
    icon: (__VLS_ctx.isCollapsed ? __VLS_ctx.ArrowDown : __VLS_ctx.ArrowUp),
    circle: true,
}));
const __VLS_54 = __VLS_53({
    ...{ 'onClick': {} },
    icon: (__VLS_ctx.isCollapsed ? __VLS_ctx.ArrowDown : __VLS_ctx.ArrowUp),
    circle: true,
}, ...__VLS_functionalComponentArgsRest(__VLS_53));
let __VLS_56;
let __VLS_57;
const __VLS_58 = ({ click: {} },
    { onClick: (__VLS_ctx.toggleCollapse) });
// @ts-ignore
[isCollapsed, ArrowDown, ArrowUp, toggleCollapse,];
var __VLS_55;
var __VLS_9;
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({});
__VLS_asFunctionalDirective(__VLS_directives.vShow)(null, { ...__VLS_directiveBindingRestFields, value: (!__VLS_ctx.isCollapsed) }, null, null);
// @ts-ignore
[vShow, isCollapsed,];
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ class: "map-buttons-container" },
});
if (!__VLS_ctx.selectedEpisode && !__VLS_ctx.isStarSelection) {
    // @ts-ignore
    [selectedEpisode, isStarSelection,];
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "episode-selection" },
    });
    __VLS_asFunctionalElement(__VLS_elements.h4, __VLS_elements.h4)({});
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "episode-buttons" },
    });
    const __VLS_60 = {}.ElButton;
    /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
    // @ts-ignore
    ElButton;
    // @ts-ignore
    const __VLS_61 = __VLS_asFunctionalComponent(__VLS_60, new __VLS_60({
        ...{ 'onClick': {} },
        type: (__VLS_ctx.isStarSelection ? 'warning' : ''),
    }));
    const __VLS_62 = __VLS_61({
        ...{ 'onClick': {} },
        type: (__VLS_ctx.isStarSelection ? 'warning' : ''),
    }, ...__VLS_functionalComponentArgsRest(__VLS_61));
    let __VLS_64;
    let __VLS_65;
    const __VLS_66 = ({ click: {} },
        { onClick: (...[$event]) => {
                if (!(!__VLS_ctx.selectedEpisode && !__VLS_ctx.isStarSelection))
                    return;
                __VLS_ctx.handleEpisodeSelection('star');
                // @ts-ignore
                [isStarSelection, handleEpisodeSelection,];
            } });
    const { default: __VLS_67 } = __VLS_63.slots;
    const __VLS_68 = {}.ElIcon;
    /** @type {[typeof __VLS_components.ElIcon, typeof __VLS_components.elIcon, typeof __VLS_components.ElIcon, typeof __VLS_components.elIcon, ]} */ ;
    // @ts-ignore
    ElIcon;
    // @ts-ignore
    const __VLS_69 = __VLS_asFunctionalComponent(__VLS_68, new __VLS_68({}));
    const __VLS_70 = __VLS_69({}, ...__VLS_functionalComponentArgsRest(__VLS_69));
    const { default: __VLS_72 } = __VLS_71.slots;
    const __VLS_73 = {}.StarFilled;
    /** @type {[typeof __VLS_components.StarFilled, ]} */ ;
    // @ts-ignore
    StarFilled;
    // @ts-ignore
    const __VLS_74 = __VLS_asFunctionalComponent(__VLS_73, new __VLS_73({}));
    const __VLS_75 = __VLS_74({}, ...__VLS_functionalComponentArgsRest(__VLS_74));
    var __VLS_71;
    var __VLS_63;
    for (const [ep] of __VLS_getVForSourceType((__VLS_ctx.episodes))) {
        // @ts-ignore
        [episodes,];
        const __VLS_78 = {}.ElButton;
        /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
        // @ts-ignore
        ElButton;
        // @ts-ignore
        const __VLS_79 = __VLS_asFunctionalComponent(__VLS_78, new __VLS_78({
            ...{ 'onClick': {} },
            key: (ep),
        }));
        const __VLS_80 = __VLS_79({
            ...{ 'onClick': {} },
            key: (ep),
        }, ...__VLS_functionalComponentArgsRest(__VLS_79));
        let __VLS_82;
        let __VLS_83;
        const __VLS_84 = ({ click: {} },
            { onClick: (...[$event]) => {
                    if (!(!__VLS_ctx.selectedEpisode && !__VLS_ctx.isStarSelection))
                        return;
                    __VLS_ctx.handleEpisodeSelection(ep);
                    // @ts-ignore
                    [handleEpisodeSelection,];
                } });
        const { default: __VLS_85 } = __VLS_81.slots;
        (ep);
        var __VLS_81;
    }
}
else {
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "map-level-selection" },
    });
    __VLS_asFunctionalElement(__VLS_elements.h4, __VLS_elements.h4)({});
    if (__VLS_ctx.isStarSelection) {
        // @ts-ignore
        [isStarSelection,];
    }
    else {
        (__VLS_ctx.selectedEpisode);
        // @ts-ignore
        [selectedEpisode,];
    }
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "map-level-buttons" },
    });
    const __VLS_86 = {}.ElButton;
    /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
    // @ts-ignore
    ElButton;
    // @ts-ignore
    const __VLS_87 = __VLS_asFunctionalComponent(__VLS_86, new __VLS_86({
        ...{ 'onClick': {} },
    }));
    const __VLS_88 = __VLS_87({
        ...{ 'onClick': {} },
    }, ...__VLS_functionalComponentArgsRest(__VLS_87));
    let __VLS_90;
    let __VLS_91;
    const __VLS_92 = ({ click: {} },
        { onClick: (...[$event]) => {
                if (!!(!__VLS_ctx.selectedEpisode && !__VLS_ctx.isStarSelection))
                    return;
                __VLS_ctx.handleEpisodeSelection(0);
                // @ts-ignore
                [handleEpisodeSelection,];
            } });
    const { default: __VLS_93 } = __VLS_89.slots;
    var __VLS_89;
    for (const [map] of __VLS_getVForSourceType((__VLS_ctx.filteredMaps))) {
        // @ts-ignore
        [filteredMaps,];
        const __VLS_94 = {}.ElButton;
        /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
        // @ts-ignore
        ElButton;
        // @ts-ignore
        const __VLS_95 = __VLS_asFunctionalComponent(__VLS_94, new __VLS_94({
            ...{ 'onClick': {} },
            key: (map.level + (map.isStarred ? 'star' : '')),
            type: (__VLS_ctx.getMapButtonType(map)),
        }));
        const __VLS_96 = __VLS_95({
            ...{ 'onClick': {} },
            key: (map.level + (map.isStarred ? 'star' : '')),
            type: (__VLS_ctx.getMapButtonType(map)),
        }, ...__VLS_functionalComponentArgsRest(__VLS_95));
        let __VLS_98;
        let __VLS_99;
        const __VLS_100 = ({ click: {} },
            { onClick: (...[$event]) => {
                    if (!!(!__VLS_ctx.selectedEpisode && !__VLS_ctx.isStarSelection))
                        return;
                    __VLS_ctx.fillMapLevel(map);
                    // @ts-ignore
                    [getMapButtonType, fillMapLevel,];
                } });
        const { default: __VLS_101 } = __VLS_97.slots;
        __VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({
            ...{ class: "map-button-content" },
        });
        __VLS_asFunctionalElement(__VLS_elements.span, __VLS_elements.span)({});
        (map.level);
        (map.name);
        const __VLS_102 = {}.ElIcon;
        /** @type {[typeof __VLS_components.ElIcon, typeof __VLS_components.elIcon, typeof __VLS_components.ElIcon, typeof __VLS_components.elIcon, ]} */ ;
        // @ts-ignore
        ElIcon;
        // @ts-ignore
        const __VLS_103 = __VLS_asFunctionalComponent(__VLS_102, new __VLS_102({
            ...{ 'onClick': {} },
            ...{ class: "star-icon" },
            ...{ class: ({ 'is-starred': map.isStarred }) },
        }));
        const __VLS_104 = __VLS_103({
            ...{ 'onClick': {} },
            ...{ class: "star-icon" },
            ...{ class: ({ 'is-starred': map.isStarred }) },
        }, ...__VLS_functionalComponentArgsRest(__VLS_103));
        let __VLS_106;
        let __VLS_107;
        const __VLS_108 = ({ click: {} },
            { onClick: (...[$event]) => {
                    if (!!(!__VLS_ctx.selectedEpisode && !__VLS_ctx.isStarSelection))
                        return;
                    __VLS_ctx.toggleStar(map);
                    // @ts-ignore
                    [toggleStar,];
                } });
        const { default: __VLS_109 } = __VLS_105.slots;
        const __VLS_110 = {}.StarFilled;
        /** @type {[typeof __VLS_components.StarFilled, ]} */ ;
        // @ts-ignore
        StarFilled;
        // @ts-ignore
        const __VLS_111 = __VLS_asFunctionalComponent(__VLS_110, new __VLS_110({}));
        const __VLS_112 = __VLS_111({}, ...__VLS_functionalComponentArgsRest(__VLS_111));
        var __VLS_105;
        var __VLS_97;
    }
}
if (__VLS_ctx.hasValidMapLevel) {
    // @ts-ignore
    [hasValidMapLevel,];
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "channel-selection" },
    });
    __VLS_asFunctionalElement(__VLS_elements.h4, __VLS_elements.h4)({});
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "channel-buttons" },
    });
    for (const [channel] of __VLS_getVForSourceType((10))) {
        const __VLS_115 = {}.ElButton;
        /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
        // @ts-ignore
        ElButton;
        // @ts-ignore
        const __VLS_116 = __VLS_asFunctionalComponent(__VLS_115, new __VLS_115({
            ...{ 'onClick': {} },
            key: (channel),
            type: (__VLS_ctx.getChannelButtonType(channel)),
        }));
        const __VLS_117 = __VLS_116({
            ...{ 'onClick': {} },
            key: (channel),
            type: (__VLS_ctx.getChannelButtonType(channel)),
        }, ...__VLS_functionalComponentArgsRest(__VLS_116));
        let __VLS_119;
        let __VLS_120;
        const __VLS_121 = ({ click: {} },
            { onClick: (...[$event]) => {
                    if (!(__VLS_ctx.hasValidMapLevel))
                        return;
                    __VLS_ctx.fillChannel(channel);
                    // @ts-ignore
                    [getChannelButtonType, fillChannel,];
                } });
        const { default: __VLS_122 } = __VLS_118.slots;
        (channel);
        var __VLS_118;
    }
    const __VLS_123 = {}.ElButtonGroup;
    /** @type {[typeof __VLS_components.ElButtonGroup, typeof __VLS_components.elButtonGroup, typeof __VLS_components.ElButtonGroup, typeof __VLS_components.elButtonGroup, ]} */ ;
    // @ts-ignore
    ElButtonGroup;
    // @ts-ignore
    const __VLS_124 = __VLS_asFunctionalComponent(__VLS_123, new __VLS_123({}));
    const __VLS_125 = __VLS_124({}, ...__VLS_functionalComponentArgsRest(__VLS_124));
    const { default: __VLS_127 } = __VLS_126.slots;
    const __VLS_128 = {}.ElButton;
    /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
    // @ts-ignore
    ElButton;
    // @ts-ignore
    const __VLS_129 = __VLS_asFunctionalComponent(__VLS_128, new __VLS_128({
        ...{ 'onClick': {} },
    }));
    const __VLS_130 = __VLS_129({
        ...{ 'onClick': {} },
    }, ...__VLS_functionalComponentArgsRest(__VLS_129));
    let __VLS_132;
    let __VLS_133;
    const __VLS_134 = ({ click: {} },
        { onClick: (...[$event]) => {
                if (!(__VLS_ctx.hasValidMapLevel))
                    return;
                __VLS_ctx.changeChannel(-1);
                // @ts-ignore
                [changeChannel,];
            } });
    const { default: __VLS_135 } = __VLS_131.slots;
    var __VLS_131;
    const __VLS_136 = {}.ElButton;
    /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
    // @ts-ignore
    ElButton;
    // @ts-ignore
    const __VLS_137 = __VLS_asFunctionalComponent(__VLS_136, new __VLS_136({
        ...{ 'onClick': {} },
    }));
    const __VLS_138 = __VLS_137({
        ...{ 'onClick': {} },
    }, ...__VLS_functionalComponentArgsRest(__VLS_137));
    let __VLS_140;
    let __VLS_141;
    const __VLS_142 = ({ click: {} },
        { onClick: (...[$event]) => {
                if (!(__VLS_ctx.hasValidMapLevel))
                    return;
                __VLS_ctx.changeChannel(1);
                // @ts-ignore
                [changeChannel,];
            } });
    const { default: __VLS_143 } = __VLS_139.slots;
    var __VLS_139;
    var __VLS_126;
}
if (__VLS_ctx.isChannelConfirmed) {
    // @ts-ignore
    [isChannelConfirmed,];
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "state-selection" },
    });
    __VLS_asFunctionalElement(__VLS_elements.h4, __VLS_elements.h4)({});
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        ...{ class: "state-buttons" },
    });
    for (const [stage] of __VLS_getVForSourceType((__VLS_ctx.selectedMapMaxStages))) {
        // @ts-ignore
        [selectedMapMaxStages,];
        const __VLS_144 = {}.ElButton;
        /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
        // @ts-ignore
        ElButton;
        // @ts-ignore
        const __VLS_145 = __VLS_asFunctionalComponent(__VLS_144, new __VLS_144({
            ...{ 'onClick': {} },
            key: (stage),
            type: (__VLS_ctx.getStateButtonType(`${stage}/${__VLS_ctx.selectedMapMaxStages}`)),
        }));
        const __VLS_146 = __VLS_145({
            ...{ 'onClick': {} },
            key: (stage),
            type: (__VLS_ctx.getStateButtonType(`${stage}/${__VLS_ctx.selectedMapMaxStages}`)),
        }, ...__VLS_functionalComponentArgsRest(__VLS_145));
        let __VLS_148;
        let __VLS_149;
        const __VLS_150 = ({ click: {} },
            { onClick: (...[$event]) => {
                    if (!(__VLS_ctx.isChannelConfirmed))
                        return;
                    __VLS_ctx.fillState(`${stage}/${__VLS_ctx.selectedMapMaxStages}`);
                    // @ts-ignore
                    [selectedMapMaxStages, selectedMapMaxStages, getStateButtonType, fillState,];
                } });
        const { default: __VLS_151 } = __VLS_147.slots;
        (stage);
        (__VLS_ctx.selectedMapMaxStages);
        // @ts-ignore
        [selectedMapMaxStages,];
        var __VLS_147;
    }
    const __VLS_152 = {}.ElButton;
    /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
    // @ts-ignore
    ElButton;
    // @ts-ignore
    const __VLS_153 = __VLS_asFunctionalComponent(__VLS_152, new __VLS_152({
        ...{ 'onClick': {} },
        type: (__VLS_ctx.getStateButtonType('on')),
    }));
    const __VLS_154 = __VLS_153({
        ...{ 'onClick': {} },
        type: (__VLS_ctx.getStateButtonType('on')),
    }, ...__VLS_functionalComponentArgsRest(__VLS_153));
    let __VLS_156;
    let __VLS_157;
    const __VLS_158 = ({ click: {} },
        { onClick: (...[$event]) => {
                if (!(__VLS_ctx.isChannelConfirmed))
                    return;
                __VLS_ctx.fillState('on');
                // @ts-ignore
                [getStateButtonType, fillState,];
            } });
    const { default: __VLS_159 } = __VLS_155.slots;
    var __VLS_155;
    const __VLS_160 = {}.ElInput;
    /** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
    // @ts-ignore
    ElInput;
    // @ts-ignore
    const __VLS_161 = __VLS_asFunctionalComponent(__VLS_160, new __VLS_160({
        ...{ 'onKeyup': {} },
        modelValue: (__VLS_ctx.timeInput),
        placeholder: "e.g., 1:10:05 或 25.10",
        ...{ style: {} },
    }));
    const __VLS_162 = __VLS_161({
        ...{ 'onKeyup': {} },
        modelValue: (__VLS_ctx.timeInput),
        placeholder: "e.g., 1:10:05 或 25.10",
        ...{ style: {} },
    }, ...__VLS_functionalComponentArgsRest(__VLS_161));
    let __VLS_164;
    let __VLS_165;
    const __VLS_166 = ({ keyup: {} },
        { onKeyup: (__VLS_ctx.handleAdd) });
    // @ts-ignore
    [handleAdd, timeInput,];
    var __VLS_163;
    if (__VLS_ctx.timeInput.length > 0) {
        // @ts-ignore
        [timeInput,];
        const __VLS_168 = {}.ElButton;
        /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
        // @ts-ignore
        ElButton;
        // @ts-ignore
        const __VLS_169 = __VLS_asFunctionalComponent(__VLS_168, new __VLS_168({
            ...{ 'onClick': {} },
            type: "primary",
            ...{ class: "add-button-bottom" },
        }));
        const __VLS_170 = __VLS_169({
            ...{ 'onClick': {} },
            type: "primary",
            ...{ class: "add-button-bottom" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_169));
        let __VLS_172;
        let __VLS_173;
        const __VLS_174 = ({ click: {} },
            { onClick: (__VLS_ctx.handleAdd) });
        const { default: __VLS_175 } = __VLS_171.slots;
        // @ts-ignore
        [handleAdd,];
        var __VLS_171;
    }
}
var __VLS_3;
/** @type {__VLS_StyleScopedClasses['input-form']} */ ;
/** @type {__VLS_StyleScopedClasses['input-form-left']} */ ;
/** @type {__VLS_StyleScopedClasses['input-hint']} */ ;
/** @type {__VLS_StyleScopedClasses['input-form-right']} */ ;
/** @type {__VLS_StyleScopedClasses['map-buttons-container']} */ ;
/** @type {__VLS_StyleScopedClasses['episode-selection']} */ ;
/** @type {__VLS_StyleScopedClasses['episode-buttons']} */ ;
/** @type {__VLS_StyleScopedClasses['map-level-selection']} */ ;
/** @type {__VLS_StyleScopedClasses['map-level-buttons']} */ ;
/** @type {__VLS_StyleScopedClasses['map-button-content']} */ ;
/** @type {__VLS_StyleScopedClasses['star-icon']} */ ;
/** @type {__VLS_StyleScopedClasses['is-starred']} */ ;
/** @type {__VLS_StyleScopedClasses['channel-selection']} */ ;
/** @type {__VLS_StyleScopedClasses['channel-buttons']} */ ;
/** @type {__VLS_StyleScopedClasses['state-selection']} */ ;
/** @type {__VLS_StyleScopedClasses['state-buttons']} */ ;
/** @type {__VLS_StyleScopedClasses['add-button-bottom']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup: () => ({
        ElButton: ElButton,
        ArrowUp: ArrowUp,
        ArrowDown: ArrowDown,
        StarFilled: StarFilled,
        inputContent: inputContent,
        timeInput: timeInput,
        hasSound: hasSound,
        selectedEpisode: selectedEpisode,
        isStarSelection: isStarSelection,
        isCollapsed: isCollapsed,
        isChannelConfirmed: isChannelConfirmed,
        isInputFocused: isInputFocused,
        hintText: hintText,
        toggleCollapse: toggleCollapse,
        episodes: episodes,
        filteredMaps: filteredMaps,
        hasValidMapLevel: hasValidMapLevel,
        selectedMapMaxStages: selectedMapMaxStages,
        getMapButtonType: getMapButtonType,
        getChannelButtonType: getChannelButtonType,
        getStateButtonType: getStateButtonType,
        handleEpisodeSelection: handleEpisodeSelection,
        fillMapLevel: fillMapLevel,
        fillChannel: fillChannel,
        changeChannel: changeChannel,
        fillState: fillState,
        toggleStar: toggleStar,
        handleAdd: handleAdd,
    }),
    emits: {},
    props: {
        hasSound: Boolean,
        maps: Array,
    },
});
export default (await import('vue')).defineComponent({
    emits: {},
    props: {
        hasSound: Boolean,
        maps: Array,
    },
});
; /* PartiallyEnd: #4569/main.vue */
