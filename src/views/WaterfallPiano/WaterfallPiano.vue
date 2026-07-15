<template>
  <div class="fixed inset-0 flex flex-col bg-black overflow-hidden">
    <div class="flex-1 relative min-h-0">
      <WaterfallCanvas
        ref="waterfallCanvasRef"
        :settings="store.settings"
        :mode="mode"
        :octave-offset="store.octaveOffset"
        @ready="onEngineReady"
        @note-on="onCanvasNoteOn"
        @note-off="onCanvasNoteOff"
      />
      <div class="absolute top-0 left-0 right-0 p-3 flex items-center justify-between pointer-events-none">
        <div class="flex items-center gap-2 pointer-events-auto">
          <button
            class="btn btn-sm btn-circle btn-ghost text-white hover:bg-white/20"
            :aria-label="t('common.back')"
            @click="$router.push('/home')"
          >
            <Icon name="arrow-left" :size="18" aria-hidden="true" />
          </button>
          <span class="text-white/80 font-semibold drop-shadow">
            {{ t('waterfallPiano.title') }}
          </span>
        </div>
        <div class="flex items-center gap-1 pointer-events-auto">
          <button
            class="btn btn-sm btn-circle btn-ghost text-white"
            :aria-label="t('common.decrement')"
            @click="store.octaveOffset = Math.max(-4, store.octaveOffset - 1)"
          >
            <Icon name="minus" :size="16" aria-hidden="true" />
          </button>
          <span class="text-white/70 text-xs font-mono w-10 text-center tabular-nums">
            {{ store.octaveOffset >= 0 ? '+' : '' }}{{ store.octaveOffset }}
          </span>
          <button
            class="btn btn-sm btn-circle btn-ghost text-white"
            :aria-label="t('common.increment')"
            @click="store.octaveOffset = Math.min(4, store.octaveOffset + 1)"
          >
            <Icon name="plus" :size="16" aria-hidden="true" />
          </button>
          <button
            class="btn btn-sm btn-circle btn-ghost text-white"
            :aria-label="t('common.settings')"
            @click="settingsOpen = true"
          >
            <Icon name="settings" :size="18" aria-hidden="true" />
          </button>
        </div>
      </div>

      <PlaybackPanel
        :mode="mode"
        :is-recording="isRecording"
        :is-playing="isPlaying"
        :is-paused="isPaused"
        :current-time="currentTime"
        :duration="duration"
        :file-name="fileName"
        :tracks="tracks"
        :selected-tracks="selectedTracks"
        :playback-speed="store.settings.midiFile.playbackSpeed"
        :loop="store.settings.midiFile.loop"
        :has-content="contentType !== 'none'"
        @update:mode="onModeChange"
        @toggle-record="onToggleRecord"
        @play="onPlay"
        @pause="onPause"
        @stop="onStop"
        @seek="onSeek"
        @load-midi="onLoadMidi"
        @select-tracks="onSelectTracks"
        @set-speed="onSetSpeed"
        @toggle-loop="onToggleLoop"
      />
    </div>

    <SettingsPanel v-model="settingsOpen" />
  </div>
</template>

<script setup lang="ts">
import { ref, shallowRef, onMounted, onUnmounted } from "vue";
import { useI18n } from "vue-i18n";
import Icon from "@/components/Icon/Icon.vue";
import WaterfallCanvas from "./components/WaterfallCanvas.vue";
import PlaybackPanel from "./components/PlaybackPanel.vue";
import SettingsPanel from "./components/SettingsPanel.vue";
import { useWaterfallPianoStore } from "./stores/waterfallPiano";
import { MidiFilePlayer } from "./midi/MidiFilePlayer";
import { Recorder } from "./audio/Recorder";
import { useRealtimeMidi } from "./composables/useRealtimeMidi";
import type { WaterfallEngine } from "./engine/WaterfallEngine";
import type { NoteBlockMode } from "./engine/NoteBlockSystem";
import type { MidiTrackInfo } from "./types";

const { t } = useI18n();
const store = useWaterfallPianoStore();

const mode = ref<NoteBlockMode>("realtime");
const contentType = ref<"none" | "recording" | "midi">("none");
const isRecording = ref(false);
const isPlaying = ref(false);
const isPaused = ref(false);
const currentTime = ref(0);
const duration = ref(0);
const fileName = ref("");
const tracks = ref<MidiTrackInfo[]>([]);
const selectedTracks = ref<number[]>([]);
const settingsOpen = ref(false);
const waterfallCanvasRef = ref<InstanceType<typeof WaterfallCanvas> | null>(null);

const engineRef = shallowRef<WaterfallEngine | null>(null);
const recorderRef = shallowRef<Recorder | null>(null);
let player: MidiFilePlayer | null = null;
let recorder: Recorder | null = null;

async function ensureAudioReady(): Promise<void> {
  await waterfallCanvasRef.value?.retryAudio();
}

function onEngineReady(engine: WaterfallEngine): void {
  engineRef.value = engine;
  // 设置每帧回调：在 WaterfallEngine 主循环中调用 player.tick()/recorder.tick()，
  // 替代各自独立的 rAF 循环，消除两个 rAF 之间的时间同步问题
  engine.frameCallback = () => {
    if (contentType.value === "midi" && player?.getIsPlaying()) {
      player.tick();
    } else if (contentType.value === "recording" && recorder?.getIsPlaying()) {
      recorder.tick();
    }
  };
  if (recorder) {
    const saved = recorder.loadFromStorage();
    if (saved.length > 0) {
      recorder.loadNotes(saved);
      duration.value = recorder.getDuration();
    }
  }
}

function onCanvasNoteOn(midi: number, vel: number): void {
  if (isRecording.value && recorder) recorder.recordNoteOn(midi, vel);
}

function onCanvasNoteOff(midi: number): void {
  if (isRecording.value && recorder) recorder.recordNoteOff(midi);
}

function onModeChange(m: NoteBlockMode): void {
  mode.value = m;
  engineRef.value?.setMode(m);
  if (m === "realtime") {
    engineRef.value?.noteBlockSystemRef.setTransportPlaying(false);
  }
}

async function onLoadMidi(file: File): Promise<void> {
  if (!player) return;
  try {
    // 先切换模式（清空旧方块），再加载文件（调度新音符）
    // 顺序不能反，否则 setMode 的 clearNoteBlocks 会清空刚调度的 synthesiaNotes
    mode.value = "synthesia";
    engineRef.value?.setMode("synthesia");
    await player.loadFile(file);
    fileName.value = file.name;
    contentType.value = "midi";
    duration.value = player.getDuration();
    currentTime.value = 0;
  } catch (e) {
    console.error("[MIDI] loadFile failed:", e);
  }
}

function onToggleRecord(): void {
  if (!recorder) return;
  if (isRecording.value) {
    const notes = recorder.stopRecording();
    isRecording.value = false;
    if (notes.length > 0) {
      contentType.value = "recording";
      duration.value = recorder.getDuration();
    }
  } else {
    if (isPlaying.value) onStop();
    recorder.startRecording();
    isRecording.value = true;
  }
}

async function onPlay(): Promise<void> {
  await ensureAudioReady();
  if (contentType.value === "midi" && player) {
    if (isPaused.value) {
      player.resumePlayback();
    } else {
      player.startPlayback();
    }
    engineRef.value?.noteBlockSystemRef.setTransportPlaying(true);
  } else if (contentType.value === "recording" && recorder) {
    if (isPaused.value) {
      recorder.resumePlayback();
    } else {
      recorder.startPlayback();
    }
    engineRef.value?.noteBlockSystemRef.setTransportPlaying(true);
  }
  isPlaying.value = true;
  isPaused.value = false;
}

function onPause(): void {
  if (contentType.value === "midi" && player) player.pausePlayback();
  else if (contentType.value === "recording" && recorder) recorder.pausePlayback();
  isPlaying.value = false;
  isPaused.value = true;
  engineRef.value?.noteBlockSystemRef.setTransportPlaying(false);
}

function onStop(): void {
  if (contentType.value === "midi" && player) player.stopPlayback();
  else if (contentType.value === "recording" && recorder) recorder.stopPlayback();
  isPlaying.value = false;
  isPaused.value = false;
  currentTime.value = 0;
  engineRef.value?.noteBlockSystemRef.setTransportPlaying(false);
  engineRef.value?.noteBlockSystemRef.setTransportTime(0);
}

function onSeek(seconds: number): void {
  if (contentType.value === "midi" && player) player.seekTo(seconds);
  else if (contentType.value === "recording" && recorder) recorder.seekTo(seconds);
  currentTime.value = seconds;
  engineRef.value?.noteBlockSystemRef.setTransportTime(seconds);
}

function onSelectTracks(indices: number[]): void {
  selectedTracks.value = indices;
  if (player) {
    player.setSelectedTracks(indices);
    duration.value = player.getDuration();
  }
}

function onSetSpeed(speed: number): void {
  store.updateSetting("midiFile", "playbackSpeed", speed);
  if (player) player.setPlaybackSpeed(speed);
}

function onToggleLoop(): void {
  const next = !store.settings.midiFile.loop;
  store.updateSetting("midiFile", "loop", next);
  if (player) player.setLoop(next);
}

onMounted(() => {
  player = new MidiFilePlayer();
  player.setCallbacks({
    onProgress: (current, dur) => {
      currentTime.value = current;
      if (dur > 0) duration.value = dur;
      engineRef.value?.noteBlockSystemRef.setTransportTime(current);
    },
    onScheduledNotesReady: (notes) => {
      engineRef.value?.noteBlockSystemRef.scheduleSynthesiaNotes(notes);
    },
    onTracksReady: (t) => {
      tracks.value = t;
      if (selectedTracks.value.length === 0 && t.length > 0) {
        selectedTracks.value = t.map((tr) => tr.index);
      }
    },
    onPlaybackEnd: () => {
      isPlaying.value = false;
      isPaused.value = false;
      currentTime.value = 0;
      engineRef.value?.noteBlockSystemRef.setTransportPlaying(false);
    },
  });

  recorder = new Recorder();
  recorderRef.value = recorder;
  recorder.setCallbacks({
    onProgress: (current, dur) => {
      currentTime.value = current;
      if (dur > 0) duration.value = dur;
      engineRef.value?.noteBlockSystemRef.setTransportTime(current);
    },
    onScheduledNotesReady: (notes) => {
      engineRef.value?.noteBlockSystemRef.scheduleSynthesiaNotes(notes);
    },
    onPlaybackEnd: () => {
      isPlaying.value = false;
      isPaused.value = false;
      currentTime.value = 0;
      engineRef.value?.noteBlockSystemRef.setTransportPlaying(false);
    },
  });

  useRealtimeMidi(engineRef, recorderRef, isRecording, {
    onSustain: (enabled) => {
      engineRef.value?.setSustain(enabled);
    },
  });
});

onUnmounted(() => {
  player?.dispose();
  recorder?.dispose();
  player = null;
  recorder = null;
});
</script>
