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
const ON_TIME_LIMIT_MS = 30 * 60 * 1000;
const hasInputSoundOn = ref(true);
const maps = ref([...originalMaps]);

const loadNotes = () => {
  const savedNotes = localStorage.getItem('notes');
  if (savedNotes) {
    notes.value = JSON.parse(savedNotes).map((note: Note) => {
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
  
  const aIsOnOverLimit = aStateCategory === 'ON' && (now - (a.onTime || now)) > ON_TIME_LIMIT_MS;
  const bIsOnOverLimit = bStateCategory === 'ON' && (now - (b.onTime || now)) > ON_TIME_LIMIT_MS;

  if (aIsOnOverLimit && !bIsOnOverLimit) return 1;
  if (!aIsOnOverLimit && bIsOnOverLimit) return -1;

  const stateOrder = { 'ON': 1, 'STAGE': 2, 'CD': 3 };
  if (stateOrder[aStateCategory as keyof typeof stateOrder] !== stateOrder[bStateCategory as keyof typeof stateOrder]) {
    return stateOrder[aStateCategory as keyof typeof stateOrder] - stateOrder[bStateCategory as keyof typeof stateOrder];
  }
  
  if (aStateCategory === 'ON') {
    return (b.onTime || 0) - (a.onTime || 0);
  } else if (aStateCategory === 'STAGE') {
    const aStage = parseInt(a.state.replace('STAGE_', ''), 10);
    const bStage = parseInt(b.state.replace('STAGE_', ''), 10);
    return bStage - aStage;
  } else if (aStateCategory === 'CD') {
    return (a.respawnTime || 0) - (b.respawnTime || 0);
  }
  
  return 0;
};

const handleUpdateNoteStatus = (id: string, newState: NoteState, newTime: number | null) => {
  const noteToUpdate = notes.value.find(note => note.id === id);
  if (noteToUpdate) {
    noteToUpdate.state = newState;
    noteToUpdate.onTime = newTime;
    noteToUpdate.hasAlerted = false;
    
    if (newState === 'CD') {
      const map = maps.value.find(m => m.level === noteToUpdate.mapLevel);
      if (map) {
        noteToUpdate.respawnTime = Date.now() + map.respawnTime * 1000;
      }
    }
  }
  notes.value.sort(sortNotesArray);
  saveNotes();
};

const handleToggleInputSound = (state: boolean) => {
  hasInputSoundOn.value = state;
};

const handleUpdateMapStar = (mapLevel: number) => {
  const map = maps.value.find(m => m.level === mapLevel);
  if (map) {
    map.isStarred = !map.isStarred;
  }
};

onMounted(() => {
  loadNotes();
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