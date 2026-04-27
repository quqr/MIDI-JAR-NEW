import type { RouteConfig } from "@/types";

export const settingsRoutes: RouteConfig[] = [
  {
    path: "/settings",
    name: "settings",
    component: () => import("../Layout/SettingsLayout.vue"),
  },
  {
    path: "/settings/general",
    name: "settings-general",
    component: () => import("../GeneralSettings/GeneralSettings.vue"),
  },
  {
    path: "/settings/routing",
    name: "settings-routing",
    component: () => import("../Routing/Routing.vue"),
  },
  {
    path: "/settings/notation",
    name: "settings-notation",
    component: () => import("../NotationSettings/NotationSettings.vue"),
  },
  {
    path: "/settings/chord-dictionary",
    name: "settings-chord-dictionary",
    component: () =>
      import("../ChordDictionarySettings/ChordDictionarySettings.vue"),
  },
  {
    path: "/settings/chords",
    name: "settings-chords",
    component: () => import("../ChordDisplaySettings/ChordDisplaySettings.vue"),
  },
  {
    path: "/settings/chords/:moduleId",
    name: "settings-chords-module",
    component: () =>
      import("../ChordDisplaySettings/ChordDisplayModuleSettings.vue"),
  },
  {
    path: "/settings/circle-of-fifths",
    name: "settings-circle-of-fifths",
    component: () =>
      import("../CircleOfFifthsSettings/CircleOfFifthsSettings.vue"),
  },
  {
    path: "/settings/quiz",
    name: "settings-quiz",
    component: () => import("../ChordQuizSettings/ChordQuizSettings.vue"),
  },
  {
    path: "/settings/debug",
    name: "settings-debug",
    component: () => import("../Debugger/Debugger.vue"),
  },
  {
    path: "/settings/licenses",
    name: "settings-licenses",
    component: () => import("../Licenses/Licenses.vue"),
  },
  {
    path: "/settings/about",
    name: "settings-about",
    component: () => import("../About/About.vue"),
  },
];

export { default as SettingsLayout } from "./Layout/SettingsLayout.vue";
export { default as GeneralSettings } from "./GeneralSettings/GeneralSettings.vue";
export { default as Routing } from "./Routing/Routing.vue";
export { default as NotationSettings } from "./NotationSettings/NotationSettings.vue";
export { default as ChordDictionarySettings } from "./ChordDictionarySettings/ChordDictionarySettings.vue";
export { default as ChordDisplaySettings } from "./ChordDisplaySettings/ChordDisplaySettings.vue";
export { default as ChordDisplayModuleSettings } from "./ChordDisplaySettings/ChordDisplayModuleSettings.vue";
export { default as CircleOfFifthsSettings } from "./CircleOfFifthsSettings/CircleOfFifthsSettings.vue";
export { default as ChordQuizSettings } from "./ChordQuizSettings/ChordQuizSettings.vue";
export { default as Debugger } from "./Debugger/Debugger.vue";
export { default as Licenses } from "./Licenses/Licenses.vue";
export { default as About } from "./About/About.vue";
