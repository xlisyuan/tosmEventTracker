<template>
  <el-container class="app-container">
    <el-header class="app-header">
      <div class="header-content">
        <div class="header-left">
          <!-- <div class="title">野外活動追蹤</div> -->
          <div
            v-if="featureFlags?.nosec"
            type="warning"
            style="text-align: left; color: #aaa;"
          >
            目前設定: 不使用秒數 <br />
            (例) CD 1小時 23分鐘 請輸入 <b>1.23</b> <br />
            (例) CD 5分鐘 請輸入 <b>5</b>
          </div>
        </div>
        <div class="header-right">
          <el-switch
            v-model="isDark"
            inline-prompt
            :active-icon="Moon"
            :inactive-icon="Sunny"
            size="large"
            class="dark-mode-switch"
          />
        </div>
      </div>
    </el-header>
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
          @show-update-dialog="handleShowUpdateDialog"
          :mapImageCache="mapImageCache"
        />
      </div>
      <UpdateStatusDialog
        v-model="showUpdateDialog"
        :current-note="currentNoteToUpdate"
        :showName="updateMapName"
        @update-note-status="handleUpdateNoteStatus"
        @update-note-cd="handleUpdateNoteCd"
      />
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
  <a
    v-if="featureFlags?.en"
    href="https://github.com/xlisyuan/tosmEventTracker/issues"
    target="_blank"
    rel="noopener noreferrer"
    title="github"
  >
    Lis Taiwan
  </a>
  <a
    v-else
    href="https://forum.gamer.com.tw/C.php?bsn=74968&snA=700"
    target="_blank"
    rel="noopener noreferrer"
    title="巴哈姆特:【閒聊】追蹤野外活動的工具"
  >
    其他資訊
  </a>
</template>

<script setup lang="ts">
import { ref, onMounted, watch, h, provide } from "vue";

const featureFlags = ref({
  nosec: false,
  pic: false,
  en: false,
});
// 確保在其他 onMounted 邏輯執行前 provide
// provide 的第一個參數是鍵值，第二個是提供的變數
provide("feature-flags", featureFlags);

import { v4 as uuidv4 } from "uuid";
import NoteInput from "./components/NoteInput.vue";
import NoteList from "./components/NoteList.vue";
import UpdateStatusDialog from "./components/UpdateStatusDialog.vue";
import type { Note, NoteState } from "./types/Note";
import { ElMessage, ElMessageBox } from "element-plus";
import { maps as originalMaps, type MapData } from "./data/maps";
import packageInfo from "../package.json";
import { Sunny, Moon } from "@element-plus/icons-vue";
// --------------------- 主題模式狀態 ---------------------
const isDark = ref(false);

watch(isDark, (newValue) => {
  if (newValue) {
    document.documentElement.classList.add("dark");
    localStorage.setItem("theme", "dark");
  } else {
    document.documentElement.classList.remove("dark");
    localStorage.setItem("theme", "light");
  }
});

// --------------------- 功能旗標 (Feature Flags) ---------------------

onMounted(() => {
  // 網址參數邏輯
  const urlParams = new URLSearchParams(window.location.search);
  const settingsParam = urlParams.get("setting");

  if (settingsParam) {
    const enabledFeatures = settingsParam.split(",");
    if (enabledFeatures.includes("nosec")) {
      featureFlags.value.nosec = true;
      console.log("功能已啟用：nosec");
    }
    if (enabledFeatures.includes("pic")) {
      featureFlags.value.pic = true;
      console.log("功能已啟用：pic");
    }
    if (enabledFeatures.includes("en")) {
      featureFlags.value.en = true;
      console.log("功能已啟用：en");
    }
  }
});

// --------------------- 地圖與圖片快取 ---------------------
// ---------------------
// 1. 地圖版本遷移設定
// ---------------------
const mapMigrations: ((mapsData: MapData[]) => MapData[])[] = [
  // v0 → v1: 僅修正「提拉修道院」名稱和圖片路徑 (保留使用者資料)
  (mapsData) => {
    const correctTiraMap = originalMaps.find(
      (map) => map.name === "堤拉修道院"
    );
    // 找不到最新資料時，拋出錯誤以阻止版本號更新。
    if (!correctTiraMap) {
      console.error(
        "Migration V0→V1: 找不到最新的 '堤拉修道院' 資料，無法完成遷移！"
      );
      throw new Error("Missing correct map data for V0→V1 migration.");
    }
    return mapsData.map((map) =>
      map.name === "提拉修道院" // 檢查舊名稱
        ? {
            ...map,
            name: correctTiraMap.name,
            imagePath: correctTiraMap.imagePath,
          }
        : map
    );
  },

  // v1 → v2: 新增 'enName' 欄位
  (mapsData) => {
    console.log("Applying migration: v1 to v2 (Adding enName)");

    // 鍵(key) 使用地圖的中文名稱 (map.name)
    const originalMapsEnNames = new Map(
      originalMaps.map((map) => [map.name, map.enName])
    );

    const migratedMaps = mapsData.map((map) => {
      const newEnName = originalMapsEnNames.get(map.name);
      if (newEnName) {
        return {
          ...map,
          enName: newEnName,
        };
      }
      return map;
    });

    return migratedMaps;
  },
];

// ---------------------
// 2. 讀取 localStorage & 套用 migration
// ---------------------
const savedMaps = localStorage.getItem("mapData");
let mapsData = savedMaps ? JSON.parse(savedMaps) : [];

// 遊戲更新地區時更新地圖
const existingEpisodes = new Set(mapsData.map((map: MapData) => map.episode));
const newMaps = originalMaps.filter((newMap: MapData) => {
  return !existingEpisodes.has(newMap.episode);
});

mapsData.push(...newMaps);

//地圖版本
const mapVersion = localStorage.getItem("mapVersion") || "0";

// 套用缺的 migration
const mapMigrationIndex = parseInt(mapVersion, 10);
let migrationSuccess = true;
try {
  for (let i = mapMigrationIndex; i < mapMigrations.length; i++) {
    mapsData = mapMigrations[i](mapsData);
  }
} catch (error) {
  console.error("地圖資料遷移失敗，版本號未更新。", error);
  migrationSuccess = false;
}

// 更新版本與 localStorage
if (migrationSuccess) {
  localStorage.setItem("mapVersion", mapMigrations.length.toString());
}
localStorage.setItem("mapData", JSON.stringify(mapsData));

// ---------------------
// 3. 建立 Vue reactive 變數
// ---------------------
const maps = ref(mapsData);

// 用來快取已載入的圖片路徑
const mapImageCache = ref<Record<string, string>>({});

// 獨立的圖片載入函式
const loadMapImage = async (noteText: string) => {
  const mapData = maps.value.find((m: MapData) => m.name === noteText);
  // todo: 等蒐集完地圖再更新
  if (
    featureFlags?.value.pic &&
    mapData?.imagePath &&
    !mapImageCache.value[mapData.name]
  ) {
    console.log(mapData?.imagePath);
    try {
      const image = new Image();
      await new Promise((resolve, reject) => {
        image.onload = resolve;
        image.onerror = reject;
        image.src = mapData.imagePath as string;
      });
      mapImageCache.value[mapData.name] = mapData.imagePath;
    } catch (e) {
      console.error(`無法載入地圖圖片: ${mapData.imagePath}`, e);
    }
  }
};

// --------------------- ------------- ---------------------

const notes = ref<Note[]>([]);
const currentSortMode = ref<"time" | "map">("time");
const ON_TIME_LIMIT_MS = 30 * 60 * 1000;
const hasInputSoundOn = ref(true);
const importExportData = ref("");

const showUpdateDialog = ref(false);
const currentNoteToUpdate = ref<Note | null>(null);
const updateMapName = ref("");

const handleShowUpdateDialog = (noteId: string) => {
  const note = notes.value.find((n) => n.id === noteId);
  if (note) {
    currentNoteToUpdate.value = note;
    showUpdateDialog.value = true;

    const finalMapName = featureFlags.value.en
      ? (() => {
          const mapData = maps.value.find(
            (m: MapData) => m.name === note.noteText
          );
          return mapData ? mapData.enName : note.noteText; 
        })()
      : note.noteText;
    updateMapName.value = `Lv. ${note.mapLevel} ${finalMapName} Ch. ${note.channel}`
  }
};

const toggleSort = () => {
  currentSortMode.value = currentSortMode.value === "time" ? "map" : "time";
  notes.value.sort(sortNotesArray);
};

const loadNotes = () => {
  const savedNotes = localStorage.getItem("notes");
  if (savedNotes) {
    notes.value = JSON.parse(savedNotes).map((note: Note) => {
      const mapData = maps.value.find(
        (m: MapData) => m.level === note.mapLevel && m.name === note.noteText
      );

      if (mapData) {
        return {
          ...note,
          isStarred: mapData.isStarred,
          noteText: mapData.name,
          maxStages: mapData.maxStages,
          // 如果 note 物件沒有 imagePath，則在這裡添加
          imagePath: (note as any).imagePath || mapData.imagePath,
        };
      }
      return note;
    });
  }
};

const saveNotes = () => {
  localStorage.setItem("notes", JSON.stringify(notes.value));
};

const handleAddNewNote = async (newNote: any) => {
  const mapData = maps.value.find((m: MapData) => m.name === newNote.noteText);
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
    if (
      note.mapLevel === finalNote.mapLevel &&
      note.noteText === finalNote.noteText &&
      note.channel === finalNote.channel
    ) {
      note.isWarning = true;
    } else {
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
    return (a.onTime || 0) - (b.onTime || 0); // ON 狀態：ON 最久的排最前
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
    noteToUpdate.onTime = null;
    noteToUpdate.stageTime = null;
    noteToUpdate.hasAlerted = false;

    switch (newState) {
      case "ON":
        noteToUpdate.onTime = newTime;
        break;
      case "CD":
        const map = maps.value.find(
          (m: MapData) => m.level === noteToUpdate.mapLevel
        );
        if (map) {
          noteToUpdate.respawnTime = Date.now() + map.respawnTime * 1000;
        }
        break;
      default:
        // STAGE_
        noteToUpdate.stageTime = newTime;
        break;
    }
    notes.value.sort(sortNotesArray);
  }
  saveNotes();
};

const handleUpdateNoteCd = (id: string, respawnTime: number) => {
  const note = notes.value.find((n) => n.id === id);
  if (note) {
    note.respawnTime = respawnTime;
    note.state = "CD";
    note.onTime = null;
    note.stageTime = null;
    note.hasAlerted = false;
    note.isWarning = false;
    saveNotes();
  }
};

const handleToggleInputSound = (state: boolean) => {
  hasInputSoundOn.value = state;
};

const handleUpdateMapStar = (mapLevel: number) => {
  const map = maps.value.find((m: MapData) => m.level === mapLevel);
  if (map) {
    map.isStarred = !map.isStarred;
    localStorage.setItem("mapData", JSON.stringify(maps.value));
  }
};

const exportNotes = async () => {
  const exportedNotes = notes.value.map((note) => ({
    l: note.mapLevel, // 縮寫: mapLevel -> l
    c: note.channel, // 縮寫: channel -> c
    o: note.onTime, // 縮寫: onTime -> o
    r: note.respawnTime, // 縮寫: respawnTime -> r
    s: note.state, // 縮寫: state -> s
    n: (note as any).noteText, // 縮寫: noteText -> n
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

    // 檢查資料格式：我們檢查新格式的 'l' 和 'c'，或舊格式的 'mapLevel' 和 'channel'
    if (
      !Array.isArray(importedNotes) ||
      importedNotes.some((n) => !(n.l || n.mapLevel) || !(n.c || n.channel))
    ) {
      ElMessage({ type: "error", message: "匯入的資料格式不正確。" });
      return;
    }

    // --- 核心解碼邏輯 ---
    const processedImportedNotes = importedNotes
      .map((importedNote) => {
        // 使用 || 來兼容新格式 (l, c, o, r, s, n) 和舊格式 (mapLevel, channel, ...)
        const mapLevel = importedNote.l || importedNote.mapLevel;
        const channel = importedNote.c || importedNote.channel;
        const onTime = importedNote.o || importedNote.onTime;
        const respawnTime = importedNote.r || importedNote.respawnTime;
        const state = importedNote.s || importedNote.state;
        const noteText = importedNote.n || importedNote.noteText;

        // 檢查地圖等級和名稱是否存在 (確保 mapData 可以被找到)
        if (!mapLevel || !noteText) {
          // 可以在這裡拋出錯誤，或跳過此筆資料
          return null;
        }

        // 重新組裝成一個標準的物件，方便後續程式碼處理
        return {
          ...importedNote, // 保留所有原始屬性 (兼容舊版自訂屬性)
          mapLevel,
          channel,
          onTime,
          respawnTime,
          state,
          noteText, // 這裡的 noteText 包含了地圖名稱
        };
      })
      .filter((n) => n !== null); // 過濾掉不合格的資料

    // 預載入圖片
    for (const note of processedImportedNotes) {
      await loadMapImage(note.noteText);
    }
    // 在建立 Map 時將 noteText 納入鍵中
    const currentNotesMap = new Map(
      notes.value.map((note) => [
        `${note.mapLevel}-${note.channel}-${note.noteText}`,
        note,
      ])
    );
    const nonDuplicateNotes: Note[] = [];
    const duplicateNotes: { newNote: Note; oldNote: Note }[] = [];
    processedImportedNotes.forEach((importedNote) => {
      const mapData = maps.value.find(
        (m: MapData) =>
          m.level === importedNote.mapLevel && m.name === importedNote.noteText
      );
      const isExpired = importedNote.respawnTime <= Date.now();
      const processedNote: Note = {
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
                `地圖: ${item.newNote.mapLevel} - ${item.newNote.noteText} 分流: ${item.newNote.channel}`
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
            const finalNotesMap = new Map(
              notes.value.map((note) => [
                `${note.mapLevel}-${note.channel}-${note.noteText}`,
                note,
              ])
            );
            duplicateNotes.forEach((item) =>
              finalNotesMap.set(
                `${item.newNote.mapLevel}-${item.newNote.channel}-${item.newNote.noteText}`,
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
  const savedTheme = localStorage.getItem("theme");
  isDark.value =
    savedTheme === "dark" ||
    (savedTheme === null &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);

  if (isDark.value) {
    document.documentElement.classList.add("dark");
  } else {
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
</script>

<style scoped>
.app-container {
  max-width: 1200px;
  margin: 0 auto;
  padding: var(--cus-app-container-padding);
  background-color: var(--app-container-color);
  min-height: 100vh;
}
.app-header {
  height: auto;
  text-align: center;
  padding: 5px;
}
.header-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.header-right {
  display: flex;
  align-items: center;
}
.dark-mode-switch {
  --el-switch-on-color: #0e2d5a;
  --el-switch-off-color: #eba523;
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
