<template>
  <div class="drawer lg:drawer-open h-full">
    <input
      id="settings-drawer"
      v-model="drawerOpen"
      type="checkbox"
      class="drawer-toggle"
    />
    <div class="drawer-content flex flex-col min-h-0">
      <div class="navbar bg-base-300 w-full flex-none glass">
        <label
          for="settings-drawer"
          :aria-label="t('common.openSidebar')"
          class="btn btn-square btn-ghost lg:hidden"
        >
          <Icon name="menu" :size="20" aria-hidden="true" />
        </label>
        <div class="px-4 font-semibold">{{ $t("settings.title") }}</div>
        <div class="flex-1"></div>
        <button
          class="btn btn-sm btn-ghost gap-1 text-base-content/70 hover:text-error"
          :aria-label="t('settings.resetCurrent')"
          @click="handleResetCurrent"
        >
          <Icon name="reset" :size="16" aria-hidden="true" />
          <span class="hidden sm:inline">{{ t("settings.resetCurrent") }}</span>
        </button>
        <button
          class="btn btn-sm btn-ghost gap-1 text-base-content/70 hover:text-error"
          :aria-label="t('settings.resetAll')"
          @click="handleResetAll"
        >
          <Icon name="trash" :size="16" aria-hidden="true" />
          <span class="hidden sm:inline">{{ t("settings.resetAll") }}</span>
        </button>
      </div>
      <div class="flex-1 min-h-0">
        <RouterView />
      </div>
    </div>
    <div class="drawer-side is-drawer-close:overflow-visible">
      <label
        for="settings-drawer"
        class="drawer-overlay"
        :aria-label="t('common.closeMenu')"
      ></label>
      <div
        class="flex min-h-full flex-col bg-base-200 is-drawer-close:w-14 is-drawer-open:w-64"
      >
        <!-- 搜索框 -->
        <div class="p-3 is-drawer-close:hidden">
          <div class="relative">
            <Icon
              name="search"
              :size="16"
              class="absolute left-3 top-1/2 -translate-y-1/2 text-base-content/40"
              aria-hidden="true"
            />
            <input
              v-model="searchQuery"
              type="text"
              class="input input-sm input-bordered w-full pl-9 bg-base-100/50"
              :placeholder="t('settings.searchPlaceholder')"
              :aria-label="t('settings.searchPlaceholder')"
            />
            <button
              v-if="searchQuery"
              class="absolute right-2 top-1/2 -translate-y-1/2 btn btn-ghost btn-xs btn-circle"
              :aria-label="t('common.clear')"
              @click="searchQuery = ''"
            >
              <Icon name="x" :size="14" aria-hidden="true" />
            </button>
          </div>
        </div>

        <!-- 折叠模式下的搜索图标 -->
        <div class="px-3 pb-2 is-drawer-open:hidden hidden lg:block">
          <button
            class="btn btn-square btn-ghost btn-sm w-full"
            :aria-label="t('settings.searchPlaceholder')"
            @click="openSearch"
          >
            <Icon name="search" :size="18" aria-hidden="true" />
          </button>
        </div>

        <!-- 分组导航 -->
        <ul
          class="menu w-full grow gap-1 pt-2 overflow-y-auto"
          :aria-label="t('settings.navigation')"
        >
          <template v-for="group in groupOrder" :key="group">
            <li
              v-if="getFilteredItems(group).length > 0"
              class="menu-title is-drawer-close:hidden text-[10px] font-semibold uppercase tracking-wider text-base-content/40 px-4 pt-3 pb-1"
            >
              {{ t(groupLabels[group]) }}
            </li>
            <li
              v-for="item in getFilteredItems(group)"
              :key="item.to"
            >
              <RouterLink
                :to="item.to"
                class="rounded-lg text-sm font-medium is-drawer-close:tooltip is-drawer-close:tooltip-right"
                :class="
                  isActive(item.to)
                    ? 'active bg-primary text-primary-content font-bold'
                    : 'text-base-content/70 hover:bg-base-300/50'
                "
                :data-tip="isActive(item.to) ? '' : t(item.labelKey)"
              >
                <Icon :name="item.icon" :size="20" aria-hidden="true" />
                <span class="is-drawer-close:hidden">{{ t(item.labelKey) }}</span>
              </RouterLink>
            </li>
          </template>

          <!-- 无搜索结果 -->
          <li v-if="searchQuery && filteredItems.length === 0" class="px-4 py-4 text-center text-xs text-base-content/40 is-drawer-close:hidden">
            {{ t("settings.noSearchResults") }}
          </li>
        </ul>
      </div>
    </div>

    <dialog ref="resetDialog" class="modal">
      <div class="modal-box">
        <h3 class="font-bold text-lg">{{ t("settings.resetConfirmTitle") }}</h3>
        <p class="py-4">{{ resetConfirmMessage }}</p>
        <div class="modal-action">
          <button class="btn btn-sm" @click="closeDialog">
            {{ t("common.cancel") }}
          </button>
          <button class="btn btn-sm btn-error" @click="confirmReset">
            {{ t("settings.resetConfirm") }}
          </button>
        </div>
      </div>
      <form method="dialog" class="modal-backdrop">
        <button>close</button>
      </form>
    </dialog>
  </div>
</template>

<script setup lang="ts">
import Icon from "@/components/Icon/Icon.vue";
import { navItems, groupOrder, groupLabels } from "./constants";
import type { SettingsGroup } from "./constants";
import { useI18n } from "vue-i18n";
import { useRoute, RouterLink } from "vue-router";
import { useSettingsStore } from "@/stores/settings";
import { ref, computed, onMounted, onUnmounted } from "vue";

const route = useRoute();
const { t } = useI18n();
const settingsStore = useSettingsStore();

const drawerOpen = ref(false);
const resetDialog = ref<HTMLDialogElement>();
const resetTarget = ref<"current" | "all">("current");
const searchQuery = ref("");

let mql: MediaQueryList | null = null;

const routeToSettingKey: Record<string, string> = {
  "/settings/general": "general",
  "/settings/cursor": "cursor",
  "/settings/notation": "notation",
  "/settings/chord-dictionary": "chordDictionary",
  "/settings/waterfall-piano": "waterfallPiano",
};

const currentSettingKey = computed(() => {
  const path = route.path;
  if (path.startsWith("/settings/chords/")) return "chordDisplay";
  for (const [routePath, key] of Object.entries(routeToSettingKey)) {
    if (path === routePath || path.startsWith(routePath + "/")) return key;
  }
  return "";
});

const currentSectionLabel = computed(() => {
  const key = currentSettingKey.value;
  if (!key) return "";
  const labelMap: Record<string, string> = {
    general: t("settings.general"),
    cursor: t("settings.cursor"),
    notation: t("settings.musicNotation"),
    chordDictionary: t("settings.chordDictionary"),
    chordDisplay: t("settings.chordDisplay"),
    waterfallPiano: t("settings.waterfallPiano"),
  };
  return labelMap[key] || key;
});

// 过滤搜索结果
const filteredItems = computed(() => {
  if (!searchQuery.value.trim()) return navItems;
  const q = searchQuery.value.toLowerCase();
  return navItems.filter((item) => {
    const label = t(item.labelKey).toLowerCase();
    return label.includes(q);
  });
});

function getFilteredItems(group: SettingsGroup) {
  return filteredItems.value.filter((item) => item.group === group);
}

function openSearch() {
  // 触发 drawer 展开
  drawerOpen.value = true;
  // 聚焦搜索框
  setTimeout(() => {
    document
      .querySelector<HTMLInputElement>('input[aria-label="' + t("settings.searchPlaceholder") + '"]')
      ?.focus();
  }, 100);
}

const resetConfirmMessage = computed(() => {
  if (resetTarget.value === "all") {
    return t("settings.resetAllConfirmMessage");
  }
  return t("settings.resetCurrentConfirmMessage", {
    section: currentSectionLabel.value,
  });
});

function handleResetCurrent() {
  if (!currentSettingKey.value) return;
  resetTarget.value = "current";
  resetDialog.value?.showModal();
}

function handleResetAll() {
  resetTarget.value = "all";
  resetDialog.value?.showModal();
}

function closeDialog() {
  resetDialog.value?.close();
}

function confirmReset() {
  if (resetTarget.value === "all") {
    settingsStore.resetSettings();
  } else if (currentSettingKey.value) {
    settingsStore.resetSetting(currentSettingKey.value as any);
  }
  closeDialog();
}

const handleMediaChange = (e: MediaQueryListEvent | MediaQueryList) => {
  if (e.matches) {
    drawerOpen.value = true;
  }
};

onMounted(() => {
  mql = window.matchMedia("(min-width: 1024px)");
  handleMediaChange(mql);
  mql.addEventListener("change", handleMediaChange);
});

onUnmounted(() => {
  mql?.removeEventListener("change", handleMediaChange);
});

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
