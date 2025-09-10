<template>
  <el-card>
    <div v-if="notes.length === 0" class="no-notes-message">沒有任何記錄。</div>
    <div v-else>
      <div class="list-actions">
        <el-button @click="sortNotes">
          {{ sortButtonText }}
        </el-button>
        <el-button @click="handleToggleAllSound" :disabled="notes.length === 0">
         <span>{{ toggleAllSoundButtonText }}</span> 
         <el-icon style="padding-left: 5px;">
          <template v-if="isAllSoundOn"><Bell /></template>
          <template v-else><BellFilled /></template>
         </el-icon>
        </el-button>
        <el-button
          type="danger"
          @click="handleClearAll"
          :disabled="notes.length === 0"
        >
          一鍵清除
        </el-button>
      </div>
      <el-row class="list-header" :gutter="10">
        <el-col :span="1"></el-col>
        <el-col :span="3">區域</el-col>
        <el-col :span="7">地圖</el-col>
        <el-col :span="3">
          分流
          <el-button
            size="small"
            type=""
            :icon="Setting"
            @click="toggleChannelAdjust"
          />
        </el-col>
        <el-col :span="6">
          狀態
          <el-button size="small" type="" @click="toggleTimeDisplay">
            切換CD時間
          </el-button>
        </el-col>
        <el-col :span="4">操作</el-col>
      </el-row>

      <transition-group name="list-item" tag="div">
        <el-row
          v-for="note in notes"
          :key="note.id"
          class="list-item"
          :class="{
            'over-time-limit': isOverTimeLimit(note),
            'warning-row': note.isWarning,
            'highlight-row': note.isHighlight,
          }"
          :gutter="10"
        >
          <el-col :span="1">
            <el-icon class="sound-icon" @click.stop="toggleSound(note)">
              <template v-if="note.hasSound"><BellFilled /></template>
              <template v-else><Bell /></template>
            </el-icon>
          </el-col>
          <el-col :span="3">EP.{{ getEpisode(note.mapLevel) }}</el-col>
          <el-col :span="7">
            <span class="map-name-content">
              <span
                >Lv.{{ note.mapLevel }} {{ getMapName(note.mapLevel) }}</span
              >
              <el-icon
                class="star-icon"
                :class="{ 'is-starred': isMapStarred(note.mapLevel) }"
                @click.stop="toggleStar(note.mapLevel)"
              >
                <StarFilled />
              </el-icon>
            </span>
          </el-col>
          <el-col :span="3" style="display: flex; justify-content: space-around;">
            <el-button size="small" v-if="showChannelAdjust" @click="channelAdjust(note,-1)">-</el-button>
            <div>{{ note.channel }}</div>
            <el-button size="small" v-if="showChannelAdjust" @click="channelAdjust(note,1)">+</el-button>
          </el-col>
          <el-col :span="6">
            <span v-if="note.state === 'CD' && note.respawnTime <= currentTime">
              <el-button
                type="warning"
                size="small"
                @click="handleExpiredClick(note)"
                >{{ getStatusText(note) }}</el-button
              >
            </span>
            <span v-else-if="note.state.startsWith('STAGE_')">
              <el-button
                type="primary"
                size="small"
                @click="handleExpiredClick(note)"
                >{{ getStatusText(note) }}</el-button
              >
            </span>
            <span v-else>
              {{ getStatusText(note) }}
            </span>
          </el-col>
          <el-col :span="4">
            <el-button type="danger" size="small" @click="handleDelete(note.id)"
              >刪除</el-button
            >
          </el-col>
        </el-row>
      </transition-group>
    </div>
  </el-card>
</template>

<script setup lang="ts">
import {
  ref,
  defineProps,
  defineEmits,
  onMounted,
  onUnmounted,
  h,
  computed,
} from "vue";
import { ElMessage, ElMessageBox, ElButton, ElIcon } from "element-plus";
import type { Note, NoteState } from "@/types/Note";
import type { MapData } from "@/data/maps";
import { StarFilled, Bell, BellFilled, Setting } from "@element-plus/icons-vue";

const props = defineProps<{
  notes: Note[];
  currentSortMode: "time" | "map";
  maps: MapData[];
}>();

const emit = defineEmits([
  "delete-note",
  "clear-notes",
  "toggle-sort",
  "update-note-status",
  "update-note-channel",
  "toggle-input-sound",
  "update-map-star",
]);

const currentTime = ref(Date.now());
let timer: ReturnType<typeof setInterval> | null = null;
let soundChecker: ReturnType<typeof setInterval> | null = null;
const showLocalTime = ref(false);
const showChannelAdjust = ref(false);

const ON_TIME_LIMIT_MS = 30 * 60 * 1000;
const isAllSoundOn = ref(true);

const toggleTimeDisplay = () => {
  showLocalTime.value = !showLocalTime.value;
};

const toggleChannelAdjust = () => {
  showChannelAdjust.value = !showChannelAdjust.value;
  if(!showChannelAdjust.value) {
      toggleHightlight(false);
  }
};

const channelAdjust = (note: Note, delta: number) =>{
  let currentChannel = note.channel;
  const newChannel = currentChannel + delta;

  if (newChannel >= 1) {
    emit("update-note-channel", note.id, newChannel);
    if(!note.isHighlight) {
      toggleHightlight(true,note.mapLevel);
    }
  } else {
    ElMessage({
      message: "分流已是最小，無法再減少",
      type: "warning",
    });
  }
}

const toggleHightlight = (on:boolean, target:number = 0) => {
    for (const note of props.notes) {
      // 編輯分流時提示所有相同地圖
      if ( on && note.mapLevel == target) {
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
}

const getMapName = (level: number) => {
  const map = props.maps.find((m) => m.level === level);
  return map ? map.name : "未知地圖";
};

const speakNoteDetails = (note: Note) => {
  if ("speechSynthesis" in window) {
    const mapName = getMapName(note.mapLevel);
    const utterance = new SpeechSynthesisUtterance();

    utterance.text = `E P ${getEpisode(note.mapLevel)}, ${mapName} 分流 ${
      note.channel
    }, CD已結束`;
    utterance.lang = "zh-TW";

    window.speechSynthesis.speak(utterance);
  } else {
    console.error("瀏覽器不支持語音合成 API。");
  }
};

const checkAndPlaySound = () => {
  const now = Date.now();
  for (const note of props.notes) {
    if (
      note.state === "CD" &&
      note.hasSound &&
      !note.hasAlerted &&
      note.respawnTime <= now
    ) {
      speakNoteDetails(note);
      note.hasAlerted = true;
    }
  }
};

const sortButtonText = computed(() => {
  if (props.currentSortMode === "time") {
    return "依地圖等級排序";
  } else {
    return "依時間排序";
  }
});

const toggleAllSoundButtonText = computed(() => {
  return isAllSoundOn.value ? "提示聲全關" : "提示聲全開";
});

const handleExpiredClick = (note: Note) => {
  ElMessageBox({
    title: "更新狀態",
    message: h(
      "div",
      { style: "display: flex; flex-direction: column; align-items: center;" },
      [
        h("div", { style: "width: 120px; margin-bottom: 10px;" }, [
          h(
            ElButton,
            {
              type: "success",
              onClick: () => handleSelection("on"),
              style: "width: 100%;",
            },
            () => "ON"
          ),
        ]),
        ...Array.from({ length: note.maxStages || 5 }, (_, i) =>
          h("div", { style: "width: 120px; margin-bottom: 10px;" }, [
            h(
              ElButton,
              {
                type: "",
                onClick: () => handleSelection(`stage_${i + 1}`),
                style: "width: 100%;",
              },
              () => `階段 ${i + 1}/${note.maxStages || 5}`
            ),
          ])
        ),
      ]
    ),
    showCancelButton: false,
    showConfirmButton: false,
    showClose: true,
    center: true,
  });

  const handleSelection = (action: string) => {
    ElMessageBox.close();

    let newState: NoteState;
    let newTime: number | null = null;

    if (action === "on") {
      newState = "ON";
      newTime = Date.now();
    } else {
      const stage = action.split("_")[1];
      newState = `STAGE_${stage}` as NoteState;
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

const getEpisode = (level: number) => {
  const map = props.maps.find((m) => m.level === level);
  return map ? map.episode : "未知";
};

const formatTime = (seconds: number) => {
  if (seconds < 0) seconds = 0;
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(
    2,
    "0"
  )}:${String(remainingSeconds).padStart(2, "0")}`;
};

const getStatusText = (note: Note) => {
  const now = currentTime.value;

  if (note.state === "ON") {
    const elapsedSeconds = Math.floor((now - (note.onTime || now)) / 1000);
    return `ON 已出現 ${formatTime(elapsedSeconds)}+`;
  } else if (note.state.startsWith("STAGE_")) {
    const stage = note.state.replace("STAGE_", "");
    return `階段 ${stage}/${note.maxStages}`;
  } else if (note.state === "CD") {
    const diffInSeconds = Math.floor((note.respawnTime - now) / 1000);
    if (diffInSeconds > 0) {
      if (showLocalTime.value) {
        const localTime = new Date(note.respawnTime || 0).toLocaleTimeString(
          "zh-TW",
          { hour12: false }
        );
        return `開始於 ${localTime}`;
      } else {
        return `CD時間 ${formatTime(diffInSeconds)}`;
      }
    } else {
      const elapsedSeconds = Math.abs(diffInSeconds);
      return `CD已過 ${formatTime(elapsedSeconds)}`;
    }
  }
  return "";
};

const isOverTimeLimit = (note: Note) => {
  if (note.state === "ON" && note.onTime) {
    return currentTime.value - note.onTime > ON_TIME_LIMIT_MS;
  }
  return false;
};

const isMapStarred = (mapLevel: number) => {
  const map = props.maps.find((m) => m.level === mapLevel);
  return map ? map.isStarred : false;
};

const toggleStar = (mapLevel: number) => {
  emit("update-map-star", mapLevel);
};

const toggleSound = (note: Note) => {
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

const handleDelete = (id: string) => {
  emit("delete-note", id);
};

const handleClearAll = async () => {
  try {
    await ElMessageBox.confirm(
      "確定要清空所有記錄嗎？此操作無法復原。",
      "警告",
      {
        confirmButtonText: "確定",
        cancelButtonText: "取消",
        type: "warning",
      }
    );
    emit("clear-notes");
    ElMessage({
      type: "success",
      message: "所有記錄已清空",
    });
  } catch (err) {
    ElMessage({
      type: "info",
      message: "已取消清空",
    });
  }
};
</script>

<style scoped>
.no-notes-message {
  text-align: center;
  padding: 20px;
  color: #909399;
}
.list-actions {
  text-align: left;
  margin-bottom: 10px;
}
.list-header {
  font-weight: bold;
  border-bottom: 2px solid #ebeef5;
  padding-bottom: 10px;
  margin-bottom: 10px;
}
.list-item {
  border-bottom: 1px solid #ebeef5;
  padding: 10px 0;
  transition: transform 0.5s ease, opacity 0.5s ease, background-color 0.5s ease;
}

.list-item-enter-from {
  opacity: 0;
  transform: translateY(-20px);
}
.list-item-enter-to {
  background-color: transparent;
}
.list-item-enter-active {
  transition: all 0.5s ease;
  background-color: #e6f7ff;
}
.list-item-leave-to {
  opacity: 0;
  transform: translateY(20px);
}
.list-item-move {
  transition: transform 0.5s ease;
}

.over-time-limit {
  color: #909399;
}

.warning-row {
  background-color: #ffe6e6 !important;
  border-left: 5px solid #ff4d4f;
}

.highlight-row {
  background-color: #dce6af !important;
}

.map-name-content {
  display: flex;
  align-items: center;
  gap: 5px;
}

.star-icon {
  font-size: 1.2em;
  cursor: pointer;
  color: #c0c4cc;
}

.star-icon.is-starred {
  color: #f5c723;
}

.sound-icon {
  font-size: 1.2em;
  cursor: pointer;
}
</style>
