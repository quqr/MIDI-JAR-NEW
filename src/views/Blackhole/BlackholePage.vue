<template>
  <div class="w-full h-full relative overflow-hidden">
    <!-- 黑洞画布 -->
    <BlackholeComponent :config="config" />

    <!-- 右上角设置按钮 -->
    <div class="absolute top-4 right-4 z-10 flex gap-2">
      <button
        class="btn btn-circle btn-sm btn-ghost backdrop-blur-sm"
        :class="globalBgEnabled ? 'bg-primary/30' : 'bg-base-100/30'"
        :aria-label="globalBgEnabled ? t('blackhole.globalBackground.disable') : t('blackhole.globalBackground.enable')"
        @click="toggleGlobalBackground"
      >
        <Icon name="overlay" :size="16" />
      </button>
      <button
        class="btn btn-circle btn-sm btn-ghost backdrop-blur-sm bg-base-100/30"
        :aria-label="t('blackhole.openSettings')"
        @click="settingsOpen = !settingsOpen"
      >
        <Icon name="settings" :size="16" />
      </button>
    </div>

    <!-- 右侧设置面板 -->
    <Transition name="slide-right">
      <div
        v-if="settingsOpen"
        class="absolute top-0 right-0 z-20 h-full w-80 bg-base-100/90 backdrop-blur-md border-l border-base-200/30 shadow-xl"
      >
        <div class="flex items-center justify-between p-3 border-b border-base-200/30">
          <h2 class="text-sm font-semibold">
            {{ t("blackhole.settings.title") }}
          </h2>
          <button
            class="btn btn-xs btn-ghost btn-circle"
            @click="settingsOpen = false"
          >
            <Icon name="x" :size="14" />
          </button>
        </div>
        <BlackholeSettings v-model="config" />
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, inject } from "vue";
import { useI18n } from "vue-i18n";
import BlackholeComponent from "./BlackholeComponent.vue";
import BlackholeSettings from "./components/BlackholeSettings.vue";
import BlackholeBackground from "./BlackholeBackground.vue";
import Icon from "@/components/Icon/Icon.vue";
import type { BlackholeConfig } from "./types";
import { DEFAULT_BLACKHOLE_CONFIG } from "./constants";

const { t } = useI18n();

const settingsOpen = ref(false);
const config = ref<BlackholeConfig>({ ...DEFAULT_BLACKHOLE_CONFIG });
const globalBgEnabled = ref(localStorage.getItem("blackhole-global-enabled") === "true");

const blackholeBgRef = inject<ReturnType<typeof ref<InstanceType<typeof BlackholeBackground>>>>("blackholeBg");

function toggleGlobalBackground() {
  globalBgEnabled.value = !globalBgEnabled.value;
  localStorage.setItem("blackhole-global-enabled", String(globalBgEnabled.value));
  if (blackholeBgRef?.value) {
    if (globalBgEnabled.value) {
      blackholeBgRef.value.enable();
    } else {
      blackholeBgRef.value.disable();
    }
  }
}

// 持久化到 localStorage
const STORAGE_KEY = "blackhole-config";

function loadConfig() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      config.value = { ...DEFAULT_BLACKHOLE_CONFIG, ...parsed };
    }
  } catch {
    // ignore
  }
}

function saveConfig() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config.value));
  } catch {
    // ignore
  }
}

watch(config, saveConfig, { deep: true });

loadConfig();
</script>

<style scoped>
.slide-right-enter-active,
.slide-right-leave-active {
  transition: transform 0.3s ease;
}
.slide-right-enter-from,
.slide-right-leave-to {
  transform: translateX(100%);
}
</style>
