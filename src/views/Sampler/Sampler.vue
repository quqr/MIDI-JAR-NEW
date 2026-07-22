<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from "vue";
import { useI18n } from "vue-i18n";
import { useSamplerStore } from "@/stores/sampler";
import type { InstrumentCategory, InstrumentInfo } from "@/stores/sampler";
import { useSamplerService } from "@/composables/useSamplerService";
import { useScalePlayer } from "@/composables/useScalePlayer";
import { useInstrumentCache } from "@/composables/useInstrumentCache";
import { useSettingsStore } from "@/stores/settings";
import { Icon } from "@/components/Icon";
import { CanvasPianoKeyboard } from "@/components/CanvasPianoKeyboard";
import { createKeyboardSettingsFromPiano } from "@/components/PianoKeyboard/utils";
import { createLogger } from "@/utils/logger";

import SamplerSidebar from "./components/SamplerSidebar.vue";

const logger = createLogger("Sampler");

const { t } = useI18n();
const samplerStore = useSamplerStore();
const samplerService = useSamplerService();
const settingsStore = useSettingsStore();
const scalePlayer = useScalePlayer();
const { getInstrumentCacheSize, clearInstrumentCache } = useInstrumentCache();

// --- State ---
const searchQuery = ref("");
const selectedCategory = ref<InstrumentCategory | "all">("all");
const activeNotes = ref<Set<number>>(new Set());
const instrumentCacheSizes = ref<Record<string, number>>({});
const isPlayingScale = ref(false);
let cacheSizeRefreshTimer: ReturnType<typeof setInterval> | null = null;

// --- Computed ---
const filteredInstruments = computed(() => {
  let result = samplerStore.gmInstrumentCatalog;
  if (selectedCategory.value !== "all") {
    result = result.filter((i) => i.category === selectedCategory.value);
  }
  if (searchQuery.value) {
    const q = searchQuery.value.toLowerCase();
    result = result.filter(
      (i) => i.name.toLowerCase().includes(q) || i.id.toLowerCase().includes(q),
    );
  }
  return result;
});

const loadProgressPercent = computed(() => {
  const { loaded, total } = samplerStore.loadProgress;
  if (total === 0) return 0;
  return Math.round((loaded / total) * 100);
});

const keyboardSettings = computed(() =>
  createKeyboardSettingsFromPiano(settingsStore.settings.piano),
);

// --- Methods ---
async function selectInstrument(info: InstrumentInfo) {
  try {
    await samplerService.loadInstrument(info.id);
    // 更新该音源的缓存大小
    updateInstrumentCacheSize(info.id);
  } catch {
    // 错误已由 store 处理
  }
}

function onNoteOn(note: number) {
  if (!samplerStore.isReady) return;
  activeNotes.value.add(note);
  samplerService.noteOn(note, 100);
}

function onNoteOff(note: number) {
  activeNotes.value.delete(note);
  samplerService.noteOff(note);
}

// --- 缓存大小管理 ---
function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const value = bytes / Math.pow(1024, i);
  return `${value.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

async function updateInstrumentCacheSize(instrumentId: string) {
  const size = await getInstrumentCacheSize(instrumentId);
  instrumentCacheSizes.value[instrumentId] = size;
}

async function handleClearInstrumentCache(instrumentId: string, event: Event) {
  event.stopPropagation();
  await clearInstrumentCache(instrumentId);
  instrumentCacheSizes.value[instrumentId] = 0;

  // 更新 store 中的缓存状态
  samplerStore.updateInstrumentStatus(instrumentId, {
    loaded: false,
  });

  logger.info("Cleared cache for instrument: %s", instrumentId);
}

// --- 试听功能 ---
async function playInstrumentScale(info: InstrumentInfo, event: Event) {
  event.stopPropagation();

  // 如果正在播放，停止
  if (isPlayingScale.value) {
    scalePlayer.stopScale();
    isPlayingScale.value = false;
    return;
  }

  // 先选中该音源
  if (samplerStore.currentInstrumentId !== info.id) {
    await selectInstrument(info);
  }

  // 等待音源加载完成
  if (!samplerStore.isReady) return;

  isPlayingScale.value = true;

  // 从 settings 获取当前调式
  const currentKey = settingsStore.settings.notation?.key || "C";

  try {
    await scalePlayer.playScale({
      key: currentKey,
      startOctave: 4,
      duration: 300,
      direction: "up",
    });
  } finally {
    isPlayingScale.value = false;
  }
}

// --- Lifecycle ---
onMounted(async () => {
  // 优先恢复上次加载的乐器，否则默认加载钢琴
  const savedId = samplerStore.savedInstrumentId;
  if (savedId) {
    const saved = samplerStore.gmInstrumentCatalog.find(
      (i) => i.id === savedId,
    );
    if (saved) {
      try {
        await selectInstrument(saved);
      } catch {
        // 恢复失败，加载默认钢琴
      }
    }
  }
  if (!samplerStore.isReady) {
    const piano = samplerStore.gmInstrumentCatalog.find(
      (i) => i.id === "acoustic_grand_piano",
    );
    if (piano) {
      await selectInstrument(piano);
    }
  }

  // 定期刷新已加载音源的缓存大小
  cacheSizeRefreshTimer = setInterval(() => {
    for (const inst of samplerStore.gmInstrumentCatalog) {
      if (samplerStore.instruments[inst.id]?.loaded) {
        updateInstrumentCacheSize(inst.id);
      }
    }
  }, 10_000);
});

onUnmounted(() => {
  samplerService.stopAllNotes();
  if (cacheSizeRefreshTimer) {
    clearInterval(cacheSizeRefreshTimer);
    cacheSizeRefreshTimer = null;
  }
});
</script>

<template>
  <div class="h-full flex bg-base-300 overflow-hidden">
    <!-- ═══ Main Body ═══ -->
    <div class="flex-1 flex min-h-0">
      <!-- ── Sidebar (左侧) ── -->
      <div class="w-56 bg-base-200 border-r border-base-content/10 flex flex-col shrink-0">
        <SamplerSidebar
          v-model:search-query="searchQuery"
          v-model:selected-category="selectedCategory"
        />
      </div>

      <!-- ── Main Area (右侧) ── -->
      <div class="flex-1 flex flex-col min-h-0">
        <!-- Instrument Grid -->
        <div class="flex-1 overflow-y-auto p-4">
          <!-- Error message -->
          <div v-if="samplerStore.error" class="alert alert-error mb-4">
            <Icon name="alert-circle" :size="16" aria-hidden="true" />
            <span class="text-sm">{{ samplerStore.error }}</span>
          </div>

          <!-- Grid -->
          <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            <div
              v-for="inst in filteredInstruments"
              :key="inst.id"
              :class="[
                'card bg-base-200 shadow-sm cursor-pointer hover:shadow-md transition-all relative group',
                samplerStore.currentInstrumentId === inst.id && 'ring-2 ring-primary',
                samplerStore.instruments[inst.id]?.error && 'ring-2 ring-error',
              ]"
              @click="selectInstrument(inst)"
            >
              <div class="card-body p-3">
                <!-- 试听按钮 (右上角) -->
                <button
                  class="btn btn-xs btn-circle btn-ghost absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-10"
                  :class="{ 'btn-active': isPlayingScale && samplerStore.currentInstrumentId === inst.id }"
                  :aria-label="t('sampler.preview')"
                  @click="playInstrumentScale(inst, $event)"
                >
                  <Icon
                    :name="isPlayingScale && samplerStore.currentInstrumentId === inst.id ? 'stop' : 'play'"
                    :size="14"
                    aria-hidden="true"
                  />
                </button>

                <h4 class="text-sm font-medium leading-tight pr-6">
                  {{ inst.name }}
                </h4>

                <!-- 加载进度（radial-progress） -->
                <div
                  v-if="samplerStore.instruments[inst.id]?.loading && samplerStore.currentInstrumentId === inst.id"
                  class="flex items-center justify-center mt-2"
                >
                  <div
                    class="radial-progress text-primary"
                    :style="{
                      '--value': loadProgressPercent,
                      '--size': '2.5rem',
                      '--thickness': '3px',
                    }"
                    role="progressbar"
                    :aria-valuenow="loadProgressPercent"
                  >
                    {{ loadProgressPercent }}%
                  </div>
                </div>

                <!-- 错误显示 -->
                <div
                  v-else-if="samplerStore.instruments[inst.id]?.error"
                  class="mt-2"
                >
                  <div class="badge badge-error badge-sm gap-1">
                    <Icon name="error" :size="12" aria-hidden="true" />
                    <span class="text-xs truncate max-w-[120px]">{{
                      samplerStore.instruments[inst.id]?.error
                    }}</span>
                  </div>
                </div>

                <!-- 状态标识 -->
                <div v-else class="flex items-center justify-between mt-1">
                  <span class="text-xs text-base-content/50">{{ inst.category }}</span>
                  <!-- 已缓存标识 -->
                  <div v-if="samplerStore.instruments[inst.id]?.loaded" class="flex items-center gap-1">
                    <span class="badge badge-success badge-xs gap-1">
                      <Icon name="check" :size="10" aria-hidden="true" />
                      <span class="text-xs">Cached</span>
                    </span>
                    <!-- 缓存大小 + 清除按钮 -->
                    <template v-if="instrumentCacheSizes[inst.id] > 0">
                      <span class="text-xs text-base-content/40">
                        {{ formatBytes(instrumentCacheSizes[inst.id]) }}
                      </span>
                      <button
                        class="btn btn-xs btn-ghost btn-square p-0 min-h-0 h-4 w-4"
                        :aria-label="t('sampler.clearInstrumentCache')"
                        @click="handleClearInstrumentCache(inst.id, $event)"
                      >
                        <Icon name="x" :size="10" aria-hidden="true" />
                      </button>
                    </template>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Empty state -->
          <div
            v-if="filteredInstruments.length === 0"
            class="text-center py-12 text-base-content/40"
          >
            {{ t("sampler.noInstrumentsFound") }}
          </div>
        </div>

        <!-- ── Bottom: Piano Keyboard ── -->
        <div class="bg-base-200 border-t border-base-content/10 px-2 py-1" style="height: 120px">
          <CanvasPianoKeyboard
            :keyboard="keyboardSettings"
            :played="[...activeNotes]"
            :clickable="true"
            :sustain-mode="true"
            @note-on="(midi: number) => onNoteOn(midi)"
            @note-off="(midi: number) => onNoteOff(midi)"
          />
        </div>
      </div>
    </div>
  </div>
</template>