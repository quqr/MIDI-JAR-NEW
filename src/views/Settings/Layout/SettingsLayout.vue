<template>
  <!-- 侧栏常驻展开：所有宽度下固定左栏（窄屏收窄为图标列），不再使用抽屉/汉堡 -->
  <div class="flex h-full w-full min-h-0">
    <aside
      class="flex flex-col flex-none w-16 sm:w-64 min-h-0 border-r border-base-content/10 bg-base-200/40"
    >
      <div
        class="flex-none px-3 py-2.5 text-sm font-semibold text-base-content/80 max-sm:hidden"
      >
        {{ $t("settings.title") }}
      </div>
      <!-- 分组导航 -->
      <ul
        class="menu w-full grow gap-1 pt-1 overflow-y-auto overflow-x-clip"
        :aria-label="t('settings.navigation')"
      >
        <template v-for="group in groupOrder" :key="group">
          <li
            v-if="getItemsForGroup(group).length > 0"
            class="menu-title max-sm:hidden text-xs font-semibold uppercase tracking-wider text-base-content/70 px-4 pt-3 pb-1"
          >
            {{ t(groupLabels[group]) }}
          </li>
          <li v-for="item in getItemsForGroup(group)" :key="item.to">
            <RouterLink :to="item.to" custom v-slot="{ href, navigate }">
              <a
                :href="href"
                class="rounded-lg text-sm font-medium max-sm:tooltip max-sm:tooltip-right"
                :class="
                  isActive(item.to)
                    ? 'active bg-primary/10 text-primary font-semibold'
                    : 'text-base-content/70 hover:bg-base-300'
                "
                :data-tip="t(item.labelKey)"
                :aria-current="isActive(item.to) ? 'page' : undefined"
                @click="navigate"
              >
                <Icon :name="item.icon" :size="20" aria-hidden="true" />
                <span class="max-sm:hidden">{{ t(item.labelKey) }}</span>
              </a>
            </RouterLink>
          </li>
        </template>
      </ul>
    </aside>

    <div class="flex flex-col flex-1 min-w-0 min-h-0">
      <div class="navbar w-full flex-none min-h-10">
        <div class="px-4 text-lg font-semibold max-sm:hidden">
          {{ $t("settings.title") }}
        </div>
        <div class="px-3 text-lg font-semibold sm:hidden">
          {{ currentSectionLabel }}
        </div>
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
      <div class="flex-1 min-h-0 overflow-y-auto flex flex-col">
        <RouterView />
      </div>
    </div>

    <dialog
      ref="resetDialog"
      class="modal"
      aria-labelledby="reset-dialog-title"
    >
      <div class="modal-box">
        <h3 id="reset-dialog-title" class="text-lg font-bold">
          {{ t("settings.resetConfirmTitle") }}
        </h3>
        <p class="py-4 text-sm text-base-content/70">
          {{ resetConfirmMessage }}
        </p>
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
        <button :aria-label="t('common.close')"></button>
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
import { useThemeStore } from "@/stores/theme";
import { useWaterfallPianoStore } from "@/views/WaterfallPiano/stores/WaterfallPiano";
import { ref, computed } from "vue";

const route = useRoute();
const { t } = useI18n();
const settingsStore = useSettingsStore();
const themeStore = useThemeStore();
const WaterfallPianoStore = useWaterfallPianoStore();

const resetDialog = ref<HTMLDialogElement>();
const resetTarget = ref<"current" | "all">("current");

const routeToSettingKey: Record<string, string> = {
  "/settings/general": "general",
  "/settings/cursor": "cursor",
  "/settings/notation": "notation",
  "/settings/chord-dictionary": "chordDictionary",
  "/settings/waterfall-piano": "WaterfallPiano",
  "/settings/piano": "piano",
  "/settings/advanced-debug": "advancedDebug",
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
  if (!key) return t("settings.title");
  const labelMap: Record<string, string> = {
    general: t("settings.general"),
    cursor: t("settings.cursor"),
    notation: t("settings.musicNotation"),
    chordDictionary: t("settings.chordDictionary"),
    chordDisplay: t("settings.chordDisplay"),
    WaterfallPiano: t("settings.WaterfallPiano"),
    piano: t("settings.piano"),
    advancedDebug: t("settings.advancedDebug"),
  };
  return labelMap[key] || key;
});

// 按分组获取导航项
function getItemsForGroup(group: SettingsGroup) {
  return navItems.filter((item) => item.group === group);
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
    WaterfallPianoStore.resetSettings();
    themeStore.setTheme("light");
  } else if (
    currentSettingKey.value === "WaterfallPiano" ||
    currentSettingKey.value === "advancedDebug"
  ) {
    WaterfallPianoStore.resetSettings();
  } else if (currentSettingKey.value) {
    settingsStore.resetSetting(currentSettingKey.value as any);
  }
  closeDialog();
}

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
