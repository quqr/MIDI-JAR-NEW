<template>
  <div class="app-navbar" :class="{ 'app-navbar--mac': isMac }">
    <div v-if="isMac" class="app-navbar__mac-spacer"></div>

    <div class="app-navbar__breadcrumb">
      <AppBreadcrumb />
    </div>

    <div class="app-navbar__drag-region">
      <div
        class="app-navbar__drag-area"
        @dblclick="handleDragAreaDblClick"
      ></div>
    </div>

    <div class="app-navbar__actions">
      <RouterLink
        to="/settings"
        class="app-navbar__action-btn"
        :title="$t('settings.title')"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          stroke-width="2"
          stroke="currentColor"
          class="app-navbar__action-icon"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z"
          />
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
          />
        </svg>
      </RouterLink>

      <ThemeSwitcher />

      <div v-if="!isMac" class="app-navbar__window-controls">
        <button
          class="win-ctrl-btn"
          @click="handleMinimize"
          :title="$t('layout.minimize')"
        >
          <svg width="12" height="12" viewBox="0 0 12 12">
            <line x1="1" y1="6" x2="11" y2="6" stroke="currentColor" stroke-width="1" stroke-linecap="round" />
          </svg>
        </button>
        <button
          class="win-ctrl-btn"
          @click="handleMaximize"
          :title="isMaximized ? $t('layout.unmaximize') : $t('layout.maximize')"
        >
          <svg v-if="!isMaximized" width="12" height="12" viewBox="0 0 12 12">
            <rect x="1.5" y="1.5" width="9" height="9" fill="none" stroke="currentColor" stroke-width="1" />
          </svg>
          <svg v-else width="12" height="12" viewBox="0 0 12 12">
            <rect x="3.5" y="3.5" width="7" height="7" fill="none" stroke="currentColor" stroke-width="1" />
            <path d="M1.5 4.5V1.5h3" fill="none" stroke="currentColor" stroke-width="1" />
            <path d="M1.5 11.5V8.5" fill="none" stroke="currentColor" stroke-width="1" />
            <path d="M8.5 1.5h1.5v1.5" fill="none" stroke="currentColor" stroke-width="1" />
          </svg>
        </button>
        <button
          class="win-ctrl-btn win-ctrl-btn--close"
          @click="handleClose"
          :title="$t('common.close')"
        >
          <svg width="12" height="12" viewBox="0 0 12 12">
            <line x1="2" y1="2" x2="10" y2="10" stroke="currentColor" stroke-width="1" stroke-linecap="round" />
            <line x1="10" y1="2" x2="2" y2="10" stroke="currentColor" stroke-width="1" stroke-linecap="round" />
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
    <ul class="menu menu-vertical px-2 gap-1">
      <li v-for="item in navItems" :key="item.path">
        <RouterLink
          :to="item.path"
          class="flex items-center gap-2 transition-all duration-200"
          :class="[
            isActive(item.path)
              ? 'btn btn-primary'
              : 'btn btn-ghost hover:bg-base-200',
          ]"
          @click="mobileMenuOpen = false"
        >
          <component :is="getIconComponent(item.icon)" class="size-4" />
          <span>{{ $t(item.label) }}</span>
        </RouterLink>
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from "vue";
import { useRoute, RouterLink } from "vue-router";
import AppBreadcrumb from "./AppBreadcrumb.vue";
import ThemeSwitcher from "@/components/ThemeSwitcher.vue";

const route = useRoute();

const mobileMenuOpen = ref(false);
const isMaximized = ref(false);
const isMac = ref(false);

let removeMaximizedListener: (() => void) | null = null;

const navItems = [
  { path: "/home", label: "nav.home", icon: "home" },
  { path: "/circle-of-fifths", label: "nav.circleOfFifths", icon: "circle" },
  { path: "/quiz", label: "nav.chordQuiz", icon: "help-circle" },
  { path: "/chord-dictionary", label: "nav.chordDictionary", icon: "book" },
];

const isActive = (path: string) => {
  if (path === "/home") {
    return route.path === "/home" || route.path === "/";
  }
  return route.path.startsWith(path);
};

const getIconComponent = (iconName: string) => {
  const icons: Record<string, any> = {
    home: {
      template: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>`,
    },
    circle: {
      template: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /><path stroke-linecap="round" stroke-linejoin="round" d="M9 12a3 3 0 116 0 3 3 0 01-6 0z" /></svg>`,
    },
    "help-circle": {
      template: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>`,
    },
    book: {
      template: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" /></svg>`,
    },
  };
  return icons[iconName] || icons.home;
};

const handleMinimize = () => {
  window.electronAPI?.window.minimize();
};

const handleMaximize = () => {
  window.electronAPI?.window.maximize();
};

const handleClose = () => {
  window.electronAPI?.window.close();
};

const handleDragAreaDblClick = () => {
  window.electronAPI?.window.maximize();
};

onMounted(async () => {
  const api = window.electronAPI;
  if (!api) return;

  try {
    const p = await api.app.getPlatform();
    isMac.value = p === "darwin";

    const max = await api.window.isMaximized();
    isMaximized.value = max;

    api.window.onMaximizedChanged((maximized: boolean) => {
      isMaximized.value = maximized;
    });

    removeMaximizedListener = () => {};
  } catch (e) {
    console.error("[AppNavbar] init failed:", e);
  }
});

onUnmounted(() => {
  if (removeMaximizedListener) {
    removeMaximizedListener();
    removeMaximizedListener = null;
  }
});
</script>

<style scoped>
.app-navbar {
  display: flex;
  align-items: center;
  height: 40px;
  min-height: 40px;
  background-color: oklch(var(--b2));
  padding: 0 8px;
  gap: 4px;
  user-select: none;
  -webkit-user-select: none;
}

.app-navbar--mac {
  padding-left: 0;
}

.app-navbar__mac-spacer {
  width: 78px;
  flex-shrink: 0;
  -webkit-app-region: drag;
}

.app-navbar__breadcrumb {
  flex-shrink: 1;
  min-width: 0;
  overflow: hidden;
  -webkit-app-region: no-drag;
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
  width: 32px;
  height: 32px;
  border-radius: 8px;
  color: oklch(var(--bc) / 0.7);
  transition: background-color 0.15s, color 0.15s;
}

.app-navbar__action-btn:hover {
  background-color: oklch(var(--b1));
  color: oklch(var(--bc));
}

.app-navbar__action-icon {
  width: 1.2em;
  height: 1.2em;
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
  height: 28px;
  border: none;
  background: transparent;
  color: oklch(var(--bc) / 0.7);
  cursor: pointer;
  transition: background-color 0.12s, color 0.12s;
  border-radius: 4px;
}

.win-ctrl-btn:hover {
  background-color: oklch(var(--b1));
  color: oklch(var(--bc));
}

.win-ctrl-btn--close:hover {
  background-color: #e81123;
  color: white;
}

@media (max-width: 768px) {
  .app-navbar {
    height: 36px;
    min-height: 36px;
    padding: 0 4px;
  }

  .app-navbar__action-btn {
    width: 28px;
    height: 28px;
  }

  .win-ctrl-btn {
    width: 32px;
    height: 26px;
  }

  .app-navbar__mac-spacer {
    width: 68px;
  }
}
</style>
