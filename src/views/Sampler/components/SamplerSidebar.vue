<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from "vue";
import { useI18n } from "vue-i18n";
import { useSamplerStore, INSTRUMENT_CATEGORIES } from "@/stores/sampler";
import type { InstrumentCategory } from "@/stores/sampler";
import { useInstrumentCache } from "@/composables/useInstrumentCache";
import { Icon } from "@/components/Icon";

const props = defineProps<{
  searchQuery: string;
  selectedCategory: InstrumentCategory | "all";
}>();

const emit = defineEmits<{
  (e: "update:searchQuery", value: string): void;
  (e: "update:selectedCategory", value: InstrumentCategory | "all"): void;
}>();

const { t } = useI18n();
const samplerStore = useSamplerStore();
const { getCacheStorageSize, clearAllCaches, isClearing } =
  useInstrumentCache();

const cacheSize = ref(0);
let cacheRefreshTimer: ReturnType<typeof setInterval> | null = null;

const categories = computed(() => [
  { id: "all" as const, label: t("sampler.allCategories") },
  ...INSTRUMENT_CATEGORIES.map((cat) => ({
    id: cat,
    label: cat,
  })),
]);
import { batchDownloadInstruments } from "@/composables/useSamplerService";
async function batchDownloadInstrumentsFunction() {
  // 批量下载所有音色
  const result = await batchDownloadInstruments(
    samplerStore.gmInstrumentCatalog.map((inst) => inst.id),
  );
  console.log(result);
}
function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const value = bytes / Math.pow(1024, i);
  return `${value.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

async function refreshCacheSize() {
  cacheSize.value = await getCacheStorageSize();
}

async function handleClearAllCache() {
  if (isClearing.value) return;

  await clearAllCaches();
  await refreshCacheSize();

  // 清除所有音源的缓存状态
  for (const inst of samplerStore.gmInstrumentCatalog) {
    const record = samplerStore.instruments[inst.id];
    if (record) {
      record.loaded = false;
      record.loading = false;
      record.error = undefined;
    }
  }
}

/** 刷新音色列表 */
async function handleRefreshInstruments() {
  if (samplerStore.isRefreshing) return;
  await samplerStore.refreshInstrumentList();
}

onMounted(() => {
  refreshCacheSize();
  cacheRefreshTimer = setInterval(refreshCacheSize, 5000);
});

onUnmounted(() => {
  if (cacheRefreshTimer) {
    clearInterval(cacheRefreshTimer);
  }
});
</script>

<template>
  <div class="flex flex-col h-full">
    <!-- 上部：分类列表 + 搜索框 -->
    <div class="flex-1 overflow-y-auto p-4">
      <!-- 刷新按钮 -->
      <div class="flex items-center justify-between mb-3">
        <h2 class="text-hig-sm font-semibold text-base-content/70">
          {{ t("sampler.categories") }}
        </h2>
        <button
          class="btn btn-ghost btn-xs"
          :disabled="samplerStore.isRefreshing"
          :class="{ loading: samplerStore.isRefreshing }"
          @click="handleRefreshInstruments"
          title="刷新音色列表"
        >
          <Icon
            name="refresh"
            :size="14"
            :class="{ 'animate-spin': samplerStore.isRefreshing }"
            aria-hidden="true"
          />
        </button>
      </div>

      <!-- 搜索框 -->
      <div class="form-control mb-4">
        <input
          :value="searchQuery"
          type="text"
          :placeholder="t('sampler.searchInstruments')"
          class="input input-bordered input-sm w-full"
          @input="
            emit(
              'update:searchQuery',
              ($event.target as HTMLInputElement).value,
            )
          "
        />
      </div>

      <!-- 分类列表 -->
      <ul class="menu menu-sm rounded-hig-md">
        <li v-for="cat in categories" :key="cat.id">
          <button
            :class="{
              active: selectedCategory === cat.id,
              'bg-primary/10 text-primary font-semibold':
                selectedCategory === cat.id,
            }"
            @click="emit('update:selectedCategory', cat.id)"
          >
            {{ cat.label }}
            <span class="badge badge-xs badge-ghost ml-auto">
              {{
                cat.id === "all"
                  ? samplerStore.gmInstrumentCatalog.length
                  : (samplerStore.instrumentsByCategory[cat.id]?.length ?? 0)
              }}
            </span>
          </button>
        </li>
      </ul>
    </div>

    <!-- 底部：缓存管理区域 -->
    <div class="flex flex-col border-t border-base-300 p-4 gap-3">
      <div class="flex items-baseline justify-between">
        <h3 class="text-hig-sm font-semibold text-base-content/70">
          {{ t("sampler.cacheSize") || "Cache Size" }}
        </h3>
        <span class="text-hig-xl font-bold tabular">{{
          formatBytes(cacheSize)
        }}</span>
      </div>
      <button
        class="btn btn-sm btn-outline btn-error w-full"
        :disabled="isClearing"
        @click="handleClearAllCache"
      >
        <Icon name="trash" :size="16" aria-hidden="true" />
        <span>{{ t("sampler.clearCache") }}</span>
      </button>
      <button
        class="btn btn-sm btn-primary w-full"
        :disabled="samplerStore.isBatchDownloading"
        @click="batchDownloadInstrumentsFunction"
      >
        <Icon name="refresh" :size="16" aria-hidden="true" />
        <span v-if="samplerStore.isBatchDownloading" class="tabular">
          下载中 {{ samplerStore.batchDownloadCompleted }}/{{
            samplerStore.batchDownloadTotal
          }}
        </span>
        <span v-else>批量下载</span>
      </button>
    </div>
  </div>
</template>
