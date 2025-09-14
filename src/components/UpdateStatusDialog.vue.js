// src/components/UpdateStatusDialog.vue
import { ref, defineProps, defineEmits, watch, inject } from "vue";
import { ElMessage } from "element-plus";
const featureFlags = inject("feature-flags");
const props = defineProps();
const emit = defineEmits([
    "update:modelValue",
    "update-note-status",
    "update-note-cd",
]);
const newCdTimeInput = ref("");
watch(() => props.currentNote, () => {
    newCdTimeInput.value = "";
});
const handleSelection = (action) => {
    emit("update:modelValue", false);
    if (!props.currentNote)
        return;
    let newState;
    let newTime = null;
    if (action === "on") {
        newState = "ON";
        newTime =
            props.currentNote.state === "ON" ? props.currentNote.onTime : Date.now();
    }
    else {
        const stage = action.split("_")[1];
        newState = `STAGE_${stage}`;
        newTime =
            props.currentNote.state === `STAGE_${stage}` &&
                props.currentNote.stageTime
                ? props.currentNote.stageTime
                : Date.now();
    }
    emit("update-note-status", props.currentNote.id, newState, newTime);
};
const handleCustomCd = () => {
    const timeStr = newCdTimeInput.value.trim();
    let respawnTime = null;
    if (!timeStr) {
        ElMessage.error("請輸入時間！");
        return;
    }
    if (timeStr.includes(":") || timeStr.includes(".")) {
        const timeParts = featureFlags?.value.nosec
            ? (timeStr + ".0").split(/[.:]/).map(Number)
            : timeStr.split(/[.:]/).map(Number);
        let totalSeconds = 0;
        if (timeParts.length === 2) {
            totalSeconds = timeParts[0] * 60 + (timeParts[1] || 0);
        }
        else if (timeParts.length === 3) {
            totalSeconds =
                timeParts[0] * 3600 + timeParts[1] * 60 + (timeParts[2] || 0);
        }
        else {
            // nosec?
            ElMessage.error("時間格式錯誤，請使用 mm:ss 或 hh:mm:ss");
            return;
        }
        respawnTime = Date.now() + totalSeconds * 1000;
    }
    else if (!isNaN(parseInt(timeStr))) {
        // 【修正】這裡的邏輯現在與您的原始程式碼完全相同
        const minutes = parseInt(timeStr);
        respawnTime = Date.now() + minutes * 60 * 1000;
    }
    else {
        ElMessage.error("時間格式錯誤，請輸入有效數字或時間格式");
        return;
    }
    if (respawnTime === null) {
        ElMessage.error("無法解析時間");
        return;
    }
    emit("update:modelValue", false);
    // 【修正】直接發出時間戳給 App.vue
    emit("update-note-cd", props.currentNote?.id, respawnTime);
};
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_elements;
let __VLS_components;
let __VLS_directives;
const __VLS_0 = {}.ElDialog;
/** @type {[typeof __VLS_components.ElDialog, typeof __VLS_components.elDialog, typeof __VLS_components.ElDialog, typeof __VLS_components.elDialog, ]} */ ;
// @ts-ignore
ElDialog;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent(__VLS_0, new __VLS_0({
    ...{ 'onUpdate:modelValue': {} },
    modelValue: (__VLS_ctx.modelValue),
    title: "更新狀態",
    width: "400px",
    showClose: (false),
    closeOnClickModal: (true),
    alignCenter: true,
}));
const __VLS_2 = __VLS_1({
    ...{ 'onUpdate:modelValue': {} },
    modelValue: (__VLS_ctx.modelValue),
    title: "更新狀態",
    width: "400px",
    showClose: (false),
    closeOnClickModal: (true),
    alignCenter: true,
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
let __VLS_4;
let __VLS_5;
const __VLS_6 = ({ 'update:modelValue': {} },
    { 'onUpdate:modelValue': (...[$event]) => {
            __VLS_ctx.$emit('update:modelValue', $event);
            // @ts-ignore
            [modelValue, $emit,];
        } });
var __VLS_7 = {};
const { default: __VLS_8 } = __VLS_3.slots;
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ style: {} },
});
if (__VLS_ctx.featureFlags?.nosec) {
    // @ts-ignore
    [featureFlags,];
    const __VLS_9 = {}.ElInput;
    /** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
    // @ts-ignore
    ElInput;
    // @ts-ignore
    const __VLS_10 = __VLS_asFunctionalComponent(__VLS_9, new __VLS_9({
        ...{ 'onKeyup': {} },
        modelValue: (__VLS_ctx.newCdTimeInput),
        placeholder: "時.分 + enter",
        ...{ style: {} },
    }));
    const __VLS_11 = __VLS_10({
        ...{ 'onKeyup': {} },
        modelValue: (__VLS_ctx.newCdTimeInput),
        placeholder: "時.分 + enter",
        ...{ style: {} },
    }, ...__VLS_functionalComponentArgsRest(__VLS_10));
    let __VLS_13;
    let __VLS_14;
    const __VLS_15 = ({ keyup: {} },
        { onKeyup: (__VLS_ctx.handleCustomCd) });
    // @ts-ignore
    [newCdTimeInput, handleCustomCd,];
    var __VLS_12;
}
else {
    const __VLS_17 = {}.ElInput;
    /** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
    // @ts-ignore
    ElInput;
    // @ts-ignore
    const __VLS_18 = __VLS_asFunctionalComponent(__VLS_17, new __VLS_17({
        ...{ 'onKeyup': {} },
        modelValue: (__VLS_ctx.newCdTimeInput),
        placeholder: "時.分.秒 + enter",
        ...{ style: {} },
    }));
    const __VLS_19 = __VLS_18({
        ...{ 'onKeyup': {} },
        modelValue: (__VLS_ctx.newCdTimeInput),
        placeholder: "時.分.秒 + enter",
        ...{ style: {} },
    }, ...__VLS_functionalComponentArgsRest(__VLS_18));
    let __VLS_21;
    let __VLS_22;
    const __VLS_23 = ({ keyup: {} },
        { onKeyup: (__VLS_ctx.handleCustomCd) });
    // @ts-ignore
    [newCdTimeInput, handleCustomCd,];
    var __VLS_20;
}
const __VLS_25 = {}.ElButton;
/** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
// @ts-ignore
ElButton;
// @ts-ignore
const __VLS_26 = __VLS_asFunctionalComponent(__VLS_25, new __VLS_25({
    ...{ 'onClick': {} },
    type: "warning",
    ...{ style: {} },
}));
const __VLS_27 = __VLS_26({
    ...{ 'onClick': {} },
    type: "warning",
    ...{ style: {} },
}, ...__VLS_functionalComponentArgsRest(__VLS_26));
let __VLS_29;
let __VLS_30;
const __VLS_31 = ({ click: {} },
    { onClick: (__VLS_ctx.handleCustomCd) });
const { default: __VLS_32 } = __VLS_28.slots;
// @ts-ignore
[handleCustomCd,];
var __VLS_28;
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    ...{ style: {} },
});
for (const [i] of __VLS_getVForSourceType((__VLS_ctx.currentNote?.maxStages || 4))) {
    // @ts-ignore
    [currentNote,];
    __VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
        key: (`stage-${i}`),
        ...{ style: {} },
    });
    const __VLS_33 = {}.ElButton;
    /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
    // @ts-ignore
    ElButton;
    // @ts-ignore
    const __VLS_34 = __VLS_asFunctionalComponent(__VLS_33, new __VLS_33({
        ...{ 'onClick': {} },
        ...{ style: {} },
    }));
    const __VLS_35 = __VLS_34({
        ...{ 'onClick': {} },
        ...{ style: {} },
    }, ...__VLS_functionalComponentArgsRest(__VLS_34));
    let __VLS_37;
    let __VLS_38;
    const __VLS_39 = ({ click: {} },
        { onClick: (...[$event]) => {
                __VLS_ctx.handleSelection(`stage_${i}`);
                // @ts-ignore
                [handleSelection,];
            } });
    const { default: __VLS_40 } = __VLS_36.slots;
    (i);
    (__VLS_ctx.currentNote?.maxStages || 4);
    // @ts-ignore
    [currentNote,];
    var __VLS_36;
}
__VLS_asFunctionalElement(__VLS_elements.div, __VLS_elements.div)({
    span: (24),
    ...{ style: {} },
});
const __VLS_41 = {}.ElButton;
/** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
// @ts-ignore
ElButton;
// @ts-ignore
const __VLS_42 = __VLS_asFunctionalComponent(__VLS_41, new __VLS_41({
    ...{ 'onClick': {} },
    type: "success",
    ...{ style: {} },
}));
const __VLS_43 = __VLS_42({
    ...{ 'onClick': {} },
    type: "success",
    ...{ style: {} },
}, ...__VLS_functionalComponentArgsRest(__VLS_42));
let __VLS_45;
let __VLS_46;
const __VLS_47 = ({ click: {} },
    { onClick: (...[$event]) => {
            __VLS_ctx.handleSelection('on');
            // @ts-ignore
            [handleSelection,];
        } });
const { default: __VLS_48 } = __VLS_44.slots;
var __VLS_44;
var __VLS_3;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup: () => ({
        featureFlags: featureFlags,
        newCdTimeInput: newCdTimeInput,
        handleSelection: handleSelection,
        handleCustomCd: handleCustomCd,
    }),
    emits: {},
    __typeProps: {},
});
export default (await import('vue')).defineComponent({
    emits: {},
    __typeProps: {},
});
; /* PartiallyEnd: #4569/main.vue */
