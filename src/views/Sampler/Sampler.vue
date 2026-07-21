<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";
import { useSamplerStore, INSTRUMENT_CATEGORIES } from "@/stores/sampler";
import type { InstrumentCategory, InstrumentInfo } from "@/stores/sampler";
import { useSamplerService } from "@/composables/useSamplerService";
import { useAudioContext } from "@/composables/useAudioContext";
import { Icon } from "@/components/Icon";
import { PianoKeyboard } from "@/components/PianoKeyboard";

const { t } = useI18n();
const router = useRouter();
const samplerStore = useSamplerStore();
const samplerService = useSamplerService();
const { audioReady, ensureAudioReady } = useAudioContext();

// --- State ---
const searchQuery = ref("");
const selectedCategory = ref<InstrumentCategory | "all">("all");
const activeNotes = ref<Set<number>>(new Set());

// --- Computed ---
const filteredInstruments = computed(() => {
  let result = samplerStore.gmInstrumentCatalog;
  if (selectedCategory.value !== "all") {
    result = result.filter((i) => i.category === selectedCategory.value);
  }
  if (searchQuery.value) {
    const q = searchQuery.value.toLowerCase();
    result = result.filter((i) => i.name.toLowerCase().includes(q) || i.id.toLowerCase().includes(q));
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
  if (!audioReady.value) {
    ensureAudioReady();
    // 等待 AudioContext 就绪
    await new Promise<void>((resolve) => {
      const unwatch = watch(audioReady, (v) => {
        if (v) { unwatch(); resolve(); }
      });
    });
  }

  try {
    await samplerService.loadInstrument(info.id);
  } catch {
    // 错误已由 store 处理
  }
}

function onNoteClick(note: number) {
  if (!samplerStore.isReady) return;
  // Toggle note on/off
  if (activeNotes.value.has(note)) {
    activeNotes.value.delete(note);
    samplerService.stopNote(note);
  } else {
    activeNotes.value.add(note);
    samplerService.playNote(note, 100, 0.5); // 短音 0.5s
  }
}

function goBack() {
  router.push("/home");
}

// --- Lifecycle ---
onMounted(async () => {
  // 默认加载钢琴
  const piano = samplerStore.gmInstrumentCatalog.find(
    (i) => i.id === "acoustic_grand_piano",
  );
  if (piano) {
    await selectInstrument(piano);
  }
});

onUnmounted(() => {
  samplerService.stopAllNotes();
});
</script>

<template>
  <div class="fixed inset-0 flex flex-col bg-base-300 overflow-hidden">
    <!-- ═══ Top Toolbar ═══ -->
    <div class="flex items-center gap-2 px-3 py-2 bg-base-200 border-b border-base-content/10 min-h-[44px]">
      <button
        class="btn btn-sm btn-circle btn-ghost tooltip tooltip-bottom"
        :data-tip="t('common.back')"
        :aria-label="t('common.back')"
        @click="goBack"
      >
        <Icon name="arrow-left" :size="18" aria-hidden="true" />
      </button>
      <span class="font-bold text-base-content/90 text-sm tracking-wide">Sampler</span>

      <div class="flex-1" />

      <!-- Current instrument badge -->
      <span v-if="samplerStore.currentInstrument" class="badge badge-primary badge-sm">
        {{ samplerStore.currentInstrument.name }}
      </span>

      <!-- Loading progress -->
      <div v-if="samplerStore.isLoading" class="flex items-center gap-2">
        <progress
          class="progress progress-primary w-20"
          :value="samplerStore.loadProgress.loaded"
          :max="samplerStore.loadProgress.total"
        ></progress>
        <span class="text-xs text-base-content/60">{{ loadProgressPercent }}%</span>
      </div>

      <!-- Ready indicator -->
      <span v-if="samplerStore.isReady" class="badge badge-success badge-xs">Ready</span>
    </div>

    <!-- ═══ Main Body ═══ -->
    <div class="flex-1 flex min-h-0">
      <!-- ── Sidebar: Category Filter ── -->
      <div class="w-48 bg-base-200 border-r border-base-content/10 flex flex-col shrink-0">
        <div class="p-3 border-b border-base-content/10">
          <input
            v-model="searchQuery"
            type="text"
            :placeholder="t('sampler.searchInstruments', 'Search instruments...')"
            class="input input-sm input-bordered w-full"
          />
        </div>
        <ul class="menu menu-sm flex-1 overflow-y-auto p-2">
          <li>
            <a
              :class="{ 'active': selectedCategory === 'all' }"
              @click="selectedCategory = 'all'"
            >
              {{ t('sampler.allCategories', 'All') }}
              <span class="badge badge-xs badge-ghost">{{ samplerStore.gmInstrumentCatalog.length }}</span>
            </a>
          </li>
          <li v-for="cat in INSTRUMENT_CATEGORIES" :key="cat">
            <a
              :class="{ 'active': selectedCategory === cat }"
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
          <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
            <div
              v-for="inst in filteredInstruments"
              :key="inst.id"
              :class="[
                'card bg-base-200 shadow-sm cursor-pointer hover:shadow-md transition-all',
                samplerStore.currentInstrumentId === inst.id && 'ring-2 ring-primary'
              ]"
              @click="selectInstrument(inst)"
            >
              <div class="card-body p-3">
                <h4 class="text-sm font-medium leading-tight">{{ inst.name }}</h4>
                <div class="flex items-center justify-between mt-1">
                  <span class="text-xs text-base-content/50">{{ inst.category }}</span>
                  <span
                    v-if="samplerStore.instruments[inst.id]?.loaded"
                    class="badge badge-success badge-xs"
                  >✓</span>
                  <span
                    v-else-if="samplerStore.instruments[inst.id]?.loading"
                    class="loading loading-xs loading-spinner"
                  ></span>
                </div>
              </div>
            </div>
          </div>

          <!-- Empty state -->
          <div v-if="filteredInstruments.length === 0" class="text-center py-12 text-base-content/40">
            {{ t('sampler.noInstrumentsFound', 'No instruments found') }}
          </div>
        </div>

        <!-- ── Bottom: Piano Keyboard ── -->
        <div class="bg-base-200 border-t border-base-content/10 px-2 py-1">
          <PianoKeyboard
            :played="[...activeNotes]"
            :clickable="true"
            @note-click="(midi: number) => onNoteClick(midi)"
          />
        </div>
      </div>
    </div>
  </div>
</template>
