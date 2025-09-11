<template>
  <el-card>
    <el-form class="input-form" @submit.prevent>
      <div class="input-form-left">
        <el-form-item label="地圖 分流 時間or狀態">
          <el-input
            v-model="inputContent"
            placeholder="e.g., 83 2 1.35.45"
            @keyup.enter="handleAdd"
            @focus="isInputFocused = true"
            @blur="isInputFocused = false"
          />
          <div
            v-show="isInputFocused"
            class="input-hint"
            v-html="hintText"
          ></div>
        </el-form-item>
        <el-form-item>
          <el-checkbox v-model="hasSound" label="提示聲" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleAdd">新增</el-button>
        </el-form-item>
      </div>
      <div class="input-form-right">
        <el-button
          :icon="isCollapsed ? ArrowDown : ArrowUp"
          circle
          @click="toggleCollapse"
        />
      </div>
    </el-form>

    <div v-show="!isCollapsed">
      <div class="map-buttons-container">
        <div
          v-if="!selectedEpisode && !isStarSelection"
          class="episode-selection"
        >
          <h4>請選擇章節：</h4>
          <div class="episode-buttons">
            <el-button
              :type="isStarSelection ? 'warning' : ''"
              @click="handleEpisodeSelection('star')"
            >
              <el-icon><StarFilled /></el-icon>
            </el-button>
            <el-button
              v-for="ep in episodes"
              :key="ep"
              @click="handleEpisodeSelection(ep)"
            >
              EP{{ ep }}
            </el-button>
          </div>
        </div>

        <div v-else class="map-level-selection">
          <h4>
            <template v-if="isStarSelection">收藏的地圖：</template>
            <template v-else>EP{{ selectedEpisode }} 地圖：</template>
          </h4>
          <div class="map-level-buttons">
            <el-button @click="handleEpisodeSelection(0)">回上頁</el-button>
            <el-button
              v-for="map in filteredMaps"
              :key="map.level + (map.isStarred ? 'star' : '')"
              :type="getMapButtonType(map)"
              @click="fillMapLevel(map)"
            >
              <span class="map-button-content">
                <span>Lv.{{ map.level }} {{ map.name }}</span>
                <el-icon
                  class="star-icon"
                  :class="{ 'is-starred': map.isStarred }"
                  @click.stop="toggleStar(map)"
                >
                  <StarFilled />
                </el-icon>
              </span>
            </el-button>
          </div>
        </div>
      </div>

      <div v-if="hasValidMapLevel" class="channel-selection">
        <h4>請選擇分流：</h4>
        <div class="channel-buttons">
          <el-button
            v-for="channel in 10"
            :key="channel"
            :type="getChannelButtonType(channel)"
            @click="fillChannel(channel)"
          >
            Ch.{{ channel }}
          </el-button>
          <el-button-group>
            <el-button @click="changeChannel(-1)">-</el-button>
            <el-button @click="changeChannel(1)">+</el-button>
          </el-button-group>
        </div>
      </div>

      <div v-if="isChannelConfirmed" class="state-selection">
        <h4>請選擇狀態或輸入時間：</h4>
        <div class="state-buttons">
          <el-button
            v-for="stage in selectedMapMaxStages"
            :key="stage"
            :type="getStateButtonType(`${stage}/${selectedMapMaxStages}`)"
            @click="fillState(`${stage}/${selectedMapMaxStages}`)"
          >
            {{ stage }}/{{ selectedMapMaxStages }}
          </el-button>
          <el-button :type="getStateButtonType('on')" @click="fillState('on')">
            ON
          </el-button>
          <el-input
            v-model="timeInput"
            placeholder="e.g., 1:10:05 或 25.10"
            style="width: 150px"
            @keyup.enter="handleAdd"
          />
        </div>
        <el-button
          v-if="timeInput.length > 0"
          type="primary"
          @click="handleAdd"
          class="add-button-bottom"
        >
          新增
        </el-button>
      </div>
    </div>
  </el-card>
</template>

<script setup lang="ts">
import { ref, defineEmits, computed, watch, h, defineProps } from "vue";
import { ElMessage, ElMessageBox, ElButton } from "element-plus";
import { ArrowUp, ArrowDown, StarFilled } from "@element-plus/icons-vue";
import type { Note, NoteState } from "@/types/Note";
import type { MapData } from "@/data/maps";

const props = defineProps({
  hasSound: Boolean,
  maps: Array as () => MapData[],
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

watch(
  () => props.hasSound,
  (newVal) => {
    hasSound.value = newVal;
  }
);

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
  const uniqueEpisodes = new Set(
    props.maps!.map((map) => (map as any).episode)
  );
  return Array.from(uniqueEpisodes).sort((a, b) => a - b);
});

const filteredMaps = computed(() => {
  if (isStarSelection.value) {
    return props.maps!.filter((map) => (map as any).isStarred) as MapData[];
  }
  return props.maps!.filter(
    (map) => (map as any).episode === selectedEpisode.value
  ) as MapData[];
});

const parseInput = (value: string) => {
  const parts = value.trim().split(/\s+/);
  const result: {
    mapLevel: number | null;
    mapName: string | null;
    channel: number | null;
    timeStr: string | null;
  } = {
    mapLevel: null,
    mapName: null,
    channel: null,
    timeStr: null,
  };

  if (parts.length === 0) return result;

  // 第一部分：解析地圖等級
  result.mapLevel = parseInt(parts[0]);
  if (isNaN(result.mapLevel)) return result;

  // 第二部分：判斷是地圖名稱還是分流
  if (parts.length > 1) {
    const potentialMapName = parts[1];
    // 檢查是否有地圖同時符合等級和名稱
    const isMapName = props.maps!.some(
      (m) =>
        (m as any).level === result.mapLevel &&
        (m as any).name.trim() === potentialMapName
    );

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
    } else {
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
  return (
    !isNaN(mapLevel!) && props.maps!.some((m) => (m as any).level === mapLevel)
  );
});

const selectedMap = computed(() => {
  const { mapLevel, mapName } = parseInput(inputContent.value);
  if (mapName) {
    return props.maps!.find(
      (m) => (m as any).level === mapLevel && (m as any).name === mapName
    ) as MapData;
  }
  return props.maps!.find((m) => (m as any).level === mapLevel) as MapData;
});

const selectedMapMaxStages = computed(() => {
  const map = selectedMap.value;
  return map ? map.maxStages : 5;
});

const getMapButtonType = (map: MapData) => {
  const { mapLevel, mapName } = parseInput(inputContent.value);
  if (mapName) {
    return mapLevel === map.level && mapName === map.name ? "primary" : "";
  }
  return mapLevel === map.level ? "primary" : "";
};

const getChannelButtonType = (channel: number) => {
  const { channel: currentChannel } = parseInput(inputContent.value);
  return currentChannel === channel ? "primary" : "";
};

const getStateButtonType = (state: string): "primary" | "" => {
  return timeInput.value === state ? "primary" : "";
};

const handleEpisodeSelection = (ep: number | "star" | 0) => {
  if (ep === "star") {
    isStarSelection.value = true;
    selectedEpisode.value = 0;
  } else if (ep === 0) {
    isStarSelection.value = false;
    selectedEpisode.value = 0;
  } else {
    isStarSelection.value = false;
    selectedEpisode.value = ep;
  }
  isChannelConfirmed.value = false;
};

const fillMapLevel = (map: MapData) => {
  inputContent.value = `${map.level} ${map.name}`.trim();
  isChannelConfirmed.value = false;
};

const fillChannel = (channel: number) => {
  const { mapLevel, mapName } = parseInput(inputContent.value);
  if (mapName) {
    inputContent.value = `${mapLevel} ${mapName} ${channel}`.trim();
  } else {
    inputContent.value = `${mapLevel} ${channel}`.trim();
  }
  isChannelConfirmed.value = true;
};

const changeChannel = (delta: number) => {
  const { mapLevel, mapName, channel } = parseInput(inputContent.value);
  let currentChannel = channel || 1;
  const newChannel = currentChannel + delta;

  if (newChannel >= 1) {
    fillChannel(newChannel);
  } else {
    ElMessage({
      message: "分流已是最小，無法再減少",
      type: "warning",
    });
  }
};

const fillState = (state: string) => {
  timeInput.value = state;
};

const toggleStar = (map: MapData) => {
  emit("update-map-star", map.level);
};

const handleAdd = async () => {
  const parsed = parseInput(inputContent.value);
  const finalTimeStr = parsed.timeStr || timeInput.value.trim();

  if (!parsed.mapLevel || !parsed.channel || !finalTimeStr) {
    ElMessage.error("輸入格式錯誤");
    return;
  }

  let map: MapData;

  if (parsed.mapName != null) {
    map = props.maps!.find(
      (m) => (m as any).name === parsed.mapName
    ) as MapData;
  } else {
    map = (await getMapData(parsed.mapLevel)) as MapData;
  }

  if (!map) {
    return;
  }

  let respawnTime = 0;
  let state: NoteState = "CD";
  let maxStages: number | null = map.maxStages;
  let onTime: number | null = null;

  if (finalTimeStr.toLowerCase() === "on") {
    state = "ON";
    onTime = Date.now();
  } else if (finalTimeStr.includes("/")) {
    const [current, max] = finalTimeStr.split("/").map(Number);
    if (!isNaN(current) && !isNaN(max)) {
      state = `STAGE_${current}` as NoteState;
      maxStages = max;
    } else {
      ElMessage.error("階段格式錯誤");
      return;
    }
  } else if (finalTimeStr.includes(".") || finalTimeStr.includes(":")) {
    const timeParts = finalTimeStr.split(/[.:]/).map(Number);
    let totalSeconds = 0;

    if (timeParts.length === 2) {
      totalSeconds = timeParts[0] * 60 + (timeParts[1] || 0);
    } else {
      totalSeconds =
        timeParts[0] * 3600 + timeParts[1] * 60 + (timeParts[2] || 0);
    }
    respawnTime = Date.now() + totalSeconds * 1000;
  } else if (!isNaN(parseInt(finalTimeStr))) {
    const minutes = parseInt(finalTimeStr);
    respawnTime = Date.now() + minutes * 60 * 1000;
  } else {
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

const getMapData = async (mapLevel: number) => {
  const matchingMaps = props.maps!.filter((m) => (m as any).level === mapLevel);
  let map: MapData;

  if (matchingMaps.length > 1) {
    matchingMaps.sort((a, b) => {
      if (a.episode !== b.episode) {
        return a.episode - b.episode;
      }
      return a.level - b.level;
    });

    try {
      const selectedMapName = await new Promise<string>((resolve, reject) => {
        const message = h(
          "div",
          null,
          matchingMaps.map((m) =>
            h(
              ElButton,
              {
                onClick: () => {
                  resolve(m.name);
                  ElMessageBox.close();
                },
                style: { margin: "5px" },
              },
              () => `EP${m.episode} - Lv.${m.level} ${m.name}`
            )
          )
        );

        ElMessageBox.alert(message, "地圖選擇", {
          showConfirmButton: false,
          callback: (action: string) => {
            if (action === "cancel") {
              reject("cancel");
            }
          },
        });
      });

      map = matchingMaps.find((m) => m.name === selectedMapName) as MapData;
    } catch (action) {
      if (action === "cancel") {
        ElMessage.info("已取消新增");
      }
      return;
    }
  } else {
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

  if (!isNaN(mapLevel!)) {
    const map = props.maps!.find(
      (m) => (m as any).level === mapLevel
    ) as MapData;

    if (map) {
      selectedEpisode.value = map.episode;
      isStarSelection.value = false;
    } else {
      selectedEpisode.value = 0;
      isStarSelection.value = false;
    }
  } else {
    selectedEpisode.value = 0;
    isStarSelection.value = false;
  }

  if (timeStr) {
    timeInput.value = timeStr;
    isChannelConfirmed.value = true;
  } else {
    timeInput.value = "";
    if (isNaN(channel!)) {
      isChannelConfirmed.value = false;
    }
  }
});
</script>

<style scoped>
.input-form {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
}
.input-form-left {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
}
.input-form .el-form-item {
  margin-bottom: 0;
  margin-right: 15px;
  position: relative;
}
.input-form-right .el-form-item {
  margin-bottom: 0;
}
.map-buttons-container,
.channel-selection,
.state-selection {
  margin-top: 20px;
}
.episode-buttons,
.map-level-buttons,
.channel-buttons,
.state-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}
h4 {
  margin: 0 0 10px 0;
  padding-bottom: 5px;
  border-bottom: 1px solid #dcdfe6;
}
.add-button-bottom {
  margin-top: 10px;
}

.input-hint {
  position: absolute;
  top: 100%;
  left: 0;
  font-size: 12px;
  color: var(--el-text-color-regular);
  background-color: var(--el-color-info-light-9);
  line-height: 1.5;
  margin-top: 5px;
  z-index: 10;
  padding: 8px 12px;
  border-radius: 4px;
  border: 1px solid #dcdfe6;
  width: auto;
  min-width: 300px;
  box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.1);
}
.input-hint br {
  margin: 5px 0;
}

.map-button-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
}

.star-icon {
  font-size: 1.5em;
  padding: 5px;
  margin-left: 5px;
  cursor: pointer;
  color: #c0c4cc;
}

.star-icon.is-starred {
  color: #f5c723;
}
</style>
