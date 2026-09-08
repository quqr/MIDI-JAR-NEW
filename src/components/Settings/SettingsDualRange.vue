<template>
  <fieldset class="fieldset">
    <legend v-if="label" class="fieldset-legend pb-1 text-sm">
      {{ label }}
    </legend>
    <RangeSlider
      v-if="options.length > 1"
      :model-value="indices"
      dual
      :min="0"
      :max="options.length - 1"
      :step="1"
      :tick-labels="optionLabels"
      color="primary"
      :disabled="disabled"
      :aria-label="label"
      @update:model-value="onSlide"
    />
    <span v-else class="label text-base-content/70">–</span>
    <span v-if="description" class="label text-base-content/70">{{
      description
    }}</span>
  </fieldset>
</template>

<script setup lang="ts">
import { computed } from "vue";
import RangeSlider from "@/components/common/RangeSlider.vue";
import { optionIndexOf } from "@/components/common/rangeSlider";
import type { RangeSliderValue } from "@/components/common/rangeSlider";

/**
 * 双头范围设置控件：两个独立字段（如 piano.from / piano.to）以 select
 * 风格选项映射为一条双头索引滑条（lo <= hi，互不穿越 + 推挤）。
 */
interface Props {
  label?: string;
  description?: string;
  /** 选项列表（value 唯一，select 语义） */
  options: { value: string | number; label: string }[];
  /** 低位字段当前值 */
  from: string | number | null | undefined;
  /** 高位字段当前值 */
  to: string | number | null | undefined;
  disabled?: boolean;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  /** 元组为 [低位选项 value, 高位选项 value]（非索引） */
  (e: "update", range: [string | number, string | number]): void;
}>();

const optionLabels = computed(() => props.options.map((o) => o.label));

/** 非法/缺失值夹回合法区间，且保证 lo <= hi */
const indices = computed<[number, number]>(() => {
  const last = props.options.length - 1;
  const loRaw =
    props.from == null ? -1 : optionIndexOf(props.options, props.from);
  const hiRaw = props.to == null ? -1 : optionIndexOf(props.options, props.to);
  const lo = loRaw < 0 ? 0 : loRaw;
  const hi = hiRaw < 0 ? last : hiRaw;
  return [Math.min(lo, hi), Math.max(lo, hi)];
});

function onSlide(value: RangeSliderValue) {
  if (!Array.isArray(value)) return;
  const lo = props.options[value[0]];
  const hi = props.options[value[1]];
  if (lo && hi) emit("update", [lo.value, hi.value]);
}
</script>
