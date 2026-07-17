<template>
  <div class="fixed inset-0 flex flex-col bg-black overflow-hidden">
    <div class="flex-1 relative min-h-0">
      <WaterfallCanvas
        ref="waterfallCanvasRef"
        :settings="store.settings"
        :mode="mode"
        :show-fps="showFPS"
        @ready="onEngineReady"
        @note-on="onCanvasNoteOn"
        @note-off="onCanvasNoteOff"
      />
      <div
        class="absolute top-0 left-0 right-0 p-3 flex items-center justify-between pointer-events-none"
      >
        <div class="flex items-center gap-2 pointer-events-auto">
          <button
            class="btn btn-sm btn-circle btn-ghost text-white hover:bg-white/20 tooltip tooltip-bottom"
            :data-tip="t('common.back')"
            :aria-label="t('common.back')"
            @click="$router.push('/home')"
          >
            <Icon name="arrow-left" :size="18" aria-hidden="true" />
          </button>
          <span class="text-white/80 font-semibold drop-shadow">
            {{ t("WaterfallPiano.title") }}
          </span>
        </div>
        <div class="flex items-center gap-1 pointer-events-auto">
          <button
            class="btn btn-sm btn-circle btn-ghost text-white tooltip tooltip-bottom"
            :data-tip="t('WaterfallPiano.midiDrawer.title')"
            :aria-label="t('WaterfallPiano.midiDrawer.title')"
            @click="midiDrawerOpen = true"
          >
            <Icon name="music" :size="18" aria-hidden="true" />
          </button>
          <button
            class="btn btn-sm btn-circle btn-ghost text-white tooltip tooltip-bottom"
            :data-tip="t('common.settings')"
            :aria-label="t('common.settings')"
            @click="settingsOpen = true"
          >
            <Icon name="settings" :size="18" aria-hidden="true" />
          </button>
        </div>
      </div>

      <PlaybackPanel
        :current-time="currentTime"
        :duration="duration"
        @seek="onSeek"
      />
    </div>

    <MidiDrawer
      v-model="midiDrawerOpen"
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
    <SettingsPanel v-model="settingsOpen" />

    <!-- Error 状态提示 -->
    <div
      v-if="isError"
      class="absolute inset-0 flex items-center justify-center bg-black/60 z-50"
    >
      <div class="bg-base-200 rounded-xl p-6 max-w-md text-center shadow-2xl">
        <div class="text-error text-5xl mb-4">
          <Icon name="alert-circle" :size="48" aria-hidden="true" />
        </div>
        <h3 class="text-lg font-bold text-base-content mb-2">
          {{ t("WaterfallPiano.errors.playbackFailed") || "播放失败" }}
        </h3>
        <p class="text-sm text-base-content/70 mb-4">
          {{ errorMessage }}
        </p>
        <button class="btn btn-primary btn-sm" @click="onRetry">
          {{ t("common.retry") || "重试" }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, shallowRef, computed, onMounted, onUnmounted } from "vue";
import { useI18n } from "vue-i18n";
import Icon from "@/components/Icon/Icon.vue";
import WaterfallCanvas from "./components/WaterfallCanvas.vue";
import PlaybackPanel from "./components/PlaybackPanel.vue";
import MidiDrawer from "./components/MidiDrawer.vue";
import SettingsPanel from "./components/SettingsPanel.vue";
import { useWaterfallPianoStore } from "./stores/WaterfallPiano";
import { MidiFilePlayer } from "./midi/MidiFilePlayer";
import { Recorder } from "./audio/Recorder";
import { useRealtimeMidi } from "./composables/useRealtimeMidi";
import { useVisibilityRefresh } from "./composables/useVisibilityRefresh";
import { PlayerStateMachine } from "./state/PlayerStateMachine";
import type { WaterfallEngine } from "./engine/WaterfallEngine";
import type { NoteBlockMode } from "./engine/NoteBlockSystem";
import type { MidiTrackInfo } from "./types";
import type { PlayerState } from "./state/PlayerStateMachine";
import { createLogger } from "@/utils/logger";

const logger = createLogger("WaterfallPianoView");

const { t } = useI18n();
const store = useWaterfallPianoStore();

// ── 状态机 ──
const stateMachine = new PlayerStateMachine();
const playerState = ref<PlayerState>(stateMachine.getState());

const mode = ref<NoteBlockMode>("realtime");
const contentType = ref<"none" | "recording" | "midi">("none");
const isRecording = ref(false);
const errorMessage = ref("");
const currentTime = ref(0);
const duration = ref(0);
const fileName = ref("");
const tracks = ref<MidiTrackInfo[]>([]);
const selectedTracks = ref<number[]>([]);
const settingsOpen = ref(false);
const midiDrawerOpen = ref(false);
const showFPS = ref(true);
const waterfallCanvasRef = ref<InstanceType<typeof WaterfallCanvas> | null>(
  null,
);

const engineRef = shallowRef<WaterfallEngine | null>(null);
const recorderRef = shallowRef<Recorder | null>(null);
let player: MidiFilePlayer | null = null;
let recorder: Recorder | null = null;

// ── 从 playerState ref 派生的计算属性（确保 Vue 响应式追踪） ──
const isPlaying = computed(() => playerState.value === "playing");
const isPaused = computed(() => playerState.value === "paused");
const isError = computed(() => playerState.value === "error");

// ── 窗口可见性刷新 ──
useVisibilityRefresh({
  forceRedraw: () => engineRef.value?.forceRedraw(),
});

/**
 * 确保 AudioContext 已初始化（处理浏览器自动播放策略限制）
 */
async function ensureAudioReady(): Promise<void> {
  await waterfallCanvasRef.value?.retryAudio();
}

/**
 * 引擎初始化完成回调，设置每帧驱动逻辑并恢复本地录缓存数据
 * @param engine - Waterfall 引擎实例
 */
function onEngineReady(engine: WaterfallEngine): void {
  engineRef.value = engine;
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

/**
 * 切换音符块显示模式（严格限制：仅 idle/ready 时允许切换）
 * @param m - 目标模式（realtime / synthesia）
 */
function onModeChange(m: NoteBlockMode): void {
  if (!stateMachine.canSwitchMode) {
    logger.warn(`Cannot switch mode in state: ${stateMachine.getState()}`);
    return;
  }
  mode.value = m;
  engineRef.value?.setMode(m);
}

/**
 * 加载 MIDI 文件并切换至 synthesia 模式（严格限制：仅 idle/ready 时允许加载）
 * @param file - 用户选择的 MIDI 文件
 */
async function onLoadMidi(file: File): Promise<void> {
  if (!player || !stateMachine.canLoadFile) {
    logger.warn(`Cannot load MIDI in state: ${stateMachine.getState()}`);
    return;
  }
  if (!stateMachine.setState("loading")) return;
  try {
    mode.value = "synthesia";
    engineRef.value?.setMode("synthesia");
    await player.loadFile(file);
    fileName.value = file.name;
    contentType.value = "midi";
    duration.value = player.getDuration();
    currentTime.value = 0;
    stateMachine.setState("ready");
  } catch (e) {
    logger.error({ err: e }, "loadFile failed");
    errorMessage.value = e instanceof Error ? e.message : String(e);
    stateMachine.setState("error");
  }
}

/**
 * 切换录制状态（严格限制：idle → recording → idle）
 */
function onToggleRecord(): void {
  if (!recorder) return;
  if (isRecording.value) {
    const notes = recorder.stopRecording();
    isRecording.value = false;
    if (notes.length > 0) {
      contentType.value = "recording";
      duration.value = recorder.getDuration();
    }
    stateMachine.setState("idle");
  } else {
    if (isPlaying.value) onStop();
    if (!stateMachine.setState("recording")) return;
    recorder.startRecording();
    isRecording.value = true;
  }
}

/**
 * 开始或恢复播放（严格限制：ready/paused → playing）
 */
async function onPlay(): Promise<void> {
  if (!stateMachine.canPlay) {
    logger.warn(`Cannot play in state: ${stateMachine.getState()}`);
    return;
  }
  await ensureAudioReady();
  if (contentType.value === "midi" && player) {
    if (isPaused.value) {
      player.resumePlayback();
    } else {
      player.startPlayback();
      engineRef.value?.noteBlockSystemRef.setTransportTime(0);
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
  stateMachine.setState("playing");
}

function onPause(): void {
  if (!stateMachine.canPause) {
    logger.warn(`Cannot pause in state: ${stateMachine.getState()}`);
    return;
  }
  if (contentType.value === "midi" && player) player.pausePlayback();
  else if (contentType.value === "recording" && recorder)
    recorder.pausePlayback();
  stateMachine.setState("paused");
  engineRef.value?.noteBlockSystemRef.setTransportPlaying(false);
}

function onStop(): void {
  if (!stateMachine.canStop) {
    logger.warn(`Cannot stop in state: ${stateMachine.getState()}`);
    return;
  }
  if (contentType.value === "midi" && player) player.stopPlayback();
  else if (contentType.value === "recording" && recorder)
    recorder.stopPlayback();
  currentTime.value = 0;
  stateMachine.setState("ready");
  engineRef.value?.noteBlockSystemRef.setTransportPlaying(false);
  engineRef.value?.noteBlockSystemRef.setTransportTime(0);
}

/**
 * 从 error 状态恢复到 idle
 */
function onRetry(): void {
  errorMessage.value = "";
  stateMachine.setState("idle");
}

function onSeek(seconds: number): void {
  if (contentType.value === "midi" && player) player.seekTo(seconds);
  else if (contentType.value === "recording" && recorder)
    recorder.seekTo(seconds);
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
  // 将状态机状态同步到 Vue 响应式系统
  stateMachine.onStateChange((newState) => {
    playerState.value = newState;
  });

  player = new MidiFilePlayer();
  player.setCallbacks({
    onProgress: (current, dur) => {
      currentTime.value = current;
      if (dur > 0) duration.value = dur;
      engineRef.value?.noteBlockSystemRef.setTransportTime(current);
    },
    onScheduledNotesReady: (notes) => {
      logger.info(`Scheduled notes ready: ${notes.length}`);
      engineRef.value?.noteBlockSystemRef.scheduleSynthesiaNotes(notes);
    },
    onTracksReady: (t) => {
      tracks.value = t;
      if (selectedTracks.value.length === 0 && t.length > 0) {
        selectedTracks.value = t.map((tr) => tr.index);
      }
    },
    onPlaybackEnd: () => {
      currentTime.value = 0;
      stateMachine.setState("ready");
      engineRef.value?.noteBlockSystemRef.setTransportPlaying(false);
    },
    onSyncTime: (time) => {
      logger.debug(`Syncing note blocks to time: ${time.toFixed(2)}s`);
      engineRef.value?.noteBlockSystemRef.syncToTime(time);
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
      currentTime.value = 0;
      stateMachine.setState("ready");
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
  engineRef.value?.dispose();
  engineRef.value = null;
});
</script>
