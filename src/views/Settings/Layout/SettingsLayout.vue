<template>
  <div class="drawer lg:drawer-open h-full">
    <input
      id="settings-drawer"
      v-model="drawerOpen"
      type="checkbox"
      class="drawer-toggle"
    />
    <div class="drawer-content flex flex-col min-h-0">
      <div class="navbar bg-base-300 w-full flex-none">
        <label
          for="settings-drawer"
          :aria-label="t('common.openSidebar')"
          class="btn btn-square btn-ghost lg:hidden"
        >
          <Icon name="menu" size="20" />
        </label>
        <div class="px-4 font-semibold">{{ $t("settings.title") }}</div>
        <div class="flex-1"></div>
        <button
          class="btn btn-sm btn-ghost gap-1 text-base-content/70 hover:text-error"
          @click="handleResetCurrent"
        >
          <Icon name="reset" size="16" />
          <span class="hidden sm:inline">{{ t("settings.resetCurrent") }}</span>
        </button>
        <button
          class="btn btn-sm btn-ghost gap-1 text-base-content/70 hover:text-error"
          @click="handleResetAll"
        >
          <Icon name="trash" size="16" />
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
        <ul
          class="menu w-full grow gap-4 pt-4"
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
import { navItems } from "./constants";
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

let mql: MediaQueryList | null = null;

const routeToSettingKey: Record<string, string> = {
  "/settings/general": "general",
  "/settings/cursor": "cursor",
  "/settings/notation": "notation",
  "/settings/chord-dictionary": "chordDictionary",
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
  };
  return labelMap[key] || key;
});

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
