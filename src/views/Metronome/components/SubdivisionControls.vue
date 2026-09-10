<script setup lang="ts">
/**
 * 细分控制：模式（无 / 八分 / 十六分 / 三连音）+ 细分音量。
 *
 * 模式刻度用 **Bravura 音乐字体**的 SMuFL 音符字形直接渲染（♩/♪/𝅘𝅥𝅯/♪³），
 * 字形来自真实乐谱字体，比手绘 SVG 准确得多；切换时用 animejs 做轻微回弹。
 * 音量滑条在关闭细分时自动禁用。
 */
import { computed, nextTick, ref, watch } from "vue";
import { animate } from "animejs";
import RangeSlider from "@/components/common/RangeSlider.vue";
import type { RangeSliderValue } from "@/components/common/rangeSlider";
import { SUBDIVISIONS, slotsPerBeatOf, type SubdivisionMode } from "../types";

const props = defineProps<{
  subdivision: SubdivisionMode;
  subdivisionVolume: number;
}>();

const emit = defineEmits<{
  "update:subdivision": [value: SubdivisionMode];
  "update:subdivisionVolume": [value: number];
}>();

/**
 * 各模式对应的 SMuFL 音符字形（Bravura 字体码位，见 W3C SMuFL 规范）：
 * off = 四分音符 U+E1D5（每拍一声）；eighth = 八分 U+E1D7；
 * sixteenth = 十六分 U+E1D9；triplet = 八分 + 三连音数字 3。
 */
const MODE_GLYPH: Record<SubdivisionMode, string> = {
  off: "\u{E1D5}",
  eighth: "\u{E1D7}",
  sixteenth: "\u{E1D9}",
  triplet: "\u{E1D7}",
};

const modeIndex = computed(() => {
  const index = SUBDIVISIONS.indexOf(props.subdivision);
  return index < 0 ? 0 : index;
});

const volumePercent = computed(() => Math.round(props.subdivisionVolume * 100));
const disabled = computed(() => props.subdivision === "off");
const slotsHint = computed(() => slotsPerBeatOf(props.subdivision));

// ── 音符字形：切换时回弹 ──
const iconRefs = ref<HTMLElement[]>([]);
let bounceAnim: { revert: () => void } | null = null;

watch(
  () => props.subdivision,
  async () => {
    await nextTick();
    const el = iconRefs.value[modeIndex.value];
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    bounceAnim?.revert();
    bounceAnim = animate(el, {
      scale: [0.75, 1.12, 1],
      duration: 420,
      ease: "outElastic(1, 0.6)",
    });
  },
);

function onMode(index: number): void {
  emit("update:subdivision", SUBDIVISIONS[index] ?? "off");
}

function onVolume(value: RangeSliderValue): void {
  const raw = Number(Array.isArray(value) ? value[0] : value);
  emit("update:subdivisionVolume", Math.min(1, Math.max(0, raw / 100)));
}
</script>

<template>
  <div class="flex flex-col gap-3">
    <!-- 音符时值选择器：Bravura 字形，选中项用主色填充 -->
    <div class="grid grid-cols-4 gap-2">
      <button
        v-for="(mode, index) in SUBDIVISIONS"
        :key="mode"
        type="button"
        class="flex min-w-0 flex-col items-center gap-1 rounded-xl border px-1 py-2.5 transition duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        :class="
          modeIndex === index
            ? 'border-primary/60 bg-primary/10 text-primary shadow-sm'
            : 'border-base-content/10 bg-base-100 text-base-content/50 hover:border-base-content/25 hover:text-base-content/80'
        "
        :aria-pressed="modeIndex === index"
        :aria-label="$t(`metronome.subdivision.${mode}`)"
        @click="onMode(index)"
      >
        <span
          :ref="
            (el) => {
              if (el) iconRefs[index] = el as HTMLElement;
            }
          "
          class="flex h-7 items-center justify-center"
        >
          <span class="music-glyph text-[26px]">{{
            MODE_GLYPH[mode]
          }}</span>
          <span
            v-if="mode === 'triplet'"
            class="ml-0.5 mt-2 self-start text-[10px] font-bold leading-none"
            aria-hidden="true"
          >
            3
          </span>
        </span>
        <span class="text-[11px] leading-none whitespace-nowrap">
          {{ $t(`metronome.subdivision.${mode}`) }}
        </span>
      </button>
    </div>

    <!-- 细分音量：关闭细分时禁用并压暗 -->
    <div
      class="flex items-center gap-3 transition-opacity"
      :class="{ 'opacity-40 pointer-events-none': disabled }"
    >
      <span class="shrink-0 text-xs text-base-content/60">
        {{ $t("metronome.subdivision.volume") }}
      </span>
      <div class="flex-1 min-w-0">
        <RangeSlider
          :model-value="volumePercent"
          :min="0"
          :max="100"
          :step="1"
          :disabled="disabled"
          :aria-label="$t('metronome.subdivision.volumeAria')"
          @update:model-value="onVolume"
        />
      </div>
    </div>

    <p class="text-xs text-base-content/45">
      {{
        disabled
          ? $t("metronome.subdivision.offHint")
          : $t("metronome.subdivision.slotsHint", { count: slotsHint })
      }}
    </p>
  </div>
</template>
