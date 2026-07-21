<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from "vue";
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";
import { useSamplerStore, INSTRUMENT_CATEGORIES } from "@/stores/sampler";
import type { InstrumentCategory, InstrumentInfo } from "@/stores/sampler";
import { useSamplerService } from "@/composables/useSamplerService";
import { Icon } from "@/components/Icon";
import { CanvasPianoKeyboard } from "@/components/CanvasPianoKeyboard";

const { t } = useI18n();
const router = useRouter();
const samplerStore = useSamplerStore();
const samplerService = useSamplerService();

// --- State ---
const searchQuery = ref("");
const selectedCategory = ref<InstrumentCategory | "all">("all");
const activeNotes = ref<Set<number>>(new Set());
const cacheSize = ref(0);
let cacheRefreshTimer: ReturnType<typeof setInterval> | null = null;

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

// --- Methods ---
async function selectInstrument(info: InstrumentInfo) {
  try {
    await samplerService.loadInstrument(info.id);
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

function goBack() {
  router.push("/home");
}

// --- Cache Management ---
function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const value = bytes / Math.pow(1024, i);
  return `${value.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

async function refreshCacheSize() {
  cacheSize.value = await samplerService.getCacheSize();
}

async function clearSamplerCache() {
  const previousId = await samplerService.clearCache();
  await refreshCacheSize();
  // 清除缓存后自动重新加载之前的乐器
  if (previousId) {
    try {
      await samplerService.loadInstrument(previousId);
    } catch {
      // 重载失败已由 store 处理
    }
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
  // 刷新缓存大小
  await refreshCacheSize();
  // 每 5 秒刷新一次（比之前的 30 秒更及时）
  cacheRefreshTimer = setInterval(refreshCacheSize, 5_000);
});

onUnmounted(() => {
  samplerService.stopAllNotes();
  if (cacheRefreshTimer) {
    clearInterval(cacheRefreshTimer);
    cacheRefreshTimer = null;
  }
});
</script>

<template>
  <div class="fixed inset-0 flex flex-col bg-base-300 overflow-hidden">
    <!-- ═══ Top Toolbar ═══ -->
    <div
      class="flex items-center gap-2 px-3 py-2 bg-base-200 border-b border-base-content/10 min-h-[44px]"
    >
      <button
        class="btn btn-sm btn-circle btn-ghost tooltip tooltip-bottom"
        :data-tip="t('common.back')"
        :aria-label="t('common.back')"
        @click="goBack"
      >
        <Icon name="arrow-left" :size="18" aria-hidden="true" />
      </button>
      <span class="font-bold text-base-content/90 text-sm tracking-wide"
        >Sampler</span
      >

      <div class="flex-1" />

      <!-- Current instrument badge -->
      <span
        v-if="samplerStore.currentInstrument"
        class="badge badge-primary badge-sm"
      >
        {{ samplerStore.currentInstrument.name }}
      </span>

      <!-- Loading progress -->
      <div v-if="samplerStore.isLoading" class="flex items-center gap-2">
        <progress
          v-if="samplerStore.loadProgress.total > 0"
          class="progress progress-primary w-20"
          :value="samplerStore.loadProgress.loaded"
          :max="samplerStore.loadProgress.total"
        ></progress>
        <progress v-else class="progress progress-primary w-20"></progress>
        <span class="text-xs text-base-content/60"
          >{{ loadProgressPercent }}%</span
        >
      </div>

      <!-- Ready indicator -->
      <span v-if="samplerStore.isReady" class="badge badge-success badge-xs"
        >Ready</span
      >

      <!-- Cache size + clear button -->
      <div class="flex items-center gap-1.5">
        <span class="text-xs text-base-content/50"
          >{{ t("sampler.cacheSize") }}: {{ formatBytes(cacheSize) }}</span
        >
        <button
          class="btn btn-xs btn-ghost btn-square tooltip tooltip-bottom"
          :data-tip="t('sampler.clearCache')"
          :aria-label="t('sampler.clearCache')"
          @click="clearSamplerCache"
        >
          <Icon name="trash" :size="12" aria-hidden="true" />
        </button>
      </div>
    </div>

    <!-- ═══ Main Body ═══ -->
    <div class="flex-1 flex min-h-0">
      <!-- ── Sidebar: Category Filter ── -->
      <div
        class="w-48 bg-base-200 border-r border-base-content/10 flex flex-col shrink-0"
      >
        <div class="p-3 border-b border-base-content/10">
          <input
            v-model="searchQuery"
            type="text"
            :placeholder="
              t('sampler.searchInstruments', 'Search instruments...')
            "
            class="input input-sm input-bordered w-full"
          />
        </div>
        <ul class="menu menu-sm flex-1 overflow-y-auto p-2">
          <li>
            <a
              :class="{ active: selectedCategory === 'all' }"
              @click="selectedCategory = 'all'"
            >
              {{ t("sampler.allCategories", "All") }}
              <span class="badge badge-xs badge-ghost">{{
                samplerStore.gmInstrumentCatalog.length
              }}</span>
            </a>
          </li>
          <li v-for="cat in INSTRUMENT_CATEGORIES" :key="cat">
            <a
              :class="{ active: selectedCategory === cat }"
              @click="selectedCategory = cat"
            >
              {{ cat }}
              <span class="badge badge-xs badge-ghost">
                {{ samplerStore.instrumentsByCategory[cat]?.length ?? 0 }}
              </span>
            </a>
          </li>
        </ul>
      </div>

      <!-- ── Main Area: Instrument Grid ── -->
      <div class="flex-1 flex flex-col min-h-0">
        <!-- Instrument Grid -->
        <div class="flex-1 overflow-y-auto p-4">
          <!-- Error message -->
          <div v-if="samplerStore.error" class="alert alert-error mb-4">
            <span class="text-sm">{{ samplerStore.error }}</span>
          </div>

          <!-- Grid -->
          <div
            class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2"
          >
            <div
              v-for="inst in filteredInstruments"
              :key="inst.id"
              :class="[
                'card bg-base-200 shadow-sm cursor-pointer hover:shadow-md transition-all',
                samplerStore.currentInstrumentId === inst.id &&
                  'ring-2 ring-primary',
              ]"
              @click="selectInstrument(inst)"
            >
              <div class="card-body p-3">
                <h4 class="text-sm font-medium leading-tight">
                  {{ inst.name }}
                </h4>
                <div class="flex items-center justify-between mt-1">
                  <span class="text-xs text-base-content/50">{{
                    inst.category
                  }}</span>
                  <span
                    v-if="samplerStore.instruments[inst.id]?.loaded"
                    class="badge badge-success badge-xs"
                    >✓</span
                  >
                  <span
                    v-else-if="samplerStore.instruments[inst.id]?.loading"
                    class="loading loading-xs loading-spinner"
                  ></span>
                </div>
              </div>
            </div>
          </div>

          <!-- Empty state -->
          <div
            v-if="filteredInstruments.length === 0"
            class="text-center py-12 text-base-content/40"
          >
            {{ t("sampler.noInstrumentsFound", "No instruments found") }}
          </div>
        </div>

        <!-- ── Bottom: Piano Keyboard ── -->
        <div
          class="bg-base-200 border-t border-base-content/10 px-2 py-1"
          style="height: 120px"
        >
          <CanvasPianoKeyboard
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
