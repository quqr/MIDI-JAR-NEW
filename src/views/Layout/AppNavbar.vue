<template>
  <div class="app-navbar" :class="{ 'app-navbar--mac': isMac }">
    <div v-if="isMac" class="app-navbar__mac-spacer"></div>

    <!-- Brand -->
    <RouterLink
      to="/home"
      class="app-navbar__brand"
      :aria-label="t('layout.midiJar')"
    >
      <Icon name="music" :size="18" aria-hidden="true" />
      <span class="app-navbar__brand-text">{{ t("layout.midiJar") }}</span>
    </RouterLink>

    <!-- Center nav links (desktop) -->
    <nav
      class="app-navbar__nav-links hidden lg:flex"
      :aria-label="t('nav.midiTools')"
    >
      <RouterLink
        v-for="item in navItems"
        :key="item.path"
        :to="item.path"
        class="nav-link"
        :class="{ 'nav-link--active': isActive(item.path) }"
        :aria-current="isActive(item.path) ? 'page' : undefined"
      >
        {{ t(item.label) }}
      </RouterLink>
    </nav>

    <!-- Mobile menu toggle -->
    <button
      class="app-navbar__action-btn lg:hidden"
      :aria-label="t('common.menu')"
      :aria-expanded="mobileMenuOpen"
      @click="mobileMenuOpen = !mobileMenuOpen"
    >
      <Icon name="menu" :size="18" aria-hidden="true" />
    </button>

    <div v-if="inTauri" class="app-navbar__drag-region">
      <div
        class="app-navbar__drag-area"
        data-tauri-drag-region
        @dblclick="handleDragAreaDblClick"
      ></div>
    </div>
    <QuickChangeKeyToolbar />

    <!-- 延迟状态圆点（常驻） -->
    <div
      class="app-navbar__status"
      :title="latencyTooltip"
      role="status"
      :aria-label="latencyAriaLabel"
    >
      <span class="latency-dot" :class="latencyClass"></span>
    </div>

    <div class="app-navbar__actions">
      <RouterLink
        to="/settings"
        class="app-navbar__action-btn"
        :title="t('settings.title')"
        :aria-label="t('settings.title')"
      >
        <Icon name="settings" :size="20" aria-hidden="true" />
      </RouterLink>

      <ThemeSwitcher />

      <div v-if="!isMac && inTauri" class="app-navbar__window-controls">
        <button
          class="win-ctrl-btn"
          @click="handleMinimize"
          :title="t('layout.minimize')"
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
          class="win-ctrl-btn"
          @click="handleMaximize"
          :title="isMaximized ? t('layout.unmaximize') : t('layout.maximize')"
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
          class="win-ctrl-btn win-ctrl-btn--close"
          @click="handleClose"
          :title="t('common.close')"
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
    class="lg:hidden shadow-md"
    style="-webkit-app-region: no-drag"
  >
    <ul class="menu menu-vertical p-3 gap-2">
      <li v-for="item in navItems" :key="item.path">
        <RouterLink
          :to="item.path"
          class="flex items-center gap-2 transition-all duration-hig-fast"
          :class="[
            isActive(item.path)
              ? 'btn btn-primary'
              : 'btn btn-ghost hover:bg-base-200',
          ]"
          @click="mobileMenuOpen = false"
        >
          <component :is="Icon" :name="item.icon" :size="16" />
          <span>{{ t(item.label) }}</span>
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
import ThemeSwitcher from "@/components/ThemeSwitcher.vue";
import Icon from "@/components/Icon/Icon.vue";
import { createLogger } from "@/utils/logger";
import QuickChangeKeyToolbar from "./QuickChangeKeyToolbar.vue";
import { useMidiLatency } from "@/composables/useMidiLatency";
import { isTauri } from "@/utils/tauri";
import { useSettingsStore } from "@/stores/settings";

const logger = createLogger("AppNavbar");
const inTauri = isTauri();

const { t } = useI18n();
const route = useRoute();
const settingsStore = useSettingsStore();

const mobileMenuOpen = ref(false);
const isMaximized = ref(false);
const isMac = ref(false);

// 延迟监控
const { currentLatency } = useMidiLatency();

// 延迟状态分类：<10ms 绿，10-30ms 黄，>30ms 红
const latencyClass = computed(() => {
  if (currentLatency.value < 10) return "latency-dot--good";
  if (currentLatency.value < 30) return "latency-dot--warn";
  return "latency-dot--bad";
});

const latencyTooltip = computed(() =>
  t("layout.latencyTooltip", { ms: currentLatency.value.toFixed(2) }),
);

const latencyAriaLabel = computed(() =>
  t("layout.latencyAriaLabel", { ms: currentLatency.value.toFixed(2) }),
);

const navItems = computed<{ path: string; label: string; icon: IconName }[]>(
  () => {
    const firstChordModule = settingsStore.settings.chordDisplay[0];
    return [
      { path: "/home", label: "nav.home", icon: "home" as IconName },
      {
        path: firstChordModule ? `/chords/${firstChordModule.id}` : "/chords",
        label: "nav.chordDisplay",
        icon: "piano" as IconName,
      },
      {
        path: "/chord-dictionary",
        label: "nav.chordDictionary",
        icon: "book" as IconName,
      },
      {
        path: "/waterfall-piano",
        label: "nav.WaterfallPiano",
        icon: "piano" as IconName,
      },
      { path: "/sampler", label: "nav.Sampler", icon: "music" as IconName },
      {
        path: "/settings/routing",
        label: "nav.routing",
        icon: "swap" as IconName,
      },
      {
        path: "/settings/debug",
        label: "nav.debugger",
        icon: "bug" as IconName,
      },
    ];
  },
);

const isActive = (path: string) => {
  if (path === "/home") {
    return route.path === "/home" || route.path === "/";
  }
  // Any chord display module should highlight the chord display nav link
  if (path.startsWith("/chords/")) {
    return route.path.startsWith("/chords/");
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

<style scoped>
.app-navbar {
  display: flex;
  align-items: center;
  height: 40px;
  min-height: 40px;
  padding: 0 8px;
  gap: 4px;
  user-select: none;
  -webkit-user-select: none;
  background-color: color-mix(in oklch, var(--color-base-200) 70%, transparent);
  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
  border-bottom: 1px solid
    color-mix(in oklch, var(--color-base-content) 8%, transparent);
}

.app-navbar--mac {
  padding-left: 0;
}

.app-navbar__mac-spacer {
  width: 78px;
  flex-shrink: 0;
  -webkit-app-region: drag;
}

.app-navbar__brand {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 8px;
  flex-shrink: 0;
  text-decoration: none;
  color: var(--color-base-content);
  font-weight: 600;
  font-size: 0.875rem;
  -webkit-app-region: no-drag;
  transition: opacity var(--hig-duration-fast) var(--ease-hig-standard);
}

.app-navbar__brand:hover {
  opacity: 0.8;
}

.app-navbar__brand-text {
  white-space: nowrap;
}

.app-navbar__nav-links {
  align-items: center;
  gap: 2px;
  flex-shrink: 0;
  -webkit-app-region: no-drag;
}

.nav-link {
  padding: 0.25rem 0.625rem;
  border-radius: var(--radius-hig-md);
  font-size: 0.8125rem;
  line-height: 1.25rem;
  color: color-mix(in oklch, var(--color-base-content) 65%, transparent);
  text-decoration: none;
  white-space: nowrap;
  transition:
    background-color var(--hig-duration-fast) var(--ease-hig-standard),
    color var(--hig-duration-fast) var(--ease-hig-standard);
}

.nav-link:hover {
  color: var(--color-base-content);
  background-color: color-mix(
    in oklch,
    var(--color-base-content) 8%,
    transparent
  );
}

.nav-link--active {
  color: var(--color-primary);
  background-color: color-mix(in oklch, var(--color-primary) 10%, transparent);
  font-weight: 500;
}

.nav-link--active:hover {
  color: var(--color-primary);
  background-color: color-mix(in oklch, var(--color-primary) 15%, transparent);
}

.app-navbar__drag-region {
  flex: 1;
  min-width: 40px;
  align-self: stretch;
  -webkit-app-region: drag;
}

.app-navbar__drag-area {
  width: 100%;
  height: 100%;
}

.app-navbar__actions {
  display: flex;
  align-items: center;
  gap: 2px;
  flex-shrink: 0;
  -webkit-app-region: no-drag;
}

.app-navbar__action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: var(--radius-hig-md);
  color: color-mix(in oklch, var(--color-base-content) 70%, transparent);
  transition:
    background-color var(--hig-duration-fast) var(--ease-hig-standard),
    color var(--hig-duration-fast) var(--ease-hig-standard);
}

.app-navbar__action-btn:hover {
  background-color: color-mix(
    in oklch,
    var(--color-base-content) 8%,
    transparent
  );
  color: var(--color-base-content);
}

.app-navbar__action-icon {
  width: 1.2em;
  height: 1.2em;
}

/* 状态指示器（延迟圆点 + 录制/播放脉冲） */
.app-navbar__status {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  flex-shrink: 0;
  -webkit-app-region: no-drag;
}

.latency-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  transition: background-color 0.3s ease;
}

.latency-dot--good {
  background-color: var(--hig-success);
  box-shadow: 0 0 4px color-mix(in oklch, var(--hig-success) 50%, transparent);
}

.latency-dot--warn {
  background-color: var(--hig-warning);
  box-shadow: 0 0 4px color-mix(in oklch, var(--hig-warning) 50%, transparent);
}

.latency-dot--bad {
  background-color: var(--hig-error);
  box-shadow: 0 0 4px color-mix(in oklch, var(--hig-error) 50%, transparent);
}

.status-pulse {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  animation: status-pulse 1.5s ease-in-out infinite;
}

.status-pulse--record {
  background-color: var(--hig-error);
  box-shadow: 0 0 6px color-mix(in oklch, var(--hig-error) 60%, transparent);
}

.status-pulse--play {
  background-color: var(--hig-info);
  box-shadow: 0 0 6px color-mix(in oklch, var(--hig-info) 60%, transparent);
}

@keyframes status-pulse {
  0%,
  100% {
    transform: scale(1);
    opacity: 1;
  }
  50% {
    transform: scale(1.3);
    opacity: 0.7;
  }
}

@media (prefers-reduced-motion: reduce) {
  .status-pulse {
    animation: none;
  }
}

.app-navbar__window-controls {
  display: flex;
  align-items: center;
  margin-left: 4px;
  -webkit-app-region: no-drag;
}

.win-ctrl-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 32px;
  border: none;
  background: transparent;
  color: color-mix(in oklch, var(--color-base-content) 70%, transparent);
  cursor: pointer;
  transition:
    background-color var(--hig-duration-fast) var(--ease-hig-standard),
    color var(--hig-duration-fast) var(--ease-hig-standard);
  border-radius: var(--radius-hig-sm);
}

.win-ctrl-btn:hover {
  background-color: color-mix(
    in oklch,
    var(--color-base-content) 8%,
    transparent
  );
  color: var(--color-base-content);
}

.win-ctrl-btn--close:hover {
  background-color: var(--color-error);
  color: var(--color-error-content);
}

@media (max-width: 768px) {
  .app-navbar {
    height: 36px;
    min-height: 36px;
    padding: 0 4px;
  }

  .app-navbar__action-btn {
    width: 32px;
    height: 32px;
  }

  .win-ctrl-btn {
    width: 32px;
    height: 28px;
  }

  .app-navbar__mac-spacer {
    width: 68px;
  }
}
</style>
