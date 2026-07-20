<template>
  <div class="fixed inset-0 flex flex-col bg-black overflow-hidden">
    <div class="flex-1 relative min-h-0">
      <WaterfallCanvas
        ref="waterfallCanvasRef"
        :settings="store.settings"
        :mode="engine.mode.value"
        :show-fps="ui.showFPS.value"
        @ready="engine.onEngineReady"
        @note-on="midi.onCanvasNoteOn"
        @note-off="midi.onCanvasNoteOff"
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
            @click="ui.midiDrawerOpen.value = true"
          >
            <Icon name="music" :size="18" aria-hidden="true" />
          </button>
          <button
            class="btn btn-sm btn-circle btn-ghost text-white tooltip tooltip-bottom"
            :data-tip="t('common.settings')"
            :aria-label="t('common.settings')"
            @click="ui.settingsOpen.value = true"
          >
            <Icon name="settings" :size="18" aria-hidden="true" />
          </button>
        </div>
      </div>

      <PlaybackPanel
        :current-time="midi.currentTime.value"
        :duration="midi.duration.value"
        @seek="midi.onSeek"
      />
    </div>

    <MidiDrawer
      v-model="ui.midiDrawerOpen.value"
      :mode="engine.mode.value"
      :is-recording="midi.isRecording.value"
      :is-playing="ui.isPlaying.value"
      :is-paused="ui.isPaused.value"
      :current-time="midi.currentTime.value"
      :duration="midi.duration.value"
      :file-name="midi.fileName.value"
      :tracks="midi.tracks.value"
      :selected-tracks="midi.selectedTracks.value"
      :playback-speed="store.settings.midiFile.playbackSpeed"
      :loop="store.settings.midiFile.loop"
      :has-content="midi.contentType.value !== 'none'"
      @update:mode="engine.onModeChange"
      @toggle-record="midi.onToggleRecord"
      @play="midi.onPlay"
      @pause="midi.onPause"
      @stop="midi.onStop"
      @seek="midi.onSeek"
      @load-midi="midi.onLoadMidi"
      @select-tracks="midi.onSelectTracks"
      @set-speed="midi.onSetSpeed"
      @toggle-loop="midi.onToggleLoop"
    />
    <SettingsPanel v-model="ui.settingsOpen.value" />

    <!-- Error 状态提示 -->
    <div
      v-if="ui.isError.value"
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
          {{ ui.errorMessage.value }}
        </p>
        <button class="btn btn-primary btn-sm" @click="ui.onRetry">
          {{ t("common.retry") || "重试" }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { useI18n } from "vue-i18n";
import Icon from "@/components/Icon/Icon.vue";
import WaterfallCanvas from "./components/WaterfallCanvas.vue";
import PlaybackPanel from "./components/PlaybackPanel.vue";
import MidiDrawer from "./components/MidiDrawer.vue";
import SettingsPanel from "./components/SettingsPanel.vue";
import { useWaterfallPianoStore } from "./stores/WaterfallPiano";
import { PlayerStateMachine } from "./state/PlayerStateMachine";
import { useWaterfallUi } from "./composables/useWaterfallUi";
import { useWaterfallEngine } from "./composables/useWaterfallEngine";
import { useWaterfallMidi } from "./composables/useWaterfallMidi";
import type { PlaybackStrategy } from "./strategies/modeStrategies";

const { t } = useI18n();
const store = useWaterfallPianoStore();

// ── 状态机：所有播放状态转换的唯一真相源 ──
const stateMachine = new PlayerStateMachine();

// ── UI 状态层：面板开关、错误信息、播放状态派生 computed ──
const ui = useWaterfallUi(stateMachine);

// ── 引用 canvas 组件（用于 retryAudio 处理浏览器自动播放策略） ──
const waterfallCanvasRef = ref<InstanceType<typeof WaterfallCanvas> | null>(
  null,
);

// ── 引擎层与 MIDI 层的延迟绑定 ──
// useWaterfallEngine 需在 useWaterfallMidi 之前创建以提供 engineRef，
// 而 engine 的 frameCallback 需要 midi 提供的 getStrategy。
// 通过闭包持有可变引用，在 midi 创建后回填，打破循环依赖。
let _getStrategy: () => PlaybackStrategy | null = () => null;
let _onEngineInit: (() => void) | undefined;

const engine = useWaterfallEngine({
  stateMachine,
  getStrategy: () => _getStrategy(),
  onEngineInit: () => _onEngineInit?.(),
});

/**
 * 确保 AudioContext 已初始化（处理浏览器自动播放策略限制）
 */
async function ensureAudioReady(): Promise<void> {
  await waterfallCanvasRef.value?.retryAudio();
}

const midi = useWaterfallMidi({
  stateMachine,
  engineRef: engine.engineRef,
  mode: engine.mode,
  isPlaying: ui.isPlaying,
  isPaused: ui.isPaused,
  errorMessage: ui.errorMessage,
  ensureAudioReady,
  store,
});

// ── 回填策略获取函数与引擎初始化钩子 ──
_getStrategy = midi.getStrategy;
_onEngineInit = midi.onEngineInit;
</script>
