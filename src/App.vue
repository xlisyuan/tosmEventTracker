<template>
  <el-container class="app-container">
    <el-header class="app-header"> </el-header>
    <el-main class="app-main">
      <NoteInput
        @add-note="handleAddNewNote"
        :hasSound="hasInputSoundOn"
        :maps="maps"
        @update-map-star="handleUpdateMapStar"
      />
      <div class="list-card-container">
        <NoteList
          :notes="notes"
          :currentSortMode="currentSortMode"
          @delete-note="handleDeleteNote"
          @clear-notes="handleClearAllNotes"
          @toggle-sort="toggleSort"
          @update-note-status="handleUpdateNoteStatus"
          @update-note-channel="handleUpdateNoteChannel"
          @toggle-input-sound="handleToggleInputSound"
          :maps="maps"
          @update-map-star="handleUpdateMapStar"
          :mapImageCache="mapImageCache"
        />
      </div>
    </el-main>
    <div class="import-export-section">
      <!-- <h3>匯入 / 匯出 記錄</h3> -->
      <div class="import-export-buttons">
        <el-button type="primary" @click="exportNotes">匯出記錄</el-button>
        <el-button type="success" @click="handleImportClick"
          >匯入記錄</el-button
        >
      </div>
      <el-input
        v-model="importExportData"
        type="textarea"
        :rows="5"
        placeholder="匯出的記錄會顯示在此處，或在此處貼上要匯入的資料"
      ></el-input>
    </div>
  </el-container>
</template>

<script setup lang="ts">
import { ref, onMounted, watch, h } from "vue";
import { v4 as uuidv4 } from "uuid";
import NoteInput from "./components/NoteInput.vue";
import NoteList from "./components/NoteList.vue";
import type { Note, NoteState } from "./types/Note";
import { ElMessage, ElMessageBox } from "element-plus";
import { maps as originalMaps, type MapData } from "./data/maps";

// 嘗試從 localStorage 載入地圖資料，如果沒有則使用原始資料並存入
const savedMaps = localStorage.getItem("mapData");
const maps = ref<MapData[]>(
  savedMaps ? JSON.parse(savedMaps) : [...originalMaps]
);

if (!savedMaps) {
  localStorage.setItem("mapData", JSON.stringify(originalMaps));
}

// 用來快取已載入的圖片路徑
const mapImageCache = ref<Record<number, string>>({});

// 獨立的圖片載入函式
const loadMapImage = async (mapLevel: number) => {
  const mapData = maps.value.find((m) => m.level === mapLevel);
  if (mapData?.imagePath && !mapImageCache.value[mapData.level]) {
    try {
      const image = new Image();
      await new Promise((resolve, reject) => {
        image.onload = resolve;
        image.onerror = reject;
        image.src = mapData.imagePath as string;
      });
      mapImageCache.value[mapData.level] = mapData.imagePath;
    } catch (e) {
      console.error(`無法載入地圖圖片: ${mapData.imagePath}`, e);
    }
  }
};
const activeIndex = ref("0");
const notes = ref<Note[]>([]);
const currentSortMode = ref<"time" | "map">("time");
const ON_TIME_LIMIT_MS = 30 * 60 * 1000;
const hasInputSoundOn = ref(true);
const importExportData = ref("");
const toggleSort = () => {
  currentSortMode.value = currentSortMode.value === "time" ? "map" : "time";
  notes.value.sort(sortNotesArray);
};
const loadNotes = () => {
  const savedNotes = localStorage.getItem("notes");
  if (savedNotes) {
    notes.value = JSON.parse(savedNotes).map((note: Note) => {
      const mapData = maps.value.find((m) => m.level === note.mapLevel);
      return { ...note, isStarred: mapData ? mapData.isStarred : false };
    });
  }
};

const saveNotes = () => {
  localStorage.setItem("notes", JSON.stringify(notes.value));
};

const handleAddNewNote = async (newNote: any) => {
  const mapData = maps.value.find((m) => m.level === newNote.mapLevel);

  // 圖片載入函式
  await loadMapImage(newNote.mapLevel);

  const finalNote = {
    ...newNote,
    id: uuidv4(),
    noteText: mapData ? mapData.name : newNote.noteText,
    isStarred: mapData ? mapData.isStarred : false,
    hasSound: hasInputSoundOn.value,
    maxStages: mapData ? mapData.maxStages : 0,
  };

  // 在新增前，檢查是否有相同地圖和分流的項目
  notes.value.forEach((note) => {
    if (
      note.mapLevel === finalNote.mapLevel &&
      note.channel === finalNote.channel
    ) {
      note.isWarning = true;
    } else {
      // 重置警告
      // 考慮要不要用其他方法 測試其他可能?
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

const handleDeleteNote = (id: string) => {
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

const getNoteStateCategory = (state: string) => {
  if (state.toLowerCase() === "on") return "ON";
  if (state.includes("_")) return "STAGE";
  return "CD";
};

const sortNotesArray = (a: Note, b: Note): number => {
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
  const aIsOnOverLimit =
    aStateCategory === "ON" && now - (a.onTime || now) > ON_TIME_LIMIT_MS;
  const bIsOnOverLimit =
    bStateCategory === "ON" && now - (b.onTime || now) > ON_TIME_LIMIT_MS;

  // 將 ON 超過時間限制的項目排在最後
  if (aIsOnOverLimit && !bIsOnOverLimit) return 1;
  if (!aIsOnOverLimit && bIsOnOverLimit) return -1;

  // 依據類別進行排序
  const stateOrder = { ON: 1, STAGE: 2, CD: 3 };
  if (
    stateOrder[aStateCategory as keyof typeof stateOrder] !==
    stateOrder[bStateCategory as keyof typeof stateOrder]
  ) {
    return (
      stateOrder[aStateCategory as keyof typeof stateOrder] -
      stateOrder[bStateCategory as keyof typeof stateOrder]
    );
  }

  // 在同一個狀態類別內，再依時間或階段排序
  if (aStateCategory === "ON") {
    return (b.onTime || 0) - (a.onTime || 0); // ON 狀態：ON 最久的排最前
  } else if (aStateCategory === "STAGE") {
    const aStage = parseInt(a.state.replace("STAGE_", ""), 10);
    const bStage = parseInt(b.state.replace("STAGE_", ""), 10);
    return bStage - aStage; // STAGE 狀態：階段號碼大的排最前
  } else if (aStateCategory === "CD") {
    // CD 狀態：CD 越短的排越前
    return (a.respawnTime || 0) - (b.respawnTime || 0);
  }

  return 0;
};

const handleUpdateNoteChannel = (id: string, newChannel: number) => {
  const noteToUpdate = notes.value.find((note) => note.id === id);
  if (noteToUpdate) {
    noteToUpdate.channel = newChannel;
  }
  saveNotes();
};

const handleUpdateNoteStatus = (
  id: string,
  newState: NoteState,
  newTime: number | null
) => {
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

const handleToggleInputSound = (state: boolean) => {
  hasInputSoundOn.value = state;
};

const handleUpdateMapStar = (mapLevel: number) => {
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
  importExportData.value = JSON.stringify(exportedNotes, null, 2);
  try {
    // 將 JSON 字串複製到剪貼簿
    await navigator.clipboard.writeText(importExportData.value);

    // 複製成功時跳出提示
    ElMessage({
      type: "success",
      message: "記錄已匯出並複製到剪貼簿。",
    });
  } catch (err) {
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

    if (
      !Array.isArray(importedNotes) ||
      importedNotes.some((n) => !n.mapLevel || !n.channel)
    ) {
      ElMessage({ type: "error", message: "匯入的資料格式不正確。" });
      return;
    }

    for (const note of importedNotes) {
      await loadMapImage(note.mapLevel);
    }

    const currentNotesMap = new Map(
      notes.value.map((note) => [`${note.mapLevel}-${note.channel}`, note])
    );

    const nonDuplicateNotes: Note[] = [];
    const duplicateNotes: { newNote: Note; oldNote: Note }[] = [];

    importedNotes.forEach((importedNote) => {
      const existingKey = `${importedNote.mapLevel}-${importedNote.channel}`;
      const existingNote = currentNotesMap.get(existingKey);
      const mapData = maps.value.find((m) => m.level === importedNote.mapLevel);
      const isExpired = importedNote.respawnTime <= Date.now();
      const processedNote: Note = {
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
      } else {
        nonDuplicateNotes.push(processedNote);
      }
    });

    if (duplicateNotes.length > 0) {
      ElMessageBox({
        title: "發現重複的記錄",
        message: h("div", null, [
          h("p", `本次匯入共發現 ${duplicateNotes.length} 筆重複記錄。`),
          h(
            "ul",
            {
              style: "max-height: 200px; overflow-y: auto; padding-left: 20px;",
            },
            duplicateNotes.map((item) =>
              h(
                "li",
                `地圖: ${item.newNote.mapLevel} 分流: ${item.newNote.channel}`
              )
            )
          ),
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
            const finalNotesMap = new Map(
              notes.value.map((note) => [
                `${note.mapLevel}-${note.channel}`,
                note,
              ])
            );
            duplicateNotes.forEach((item) =>
              finalNotesMap.set(
                `${item.newNote.mapLevel}-${item.newNote.channel}`,
                item.newNote
              )
            );
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
          } else if (action === "cancel") {
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
    } else {
      // 沒有重複項目，直接新增
      notes.value = [...notes.value, ...nonDuplicateNotes];
      notes.value.sort(sortNotesArray);
      saveNotes();
      ElMessage({
        type: "success",
        message: `成功新增 ${nonDuplicateNotes.length} 筆記錄。`,
      });
    }
  } catch (e) {
    ElMessage({ type: "error", message: "匯入失敗，請檢查格式。" });
  }
};

onMounted(() => {
  loadNotes();

  // 確保只更新必要的欄位，並保留使用者設定
  if (notes.value.length > 0) {
    notes.value = notes.value.map((note) => {
      const mapData = maps.value.find((m) => m.level === note.mapLevel);
      if (mapData) {
        // 合併新舊資料，以舊記錄（note）的屬性為優先
        return {
          ...note,
          noteText: mapData.name, // 更新地圖名稱
          maxStages: mapData.maxStages, // 更新階段數
          imagePath: mapData.imagePath, // 新增圖片路徑
        };
      }
      return note;
    });

    // 頁面載入時，為已存在的記錄載入圖片
    notes.value.forEach((note) => {
      loadMapImage(note.mapLevel);
    });
  }

  setInterval(() => {
    notes.value.sort(sortNotesArray);
  }, 1000);
});

watch(notes, saveNotes, { deep: true });
</script>

<style scoped>
.app-container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
  background-color: #f4f4f5;
  min-height: 100vh;
}
.app-header {
  height: auto;
  text-align: center;
  padding: 20px 0;
}
.app-main {
  padding: 0;
}
.list-card-container {
  margin-top: 20px;
}
.import-export-section {
  margin-top: 20px;
  padding: 20px;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
}
.import-export-buttons {
  display: flex;
  justify-content: flex-start;
  gap: 10px;
  margin-bottom: 10px;
}
</style>
