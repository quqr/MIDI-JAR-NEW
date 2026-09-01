import type {
  SettingsFieldSchema,
  SettingsFieldValue,
  SettingsGroupSchema,
} from "@/components/Settings/schema";
import { getThemeColors, type PianoTheme } from "./config/pianoThemes";

/** 瀑布流设置字段 schema：正式设置页与 AdvancedDebug 共用（差异经字段 key/前缀/debug range 表达） */

type FieldChangeEmit = (
  key: string,
  value: SettingsFieldValue | undefined,
) => void;

const particleGate = (m: Record<string, unknown>) =>
  Boolean((m.hitLine as Record<string, unknown> | undefined)?.visible);
const colorSchemeCustom = (m: Record<string, unknown>) =>
  m.colorScheme === "custom";

export const particlesGroup: SettingsGroupSchema = {
  titleKey: "WaterfallPiano.particles",
  icon: "sparkles",
  fields: [
    {
      key: "colorScheme",
      control: "select",
      optionsKey: "WaterfallPiano.scheme",
    },
    { key: "speed", control: "range", min: 0, max: 5, step: 0.1 },
    { key: "lookAhead", control: "range", min: 0, max: 10, step: 0.5 },
    { key: "opacity", control: "range", min: 0, max: 1, step: 0.05 },
    { key: "cornerRadius", control: "range", min: 0, max: 20, step: 1 },
    {
      key: "hitExplosionRadius",
      control: "range",
      min: 0,
      max: 0.1,
      step: 0.005,
    },
    { key: "hitLine.visible", control: "toggle", labelKey: "hitLine" },
    {
      key: "hitLine.color",
      control: "color",
      labelKey: "hitLine",
      visibleWhen: particleGate,
    },
    {
      key: "hitLine.thickness",
      control: "range",
      labelKey: "hitLine",
      min: 0,
      max: 10,
      step: 1,
      visibleWhen: particleGate,
    },
    {
      key: "customColors.low",
      control: "color",
      labelKey: "low",
      visibleWhen: colorSchemeCustom,
    },
    {
      key: "customColors.mid",
      control: "color",
      labelKey: "mid",
      visibleWhen: colorSchemeCustom,
    },
    {
      key: "customColors.high",
      control: "color",
      labelKey: "high",
      visibleWhen: colorSchemeCustom,
    },
  ],
};

const auraEnabled = (m: Record<string, unknown>) => Boolean(m.enabled);
const auraStyle = (m: Record<string, unknown>) => m.style;
const auraStyleIs =
  (...styles: string[]) =>
  (m: Record<string, unknown>) =>
    auraEnabled(m) && styles.includes(auraStyle(m) as string);

export const auraGroup: SettingsGroupSchema = {
  titleKey: "WaterfallPiano.aura",
  icon: "sparkles",
  fields: [
    { key: "enabled", control: "toggle", labelKey: "auraEnabled" },
    {
      key: "auraGroup.area",
      control: "heading",
      labelKey: "auraGroups.area",
      visibleWhen: auraEnabled,
    },
    {
      key: "padding",
      control: "range",
      min: 0,
      max: 30,
      step: 1,
      visibleWhen: auraEnabled,
    },
    {
      key: "auraGroup.glowLayers",
      control: "heading",
      labelKey: "auraGroups.glowLayers",
      visibleWhen: auraEnabled,
    },
    {
      key: "innerBlur",
      control: "range",
      min: 0,
      max: 100,
      step: 1,
      visibleWhen: auraEnabled,
    },
    {
      key: "innerOpacity",
      control: "range",
      min: 0,
      max: 100,
      step: 1,
      visibleWhen: auraEnabled,
    },
    {
      key: "outerBlur",
      control: "range",
      min: 0,
      max: 100,
      step: 1,
      visibleWhen: auraEnabled,
    },
    {
      key: "outerOpacity",
      control: "range",
      min: 0,
      max: 100,
      step: 1,
      visibleWhen: auraEnabled,
    },
    {
      key: "auraGroup.animation",
      control: "heading",
      labelKey: "auraGroups.animation",
      visibleWhen: auraEnabled,
    },
    {
      key: "duration",
      control: "range",
      min: 0,
      max: 60,
      step: 1,
      visibleWhen: auraEnabled,
    },
    {
      key: "auraGroup.glowSettings",
      control: "heading",
      labelKey: "auraGroups.glowSettings",
      visibleWhen: auraStyleIs("glow"),
    },
    {
      key: "glowPeakOpacity",
      control: "range",
      min: 0,
      max: 100,
      step: 1,
      visibleWhen: auraStyleIs("glow"),
    },
    {
      key: "glowPeakBlur",
      control: "range",
      min: 0,
      max: 100,
      step: 1,
      visibleWhen: auraStyleIs("glow"),
    },
    {
      key: "glowAfterPeakOpacity",
      control: "range",
      min: 0,
      max: 100,
      step: 1,
      visibleWhen: auraStyleIs("glow"),
    },
    {
      key: "glowAfterPeakBlur",
      control: "range",
      min: 0,
      max: 100,
      step: 1,
      visibleWhen: auraStyleIs("glow"),
    },
    {
      key: "auraGroup.colors",
      control: "heading",
      labelKey: "auraGroups.colors",
      visibleWhen: auraStyleIs("custom"),
    },
    {
      key: "primaryColor",
      control: "color",
      fallback: "#6366f1",
      visibleWhen: auraStyleIs("custom"),
    },
  ],
};

const fluidGate = (m: Record<string, unknown>) => Boolean(m.fluidEnabled);
const fluidParamsOf = (m: Record<string, unknown>) =>
  (m.fluidParams as Record<string, unknown> | undefined) ?? {};

export const backgroundGroup: SettingsGroupSchema = {
  titleKey: "WaterfallPiano.background",
  icon: "image",
  fields: [
    { key: "solidColor", control: "color" },
    { key: "fluidEnabled", control: "toggle" },
    {
      key: "fluidParams.simResolution",
      control: "range",
      labelKey: "fluidQuality",
      min: 0,
      max: 256,
      step: 32,
      fallback: 128,
      visibleWhen: fluidGate,
    },
    {
      key: "fluidStyle",
      control: "select",
      optionsKey: "WaterfallPiano.fluidStyleOptions",
      visibleWhen: fluidGate,
    },
    {
      key: "fluidLayerPosition",
      control: "select",
      optionsKey: "WaterfallPiano.fluidLayerPositionOptions",
      visibleWhen: fluidGate,
    },
  ],
};

export const fluidAdvancedGroup: SettingsGroupSchema = {
  titleKey: "WaterfallPiano.fluidAdvancedParams",
  icon: "droplet",
  fields: [
    {
      key: "fluidParams.splatRadius",
      control: "range",
      min: 0,
      max: 0.01,
      step: 0.0001,
      fallback: 0.0001,
    },
    {
      key: "fluidParams.splatColorHue",
      control: "range",
      min: 0,
      max: 1,
      step: 0.05,
      fallback: 0,
    },
    {
      key: "fluidParams.trailLength",
      control: "range",
      min: 0,
      max: 1,
      step: 0.05,
      fallback: 0.2,
    },
    {
      key: "fluidParams.flowPersistence",
      control: "range",
      min: 0,
      max: 1,
      step: 0.05,
      fallback: 0.2,
    },
    { key: "fluidParams.bloom", control: "toggle", fallback: true },
    {
      key: "fluidParams.bloomIntensity",
      control: "range",
      min: 0,
      max: 2,
      step: 0.1,
      fallback: 0.8,
      visibleWhen: (m) => fluidParamsOf(m).bloom !== false,
    },
    { key: "fluidParams.hitExplosion", control: "toggle", fallback: false },
    { key: "fluidParams.blockCoverage", control: "toggle", fallback: false },
    { key: "fluidParams.group", control: "heading", labelKey: "perturbation" },
    ...(
      [
        "fluidSplatPerturbation",
        "hitExplosionPerturbation",
        "blockCoveragePerturbation",
        "sustainedSplatPerturbation",
      ] as const
    ).flatMap((group) =>
      (
        [
          ["positionJitter", "positionJitter"],
          ["forceJitter", "forceJitter"],
          ["colorJitter", "colorJitter"],
        ] as const
      ).map(
        ([sub, labelKey]) =>
          ({
            key: `fluidParams.${group}.${sub}`,
            control: "range",
            labelKey,
            labelPrefixKey: group,
            min: 0,
            max: 1,
            step: 0.05,
            fallback: 0.5,
          }) satisfies SettingsFieldSchema,
      ),
    ),
  ],
};

const bloomGate = (m: Record<string, unknown>) =>
  Boolean(m.advancedBloomEnabled);
const blurGate = (m: Record<string, unknown>) => Boolean(m.backdropBlurEnabled);

export const effectsGroup: SettingsGroupSchema = {
  titleKey: "WaterfallPiano.effects",
  icon: "filter",
  fields: [
    { key: "advancedBloomEnabled", control: "toggle" },
    {
      key: "advancedBloomThreshold",
      control: "range",
      min: 0,
      max: 1,
      step: 0.05,
      visibleWhen: bloomGate,
    },
    {
      key: "advancedBloomBloomScale",
      control: "range",
      min: 0,
      max: 5,
      step: 0.1,
      visibleWhen: bloomGate,
    },
    {
      key: "advancedBloomBlur",
      control: "range",
      min: 0,
      max: 20,
      step: 0.5,
      visibleWhen: bloomGate,
    },
    { key: "effects.divider", control: "heading" },
    { key: "backdropBlurEnabled", control: "toggle" },
    {
      key: "backdropBlurStrength",
      control: "range",
      min: 0,
      max: 20,
      step: 0.5,
      visibleWhen: blurGate,
    },
  ],
};

/** 选主题时一键应用色板；value 为空时清除主题 */
function themeOnChange(
  value: SettingsFieldValue,
  _model: Record<string, unknown>,
  emit: FieldChangeEmit,
): void {
  if (!value) {
    emit("theme", undefined);
    return;
  }
  const colors = getThemeColors(value as PianoTheme);
  if (colors) {
    emit("whiteKeyColor", colors.whiteKeyColor);
    emit("blackKeyColor", colors.blackKeyColor);
    emit("pressedKeyColor", colors.pressedKeyColor);
    emit("keyBorderColor", colors.keyBorderColor);
    emit("separatorColor", colors.separatorColor);
  }
}

/** 单独修改颜色时清除主题，切回自定义模式 */
function clearColorTheme(
  _value: SettingsFieldValue,
  _model: Record<string, unknown>,
  emit: FieldChangeEmit,
): void {
  emit("theme", undefined);
}

export const keyboardGroup: SettingsGroupSchema = {
  titleKey: "WaterfallPiano.keyboard",
  icon: "piano",
  fields: [
    { key: "visible", control: "toggle", labelKey: "keyboard" },
    {
      key: "theme",
      control: "select",
      labelKey: "pianoTheme",
      optionsKey: "WaterfallPiano.themeOptions",
      fallback: "",
      onChange: themeOnChange,
    },
    {
      key: "range",
      control: "select",
      optionsKey: "WaterfallPiano.keyRangeOptions",
    },
    {
      key: "keyLabel",
      control: "select",
      optionsKey: "WaterfallPiano.keyLabelOptions",
    },
    { key: "heightRatio", control: "range", min: 0.1, max: 0.5, step: 0.05 },
    {
      key: "blackKeyHeightRatio",
      control: "range",
      min: 0.3,
      max: 0.8,
      step: 0.02,
    },
    {
      key: "keyCornerRadius",
      control: "range",
      labelKey: "cornerRadius",
      min: 0,
      max: 20,
      step: 1,
    },
    { key: "whiteKeyColor", control: "color", onChange: clearColorTheme },
    { key: "blackKeyColor", control: "color", onChange: clearColorTheme },
    { key: "pressedKeyColor", control: "color", onChange: clearColorTheme },
    { key: "separatorEnabled", control: "toggle", labelKey: "hitLine" },
    { key: "showNoteNames", control: "toggle" },
  ],
};

export const midiFileGroup: SettingsGroupSchema = {
  titleKey: "WaterfallPiano.midiFile",
  fields: [
    { key: "playbackSpeed", control: "range", min: 0.25, max: 2, step: 0.05 },
    { key: "loop", control: "toggle" },
  ],
};

// ===== AdvancedDebug（字段集与正式页不同，i18n 前缀独立） =====

const kbCustomRange = (m: Record<string, unknown>) => m.range === "custom";

export const waterfallKeyboardDebugGroup: SettingsGroupSchema = {
  titleKey: "advancedDebug.waterfall.keyboard.title",
  icon: "keyboard",
  fields: [
    {
      key: "customFrom",
      control: "textInput",
      visibleWhen: kbCustomRange,
    },
    {
      key: "customTo",
      control: "textInput",
      visibleWhen: kbCustomRange,
    },
    { key: "keyBorderWidth", control: "range", min: 0, max: 5, step: 0.5 },
    { key: "keyBorderColor", control: "color" },
    { key: "separatorColor", control: "color" },
    { key: "separatorThickness", control: "range", min: 1, max: 10, step: 1 },
    { key: "defaultVelocity", control: "range", min: 0, max: 127, step: 1 },
  ],
};

export const fluidDebugGroup: SettingsGroupSchema = {
  titleKey: "advancedDebug.waterfall.fluid.title",
  icon: "water",
  fields: [
    {
      key: "simResolution",
      control: "range",
      min: 32,
      max: 256,
      step: 32,
    },
    {
      key: "splatRadius",
      control: "range",
      min: 0.0001,
      max: 0.01,
      step: 0.0005,
    },
    {
      key: "splatColorHue",
      control: "range",
      min: 0,
      max: 1,
      step: 0.05,
    },
    {
      key: "trailLength",
      control: "range",
      min: 0,
      max: 1,
      step: 0.05,
    },
    {
      key: "flowPersistence",
      control: "range",
      min: 0,
      max: 1,
      step: 0.05,
    },
    { key: "bloom", control: "toggle" },
    {
      key: "bloomIntensity",
      control: "range",
      min: 0.1,
      max: 2,
      step: 0.1,
      visibleWhen: (m) => Boolean(m.bloom),
    },
    { key: "hitExplosion", control: "toggle" },
    { key: "blockCoverage", control: "toggle" },
  ],
};

export const waterfallMidiFileDebugGroup: SettingsGroupSchema = {
  titleKey: "advancedDebug.waterfall.midiFile.title",
  icon: "file-music",
  fields: [
    {
      key: "rightHandTrackIdx",
      control: "range",
      min: 0,
      max: 15,
      step: 1,
    },
    {
      key: "leftHandTrackIdx",
      control: "range",
      min: 0,
      max: 15,
      step: 1,
    },
  ],
};
