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
      class="shrink-0 min-w-max flex items-center"
      style="-webkit-app-region: no-drag"
    >
      <AppBreadcrumb />
    </div>

    <!-- 弹性占位：Tauri 中为拖拽区（双击最大化）；浏览器中仅占位把右侧控件推到最右。
         唯一可伸缩项，吸收全部剩余空间；面包屑与右侧控件均 shrink-0 优先保内容。 -->
    <div
      class="flex-1 min-w-0 self-stretch"
      :style="inTauri ? '-webkit-app-region: drag' : undefined"
      @dblclick="handleDragAreaDblClick"
    ></div>

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

    <!-- 音源引擎状态圆点：仅在 VST 出错时出现（采样器路径下不占位）；点击前往 VST 页 -->
    <RouterLink
      v-if="vstErrorVisible"
      to="/vst"
      class="flex items-center justify-center w-6 h-6 shrink-0"
      style="-webkit-app-region: no-drag"
      role="status"
      :title="vstErrorTooltip"
      :aria-label="vstErrorTooltip"
    >
      <StateDot status="error" size="sm" :aria-label="vstErrorTooltip" />
    </RouterLink>

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

      <!-- 调性快切滑条：置于最右，但保持在窗口控制按钮（最小化/最大化/关闭）左侧 -->
      <div
        class="flex shrink-0 items-center"
        style="-webkit-app-region: no-drag"
      >
        <QuickChangeKeyToolbar />
      </div>

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
import { useSamplerStore } from "@/stores/sampler";
import { useVstStore } from "@/stores/vst";
import { isTauri } from "@/utils/tauri";

const logger = createLogger("AppNavbar");
const inTauri = isTauri();

const { t } = useI18n();
const route = useRoute();
const samplerStore = useSamplerStore();
const vstStore = useVstStore();

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

// ─── 音源引擎全局错误指示（E3） ───
// 后端没有独立的 `vst:error` 事件：错误统一由 `vst:status` 的 state === "error" 表达，
// 因此这里从 store 状态派生，不额外订阅。
// 只在“当前正在用 VST”时显示——采样器路径下插件崩溃与本页无关，不该打扰。
const vstErrorVisible = computed(
  () => samplerStore.toneSource === "vst" && vstStore.hasError,
);

const vstErrorTooltip = computed(() => {
  const message = vstStore.errorMessage;
  return message
    ? t("vst.globalErrorTooltip", { message })
    : t("vst.globalErrorTooltipGeneric");
});

const navItems: { path: string; label: string; icon: IconName }[] = [
  { path: "/home", label: "nav.home", icon: "home" },
  { path: "/chord-dictionary", label: "nav.chordDictionary", icon: "book" },
  { path: "/chord-quiz", label: "nav.chordQuiz", icon: "quiz" },
  { path: "/tuner", label: "nav.tuner", icon: "tuner" },
  { path: "/score-scroll", label: "nav.scoreScroll", icon: "file-music" },
  { path: "/score-3d", label: "nav.score3d", icon: "layers" },
  {
    path: "/circle-of-fifths",
    label: "nav.circleOfFifths",
    icon: "circle-of-fifths",
  },
  { path: "/chord-chart", label: "nav.chordChart", icon: "lead-sheet" },
  { path: "/metronome", label: "nav.metronome", icon: "metronome" },
  { path: "/vst", label: "nav.vst", icon: "plugin" },
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
