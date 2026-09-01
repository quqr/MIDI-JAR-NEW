import type { SettingsGroupSchema } from "@/components/Settings/schema";

export const cursorGroups: readonly SettingsGroupSchema[] = [
  {
    titleKey: "settings.cursorSettings.general",
    icon: "cursor",
    fields: [{ key: "enabled", control: "toggle" }],
  },
  {
    titleKey: "settings.cursorSettings.hoverSettings",
    icon: "visible",
    fields: [
      {
        key: "hoverMode",
        control: "select",
        optionsKey: "settings.cursorSettings.hoverModeOptions",
      },
    ],
  },
  {
    titleKey: "settings.cursorSettings.sizeSettings",
    icon: "maximize",
    fields: [
      { key: "innerSize", control: "range", min: 4, max: 32, step: 2 },
      { key: "outerSize", control: "range", min: 20, max: 80, step: 2 },
    ],
  },
  {
    titleKey: "settings.cursorSettings.colorSettings",
    icon: "palette",
    fields: [
      {
        key: "innerColorSource",
        control: "select",
        optionsKey: "settings.cursorSettings.colorSourceOptions",
      },
      { key: "innerColor", control: "themeAwareColor" },
      {
        key: "outerColorSource",
        control: "select",
        optionsKey: "settings.cursorSettings.colorSourceOptions",
      },
      { key: "outerColor", control: "themeAwareColor" },
      {
        key: "hoverRingColorSource",
        control: "select",
        optionsKey: "settings.cursorSettings.colorSourceOptions",
      },
      { key: "hoverRingColor", control: "themeAwareColor" },
    ],
  },
  {
    titleKey: "settings.cursorSettings.animationSettings",
    icon: "sparkles",
    fields: [
      { key: "followDuration", control: "range", min: 0, max: 500, step: 10 },
      { key: "hoverDuration", control: "range", min: 0, max: 800, step: 10 },
      {
        key: "pulseScale",
        control: "range",
        min: 0.2,
        max: 1,
        step: 0.05,
      },
    ],
  },
  {
    titleKey: "settings.cursorSettings.advancedSettings",
    icon: "cog",
    fields: [
      {
        key: "blendMode",
        control: "select",
        optionsKey: "settings.cursorSettings.blendModeOptions",
      },
    ],
  },
];
