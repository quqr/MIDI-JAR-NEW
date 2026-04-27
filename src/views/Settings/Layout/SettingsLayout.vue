<template>
  <div class="drawer md:drawer-open">
    <input id="settings-drawer" type="checkbox" class="drawer-toggle" />
    <div class="drawer-content">
      <h1 class="sr-only">{{ $t("settings.title") }}</h1>
      <div
        class="md:hidden flex items-center gap-2 p-4 border-b border-base-200"
      >
        <label
          for="settings-drawer"
          class="btn btn-ghost btn-sm btn-square md:hidden"
        >
          <Icon name="menu" size="20" />
        </label>
        <span class="font-semibold">{{ $t("settings.title") }}</span>
      </div>
      <div class="p-6 max-w-7xl mx-auto">
        <RouterView />
      </div>
    </div>
    <div
      class="drawer-side z-40"
      style="scroll-behavior: smooth; scroll-padding-top: 5rem"
    >
      <label
        for="drawer"
        class="drawer-overlay"
        aria-label="Close menu"
      ></label>
      <div class="bg-base-100 min-h-screen w-56">
        <ul
          class="menu w-full px-4 py-0"
          :aria-label="t('settings.navigation')"
        >
          <li v-for="item in navItems" :key="item.to">
            <RouterLink
              :to="item.to"
              class="rounded-lg text-sm font-medium truncate"
              :class="
                isActive(item.to)
                  ? 'active bg-primary text-primary-content font-bold'
                  : 'text-base-content/80'
              "
            >
              {{ t(item.labelKey) }}
            </RouterLink>
          </li>
        </ul>
        <div class="divider my-0"></div>
        <div class="p-3 text-center text-sm text-base-content/80">
          <span>v{{ APP_VERSION }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import Icon from "@/components/Icon/Icon.vue";
import { navItems } from "./constants";
import { useI18n } from "vue-i18n";
import { useRoute, RouterLink } from "vue-router";

const route = useRoute();
const { t } = useI18n();
const APP_VERSION = import.meta.env.VITE_APP_VERSION || "0.0.0";

function isActive(to: string): boolean {
  if (to === "/settings/general")
    return route.path === "/settings/general" || route.path === "/settings";
  if (to === "/settings/chords")
    return (
      route.path.startsWith("/settings/chords") &&
      route.path !== "/settings/chords"
    );
  return route.path.startsWith(to);
}
</script>
