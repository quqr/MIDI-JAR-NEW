<script setup lang="ts">
/**
 * 乐谱滚动（Score Scroll）主视图
 *
 * 标准布局：顶部应用导航栏（AppLayout 提供），主体左侧谱面视口
 * （OSMD 渲染 + 扫描线 + 自动滚动），底部播放控制条，右侧设置面板。
 * 播放时间轴由 MusicXML 自身驱动（音符时值 + 小节速度标记），无需 MIDI 文件。
 */
import { computed, ref, shallowRef, toRef, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useFilePicker } from "@/composables/useFilePicker";
import { useThemeStore } from "@/stores/theme";
import { useScoreScrollStore } from "./stores/ScoreScroll";
import { useOsmd } from "./composables/useOsmd";
import {
  useScoreSync,
  type ScoreSyncViewport,
} from "./composables/useScoreSync";
import {
  useScoreEffects,
  type EffectLayerExposed,
} from "./composables/useScoreEffects";
import ScoreViewport from "./components/ScoreViewport.vue";
import SourcePanel from "./components/SourcePanel.vue";
import TransportBar from "./components/TransportBar.vue";
import EffectLayer from "./components/EffectLayer.vue";
import ScoreEffectsSettings from "./components/ScoreEffectsSettings.vue";
import ScoreAppearanceSettings from "./components/ScoreAppearanceSettings.vue";
import type { ScoreMetaInfo } from "./types";

const { t } = useI18n();
const store = useScoreScrollStore();
const themeStore = useThemeStore();
const { openFile } = useFilePicker();

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

// 特效层句柄 → 命中特效编排
const effectLayerRef = ref<InstanceType<typeof EffectLayer>>();
const effectLayer = shallowRef<EffectLayerExposed | null>(null);
watch(
  effectLayerRef,
  (v) => {
    effectLayer.value = v ?? null;
  },
  { immediate: true, flush: "post" },
);

const effects = useScoreEffects({
  layer: effectLayer,
  getSettings: () => store.settings.effects,
});

const sync = useScoreSync({
  viewport: viewportApi,
  snapPosition: toRef(() => store.settings.effects.snapPosition),
  onNoteHit: effects.onNoteHit,
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
  try {
    const result = await osmd.loadScore(
      picked.data,
      store.settings.appearance.musicFont,
    );
    scoreName.value = picked.name;
    parseError.value = false;
    meta.value = result.meta;
    sync.setScoreData(result);
    const target = viewportRef.value?.osmdEl;
    if (target) effects.onScoreReady(target);
  } catch {
    parseError.value = true;
  }
}

function onClearScore(): void {
  osmd.clear();
  sync.clearScore();
  scoreName.value = null;
  parseError.value = false;
  meta.value = null;
}

function onZoomChange(z: number): void {
  const result = osmd.setZoom(z);
  if (result) {
    sync.setScoreData(result);
  }
}

function onSeek(seconds: number): void {
  sync.seek(seconds);
}

// 音乐字体变更：重渲染并同步新的音符/系统坐标
watch(
  () => store.settings.appearance.musicFont,
  async (font) => {
    const result = await osmd.applyFont(font);
    if (result) {
      sync.setScoreData(result);
    }
  },
);

// 全局主题切换：谱面配色（深色 → 亮色符号）重渲染
watch(
  () => themeStore.isDark,
  (dark) => {
    const result = osmd.setDark(dark);
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
          :zoom="osmd.zoom.value"
          :scanline-position="store.settings.effects.scanlinePosition"
          :background="store.settings.appearance.background"
          :loading="osmd.loading.value"
          :playing="sync.playbackState.value === 'playing'"
          @update:zoom="onZoomChange"
        >
          <template #overlay>
            <EffectLayer ref="effectLayerRef" />
          </template>
        </ScoreViewport>
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

        <!-- 特效参数面板 -->
        <section>
          <h3 class="mb-2 text-sm font-bold text-base-content/80">
            {{ t("scoreScroll.effects.title") }}
          </h3>
          <ScoreEffectsSettings />
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
