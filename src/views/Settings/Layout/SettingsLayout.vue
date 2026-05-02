<template>
  <div class="drawer max-h-full lg:drawer-open">
    <input id="settings-drawer" type="checkbox" class="drawer-toggle" />
    <div class="drawer-content max-h-full flex flex-col">
      <div class="navbar bg-base-300 w-full">
        <label
          for="settings-drawer"
          aria-label="open sidebar"
          class="btn btn-square btn-ghost"
        >
          <Icon name="menu" size="20" />
        </label>
        <div class="px-4 font-semibold">{{ $t("settings.title") }}</div>
      </div>
      <div class="max-h-full overflow-y-auto flex-1">
        <RouterView />
      </div>
    </div>
    <div class="drawer-side max-h-full is-drawer-close:overflow-visible">
      <label
        for="settings-drawer"
        class="drawer-overlay"
        aria-label="Close menu"
      ></label>
      <div
        class="flex min-h-full flex-col bg-base-100 is-drawer-close:w-20 is-drawer-open:w-50"
      >
        <ul
          class="menu w-full grow px-4 py-4"
          :aria-label="t('settings.navigation')"
        >
          <li v-for="item in navItems" :key="item.to">
            <RouterLink
              :to="item.to"
              class="rounded-lg text-sm font-medium is-drawer-close:tooltip is-drawer-close:tooltip-right"
              :class="
                isActive(item.to)
                  ? 'active bg-primary text-primary-content font-bold'
                  : 'text-base-content/70'
              "
              :data-tip="isActive(item.to) ? '' : t(item.labelKey)"
            >
              <Icon :name="item.icon" size="20" />
              <span class="is-drawer-close:hidden">{{ t(item.labelKey) }}</span>
            </RouterLink>
          </li>
        </ul>
        <div class="divider my-0 is-drawer-close:hidden"></div>
        <div
          class="p-3 text-center text-sm text-base-content/70 is-drawer-close:hidden"
        >
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
