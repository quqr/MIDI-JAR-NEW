<script setup lang="ts">
/**
 * 调音器模块页面 — 实时音高检测 + 基准音选择
 *
 * 布局骨架与 ChordQuiz 一致（max-w-2xl mx-auto）；
 * 进入动画用 animejs timeline（遵守 prefers-reduced-motion）。
 */
import { computed, onMounted, onUnmounted, ref } from "vue";
import { animate, createTimeline, stagger } from "animejs";
import { Icon } from "@/components/Icon";
import { usePitchDetector } from "./composables/usePitchDetector";
import { centsOff, midiToNoteName } from "./utils/pitchMath";
import { A4_DEFAULT } from "./types";
import PitchIndicator from "./components/PitchIndicator.vue";
import PitchInfoPanel from "./components/PitchInfoPanel.vue";
import ReferenceToneControls from "./components/ReferenceToneControls.vue";
import InputStatus from "./components/InputStatus.vue";

// ── 状态 ──
const a4Frequency = ref<number>(A4_DEFAULT);
const detector = usePitchDetector();
const isListening = computed(() => detector.status.value === "listening");

/** 当前显示读数：音名 / 频率 / 音分（音分随基准音实时重算） */
const display = computed(() => {
  const r = detector.reading.value;
  if (!r) return null;
  return {
    name: midiToNoteName(r.midi),
    freq: r.freq,
    cents: centsOff(r.freq, r.midi, a4Frequency.value),
  };
});

// ── 启停 ──
async function startDetection(): Promise<void> {
  await detector.start(() => a4Frequency.value);
}

function stopDetection(): void {
  detector.stop();
}

function toggleDetection(): void {
  if (isListening.value) stopDetection();
  else void startDetection();
}

// ── 进入动画（animejs v4 timeline） ──
const headerRef = ref<HTMLElement>();
const indicatorRef = ref<HTMLElement>();
const panelRef = ref<HTMLElement>();
const controlsRef = ref<HTMLElement>();
let introAnims: { revert: () => void }[] = [];

onMounted(() => {
  const prefersReducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  ).matches;

  const sections = [
    headerRef.value,
    indicatorRef.value,
    panelRef.value,
    controlsRef.value,
  ].filter((el): el is HTMLElement => !!el);

  if (prefersReducedMotion) {
    introAnims = sections.map((el) =>
      animate(el, { opacity: [0, 1], duration: 200 }),
    );
    return;
  }

  const tl = createTimeline({ defaults: { duration: 500, ease: "outExpo" } });
  tl.add(sections, {
    opacity: [0, 1],
    translateY: [-24, 0],
    delay: stagger(80),
  });
  introAnims = [tl];
});

onUnmounted(() => {
  for (const anim of introAnims) anim.revert();
  introAnims = [];
});
</script>

<template>
  <div class="h-full overflow-y-auto">
    <div class="max-w-2xl mx-auto px-4 py-6 sm:px-6 flex flex-col gap-6">
      <!-- ===== 标题行 ===== -->
      <header ref="headerRef" class="flex items-center gap-3">
        <div
          class="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0"
        >
          <Icon name="tuner" :size="20" />
        </div>
        <div class="min-w-0">
          <h1 class="text-lg font-bold leading-tight">
            {{ $t("nav.tuner") }}
          </h1>
          <p class="text-xs text-base-content/50 mt-0.5">
            {{ $t("tuner.subtitle") }}
          </p>
        </div>
        <div class="ml-auto">
          <InputStatus
            :status="detector.status.value"
            :error-key="detector.errorKey.value"
            @retry="startDetection"
          />
        </div>
      </header>

      <!-- ===== 音高指示器 ===== -->
      <section
        ref="indicatorRef"
        class="bg-base-200/40 rounded-2xl border border-base-content/5 p-4 sm:p-5"
      >
        <PitchIndicator :cents="display?.cents ?? null" :active="isListening" />
      </section>

      <!-- ===== 音高信息 ===== -->
      <section ref="panelRef">
        <PitchInfoPanel
          :note-name="display?.name ?? null"
          :freq="display?.freq ?? null"
          :cents="display?.cents ?? null"
          :active="isListening"
        />
      </section>

      <!-- ===== 控制区 ===== -->
      <section
        ref="controlsRef"
        class="bg-base-200/40 rounded-2xl border border-base-content/5 p-4 sm:p-5 flex flex-col gap-4"
      >
        <ReferenceToneControls
          :a4-frequency="a4Frequency"
          @update:a4-frequency="a4Frequency = $event"
        />

        <div
          class="flex items-center justify-between border-t border-base-content/10 pt-4"
        >
          <p class="text-xs text-base-content/50">
            {{ $t("tuner.hint") }}
          </p>
          <button
            type="button"
            class="btn btn-primary btn-sm"
            :class="{ 'btn-outline': isListening }"
            :disabled="detector.status.value === 'starting'"
            @click="toggleDetection"
          >
            <Icon :name="isListening ? 'stop' : 'play'" :size="14" />
            {{ isListening ? $t("tuner.stop") : $t("tuner.start") }}
          </button>
        </div>
      </section>
    </div>
  </div>
</template>
