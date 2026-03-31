<template>
  <el-container class="app-container">
    <el-header class="app-header">
      <div class="header-content">
        <div></div>
        <el-switch
          v-model="isDark"
          inline-prompt
          :active-icon="Moon"
          :inactive-icon="Sunny"
          size="large"
          class="dark-mode-switch"
        />
      </div>
    </el-header>
    <el-main class="app-main">
      <el-card v-if="!isVerified" class="auth-card">
        <h3>共同編輯驗證</h3>
        <p class="auth-desc">請先輸入密碼，驗證成功後才會顯示追蹤頁面。</p>
        <el-input
          v-model="passwordInput"
          type="password"
          show-password
          placeholder="請輸入密碼"
          @keyup.enter="verifyPassword"
        />
        <div class="auth-actions">
          <el-button type="primary" :loading="isCheckingAuth" @click="verifyPassword">驗證</el-button>
        </div>
        <p v-if="!isFirebaseConfigured" class="auth-warning">
          尚未設定 Firebase 環境變數， 同步功能目前無法使用。
        </p>
      </el-card>

      <template v-else>
        <el-alert
          title="社恐收容所 共編頁面：更新會即時同步給所有開啟此頁的人"
          type="success"
          :closable="false"
          show-icon
          class="sync-tip"
        />
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
      </template>
    </el-main>
  </el-container>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, provide, watch } from "vue";
import { v4 as uuidv4 } from "uuid";
import { ElMessage } from "element-plus";
import { Sunny, Moon } from "@element-plus/icons-vue";
import { onAuthStateChanged, signInWithEmailAndPassword } from "firebase/auth";
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import NoteInput from "./components/NoteInput.vue";
import NoteList from "./components/NoteList.vue";
import UpdateStatusDialog from "./components/UpdateStatusDialog.vue";
import type { Note, NoteState } from "./types/Note";
import { maps as originalMaps, type MapData } from "./data/maps";
import { isFirebaseConfigured, saAuth, saDb } from "./firebase-sa";

const featureFlags = ref({
  nosec: false,
  pic: false,
  en: false,
});
provide("feature-flags", featureFlags);

const notes = ref<Note[]>([]);
const maps = ref<MapData[]>(JSON.parse(JSON.stringify(originalMaps)));
const mapImageCache = ref<Record<string, string>>({});
const isDark = ref(false);
const currentSortMode = ref<"time" | "map">("time");
const hasInputSoundOn = ref(true);
const showUpdateDialog = ref(false);
const currentNoteToUpdate = ref<Note | null>(null);
const updateMapName = ref("");

const isVerified = ref(false);
const isCheckingAuth = ref(false);
const passwordInput = ref("");
const clientId = getClientId();
let unsubscribeNotes: null | (() => void) = null;
let unsubscribeAuth: null | (() => void) = null;
let sortTimer: number | null = null;
const SA_AUTH_EMAIL = import.meta.env.VITE_SA_AUTH_EMAIL || "";

const ON_TIME_LIMIT_MS = 30 * 60 * 1000;

watch(isDark, (newValue) => {
  if (newValue) {
    document.documentElement.classList.add("dark");
    localStorage.setItem("theme", "dark");
  } else {
    document.documentElement.classList.remove("dark");
    localStorage.setItem("theme", "light");
  }
});

const loadMapImage = async (noteText: string) => {
  const mapData = maps.value.find((m: MapData) => m.name === noteText);
  if (featureFlags.value.pic && mapData?.imagePath && !mapImageCache.value[mapData.name]) {
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

const getDocId = (mapLevel: number, channel: number, noteText: string) =>
  `${mapLevel}_${channel}_${encodeURIComponent(noteText.trim())}`;

const sortNotesArray = (a: Note, b: Note): number => {
  const now = Date.now();
  const getCategory = (state: string) => {
    if (state.toLowerCase() === "on") return "ON";
    if (state.includes("_")) return "STAGE";
    return "CD";
  };
  const aStateCategory = getCategory(a.state);
  const bStateCategory = getCategory(b.state);

  if (currentSortMode.value === "map") {
    if (a.mapLevel !== b.mapLevel) return b.mapLevel - a.mapLevel;
    if (a.channel !== b.channel) return a.channel - b.channel;
  }

  const aIsOnOverLimit = aStateCategory === "ON" && now - (a.onTime || now) > ON_TIME_LIMIT_MS;
  const bIsOnOverLimit = bStateCategory === "ON" && now - (b.onTime || now) > ON_TIME_LIMIT_MS;
  if (aIsOnOverLimit && !bIsOnOverLimit) return 1;
  if (!aIsOnOverLimit && bIsOnOverLimit) return -1;

  const stateOrder = { ON: 1, STAGE: 2, CD: 3 };
  if (stateOrder[aStateCategory as keyof typeof stateOrder] !== stateOrder[bStateCategory as keyof typeof stateOrder]) {
    return stateOrder[aStateCategory as keyof typeof stateOrder] - stateOrder[bStateCategory as keyof typeof stateOrder];
  }
  if (aStateCategory === "ON") return (a.onTime || 0) - (b.onTime || 0);
  if (aStateCategory === "STAGE") {
    const aStage = parseInt(a.state.replace("STAGE_", ""), 10);
    const bStage = parseInt(b.state.replace("STAGE_", ""), 10);
    return bStage - aStage;
  }
  return (a.respawnTime || 0) - (b.respawnTime || 0);
};

const saveNoteToFirestore = async (note: Note) => {
  if (!saDb) return;
  const docId = getDocId(note.mapLevel, note.channel, note.noteText);
  await setDoc(doc(collection(saDb, "saNotes"), docId), {
    mapLevel: note.mapLevel,
    channel: note.channel,
    noteText: note.noteText,
    onTime: note.onTime ?? null,
    respawnTime: note.respawnTime ?? null,
    state: note.state,
    maxStages: note.maxStages ?? 4,
    hasSound: note.hasSound ?? true,
    updatedBy: clientId,
    updatedAt: serverTimestamp(),
  });
};

const subscribeNotes = () => {
  if (!saDb) return;
  unsubscribeNotes = onSnapshot(collection(saDb, "saNotes"), (snapshot) => {
    const nextNotes: Note[] = [];
    snapshot.forEach((snap) => {
      const d = snap.data() as any;
      const mapData = maps.value.find((m) => m.level === d.mapLevel && m.name === d.noteText);
      const mapName = d.noteText || mapData?.name;
      if (!mapName) return;
      nextNotes.push({
        id: snap.id,
        mapLevel: d.mapLevel,
        channel: d.channel,
        noteText: mapName,
        respawnTime: d.respawnTime ?? 0,
        state: d.state ?? "CD",
        isStarred: mapData?.isStarred ?? false,
        hasSound: d.hasSound ?? true,
        maxStages: d.maxStages ?? mapData?.maxStages ?? 4,
        onTime: d.onTime ?? null,
        hasAlerted: false,
        stageTime: null,
      });
    });
    notes.value = nextNotes.sort(sortNotesArray);
  });
};

const handleAddNewNote = async (newNote: any) => {
  const mapData = maps.value.find((m: MapData) => m.name === newNote.noteText);
  if (!mapData) {
    ElMessage.error("找不到對應的地圖資料");
    return;
  }
  await loadMapImage(mapData.name);
  const finalNote: Note = {
    ...newNote,
    id: getDocId(newNote.mapLevel, newNote.channel, mapData.name),
    noteText: mapData.name,
    isStarred: mapData.isStarred,
    hasSound: newNote.hasSound,
    maxStages: mapData.maxStages,
    respawnTime: newNote.respawnTime || 0,
    onTime: newNote.onTime || null,
    hasAlerted: false,
  };
  await saveNoteToFirestore(finalNote);
  ElMessage({
    type: "success",
    message: `已同步更新 ${finalNote.noteText} 分流: ${finalNote.channel}`,
  });
};

const handleDeleteNote = async (id: string) => {
  if (!saDb) return;
  await deleteDoc(doc(saDb, "saNotes", id));
  ElMessage({ type: "success", message: "記錄已刪除" });
};

const handleClearAllNotes = async () => {
  if (!saDb) return;
  const db = saDb;
  const current = [...notes.value];
  await Promise.all(current.map((n) => deleteDoc(doc(db, "saNotes", n.id))));
};

const handleUpdateNoteStatus = async (id: string, newState: NoteState, newTime: number | null) => {
  const noteToUpdate = notes.value.find((note) => note.id === id);
  if (!noteToUpdate) return;
  noteToUpdate.state = newState;
  noteToUpdate.onTime = null;
  noteToUpdate.stageTime = null;
  noteToUpdate.hasAlerted = false;
  switch (newState) {
    case "ON":
      noteToUpdate.onTime = newTime;
      break;
    case "CD": {
      const map = maps.value.find((m: MapData) => m.level === noteToUpdate.mapLevel);
      if (map) noteToUpdate.respawnTime = Date.now() + map.respawnTime * 1000;
      break;
    }
    default:
      noteToUpdate.stageTime = newTime;
      break;
  }
  await saveNoteToFirestore(noteToUpdate);
};

const handleUpdateNoteCd = async (id: string, respawnTime: number) => {
  const note = notes.value.find((n) => n.id === id);
  if (!note) return;
  note.respawnTime = respawnTime;
  note.state = "CD";
  note.onTime = null;
  note.stageTime = null;
  note.hasAlerted = false;
  await saveNoteToFirestore(note);
};

const handleUpdateNoteChannel = async (id: string, newChannel: number) => {
  const note = notes.value.find((n) => n.id === id);
  if (!note) return;
  await deleteDoc(doc(saDb!, "saNotes", id));
  note.channel = newChannel;
  note.id = getDocId(note.mapLevel, note.channel, note.noteText);
  await saveNoteToFirestore(note);
};

const handleToggleInputSound = (state: boolean) => {
  hasInputSoundOn.value = state;
};

const handleUpdateMapStar = (mapLevel: number) => {
  const map = maps.value.find((m: MapData) => m.level === mapLevel);
  if (!map) return;
  map.isStarred = !map.isStarred;
  localStorage.setItem("sa-mapData", JSON.stringify(maps.value));
};

const handleShowUpdateDialog = (noteId: string) => {
  const note = notes.value.find((n) => n.id === noteId);
  if (!note) return;
  currentNoteToUpdate.value = note;
  showUpdateDialog.value = true;
  updateMapName.value = `Lv. ${note.mapLevel} ${note.noteText} Ch. ${note.channel}`;
};

const toggleSort = () => {
  currentSortMode.value = currentSortMode.value === "time" ? "map" : "time";
  notes.value.sort(sortNotesArray);
};

const verifyPassword = async () => {
  if (!passwordInput.value.trim()) return;
  isCheckingAuth.value = true;
  try {
    if (!isFirebaseConfigured || !saAuth) {
      ElMessage.error("Firebase 設定不完整，無法進行線上驗證。");
      return;
    }
    if (!SA_AUTH_EMAIL) {
      ElMessage.error("尚未設定 VITE_SA_AUTH_EMAIL");
      return;
    }
    await signInWithEmailAndPassword(saAuth, SA_AUTH_EMAIL, passwordInput.value);
    passwordInput.value = "";
    ElMessage.success("驗證成功");
  } catch (error: any) {
    const message = getAuthErrorMessage(error?.code);
    ElMessage.error(message);
  } finally {
    isCheckingAuth.value = false;
  }
};

const getAuthErrorMessage = (code?: string) => {
  switch (code) {
    case "auth/invalid-credential":
    case "auth/wrong-password":
      return "密碼錯誤，請再試一次。";
    case "auth/user-not-found":
      return "驗證帳號不存在，請檢查 VITE_SA_AUTH_EMAIL。";
    case "auth/too-many-requests":
      return "嘗試次數過多，請稍後再試。";
    case "auth/network-request-failed":
      return "網路連線失敗，請檢查網路後再試。";
    default:
      return "登入失敗，請稍後再試。";
  }
};

function getClientId() {
  const key = "sa-client-id";
  const existing = localStorage.getItem(key);
  if (existing) return existing;
  const created = uuidv4();
  localStorage.setItem(key, created);
  return created;
}

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

  const urlParams = new URLSearchParams(window.location.search);
  const settingsParam = urlParams.get("setting");
  if (settingsParam) {
    const enabledFeatures = settingsParam.split(",");
    featureFlags.value.nosec = enabledFeatures.includes("nosec");
    featureFlags.value.pic = enabledFeatures.includes("pic");
    featureFlags.value.en = enabledFeatures.includes("en");
  }

  const savedMaps = localStorage.getItem("sa-mapData");
  if (savedMaps) maps.value = JSON.parse(savedMaps);

  if (isFirebaseConfigured && saAuth) {
    unsubscribeAuth = onAuthStateChanged(saAuth, (user) => {
      isVerified.value = !!user;
      if (user) {
        if (!unsubscribeNotes) subscribeNotes();
      } else if (unsubscribeNotes) {
        unsubscribeNotes();
        unsubscribeNotes = null;
        notes.value = [];
      }
    });
  }

  sortTimer = window.setInterval(() => {
    notes.value.sort(sortNotesArray);
  }, 1000);
});

onUnmounted(() => {
  if (unsubscribeNotes) unsubscribeNotes();
  if (unsubscribeAuth) unsubscribeAuth();
  if (sortTimer) window.clearInterval(sortTimer);
});
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
.auth-card {
  max-width: 480px;
  margin: 48px auto;
}
.auth-desc {
  color: #666;
}
.auth-actions {
  margin-top: 16px;
}
.auth-warning {
  margin-top: 12px;
  color: #d35400;
}
.sync-tip {
  margin-bottom: 16px;
}
</style>
