import type { ColorScheme } from "../types";

/** vue-i18n 翻译函数的最小签名 */
export type TranslateFunction = (key: string) => string;

/** 通用选项结构，对齐 SettingsSelect / SettingsRadioGroup 的 options prop */
export interface OptionItem<T = string> {
  value: T;
  label: string;
}

/** 粒子配色方案选项 */
export function createColorSchemeOptions(
  t: TranslateFunction,
): OptionItem<ColorScheme>[] {
  return [
    { value: "pitch", label: t("WaterfallPiano.scheme.pitch") },
    { value: "hands", label: t("WaterfallPiano.scheme.hands") },
    { value: "rainbow", label: t("WaterfallPiano.scheme.rainbow") },
    { value: "warm", label: t("WaterfallPiano.scheme.warm") },
    { value: "cool", label: t("WaterfallPiano.scheme.cool") },
    { value: "neon", label: t("WaterfallPiano.scheme.neon") },
    { value: "custom", label: t("WaterfallPiano.customColors") },
  ];
}

/** 流体风格预设选项 */
export function createFluidStyleOptions(
  _t: TranslateFunction,
): OptionItem[] {
  return [
    { value: "gentle", label: "Gentle" },
    { value: "standard", label: "Standard" },
    { value: "turbulent", label: "Turbulent" },
  ];
}

/** 键盘范围选项 */
export function createKeyRangeOptions(
  _t: TranslateFunction,
): OptionItem[] {
  return [
    { value: "88", label: "88" },
    { value: "61", label: "61" },
    { value: "49", label: "49" },
    { value: "custom", label: "Custom" },
  ];
}

/** 按键标签显示模式选项 */
export function createKeyLabelOptions(
  _t: TranslateFunction,
): OptionItem[] {
  return [
    { value: "none", label: "None" },
    { value: "note", label: "Note" },
    { value: "pitchClass", label: "Pitch Class" },
    { value: "octave", label: "Octave" },
  ];
}

/** Aura 样式选项 */
export function createAuraStyleOptions(
  t: TranslateFunction,
): OptionItem[] {
  return [
    { value: "none", label: t("WaterfallPiano.auraStyleNone") },
    { value: "glow", label: t("WaterfallPiano.auraStyleGlow") },
    { value: "rainbow", label: t("WaterfallPiano.auraStyleRainbow") },
    { value: "dual", label: t("WaterfallPiano.auraStyleDual") },
    { value: "custom", label: t("WaterfallPiano.auraStyleCustom") },
  ];
}

/** Aura 应用场景选项 */
export function createAuraTargetOptions(
  t: TranslateFunction,
): OptionItem[] {
  return [
    { value: "triggered", label: t("WaterfallPiano.auraTargetTriggered") },
    { value: "all", label: t("WaterfallPiano.auraTargetAll") },
    { value: "off", label: t("WaterfallPiano.auraTargetOff") },
  ];
}
