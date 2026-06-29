import { createRouter, createWebHistory, RouteRecordRaw } from "vue-router";
import AppLayout from "@/views/Layout/AppLayout.vue";
import SettingsLayout from "@/views/Settings/Layout/SettingsLayout.vue";
import i18n from "@/locales/i18n";

const routes: RouteRecordRaw[] = [
  {
    path: "/",
    component: AppLayout,
    redirect: "/home",
    children: [
      {
        path: "home",
        name: "home",
        component: () => import("@/views/Home.vue"),
        meta: { title: "nav.chordDisplay", icon: "home" },
      },
      {
        path: "chords/:moduleId",
        name: "chord-display",
        component: () => import("@/views/ChordDisplay/ChordDisplay.vue"),
        meta: { title: "nav.chordDisplayWithId", icon: "piano" },
        props: true,
      },
      {
        path: "waterfall-piano",
        name: "waterfall-piano",
        component: () => import("@/views/WaterfallPiano/WaterfallPiano.vue"),
        meta: { title: "nav.waterfallPiano", icon: "piano" },
      },
      {
        path: "chord-dictionary",
        name: "chord-dictionary",
        component: () => import("@/views/ChordDictionary/ChordDictionary.vue"),
        redirect: { name: "chord-dictionary-index" },
        meta: { title: "nav.chordDictionary", icon: "dictionary" },
        children: [
          {
            path: "",
            name: "chord-dictionary-index",
            component: () =>
              import("@/views/ChordDictionary/Detail/ChordOverview.vue"),
          },
          {
            path: ":chordName",
            name: "chord-dictionary-detail",
            component: () =>
              import("@/views/ChordDictionary/Detail/ChordDetail.vue"),
          },
        ],
      },
      {
        path: "settings",
        component: SettingsLayout,
        meta: { title: "settings.title", icon: "settings" },
        redirect: { name: "settings-general" },
        children: [
          {
            path: "general",
            name: "settings-general",
            component: () =>
              import("@/views/Settings/GeneralSettings/GeneralSettings.vue"),
            meta: { title: "settings.general" },
          },
          {
            path: "cursor",
            name: "settings-cursor",
            component: () =>
              import("@/views/Settings/CursorSettings/CursorSettings.vue"),
            meta: { title: "settings.cursor" },
          },
          {
            path: "routing",
            name: "settings-routing",
            component: () => import("@/views/Settings/Routing/Routing.vue"),
            meta: { title: "settings.routing" },
          },
          {
            path: "notation",
            name: "settings-notation",
            component: () =>
              import("@/views/Settings/NotationSettings/NotationSettings.vue"),
            meta: { title: "settings.musicNotation" },
          },
          {
            path: "chord-dictionary",
            name: "settings-chord-dictionary",
            component: () =>
              import("@/views/Settings/ChordDictionarySettings/ChordDictionarySettings.vue"),
            meta: { title: "settings.chordDictionary" },
          },
          {
            path: "chords",
            name: "settings-chords",
            component: () =>
              import("@/views/Settings/ChordDisplaySettings/ChordDisplaySettings.vue"),
            meta: { title: "settings.chordDisplay" },
            redirect: { name: "settings-chords-index" },
            children: [
              {
                path: "",
                name: "settings-chords-index",
                component: () =>
                  import("@/views/Settings/ChordDisplaySettings/ChordDisplayList.vue"),
              },
              {
                path: ":moduleId",
                name: "settings-chords-module",
                component: () =>
                  import("@/views/Settings/ChordDisplaySettings/ChordDisplayModuleSettings.vue"),
              },
            ],
          },
          {
            path: "debug",
            name: "settings-debug",
            component: () => import("@/views/Settings/Debugger/Debugger.vue"),
            meta: { title: "settings.debugger" },
          },
          {
            path: "licenses",
            name: "settings-licenses",
            component: () => import("@/views/Settings/Licenses/Licenses.vue"),
            meta: { title: "settings.licenses.title" },
          },
          {
            path: "about",
            name: "settings-about",
            component: () => import("@/views/Settings/About/About.vue"),
            meta: { title: "settings.about" },
          },
        ],
      },
    ],
  },
  {
    path: "/:pathMatch(.*)*",
    redirect: "/",
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

router.beforeEach((to) => {
  const titleKey = to.meta?.title;
  if (titleKey && typeof titleKey === "string") {
    const translated = i18n.global.t(titleKey, {
      moduleId: to.params.moduleId as string,
    });
    document.title = translated;
  }
});

export default router;
