<script setup lang="ts">
import { ref, onMounted, onUnmounted } from "vue";
import { useI18n } from "vue-i18n";
import { useInstrumentCache } from "@/composables/useInstrumentCache";
import { Icon } from "@/components/Icon";
import { SettingsCollapse } from "@/components/Settings";

defineProps<{
  open: boolean;
  searchQuery?: string;
}>();

const emit = defineEmits<{
  (e: "update:open", value: boolean): void;
}>();

const { t } = useI18n();
const { getLocalStorageSize, getCacheStorageSize, clearAllCaches, isClearing } =
  useInstrumentCache();

const localStorageSize = ref(0);
const cacheStorageSize = ref(0);
let refreshTimer: ReturnType<typeof setInterval> | null = null;

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const value = bytes / Math.pow(1024, i);
  return `${value.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

async function refreshSizes() {
  localStorageSize.value = getLocalStorageSize();
  cacheStorageSize.value = await getCacheStorageSize();
}

async function handleClearAllCaches() {
  await clearAllCaches();
  await refreshSizes();
}

onMounted(() => {
  refreshSizes();
  refreshTimer = setInterval(refreshSizes, 5000);
});

onUnmounted(() => {
  if (refreshTimer) {
    clearInterval(refreshTimer);
  }
});
</script>

<template>
  <SettingsCollapse
    :open="open"
    :title="t('advancedDebug.cache.title', '缓存管理')"
    @update:open="emit('update:open', $event)"
  >
    <div class="space-y-4">
      <!-- localStorage 大小 -->
      <div class="flex items-center justify-between">
        <span class="text-sm">{{
          t("advancedDebug.cache.localStorage", "localStorage")
        }}</span>
        <span class="badge badge-neutral">{{
          formatBytes(localStorageSize)
        }}</span>
      </div>

      <!-- CacheStorage 大小 -->
      <div class="flex items-center justify-between">
        <span class="text-sm">{{
          t("advancedDebug.cache.cacheStorage", "CacheStorage")
        }}</span>
        <span class="badge badge-neutral">{{
          formatBytes(cacheStorageSize)
        }}</span>
      </div>

      <!-- 总大小 -->
      <div
        class="flex items-center justify-between pt-2 border-t border-base-300"
      >
        <span class="text-sm font-semibold">{{
          t("advancedDebug.cache.total", "总计")
        }}</span>
        <span class="badge badge-primary">{{
          formatBytes(localStorageSize + cacheStorageSize)
        }}</span>
      </div>

      <!-- 清除按钮 -->
      <button
        class="btn btn-error btn-sm w-full"
        :disabled="isClearing"
        @click="handleClearAllCaches"
      >
        <Icon
          :name="isClearing ? 'loading' : 'trash'"
          :size="16"
          :class="{ 'animate-spin': isClearing }"
        />
        <span>{{ t("advancedDebug.cache.clearAll", "清除全部缓存") }}</span>
      </button>

      <!-- 说明 -->
      <p class="text-xs text-base-content/60">
        {{
          t(
            "advancedDebug.cache.note",
            "清除缓存后，已加载的音源需要重新下载。用户设置和主题将保留。",
          )
        }}
      </p>
    </div>
  </SettingsCollapse>
</template>
