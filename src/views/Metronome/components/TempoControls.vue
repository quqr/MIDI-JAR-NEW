<script setup lang="ts">
/**
 * 走带条（transport）：BPM 读数（可点击输入）+ 播放键 + 敲击定速 同排，
 * BPM 滑条紧随其下 —— 速度与播放是节拍器的首要操作，合并成一个
 * 主控区，不再各占一张卡片。
 *
 * 三段式布局 grid-cols-[1fr_auto_1fr]：左侧读数簇、中央播放键、右侧 Tap。
 * 动画：BPM 变化时数字轻量缩放（来源无关）；长按 Tap 呈脉冲态；
 * 遵守 prefers-reduced-motion。
 */
import { computed, nextTick, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { animate } from "animejs";
import { Icon } from "@/components/Icon";
import RangeSlider from "@/components/common/RangeSlider.vue";
import type { RangeSliderValue } from "@/components/common/rangeSlider";
import { useTapTempo } from "../composables/useTapTempo";
import { BPM_MAX, BPM_MIN } from "../types";

const props = defineProps<{
  bpm: number;
  isPlaying: boolean;
  /** 启动过渡中（禁用播放键） */
  starting: boolean;
}>();

const emit = defineEmits<{
  "update:bpm": [value: number];
  toggle: [];
}>();

const { t } = useI18n();
const { beginHold, endHold, pulseActive, tappedBpm } = useTapTempo((bpm) =>
  emit("update:bpm", bpm),
);

// ── 读数动画：值变化时轻微缩放，来源无关 ──
const readoutRef = ref<HTMLElement>();
let readoutAnim: { revert: () => void } | null = null;

watch(
  () => props.bpm,
  async () => {
    if (
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }
    await nextTick();
    const el = readoutRef.value;
    if (!el) return;
    readoutAnim?.revert();
    readoutAnim = animate(el, {
      scale: [1, 1.06, 1],
      duration: 260,
      ease: "outQuad",
    });
  },
);

// ── 编辑态：点击数字直接输入 ──
const editing = ref(false);
const draft = ref("");
const inputRef = ref<HTMLInputElement>();

async function beginEdit(): Promise<void> {
  draft.value = String(props.bpm);
  editing.value = true;
  await nextTick();
  inputRef.value?.focus();
  inputRef.value?.select();
}

function commitEdit(): void {
  if (!editing.value) return;
  const parsed = Number.parseInt(draft.value, 10);
  if (Number.isFinite(parsed)) {
    emit("update:bpm", Math.min(BPM_MAX, Math.max(BPM_MIN, parsed)));
  }
  editing.value = false;
}

function cancelEdit(): void {
  editing.value = false;
}

const tapHint = computed(() =>
  pulseActive.value
    ? t("metronome.tempo.tapPulse")
    : tappedBpm.value === null
      ? t("metronome.tempo.tapHint")
      : t("metronome.tempo.tapped", { bpm: tappedBpm.value }),
);

function onSlide(value: RangeSliderValue): void {
  emit("update:bpm", Number(Array.isArray(value) ? value[0] : value));
}

function step(delta: number): void {
  emit("update:bpm", Math.min(BPM_MAX, Math.max(BPM_MIN, props.bpm + delta)));
}
</script>

<template>
  <div class="flex flex-col gap-3">
    <!-- 三段式走带：读数簇 | 播放键 | Tap -->
    <div class="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
      <div class="justify-self-start flex items-center gap-1.5">
        <button
          type="button"
          class="btn btn-sm btn-circle btn-ghost"
          :aria-label="$t('metronome.tempo.decrease')"
          @click="step(-1)"
        >
          <Icon name="minus" :size="16" />
        </button>

        <button
          v-if="!editing"
          type="button"
          class="group flex flex-col items-center rounded-lg px-2 transition hover:bg-base-content/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          :aria-label="$t('metronome.tempo.bpmAria')"
          @click="beginEdit"
        >
          <span
            ref="readoutRef"
            class="inline-block text-4xl sm:text-5xl font-bold tabular-nums leading-none tracking-tight"
          >
            {{ bpm }}
          </span>
          <span
            class="mt-0.5 text-[10px] font-medium uppercase tracking-widest text-base-content/40 transition group-hover:text-base-content/60"
          >
            BPM
          </span>
        </button>

        <input
          v-else
          ref="inputRef"
          v-model="draft"
          type="text"
          inputmode="numeric"
          class="input input-bordered w-24 h-auto py-1 text-4xl font-bold tabular-nums"
          :aria-label="$t('metronome.tempo.bpmAria')"
          @blur="commitEdit"
          @keydown.enter.prevent="commitEdit"
          @keydown.esc.prevent="cancelEdit"
        />

        <button
          type="button"
          class="btn btn-sm btn-circle btn-ghost"
          :aria-label="$t('metronome.tempo.increase')"
          @click="step(1)"
        >
          <Icon name="plus" :size="16" />
        </button>
      </div>

      <!-- 播放键：走带区核心 -->
      <button
        type="button"
        class="btn btn-lg btn-circle btn-primary shadow-lg transition-transform hover:scale-105 active:scale-95"
        :class="{ 'btn-outline': isPlaying }"
        :disabled="starting"
        :aria-label="isPlaying ? $t('metronome.stop') : $t('metronome.start')"
        @click="emit('toggle')"
      >
        <Icon
          :name="isPlaying ? 'stop' : 'play'"
          :size="26"
          :class="{ 'ml-0.5': !isPlaying }"
        />
      </button>

      <div class="justify-self-end flex flex-col items-end gap-1">
        <button
          type="button"
          class="btn btn-sm gap-1.5 select-none"
          :class="pulseActive ? 'btn-primary' : 'btn-outline'"
          :aria-label="$t('metronome.tempo.tap')"
          @pointerdown.prevent="beginHold"
          @pointerup="endHold"
          @pointerleave="endHold"
          @pointercancel="endHold"
        >
          <Icon name="clock" :size="14" />
          {{ $t("metronome.tempo.tap") }}
        </button>
        <span class="h-4 text-[11px] text-base-content/40">
          {{ tapHint }}
        </span>
      </div>
    </div>

    <RangeSlider
      :model-value="bpm"
      :min="BPM_MIN"
      :max="BPM_MAX"
      :step="1"
      :aria-label="$t('metronome.tempo.bpmAria')"
      @update:model-value="onSlide"
    />
  </div>
</template>
