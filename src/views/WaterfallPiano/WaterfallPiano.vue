<template>
  <div class="relative w-full h-full overflow-hidden">
    <!-- 全屏 Canvas -->
    <WaterfallCanvas
      ref="canvasRef"
      class="absolute inset-0"
      @note-on="onNoteOn"
      @note-off="onNoteOff"
      @context-action="onContextAction"
    />

    <!-- 音域指示器 -->
    <div
      class="absolute top-4 left-4 z-10 badge badge-lg backdrop-blur-sm bg-base-100/50 border-base-200/30 font-mono text-sm"
    >
      {{ rangeText }}
    </div>

    <!-- 右上角浮动按钮 -->
    <div class="absolute top-4 right-4 z-10 flex gap-2">
      <button
        class="btn btn-circle btn-sm btn-ghost backdrop-blur-sm bg-base-100/30"
        :aria-label="t('waterfallPiano.openSettings')"
        @click="settingsOpen = true"
      >
        <Icon name="settings" :size="16" />
      </button>
      <button
        class="btn btn-circle btn-sm btn-ghost backdrop-blur-sm bg-base-100/30"
        :aria-label="t('waterfallPiano.playbackControls')"
        @click="sidebarOpen = !sidebarOpen"
      >
        <Icon name="music" :size="16" />
      </button>
    </div>

    <!-- 右侧边栏抽屉 -->
    <SidebarDrawer
      v-model="sidebarOpen"
      :title="t('waterfallPiano.playbackControls')"
    >
      <PlaybackPanel
        ref="playbackPanelRef"
        @toggle-record="toggleRecord"
        @stop-all="stopAll"
        @toggle-playback="togglePlayback"
        @import-midi="importMidi"
        @seek="seekTo"
      />
    </SidebarDrawer>

    <!-- 设置模态框 -->
    <SettingsModal v-model="settingsOpen" :title="t('waterfallPiano.settings')">
      <SettingsPanel />
    </SettingsModal>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onUnmounted } from "vue";
import { useI18n } from "vue-i18n";
import { SettingsModal } from "@/components/SettingsModal/";
import Icon from "@/components/Icon/Icon.vue";
import { useWaterfallPianoStore } from "./stores/waterfallPiano";
import { Recorder } from "./audio/Recorder";
import { MidiFilePlayer } from "./midi/MidiFilePlayer";
import WaterfallCanvas from "./components/WaterfallCanvas.vue";
import SidebarDrawer from "./components/SidebarDrawer.vue";
import PlaybackPanel from "./components/PlaybackPanel.vue";
import SettingsPanel from "./components/SettingsPanel.vue";
import type { PlaybackState, ContentType, ScheduledNote } from "./types";

const { t } = useI18n();
const store = useWaterfallPianoStore();
const settingsOpen = ref(false);
const sidebarOpen = ref(false);
const canvasRef = ref<InstanceType<typeof WaterfallCanvas>>();
const playbackPanelRef = ref<InstanceType<typeof PlaybackPanel>>();

const recorder = new Recorder();
const midiPlayer = new MidiFilePlayer();

// 播放状态
const playbackState = ref<PlaybackState>("idle");
const contentType = ref<ContentType>("none");

// 当前的调度音符（用于 Synthesia 模式）
let scheduledNotes: ScheduledNote[] = [];

// 音域指示器
const rangeText = computed(() => {
  const engine = canvasRef.value?.getEngine();
  const kr = engine?.keyboardRenderer;
  return kr ? kr.getRangeText() : "A0 - C8";
});

// ─── 设置录制器回调 ───
recorder.setCallbacks({
  onNoteOn: (midi, velocity) => {
    // 录制回放时，音符由 NoteBlockSystem 在 Synthesia 模式触发
    // 这里只需要同步键盘高亮（如果 NoteBlockSystem 没有触发的话）
    engine().triggerSynthesiaNote(midi, velocity);
  },
  onNoteOff: (midi) => {
    engine().releaseSynthesiaNote(midi);
  },
  onPlaybackEnd: () => {
    playbackState.value = "idle";
    store.isPlaying = false;
    engine().setMode("realtime");
    engine().setTransportPlaying(false);
    playbackPanelRef.value?.setProgress(0, 0);
  },
  onProgress: (progress, seconds) => {
    playbackPanelRef.value?.setProgress(progress, seconds);
    engine().setTransportTime(seconds);
  },
  onScheduledNotesReady: (notes) => {
    scheduledNotes = notes;
    engine().scheduleSynthesiaNotes(notes);
  },
});

// ─── 设置 MIDI 播放器回调 ───
midiPlayer.setCallbacks({
  onNoteOn: (midi, velocity, _trackIndex, _hand) => {
    engine().triggerSynthesiaNote(midi, velocity);
  },
  onNoteOff: (midi, _trackIndex) => {
    engine().releaseSynthesiaNote(midi);
  },
  onPlaybackEnd: () => {
    playbackState.value = "idle";
    store.isPlaying = false;
    engine().setMode("realtime");
    engine().setTransportPlaying(false);
    playbackPanelRef.value?.setProgress(0, 0);
  },
  onProgress: (progress, seconds) => {
    playbackPanelRef.value?.setProgress(progress, seconds);
    engine().setTransportTime(seconds);
  },
  onScheduledNotesReady: (notes) => {
    scheduledNotes = notes;
    engine().scheduleSynthesiaNotes(notes);
  },
});

function engine() {
  return canvasRef.value!.getEngine()!;
}

defineExpose({ canvasRef });

// ─── 录制 ───
function toggleRecord() {
  if (recorder.isRecording) {
    const notes = recorder.stopRecording();
    store.recordedNotes = notes;
    store.isRecording = false;
    contentType.value = notes.length > 0 ? "recording" : "none";
  } else {
    // 如果正在播放，先停止
    stopAll();
    recorder.startRecording();
    store.isRecording = true;
    engine().setMode("realtime");
  }
}

// ─── 停止所有 ───
function stopAll() {
  if (recorder.isRecording) {
    recorder.stopRecording();
    store.isRecording = false;
  }
  if (recorder.getIsPlaying() || recorder.getIsPaused()) {
    recorder.stopPlayback();
  }
  if (midiPlayer.getIsPlaying() || midiPlayer.getIsPaused()) {
    midiPlayer.stopPlayback();
  }
  playbackState.value = "idle";
  store.isPlaying = false;
  engine().setMode("realtime");
  engine().setTransportPlaying(false);
  engine().clearNoteBlocks();
  engine().keyboardRenderer?.clearAllHighlights();
  playbackPanelRef.value?.setProgress(0, 0);
}

// ─── 播放/暂停/恢复 ───
async function togglePlayback() {
  // 如果正在播放 → 暂停
  if (playbackState.value === "playing") {
    if (contentType.value === "midi") {
      midiPlayer.pausePlayback();
    } else if (contentType.value === "recording") {
      recorder.pausePlayback();
    }
    playbackState.value = "paused";
    store.isPlaying = false;
    engine().setTransportPlaying(false);
    return;
  }

  // 如果暂停中 → 恢复
  if (playbackState.value === "paused") {
    engine().setMode("synthesia");
    engine().setTransportPlaying(true);
    playbackState.value = "playing";
    store.isPlaying = true;
    if (contentType.value === "midi") {
      await midiPlayer.resumePlayback();
    } else if (contentType.value === "recording") {
      await recorder.resumePlayback();
    }
    return;
  }

  // 从头开始播放
  if (contentType.value === "midi" && midiPlayer.getDuration() > 0) {
    await startMidiPlayback();
  } else if (
    contentType.value === "recording" ||
    store.recordedNotes.length > 0
  ) {
    contentType.value = "recording";
    await startRecordingPlayback();
  }
}

async function startMidiPlayback() {
  engine().setMode("synthesia");
  engine().clearNoteBlocks();
  engine().setTransportPlaying(true);
  playbackState.value = "playing";
  store.isPlaying = true;
  await midiPlayer.startPlayback();
}

async function startRecordingPlayback() {
  engine().setMode("synthesia");
  engine().clearNoteBlocks();
  engine().setTransportPlaying(true);
  playbackState.value = "playing";
  store.isPlaying = true;
  await recorder.startPlayback(store.recordedNotes);
}

// ─── 跳转 ───
function seekTo(seconds: number) {
  if (contentType.value === "midi") {
    midiPlayer.seekTo(seconds);
  } else if (contentType.value === "recording") {
    recorder.seekTo(seconds);
  }
  // 重新调度音符
  engine().clearNoteBlocks();
  if (scheduledNotes.length > 0) {
    engine().scheduleSynthesiaNotes(scheduledNotes);
  }
}

// ─── 实时演奏回调 ───
function onNoteOn(midi: number, velocity: number) {
  if (store.isRecording) {
    recorder.recordNoteOn(midi, velocity);
  }
}

function onNoteOff(midi: number) {
  if (store.isRecording) {
    recorder.recordNoteOff(midi);
  }
}

// ─── 右键菜单动作 ───
function onContextAction(action: "record" | "playback" | "settings" | "reset") {
  switch (action) {
    case "record":
      toggleRecord();
      break;
    case "playback":
      togglePlayback();
      break;
    case "settings":
      settingsOpen.value = true;
      break;
    case "reset":
      stopAll();
      break;
  }
}

// ─── 导入 MIDI ───
async function importMidi(file: File) {
  try {
    stopAll();
    await midiPlayer.loadFile(file);
    store.currentMidiFileName = file.name;
    contentType.value = "midi";
    playbackPanelRef.value?.setMidiInfo(file.name, midiPlayer.getDuration());
  } catch (err) {
    console.error("Failed to load MIDI file:", err);
  }
}

// ─── 键盘快捷键 ───
function handleKeyDown(e: KeyboardEvent) {
  if (
    e.target instanceof HTMLInputElement ||
    e.target instanceof HTMLTextAreaElement
  )
    return;

  if (e.code === "Space") {
    e.preventDefault();
    toggleRecord();
  }
  if (e.code === "Enter") {
    e.preventDefault();
    togglePlayback();
  }
  if (e.code === "Escape") {
    settingsOpen.value = false;
  }
}

if (typeof window !== "undefined") {
  window.addEventListener("keydown", handleKeyDown);
}

onUnmounted(() => {
  if (typeof window !== "undefined") {
    window.removeEventListener("keydown", handleKeyDown);
  }
  recorder.dispose();
  midiPlayer.dispose();
});
</script>
