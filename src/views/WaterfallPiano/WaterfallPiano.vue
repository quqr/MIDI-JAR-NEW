<template>
  <!-- 纳入 AppLayout 内容区（ADR 0024）：navbar 常驻，播放控制经 Teleport 注入导航栏 -->
  <div class="relative w-full h-full min-h-0 bg-black overflow-hidden">
    <WaterfallCanvas
      ref="waterfallCanvasRef"
      :settings="store.settings"
      :mode="engine.mode.value"
      @ready="engine.onEngineReady"
    />

    <!-- 导航栏控制条：全部播放控制收入全局 navbar（通用插拔区） -->
    <Teleport defer to="#app-navbar-page-zone">
      <WaterfallNavbarControls
        :current-time="midi.currentTime.value"
        :duration="midi.duration.value"
        :is-playing="ui.isPlaying.value"
        :is-paused="ui.isPaused.value"
        :is-recording="midi.isRecording.value"
        :has-content="midi.contentType.value !== 'none'"
        :panel-open="ui.panelOpen.value"
        :exporting="videoExport.isExporting.value"
        @play="midi.onPlay"
        @pause="midi.onPause"
        @stop="midi.onStop"
        @seek="midi.onSeek"
        @toggle-record="midi.onToggleRecord"
        @toggle-panel="ui.togglePanel"
      />
    </Teleport>

    <!-- 合并面板（ADR 0025）：资料与设置同一个右侧抽屉，页签切换 -->
    <WaterfallSidePanel
      v-model="ui.panelOpen.value"
      v-model:tab="ui.panelTab.value"
      :mode="engine.mode.value"
      :file-name="midi.fileName.value"
      :tracks="midi.tracks.value"
      :selected-tracks="midi.selectedTracks.value"
      :playback-speed="store.settings.midiFile.playbackSpeed"
      :loop="store.settings.midiFile.loop"
      @update:mode="engine.onModeChange"
      @load-midi="midi.onLoadMidi"
      @load-music-xml="midi.onLoadMusicXml"
      @select-tracks="midi.onSelectTracks"
      @set-speed="midi.onSetSpeed"
      @toggle-loop="midi.onToggleLoop"
    />

    <!-- 右下角轻提示：导出中优先（前台渲染已停，画面静止属预期），
         否则为沉浸模式提示（UI 隐藏） -->
    <transition name="fade">
      <div
        v-if="videoExport.isExporting.value"
        class="absolute bottom-4 right-4 pointer-events-none rounded-lg bg-black/40 backdrop-blur px-3 py-1.5 text-xs text-white/70"
      >
        {{ t("WaterfallPiano.exportingHint") }}
      </div>
      <div
        v-else-if="ui.uiHidden.value"
        class="absolute bottom-4 right-4 pointer-events-none rounded-lg bg-black/40 backdrop-blur px-3 py-1.5 text-xs text-white/50"
      >
        {{ t("WaterfallPiano.uiHiddenHint") }}
      </div>
    </transition>

    <!-- 导出阻断弹窗：导出期间禁止其他操作，仅展示进度与取消 -->
    <VideoExportOverlay
      :open="videoExport.isExporting.value"
      :progress="videoExport.progress.value"
      :realtime-factor="videoExport.realtimeFactor.value"
      @cancel="videoExport.cancel"
    />

    <!-- Error 状态提示 -->
    <div
      v-if="ui.isError.value"
      class="absolute inset-0 flex items-center justify-center bg-black/60 z-modal"
    >
      <div
        class="card bg-base-100 border border-base-300 shadow-xl max-w-md text-center"
      >
        <div class="card-body p-6 items-center">
          <div class="text-error mb-4">
            <Icon name="alert-circle" :size="48" aria-hidden="true" />
          </div>
          <h3 class="text-lg font-bold text-base-content mb-2">
            {{ t("WaterfallPiano.errors.playbackFailed") }}
          </h3>
          <p class="text-sm text-base-content/70 mb-4">
            {{ ui.errorMessage.value }}
          </p>
          <button class="btn btn-primary btn-sm" @click="ui.onRetry">
            {{ t("common.retry") }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, toRaw, onUnmounted } from "vue";
import { useI18n } from "vue-i18n";
import Icon from "@/components/Icon/Icon.vue";
import VideoExportOverlay from "@/components/common/VideoExportOverlay.vue";
import WaterfallCanvas from "./components/WaterfallCanvas.vue";
import WaterfallNavbarControls from "./components/WaterfallNavbarControls.vue";
import WaterfallSidePanel from "./components/WaterfallSidePanel.vue";
import { useWaterfallPianoStore } from "./stores/WaterfallPiano";
import { PlayerStateMachine } from "./state/PlayerStateMachine";
import { useWaterfallUi } from "./composables/useWaterfallUi";
import { useWaterfallEngine } from "./composables/useWaterfallEngine";
import { useWaterfallMidi } from "./composables/useWaterfallMidi";
import { useWaterfallVideoExport } from "./composables/useWaterfallVideoExport";
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

// ── 视频导出（ADR 0023）：注入数据源 provider 与内容可用性 ──
const videoExport = useWaterfallVideoExport();
videoExport.bindExportSource(() => {
  const src = midi.getExportSource();
  if (!src) return null;
  // 画面宽高比取当前瀑布视口（引擎布局尺寸；引擎未就绪时退回窗口比例）
  const vp = engine.engineRef.value?.getViewportSize();
  const aspectRatio =
    vp && vp.height > 0
      ? vp.width / vp.height
      : window.innerWidth / Math.max(1, window.innerHeight);
  // settings 为深层响应式 Proxy：toRaw 还原后深拷贝快照，
  // 避免离屏引擎持有响应式引用（热循环读取 Proxy 开销大）
  const settings = structuredClone(toRaw(store.settings));
  return { ...src, settings, aspectRatio };
});
watch(
  () => midi.contentType.value,
  (ct) => videoExport.setContentAvailable(ct === "midi"),
  { immediate: true },
);

/**
 * 导出期间前台让路（ADR 0026）
 *
 * 导出会在后台另起一套离屏引擎逐帧渲染 + WebCodecs 编码；若前台仍按 60fps
 * 跑瀑布流（背景 / 方块 / 键盘 / Aura 滤镜 / 流体 WebGL）或仍在播放音频，
 * 两者争抢同一份 CPU / GPU，导出速度被拖慢。因此：
 * - suspend：停掉前台渲染循环 + 暂停播放（数据快照已在导出入口取好，不受影响）
 * - resume：只恢复渲染，不自动续播——导出通常耗时较长，恢复时续播无意义
 */
videoExport.bindExportSuspender({
  suspend: () => {
    engine.engineRef.value?.suspendRendering();
    if (ui.isPlaying.value) midi.onPause();
  },
  resume: () => {
    engine.engineRef.value?.resumeRendering();
  },
});

// ── 全局快捷键：Tab 切换 UI 层显隐（沉浸模式，ADR 0024） ──
// Tab 不在弹奏键位表中，与 WaterfallCanvas 的 keydown 不冲突
function onGlobalKeyDown(e: KeyboardEvent): void {
  if (e.key !== "Tab") return;
  const target = e.target;
  if (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement
  ) {
    return;
  }
  e.preventDefault();
  ui.uiHidden.value = !ui.uiHidden.value;
  // 进入沉浸模式时收起合并面板
  if (ui.uiHidden.value) {
    ui.panelOpen.value = false;
  }
}
window.addEventListener("keydown", onGlobalKeyDown);

onUnmounted(() => {
  window.removeEventListener("keydown", onGlobalKeyDown);
  videoExport.unbindExportSource();
  videoExport.bindExportSuspender(null);
});
</script>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
