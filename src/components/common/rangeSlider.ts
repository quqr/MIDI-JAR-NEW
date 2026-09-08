/**
 * RangeSlider —— 对齐 daisyUI 5 Range 的通用滑条组件的类型与工具函数。
 *
 * 值模型：组件内部永远是纯数值（min/max/step 语义）。
 * 替代 select/radio 时由调用方把选项映射为 0..n-1 索引（用 optionsToRange），
 * 非数字领域值（如调号 "C"/"G"）不进入组件。
 */

export type RangeSliderColor =
  | "primary"
  | "secondary"
  | "accent"
  | "neutral"
  | "info"
  | "success"
  | "warning"
  | "error";

export type RangeSliderSize = "xs" | "sm" | "md" | "lg" | "xl";

/** 单头 = number；双头 = [lo, hi]（lo <= hi，互不穿越 + 推挤） */
export type RangeSliderValue = number | [number, number];

export interface RangeSliderOption {
  value: string | number;
  label: string;
}

/** daisyUI 5 各尺寸类的 --range-thumb-size 倍率（基准 --size-selector，默认 .25rem） */
export const RANGE_THUMB_SIZE_MULT: Record<RangeSliderSize, number> = {
  xs: 4,
  sm: 5,
  md: 6,
  lg: 7,
  xl: 8,
};

/**
 * thumb 中心在轨道上的水平位置（分数 p ∈ [0,1] → CSS calc 字符串）。
 * 与原生 thumb 行程一致：中心从 thumbSize/2 走到 100% - thumbSize/2。
 * 覆盖层（刻度点/标签/双头填充段）必须用同一公式才能与 thumb 对齐。
 */
export function trackPosCalc(p: number, size: RangeSliderSize): string {
  const mult = RANGE_THUMB_SIZE_MULT[size];
  const sel = "var(--size-selector, .25rem)";
  return `calc(${sel} * ${mult / 2} + ${p} * (100% - ${sel} * ${mult}))`;
}

/** 吸附到 step 网格并夹回 [min, max]，消除浮点尾差 */
export function clampSnap(
  value: number,
  min: number,
  max: number,
  step: number,
): number {
  const safeStep = step > 0 ? step : 1;
  const snapped = min + Math.round((value - min) / safeStep) * safeStep;
  const clamped = Math.min(max, Math.max(min, snapped));
  const decimals =
    safeStep >= 1
      ? 0
      : Math.min(6, Math.max(0, Math.ceil(-Math.log10(safeStep))));
  return Number(clamped.toFixed(decimals));
}

/** 把 select/radio 风格的选项列表映射为索引滑条的 props（值域 0..n-1，step 1） */
export function optionsToRange(options: readonly RangeSliderOption[]): {
  min: number;
  max: number;
  step: number;
  tickLabels: string[];
} {
  return {
    min: 0,
    max: Math.max(0, options.length - 1),
    step: 1,
    tickLabels: options.map((o) => o.label),
  };
}

/** 按值查选项索引（select 语义要求 value 唯一）；找不到返回 -1 */
export function optionIndexOf(
  options: readonly RangeSliderOption[],
  value: string | number,
): number {
  return options.findIndex((o) => o.value === value);
}

/** 估算标签显示宽度（em 单位：CJK 全宽 1，其余 0.55），用于宽度感知抽稀 */
export function labelWidthEm(text: string): number {
  let units = 0;
  for (const ch of text) {
    units += /[\u2E80-\u9FFF\uF900-\uFAFF\uFF00-\uFF60\u3000-\u303F]/.test(ch)
      ? 1
      : 0.55;
  }
  return units;
}
