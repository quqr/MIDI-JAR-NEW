<script setup lang="ts">
/**
 * 乐谱滚动（Score Scroll）主视图
 *
 * 标准布局：顶部应用导航栏（AppLayout 提供），主体左侧谱面视口
 * （Canvas 渲染 + 扫描线 + 自动滚动），底部播放控制条，右侧设置面板。
 * 播放时间轴由 MusicXML 自身驱动（音符时值 + 小节速度标记），无需 MIDI 文件。
 *
 * 渲染策略（Canvas 图元缓存方案，见 ADR 0010 / 0013）：
 * - OSMD 以固定 zoom = 1 渲染 SVG，每批产出立即解析为图元并丢弃 DOM；
 *   加载遮罩覆盖渲染与解析全程，完成后谱面一次性完整可用。
 * - 缩放（0.02x - 50x）由 ScoreViewport 的 ctx.setTransform 完成，
 *   矢量重绘无损；本组件 onZoomChange 只做边界夹紧，OSMD 感知不到缩放。
 * - 播放中由 useScoreSync 驱动视口偏移，每帧重绘可见窗口内的图元，
 *   无 DOM 变动、无补画链路。
 *
 * 平移策略：无边界（无限移动）。播放中由 useScoreSync 驱动滚动，
 * 空闲/暂停时自由拖拽 + 惯性滑行。
 */
import { computed, ref, shallowRef, toRef, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useFilePicker } from "@/composables/useFilePicker";
import { useThemeStore } from "@/stores/theme";
import { useOsmd } from "./composables/useOsmd";
import { useScoreScrollStore } from "./stores/ScoreScroll";
import {
  useScoreSync,
  type ScoreSyncData,
  type ScoreSyncViewport,
} from "./composables/useScoreSync";
import ScoreViewport from "./components/ScoreViewport.vue";
import SourcePanel from "./components/SourcePanel.vue";
import TransportBar from "./components/TransportBar.vue";
import ScoreDisplaySettings from "./components/ScoreDisplaySettings.vue";
import ScoreAppearanceSettings from "./components/ScoreAppearanceSettings.vue";
import type { ScoreMetaInfo, ScoreNoteInfo } from "./types";

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

/** 按 x 升序的音符副本（符头高光定位用；每次乐谱数据交接时重建） */
const sortedNotes = shallowRef<ScoreNoteInfo[]>([]);

/** 乐谱数据统一交接：重建 x 排序音符副本 → 交给播放同步器 */
function applyScoreData(result: ScoreSyncData): void {
  const sorted = [...result.notes];
  sorted.sort((a, b) => a.x - b.x);
  sortedNotes.value = sorted;
  sync.setScoreData(result);
}

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
    result = await osmd.loadScore(
      picked.data,
      store.settings.appearance.musicFont,
    );
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
  applyScoreData(result);
}

function onClearScore(): void {
  osmd.clear();
  sync.clearScore();
  sortedNotes.value = [];
  scoreName.value = null;
  parseError.value = false;
  meta.value = null;
}

function onSeek(seconds: number): void {
  sync.seek(seconds);
}

// 音乐字体变更：重渲染并同步新的音符/系统坐标
// （重渲染始终在固定 zoom = 1 下进行，缩放交给 canvas 变换）
watch(
  () => store.settings.appearance.musicFont,
  async (font) => {
    const result = await osmd.applyFont(font);
    if (result) {
      applyScoreData(result);
    }
  },
);

// 全局主题切换：谱面配色（深色 → 亮色符号）重渲染并一次性异步解析
// （同上，固定 zoom = 1，缩放交给 canvas 变换）
watch(
  () => themeStore.isDark,
  async (dark) => {
    const result = await osmd.setDark(dark);
    if (result) {
      applyScoreData(result);
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
          :reveal="store.settings.display.showReveal"
          :show-fly-in="store.settings.display.showFlyIn"
          :fly-in-distance="store.settings.display.flyInDistance"
          :fly-in-scatter="store.settings.display.flyInScatter"
          :fly-in-delay="store.settings.display.flyInDelay"
          :fly-in-duration="store.settings.display.flyInDuration"
          :show-glow="store.settings.display.showGlow"
          :glow-range="store.settings.display.glowRange"
          :glow-intensity="store.settings.display.glowIntensity"
          :glow-size="store.settings.display.glowSize"
          :glow-color="store.settings.display.glowColor"
          :notes="sortedNotes"
          :background="store.settings.appearance.background"
          :dark="themeStore.isDark"
          :primitives="osmd.primitives"
          :primitives-version="osmd.primitivesVersion.value"
          :loading="osmd.loading.value"
          :playback-state="sync.playbackState.value"
          @update:zoom="onZoomChange"
        />
      </div>

      <!-- 右侧设置面板 -->
      <aside
        class="w-72 shrink-0 overflow-y-auto border-l border-base-content/10 bg-base-100 p-3 flex flex-col gap-4"
      >
        <section>
          <h3 class="mb-2 text-sm font-bold text-base-content/80">
            {{ t("scoreScroll.source.title") }}
          </h3>
          <SourcePanel
            :score-name="scoreName"
            :loading="osmd.loading.value"
            :error-text="errorText"
            @pick-score="onPickScore"
            @clear-score="onClearScore"
          />
        </section>

        <!-- 显示设置面板 -->
        <section>
          <h3 class="mb-2 text-sm font-bold text-base-content/80">
            {{ t("scoreScroll.display.title") }}
          </h3>
          <ScoreDisplaySettings />
        </section>

        <!-- 外观设置面板 -->
        <section>
          <h3 class="mb-2 text-sm font-bold text-base-content/80">
            {{ t("scoreScroll.appearance.title") }}
          </h3>
          <ScoreAppearanceSettings />
        </section>
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
    />
  </div>
</template>
