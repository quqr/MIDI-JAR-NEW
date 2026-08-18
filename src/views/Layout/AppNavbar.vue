<template>
  <div
    class="flex items-center h-10 min-h-10 px-2 gap-1 bg-base-200/70 backdrop-blur-xl border-b border-base-content/10 select-none"
    :class="{ 'ps-0': isMac }"
  >
    <div
      v-if="isMac"
      style="-webkit-app-region: drag"
      class="w-[78px] shrink-0"
    ></div>

    <div
      class="min-w-0 flex items-center overflow-hidden"
      style="-webkit-app-region: no-drag"
    >
      <AppBreadcrumb />
    </div>

    <div
      v-if="inTauri"
      class="flex-1 min-w-10 self-stretch"
      style="-webkit-app-region: drag"
      @dblclick="handleDragAreaDblClick"
    ></div>

    <QuickChangeKeyToolbar />

    <!-- 延迟状态圆点（常驻） -->
    <div
      class="flex items-center justify-center w-6 h-6 shrink-0"
      style="-webkit-app-region: no-drag"
      :title="latencyTooltip"
      role="status"
      :aria-label="latencyAriaLabel"
    >
      <StateDot :status="latencyStatus" :aria-label="latencyAriaLabel" />
    </div>

    <div
      class="flex items-center gap-0.5 shrink-0"
      style="-webkit-app-region: no-drag"
    >
      <RouterLink
        to="/settings"
        class="btn btn-ghost btn-square btn-sm"
        style="-webkit-app-region: no-drag"
        :title="$t('settings.title')"
        :aria-label="$t('settings.title')"
      >
        <Icon name="settings" :size="20" aria-hidden="true" />
      </RouterLink>

      <ThemeSwitcher />

      <div
        v-if="!isMac && inTauri"
        class="flex items-center ml-1"
        style="-webkit-app-region: no-drag"
      >
        <button
          class="btn btn-ghost btn-square btn-sm"
          style="-webkit-app-region: no-drag"
          @click="handleMinimize"
          :title="$t('layout.minimize')"
        >
          <svg width="12" height="12" viewBox="0 0 12 12">
            <line
              x1="1"
              y1="6"
              x2="11"
              y2="6"
              stroke="currentColor"
              stroke-width="1"
              stroke-linecap="round"
            />
          </svg>
        </button>
        <button
          class="btn btn-ghost btn-square btn-sm"
          style="-webkit-app-region: no-drag"
          @click="handleMaximize"
          :title="isMaximized ? $t('layout.unmaximize') : $t('layout.maximize')"
        >
          <svg v-if="!isMaximized" width="12" height="12" viewBox="0 0 12 12">
            <rect
              x="1.5"
              y="1.5"
              width="9"
              height="9"
              fill="none"
              stroke="currentColor"
              stroke-width="1"
            />
          </svg>
          <svg v-else width="12" height="12" viewBox="0 0 12 12">
            <rect
              x="3.5"
              y="3.5"
              width="7"
              height="7"
              fill="none"
              stroke="currentColor"
              stroke-width="1"
            />
            <path
              d="M1.5 4.5V1.5h3"
              fill="none"
              stroke="currentColor"
              stroke-width="1"
            />
            <path
              d="M1.5 11.5V8.5"
              fill="none"
              stroke="currentColor"
              stroke-width="1"
            />
            <path
              d="M8.5 1.5h1.5v1.5"
              fill="none"
              stroke="currentColor"
              stroke-width="1"
            />
          </svg>
        </button>
        <button
          class="btn btn-ghost btn-square btn-sm hover:bg-error hover:text-error-content"
          style="-webkit-app-region: no-drag"
          @click="handleClose"
          :title="$t('common.close')"
        >
          <svg width="12" height="12" viewBox="0 0 12 12">
            <line
              x1="2"
              y1="2"
              x2="10"
              y2="10"
              stroke="currentColor"
              stroke-width="1"
              stroke-linecap="round"
            />
            <line
              x1="10"
              y1="2"
              x2="2"
              y2="10"
              stroke="currentColor"
              stroke-width="1"
              stroke-linecap="round"
            />
          </svg>
        </button>
      </div>
    </div>
  </div>

  <div
    v-if="mobileMenuOpen"
    class="md:hidden shadow-md"
    style="-webkit-app-region: no-drag"
  >
    <ul class="menu menu-vertical p-3 gap-2">
      <li v-for="item in navItems" :key="item.path">
        <RouterLink
          :to="item.path"
          :class="[
            isActive(item.path)
              ? 'btn btn-primary'
              : 'btn btn-ghost hover:bg-base-200',
          ]"
          @click="mobileMenuOpen = false"
        >
          <component :is="Icon" :name="item.icon" :size="16" />
          <span>{{ $t(item.label) }}</span>
        </RouterLink>
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from "vue";
import { useI18n } from "vue-i18n";
import type { IconName } from "@/components/Icon/types";
import { useRoute, RouterLink } from "vue-router";
import AppBreadcrumb from "./AppBreadcrumb.vue";
import ThemeSwitcher from "@/components/ThemeSwitcher.vue";
import Icon from "@/components/Icon/Icon.vue";
import StateDot from "@/components/common/StateDot.vue";
import { createLogger } from "@/utils/logger";
import QuickChangeKeyToolbar from "./QuickChangeKeyToolbar.vue";
import { useMidiLatency } from "@/composables/useMidiLatency";
import { isTauri } from "@/utils/tauri";

const logger = createLogger("AppNavbar");
const inTauri = isTauri();

const { t } = useI18n();
const route = useRoute();

const mobileMenuOpen = ref(false);
const isMaximized = ref(false);
const isMac = ref(false);

// 延迟监控
const { currentLatency } = useMidiLatency();

// 延迟状态分类：<10ms 绿，10-30ms 黄，>30ms 红
const latencyStatus = computed<"success" | "warning" | "error">(() => {
  if (currentLatency.value < 10) return "success";
  if (currentLatency.value < 30) return "warning";
  return "error";
});

const latencyTooltip = computed(() =>
  t("layout.latencyTooltip", { ms: currentLatency.value.toFixed(2) }),
);

const latencyAriaLabel = computed(() =>
  t("layout.latencyAriaLabel", { ms: currentLatency.value.toFixed(2) }),
);

const navItems: { path: string; label: string; icon: IconName }[] = [
  { path: "/home", label: "nav.home", icon: "home" },
  { path: "/chord-dictionary", label: "nav.chordDictionary", icon: "book" },
];

const isActive = (path: string) => {
  if (path === "/home") {
    return route.path === "/home" || route.path === "/";
  }
  return route.path.startsWith(path);
};

const handleMinimize = async () => {
  try {
    await window.tauriAPI?.window.minimize();
  } catch (e) {
    logger.error("[AppNavbar] minimize failed: " + e);
  }
};

const handleMaximize = async () => {
  try {
    await window.tauriAPI?.window.maximize();
  } catch (e) {
    logger.error("[AppNavbar] maximize failed: " + e);
  }
};

const handleClose = async () => {
  try {
    await window.tauriAPI?.window.close();
  } catch (e) {
    logger.error("[AppNavbar] close failed: " + e);
  }
};

const handleDragAreaDblClick = async () => {
  try {
    await window.tauriAPI?.window.maximize();
  } catch (e) {
    logger.error("[AppNavbar] drag maximize failed: " + e);
  }
};

onMounted(async () => {
  const api = window.tauriAPI;
  if (!api) return;

  try {
    const p = await api.app.getPlatform();
    isMac.value = p === "darwin";

    const max = await api.window.isMaximized();
    isMaximized.value = max ?? false;

    api.window.onMaximizedChanged((maximized: boolean) => {
      isMaximized.value = maximized;
    });
  } catch (e) {
    logger.error("[AppNavbar] init failed: " + e);
  }
});
</script>
