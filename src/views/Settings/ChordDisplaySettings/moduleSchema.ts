import type { SettingsGroupSchema } from "@/components/Settings/schema";

/** 字段 key 支持点路径（如 "keyboard.sizes.radius"），由 SettingsFieldGroup 按路径读写 */
export const moduleGroups: readonly SettingsGroupSchema[] = [
  {
    titleKey: "settings.chordDisplaySettings.chords",
    icon: "music-note",
    fields: [
      { key: "displayChord", control: "toggle" },
      { key: "displayAltChords", control: "toggle" },
      { key: "displayName", control: "toggle", labelKey: "displayChordName" },
      {
        key: "chordNotation",
        control: "select",
        optionsKey: "settings.notationOptions",
      },
      { key: "highlightAlterations", control: "toggle" },
      { key: "useSustain", control: "toggle", labelKey: "useSustainPedal" },
      { key: "detectOnRelease", control: "toggle" },
    ],
  },
  {
    titleKey: "settings.chordDisplaySettings.additionalInfo",
    icon: "info",
    fields: [
      { key: "displayNotation", control: "toggle" },
      { key: "displayIntervals", control: "toggle" },
    ],
  },
  {
    titleKey: "settings.chordDisplaySettings.keyboard",
    icon: "keyboard",
    fields: [
      { key: "displayKeyboard", control: "toggle" },
      { key: "keyboard.from", control: "textInput", labelKey: "noteStart" },
      { key: "keyboard.to", control: "textInput", labelKey: "noteEnd" },
      {
        key: "keyboard.keyName",
        control: "select",
        labelKey: "keyNames",
        optionsKey: "settings.chordDisplaySettings.keyNameOptions",
      },
      {
        key: "keyboard.label",
        control: "select",
        labelKey: "playedKeyLabel",
        optionsKey: "settings.chordDisplaySettings.labelOptions",
      },
    ],
  },
  {
    titleKey: "settings.chordDisplaySettings.keyboardSkin",
    icon: "palette",
    fields: [
      {
        key: "keyboard.skin",
        control: "select",
        labelKey: "skin",
        optionsKey: "settings.chordDisplaySettings.skinOptions",
      },
      {
        key: "keyboard.sizes.radius",
        control: "range",
        labelKey: "keyBorderRadius",
        min: 0,
        max: 1,
        step: 0.05,
      },
    ],
  },
  {
    titleKey: "settings.chordDisplaySettings.keyboardColors",
    icon: "palette",
    fields: [
      { key: "keyboard.colors.black", control: "color", labelKey: "blackKeys" },
      { key: "keyboard.colors.white", control: "color", labelKey: "whiteKeys" },
      { key: "keyboard.colors.played", control: "color", labelKey: "playedKeys" },
    ],
  },
];
