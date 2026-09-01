import type { SettingsGroupSchema } from "@/components/Settings/schema";

/** 浏览选项组（禁用和弦列表与别名列表为动态列表 UI，保留手写） */
export const browseGroup: SettingsGroupSchema = {
  titleKey: "settings.chordDictionarySettings.browse",
  icon: "gamepad",
  fields: [
    {
      key: "interactive",
      control: "radio",
      optionsKey: "settings.chordDictionarySettings.interactiveOptions",
    },
    {
      key: "groupBy",
      control: "radio",
      labelKey: "groupChords",
      optionsKey: "settings.chordDictionarySettings.groupByOptions",
    },
    {
      key: "hideDisabled",
      control: "toggle",
      labelKey: "hideDisabledChords",
    },
    {
      key: "filterInKey",
      control: "toggle",
      labelKey: "filterChordsInKey",
    },
  ],
};

export const preferredNotationGroup: SettingsGroupSchema = {
  titleKey: "settings.chordDictionarySettings.preferredNotation",
  icon: "book",
  fields: [
    {
      key: "defaultNotation",
      control: "select",
      optionsKey: "settings.chordDictionarySettings.defaultNotationOptions",
    },
  ],
};
