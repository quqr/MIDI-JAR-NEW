import type { IconName } from "@/components/Icon/types";

export type { IconName };

export interface NavItem {
  icon: IconName;
  to: string;
  labelKey: string;
}

export type SettingsGroup = "general" | "display" | "advanced";

export interface GroupedNavItem extends NavItem {
  group: SettingsGroup;
}

export const groupLabels: Record<SettingsGroup, string> = {
  general: "settings.groups.general",
  display: "settings.groups.display",
  advanced: "settings.groups.advanced",
};

export const navItems: GroupedNavItem[] = [
  {
    icon: "window",
    to: "/settings/general",
    labelKey: "settings.general",
    group: "general",
  },
  {
    icon: "routing",
    to: "/settings/routing",
    labelKey: "settings.routing",
    group: "general",
  },
  {
    icon: "plugin",
    to: "/settings/vst",
    labelKey: "settings.vst",
    group: "general",
  },
  {
    icon: "cursor",
    to: "/settings/cursor",
    labelKey: "settings.cursor",
    group: "display",
  },
  {
    icon: "music",
    to: "/settings/notation",
    labelKey: "settings.musicNotation",
    group: "display",
  },
  {
    icon: "dictionary",
    to: "/settings/chord-dictionary",
    labelKey: "settings.chordDictionary",
    group: "display",
  },
  {
    icon: "piano",
    to: "/settings/chords",
    labelKey: "settings.chordDisplay",
    group: "display",
  },
  {
    icon: "piano",
    to: "/settings/waterfall-piano",
    labelKey: "settings.WaterfallPiano",
    group: "display",
  },
  {
    icon: "piano",
    to: "/settings/piano",
    labelKey: "settings.piano",
    group: "display",
  },
  {
    icon: "bug",
    to: "/settings/debug",
    labelKey: "settings.debugger",
    group: "advanced",
  },
  {
    icon: "cog",
    to: "/settings/advanced-debug",
    labelKey: "settings.advancedDebug",
    group: "advanced",
  },
];

export const groupOrder: SettingsGroup[] = ["general", "display", "advanced"];
