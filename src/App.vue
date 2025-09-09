<template>
  <el-container class="app-container">
    <el-header class="app-header">
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
          @toggle-input-sound="handleToggleInputSound"
          :maps="maps"
          @update-map-star="handleUpdateMapStar"
        />
      </div>
    </el-main>
  </el-container>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import { v4 as uuidv4 } from 'uuid';
import NoteInput from './components/NoteInput.vue';
import NoteList from './components/NoteList.vue';
import type { Note, NoteState } from './types/Note';
import { ElMessage } from 'element-plus';
import { maps as originalMaps } from './data/maps';

const activeIndex = ref('0');
const notes = ref<Note[]>([]);
const currentSortMode = ref<'time' | 'map'>('time');
const ON_TIME_LIMIT_MS = 30 * 60 * 1000; // 30分鐘
const hasInputSoundOn = ref(true);
const maps = ref([...originalMaps]); // 將 maps 狀態移到這裡統一管理

const loadNotes = () => {
  const savedNotes = localStorage.getItem('notes');
  if (savedNotes) {
    notes.value = JSON.parse(savedNotes).map((note: Note) => {
      // 確保從 localStorage 載入的 note 包含 isStarred 屬性
      const mapData = maps.value.find(m => m.level === note.mapLevel);
      return { ...note, isStarred: mapData ? mapData.isStarred : false };
    });
  }
};

const saveNotes = () => {
  localStorage.setItem('notes', JSON.stringify(notes.value));
};

const handleAddNewNote = (newNote: any) => {
  const mapData = maps.value.find(m => m.level === newNote.mapLevel);
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
    new Audio('/sound/new_note.mp3').play();
  }
  ElMessage({
    type: 'success',
    message: '記錄新增成功',
  });
};

const handleDeleteNote = (id: string) => {
  const index = notes.value.findIndex(note => note.id === id);
  if (index !== -1) {
    notes.value.splice(index, 1);
    saveNotes();
    ElMessage({
      type: 'success',
      message: '記錄已刪除',
    });
  }
};

const handleClearAllNotes = () => {
  notes.value = [];
  saveNotes();
};

const getNoteStateCategory = (state: string) => {
  if (state.toLowerCase() === 'on') return 'ON';
  if (state.includes('/')) return 'STAGE';
  return 'CD';
};

const sortNotesArray = (a: Note, b: Note): number => {
  const now = Date.now();
  const aStateCategory = getNoteStateCategory(a.state);
  const bStateCategory = getNoteStateCategory(b.state);
  
  if (currentSortMode.value === 'map') {
    const aMapName = maps.value.find(m => m.level === a.mapLevel)?.name || '';
    const bMapName = maps.value.find(m => m.level === b.mapLevel)?.name || '';
    return aMapName.localeCompare(bMapName);
  }
  
  // 檢查 ON 的時間限制
  const aIsOnOverLimit = aStateCategory === 'ON' && (now - (a.onTime || now)) > ON_TIME_LIMIT_MS;
  const bIsOnOverLimit = bStateCategory === 'ON' && (now - (b.onTime || now)) > ON_TIME_LIMIT_MS;

  // 將 ON 超過時間限制的項目排在最後
  if (aIsOnOverLimit && !bIsOnOverLimit) return 1;
  if (!aIsOnOverLimit && bIsOnOverLimit) return -1;

  // 依據類別進行排序
  const stateOrder = { 'ON': 1, 'STAGE': 2, 'CD': 3 };
  if (stateOrder[aStateCategory] !== stateOrder[bStateCategory]) {
    return stateOrder[aStateCategory] - stateOrder[bStateCategory];
  }
  
  // 在同一個狀態類別內，再依時間或階段排序
  if (aStateCategory === 'ON') {
    return (b.onTime || 0) - (a.onTime || 0); // ON 狀態：ON 最久的排最前
  } else if (aStateCategory === 'STAGE') {
    const aStage = parseInt(a.state.replace('STAGE_', ''), 10);
    const bStage = parseInt(b.state.replace('STAGE_', ''), 10);
    return bStage - aStage; // STAGE 狀態：階段號碼大的排最前
  } else if (aStateCategory === 'CD') {
    // CD 狀態：CD 越短的排越前
    return (a.respawnTime || 0) - (b.respawnTime || 0);
  }
  
  return 0;
};

const toggleSort = () => {
  currentSortMode.value = currentSortMode.value === 'time' ? 'map' : 'time';
  notes.value.sort(sortNotesArray);
};

const handleUpdateNoteStatus = () => {
  // 這個函式目前沒有被使用，但保留以備未來擴充
};

// 新增此函式來處理 NoteList 發出的事件
const handleToggleInputSound = (state: boolean) => {
  hasInputSoundOn.value = state;
};

// 新增此函式來處理子元件發出的星號更新事件
const handleUpdateMapStar = (mapLevel: number) => {
  const map = maps.value.find(m => m.level === mapLevel);
  if (map) {
    map.isStarred = !map.isStarred;
  }
};

onMounted(() => {
  loadNotes();
  // 每秒更新一次，確保時間顯示即時
  setInterval(() => {
    notes.value.sort(sortNotesArray);
  }, 1000);
});

watch(notes, saveNotes, { deep: true });
</script>

<style scoped>
.app-container {
  width: 920px;
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
</style>