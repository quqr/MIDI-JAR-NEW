import type {
  SettingsFieldOption,
  SettingsGroupSchema,
} from "@/components/Settings/schema";

/** C0–C8 音符选项（C8 为最后一个键） */
export const noteOptions: SettingsFieldOption[] = (() => {
  const notes = [
    "C",
    "C#",
    "D",
    "D#",
    "E",
    "F",
    "F#",
    "G",
    "G#",
    "A",
    "A#",
    "B",
  ];
  const options: SettingsFieldOption[] = [];
  for (let oct = 0; oct <= 8; oct++) {
    for (const note of notes) {
      const name = `${note}${oct}`;
      options.push({ label: name, value: name });
      if (oct === 8 && note === "C") break;
    }
  }
  return options;
})();

export const pianoRangeGroup: SettingsGroupSchema = {
  titleKey: "settings.pianoSettings.range",
  icon: "piano",
  fields: [
    { key: "from", control: "select", options: noteOptions },
    { key: "to", control: "select", options: noteOptions },
  ],
};

export const pianoLabelsGroup: SettingsGroupSchema = {
  titleKey: "settings.pianoSettings.labels",
  icon: "music",
  fields: [
    {
      key: "label",
      control: "select",
      labelKey: "labelMode",
      optionsKey: "settings.pianoSettings.labelOptions",
    },
    {
      key: "keyName",
      control: "select",
      labelKey: "keyNameMode",
      optionsKey: "settings.pianoSettings.keyNameOptions",
    },
    { key: "showNoteNames", control: "toggle" },
  ],
};

export const pianoColorsGroup: SettingsGroupSchema = {
  titleKey: "settings.pianoSettings.colors",
  icon: "palette",
  fields: [
    { key: "useThemeColors", control: "toggle" },
    {
      key: "whiteKeyColor",
      control: "color",
      visibleWhen: (model) => !model.useThemeColors,
    },
    {
      key: "blackKeyColor",
      control: "color",
      visibleWhen: (model) => !model.useThemeColors,
    },
    {
      key: "pressedKeyColor",
      control: "color",
      visibleWhen: (model) => !model.useThemeColors,
    },
  ],
};

export const pianoAppearanceGroup: SettingsGroupSchema = {
  titleKey: "settings.pianoSettings.appearance",
  icon: "cog",
  fields: [
    { key: "keyCornerRadius", control: "range", min: 0, max: 5, step: 0.1 },
  ],
};

export const pianoGroups: readonly SettingsGroupSchema[] = [
  pianoRangeGroup,
  pianoLabelsGroup,
  pianoColorsGroup,
  pianoAppearanceGroup,
];
