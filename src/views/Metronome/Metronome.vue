<script setup lang="ts">
/**
 * 节拍器模块页面 — 合成 click + 精确网格调度 + 拍点阵可视化
 *
 * 布局：主舞台（可视化 + 大号走带按钮）居中突出，参数区在其下两列排布，
 * 拍号与重音因需要横向空间单独占一行。
 * 页面级生命周期：离开页面即停止并拆除音频节点。
 */
import { computed, onMounted, onUnmounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { animate, createTimeline, stagger } from "animejs";
import { Icon } from "@/components/Icon";
import RangeSlider from "@/components/common/RangeSlider.vue";
import type { RangeSliderValue } from "@/components/common/rangeSlider";
import SettingRow from "@/components/common/SettingRow.vue";
import StateDot from "@/components/common/StateDot.vue";
import BeatVisualizer from "./components/BeatVisualizer.vue";
import BeatAccentEditor from "./components/BeatAccentEditor.vue";
import SubdivisionControls from "./components/SubdivisionControls.vue";
import TempoControls from "./components/TempoControls.vue";
import TimeSignatureControls from "./components/TimeSignatureControls.vue";
import { useMetronome } from "./composables/useMetronome";
import { slotsPerBeatOf } from "./types";

const { params, status, isPlaying, visual, getState, toggle } = useMetronome();
const { t } = useI18n();

const slotsPerBeat = computed(() => slotsPerBeatOf(params.value.subdivision));
const currentBeat = computed(() =>
  isPlaying.value && visual.value && !visual.value.silent
    ? visual.value.beatIndex
    : -1,
);
const countInText = computed(() => {
  const state = visual.value;
  if (!state || !state.silent) return "";
  return t("metronome.countIn.counting", {
    bar: state.countInBar,
    beat: state.countInBeat,
  });
});
const statusType = computed(() => {
  if (status.value === "playing") return "success" as const;
  if (status.value === "starting") return "warning" as const;
  return "neutral" as const;
});

const volumePercent = computed(() => Math.round(params.value.volume * 100));
const countInLabels = [
  "metronome.countIn.off",
  "metronome.countIn.oneBar",
  "metronome.countIn.twoBars",
];

/** 走带主按钮下方的一句提示 */
const transportHint = computed(() =>
  isPlaying.value ? t("metronome.hintPlaying") : t("metronome.hintIdle"),
);

function onVolume(value: RangeSliderValue): void {
  const raw = Number(Array.isArray(value) ? value[0] : value);
  params.value.volume = Math.min(1, Math.max(0, raw / 100));
}

function onCountIn(value: RangeSliderValue): void {
  const raw = Number(Array.isArray(value) ? value[0] : value);
  params.value.countInBars = Math.min(2, Math.max(0, raw)) as 0 | 1 | 2;
}

// ── 空格键启停（输入框内不拦截，避免打断数字录入） ──
function onKeydown(event: KeyboardEvent): void {
  if (event.code !== "Space" || event.repeat) return;
  const target = event.target as HTMLElement | null;
  const tag = target?.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || target?.isContentEditable)
    return;
  event.preventDefault();
  toggle();
}

// ── 进入动画（animejs v4 timeline） ──
const headerRef = ref<HTMLElement>();
const stageRef = ref<HTMLElement>();
const panelsRef = ref<HTMLElement>();
const accentRef = ref<HTMLElement>();
const outputRef = ref<HTMLElement>();
let introAnims: { revert: () => void }[] = [];

onMounted(() => {
  window.addEventListener("keydown", onKeydown);

  const prefersReducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  ).matches;

  const sections = [
    headerRef.value,
    stageRef.value,
    panelsRef.value,
    accentRef.value,
    outputRef.value,
  ].filter((el): el is HTMLElement => !!el);

  if (prefersReducedMotion) {
    introAnims = sections.map((el) =>
      animate(el, { opacity: [0, 1], duration: 200 }),
    );
    return;
  }

  const tl = createTimeline({ defaults: { duration: 550, ease: "outExpo" } });
  tl.add(sections, {
    opacity: [0, 1],
    translateY: [-20, 0],
    delay: stagger(70),
  });
  introAnims = [tl];
});

onUnmounted(() => {
  window.removeEventListener("keydown", onKeydown);
  for (const anim of introAnims) anim.revert();
  introAnims = [];
});
</script>

<template>
  <div class="h-full overflow-y-auto">
    <div
      class="w-full max-w-5xl mx-auto px-4 py-4 sm:px-6 flex flex-col gap-3 sm:gap-4"
    >
      <!-- ===== 标题行（播放键已下沉到走带区，这里只留状态） ===== -->
      <header ref="headerRef" class="flex items-center gap-3">
        <div
          class="w-11 h-11 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shrink-0"
        >
          <Icon name="metronome" :size="22" />
        </div>
        <div class="min-w-0">
          <h1 class="text-xl font-bold leading-tight">
            {{ $t("nav.metronome") }}
          </h1>
          <p class="text-xs text-base-content/50 mt-1">
            {{ $t("metronome.subtitle") }}
          </p>
        </div>
        <div class="ml-auto flex items-center gap-2">
          <StateDot
            :status="statusType"
            size="sm"
            :aria-label="$t(`metronome.status.${status}`)"
          />
          <span class="text-xs text-base-content/50">
            {{ $t(`metronome.status.${status}`) }}
          </span>
        </div>
      </header>

      <!-- ===== 主舞台：走带条（读数 + 播放 + Tap + BPM 滑条） + 拍点阵 ===== -->
      <section
        ref="stageRef"
        class="bg-base-200/40 rounded-2xl border border-base-content/5 p-4 sm:p-5 flex flex-col gap-4"
      >
        <TempoControls
          :bpm="params.bpm"
          :is-playing="isPlaying"
          :starting="status === 'starting'"
          @update:bpm="params.bpm = $event"
          @toggle="toggle"
        />
        <BeatVisualizer
          :get-state="getState"
          :numerator="params.timeSignature.numerator"
          :denominator="params.timeSignature.denominator"
          :slots-per-beat="slotsPerBeat"
          :accents="params.accents"
          :running="isPlaying"
          :count-in-text="countInText"
        />
      </section>

      <!-- ===== 拍号 | 细分 ===== -->
      <div
        ref="panelsRef"
        class="grid gap-3 sm:gap-4 lg:grid-cols-2 lg:items-start"
      >
        <section
          class="bg-base-200/40 rounded-2xl border border-base-content/5 p-4 sm:p-5 flex flex-col gap-4"
        >
          <h2 class="text-sm font-semibold text-base-content/80">
            {{ $t("metronome.signature.title") }}
          </h2>
          <TimeSignatureControls
            :numerator="params.timeSignature.numerator"
            :denominator="params.timeSignature.denominator"
            @update:numerator="params.timeSignature.numerator = $event"
            @update:denominator="params.timeSignature.denominator = $event"
          />
        </section>

        <section
          class="bg-base-200/40 rounded-2xl border border-base-content/5 p-4 sm:p-5 flex flex-col gap-4"
        >
          <h2 class="text-sm font-semibold text-base-content/80">
            {{ $t("metronome.subdivision.title") }}
          </h2>
          <SubdivisionControls
            :subdivision="params.subdivision"
            :subdivision-volume="params.subdivisionVolume"
            @update:subdivision="params.subdivision = $event"
            @update:subdivision-volume="params.subdivisionVolume = $event"
          />
        </section>
      </div>

      <!-- ===== 重音（canvas 需要横向空间，独占一行） ===== -->
      <section
        ref="accentRef"
        class="bg-base-200/40 rounded-2xl border border-base-content/5 p-4 sm:p-5 flex flex-col gap-4"
      >
        <h2 class="text-sm font-semibold text-base-content/80">
          {{ $t("metronome.accent.title") }}
        </h2>
        <BeatAccentEditor
          :accents="params.accents"
          :current-beat="currentBeat"
          @update:accents="params.accents = $event"
        />
      </section>

      <!-- ===== 预备拍 | 主音量（轻量行，两条自带标签的设置并排） ===== -->
      <section
        ref="outputRef"
        class="grid gap-x-8 gap-y-3 sm:grid-cols-2 rounded-2xl border border-base-content/5 bg-base-200/40 p-4 sm:p-5"
      >
        <SettingRow :title="$t('metronome.countIn.title')">
          <div class="w-40 sm:w-48">
            <RangeSlider
              :model-value="params.countInBars"
              :min="0"
              :max="2"
              :step="1"
              no-fill
              :tick-labels="countInLabels.map((key) => $t(key))"
              :aria-label="$t('metronome.countIn.modeAria')"
              @update:model-value="onCountIn"
            />
          </div>
        </SettingRow>

        <SettingRow :title="$t('metronome.volume.title')">
          <div class="w-40 sm:w-48">
            <RangeSlider
              :model-value="volumePercent"
              :min="0"
              :max="100"
              :step="1"
              no-fill
              :aria-label="$t('metronome.volume.aria')"
              @update:model-value="onVolume"
            />
          </div>
        </SettingRow>
      </section>

      <p class="text-xs text-base-content/40 text-center pb-1">
        {{ transportHint }}
      </p>
    </div>
  </div>
</template>
