<script setup lang="ts">
import { computed, onMounted, ref, shallowRef, toRef, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useFilePicker } from "@/composables/useFilePicker";
import { useThemeStore } from "@/stores/theme";
import { useOsmd } from "./composables/useOsmd";
import { useScoreScrollStore } from "./stores/ScoreScroll";
import {
  useScoreSync,
  type ScoreSyncViewport,
} from "./composables/useScoreSync";
import ScoreViewport from "./components/ScoreViewport.vue";
import SourcePanel from "./components/SourcePanel.vue";
import TransportBar from "./components/TransportBar.vue";
import ScoreDisplaySettings from "./components/ScoreDisplaySettings.vue";
import ScoreAppearanceSettings from "./components/ScoreAppearanceSettings.vue";
import VideoExportPanel from "./components/VideoExportPanel.vue";
import { useVideoExport } from "./composables/useVideoExport";
import {
  cameraContentRect,
  clampCameraRect,
  type CameraFrameRect,
} from "./utils/scoreFrameBuilder";
import { videoCanvasSizeForRatio } from "./utils/videoExport";
import type { ScoreMetaInfo } from "./types";

const { t } = useI18n();
const store = useScoreScrollStore();
const themeStore = useThemeStore();
const { openFile } = useFilePicker();

// ============ 缩放（与 ScoreViewport 同边界，纯数值，不触发任何重排） ============

/** 与 ScoreViewport 内的常量保持一致（实用边界，体感无限） */
const ZOOM_MIN = 0.02;
const ZOOM_MAX = 50;

/** 当前缩放。变化由 ScoreViewport 的 canvas 变换消化，OSMD 感知不到 */
const zoom = ref(1);

function onZoomChange(z: number): void {
  zoom.value = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, z));
}

const viewportRef = ref<InstanceType<typeof ScoreViewport>>();
const osmdTarget = computed(() => viewportRef.value?.osmdEl);
const osmd = useOsmd(osmdTarget);

// 视口句柄 → 同步器（滚动控制）
const viewportApi = shallowRef<ScoreSyncViewport | null>(null);
watch(
  viewportRef,
  (v) => {
    viewportApi.value = v ?? null;
  },
  { immediate: true, flush: "post" },
);

// 播放同步：滚动（每帧更新视口偏移 → 触发按帧重绘）
const sync = useScoreSync({
  viewport: viewportApi,
  scanlinePosition: toRef(() => store.settings.display.scanlinePosition),
});

const scoreName = ref<string | null>(null);
const parseError = ref(false);
const meta = ref<ScoreMetaInfo | null>(null);

const errorText = computed(() =>
  parseError.value ? t("scoreScroll.source.parseError") : "",
);

async function onPickScore(): Promise<void> {
  const picked = await openFile(".musicxml,.xml");
  if (!picked) return;
  // 解析/渲染/图元解析阶段：失败报"解析错误"；
  // 返回 null = 期间发生了新的加载/清空（会话被取代），静默忽略
  let result;
  try {
    result = await osmd.loadScore(picked.data);
  } catch {
    parseError.value = true;
    return;
  }
  if (!result) return;
  scoreName.value = picked.name;
  parseError.value = false;
  meta.value = result.meta;
  // 数据交接阶段：异常不伪装成解析错误，直接抛到控制台便于定位
  // （内部完成视口尺寸/偏移同步；图元随渲染批次增量解析，无需额外处理）
  sync.setScoreData(result);
}

function onClearScore(): void {
  osmd.clear();
  sync.clearScore();
  scoreName.value = null;
  parseError.value = false;
  meta.value = null;
}

function onSeek(seconds: number): void {
  sync.seek(seconds);
}

// ============ 视频导出（离线渲染，见 useVideoExport / videoEncoder） ============

const videoExport = useVideoExport();

// 挂载时预检各编码可用性（面板只展示当前环境支持的编码）
onMounted(() => {
  void videoExport.probeCodecs();
});

// 乐谱加载/更换时按谱面高度重置取景矩形默认值（谱面全高 + 余量，16:9）
watch(
  () => sync.contentHeightPx.value,
  (h) => videoExport.initCamera(h),
);

/**
 * 导出取景矩形的完整边界（乐谱加载后恒提供，预览开关只控制是否绘制
 * 覆盖层）。矩形夹紧、画布尺寸与缩放换算与 videoEncoder 的导出取景
 * 共用同一组纯函数，预览即导出所见；矩形可直接在视口拖拽。
 */
const cameraFrame = computed<CameraFrameRect | null>(() => {
  if (sync.contentHeightPx.value <= 0) return null;
  const rect = clampCameraRect(
    videoExport.cameraWidth.value,
    videoExport.cameraHeight.value,
    videoExport.cameraCenterY.value,
    sync.contentHeightPx.value,
  );
  const { width, height } = videoCanvasSizeForRatio(
    rect.width / rect.height,
    videoExport.shortSide.value,
  );
  const zoomE = height / rect.height;
  return cameraContentRect(
    sync.playheadX.value,
    width,
    store.settings.display.scanlinePosition,
    zoomE,
    rect.top,
    rect.height,
  );
});

/**
 * 视口内拖拽取景矩形 → 写回导出状态：
 * top 换算为垂直位置百分比（centerY），宽高直接写回；
 * clampCameraRect 会在读取侧再次夹紧。
 */
function onCameraUpdate(r: {
  width: number;
  height: number;
  top: number;
}): void {
  const ch = sync.contentHeightPx.value;
  if (ch <= 0) return;
  videoExport.cameraWidth.value = r.width;
  videoExport.cameraHeight.value = r.height;
  videoExport.cameraCenterY.value = ((r.top + r.height / 2) / ch) * 100;
}

function onExportVideo(): void {
  if (osmd.primitives.items.length === 0 || sync.duration.value <= 0) return;
  void startVideoExport();
}

/** 一次性解析主题色（导出为纯函数管线，不读 DOM） */
function resolveExportColors() {
  const cs = getComputedStyle(document.documentElement);
  const color = (name: string, fallback: string): string =>
    cs.getPropertyValue(name).trim() || fallback;
  return {
    scanlineColor: color("--color-primary", "#3b82f6"),
    baseColor: color("--color-base-300", "#d4d4d8"),
    dotColor: color("--color-base-content", "#52525b"),
  };
}

async function startVideoExport(): Promise<void> {
  await videoExport.run({
    primitives: osmd.primitives,
    beatXMap: sync.beatXMap.value,
    tempoMap: sync.tempoMap.value,
    contentHeightPx: sync.contentHeightPx.value,
    durationSec: sync.duration.value,
    frameInputs: {
      scanlinePosition: store.settings.display.scanlinePosition,
      snapPosition: store.settings.display.snapPosition,
      showScanline: store.settings.display.showScanline,
      showFlyIn: store.settings.display.showFlyIn,
      flyInDistance: store.settings.display.flyInDistance,
      flyInScatter: store.settings.display.flyInScatter,
      flyInDelay: store.settings.display.flyInDelay,
      flyInDuration: store.settings.display.flyInDuration,
      showFlyOut: store.settings.display.showFlyOut,
      flyOutDistance: store.settings.display.flyOutDistance,
      flyOutScatter: store.settings.display.flyOutScatter,
      flyOutDelay: store.settings.display.flyOutDelay,
      flyOutDuration: store.settings.display.flyOutDuration,
      showGlow: store.settings.display.showGlow,
      glowRange: store.settings.display.glowRange,
      glowIntensity: store.settings.display.glowIntensity,
      tintColor: store.settings.display.tintColor,
      background: store.settings.appearance.background,
      customColor: store.settings.appearance.customColor,
      ...resolveExportColors(),
      activated: true,
    },
  });
}

// 全局主题切换：谱面配色（深色 → 亮色符号）重渲染并一次性异步解析
// （同上，固定 zoom = 1，缩放交给 canvas 变换）
watch(
  () => themeStore.isDark,
  async (dark) => {
    const result = await osmd.setDark(dark);
    if (result) {
      sync.setScoreData(result);
    }
  },
  { immediate: true },
);
</script>

<template>
  <div class="flex-1 min-h-0 flex flex-col bg-base-300">
    <!-- 主体：谱面视口 + 右侧设置面板 -->
    <div class="flex-1 flex min-h-0">
      <div class="flex-1 min-w-0">
        <ScoreViewport
          ref="viewportRef"
          :zoom="zoom"
          :scanline-position="store.settings.display.scanlinePosition"
          :snap-position="store.settings.display.snapPosition"
          :show-scanline="store.settings.display.showScanline"
          :show-fly-in="store.settings.display.showFlyIn"
          :fly-in-distance="store.settings.display.flyInDistance"
          :fly-in-scatter="store.settings.display.flyInScatter"
          :fly-in-delay="store.settings.display.flyInDelay"
          :fly-in-duration="store.settings.display.flyInDuration"
          :show-fly-out="store.settings.display.showFlyOut"
          :fly-out-distance="store.settings.display.flyOutDistance"
          :fly-out-scatter="store.settings.display.flyOutScatter"
          :fly-out-delay="store.settings.display.flyOutDelay"
          :fly-out-duration="store.settings.display.flyOutDuration"
          :show-glow="store.settings.display.showGlow"
          :glow-range="store.settings.display.glowRange"
          :glow-intensity="store.settings.display.glowIntensity"
          :tint-color="store.settings.display.tintColor"
          :background="store.settings.appearance.background"
          :custom-color="store.settings.appearance.customColor"
          :camera-rect="cameraFrame"
          :show-camera-overlay="videoExport.cameraPreview.value"
          @camera-update="onCameraUpdate"
          :dark="themeStore.isDark"
          :primitives="osmd.primitives"
          :primitives-version="osmd.primitivesVersion.value"
          :loading="osmd.loading.value"
          :playhead-x="sync.playheadX.value"
          :playback-state="sync.playbackState.value"
          @update:zoom="onZoomChange"
        />
      </div>

      <!-- 右侧设置面板 -->
      <aside
        class="w-72 shrink-0 overflow-y-auto border-l border-base-content/10 bg-base-100 p-3 flex flex-col gap-4"
      >
        <details open class="collapse collapse-arrow bg-base-200/40">
          <summary
            class="collapse-title min-h-0 py-2 text-sm font-bold text-base-content/80"
          >
            {{ t("scoreScroll.source.title") }}
          </summary>
          <div class="collapse-content px-0 pb-1">
            <SourcePanel
              :score-name="scoreName"
              :loading="osmd.loading.value"
              :error-text="errorText"
              @pick-score="onPickScore"
              @clear-score="onClearScore"
            />
          </div>
        </details>

        <!-- 显示设置面板 -->
        <details open class="collapse collapse-arrow bg-base-200/40">
          <summary
            class="collapse-title min-h-0 py-2 text-sm font-bold text-base-content/80"
          >
            {{ t("scoreScroll.display.title") }}
          </summary>
          <div class="collapse-content px-0 pb-1">
            <ScoreDisplaySettings />
          </div>
        </details>

        <!-- 外观设置面板 -->
        <details open class="collapse collapse-arrow bg-base-200/40">
          <summary
            class="collapse-title min-h-0 py-2 text-sm font-bold text-base-content/80"
          >
            {{ t("scoreScroll.appearance.title") }}
          </summary>
          <div class="collapse-content px-0 pb-1">
            <ScoreAppearanceSettings />
          </div>
        </details>

        <!-- 视频导出设置面板 -->
        <details open class="collapse collapse-arrow bg-base-200/40">
          <summary
            class="collapse-title min-h-0 py-2 text-sm font-bold text-base-content/80"
          >
            {{ t("videoExport.title") }}
          </summary>
          <div class="collapse-content px-0 pb-1">
            <VideoExportPanel @start="startVideoExport" />
          </div>
        </details>
      </aside>
    </div>

    <!-- 播放控制条 -->
    <TransportBar
      :playback-state="sync.playbackState.value"
      :current-time="sync.currentTime.value"
      :duration="sync.duration.value"
      :current-measure-index="sync.currentMeasureIndex.value"
      :meta="meta"
      @play="sync.play"
      @pause="sync.pause"
      @stop="sync.stop"
      @seek="onSeek"
      @export="onExportVideo"
    />
  </div>
</template>
