<template>
  <!-- 瀑布流合并面板（ADR 0025）：资料与设置合并进同一个右侧抽屉，
       顶部页签切换，两组内容各自独立滚动。取代原左侧资料面板
       （WaterfallLibraryPanel）与原右侧设置抽屉（SettingsPanel）。 -->
  <Teleport to="body">
    <transition name="slide-right">
      <aside
        v-if="modelValue"
        class="fixed top-0 bottom-0 right-0 z-drawer flex flex-col overflow-hidden bg-base-100/85 backdrop-blur-xl shadow-xl border-l border-base-content/10 w-[400px] max-w-[92vw]"
        role="dialog"
        aria-modal="false"
        :aria-label="t('WaterfallPiano.sidePanel.title')"
      >
        <!-- 头部：页签切换 + 关闭（页签名即标题，不再重复一行标题） -->
        <div
          class="flex-shrink-0 px-4 py-3 flex items-center justify-between gap-2 border-b border-base-300"
        >
          <div class="tabs tabs-box tabs-sm" role="tablist">
            <button
              v-for="item in TABS"
              :key="item.value"
              class="tab"
              :class="{ 'tab-active': tab === item.value }"
              role="tab"
              :aria-selected="tab === item.value"
              :aria-controls="`waterfall-panel-${item.value}`"
              @click="selectTab(item.value)"
            >
              {{ t(item.labelKey) }}
            </button>
          </div>
          <button
            class="btn btn-sm btn-ghost btn-circle"
            :aria-label="t('common.close')"
            @click="close"
          >
            <Icon name="x" :size="16" />
          </button>
        </div>

        <!-- 资料：模式 / 文件 / 播放选项 / 音轨 -->
        <div
          v-show="tab === 'library'"
          id="waterfall-panel-library"
          class="flex-1 min-h-0 overflow-y-auto"
          role="tabpanel"
        >
          <WaterfallLibraryContent
            :mode="mode"
            :file-name="fileName"
            :tracks="tracks"
            :selected-tracks="selectedTracks"
            :playback-speed="playbackSpeed"
            :loop="loop"
            @update:mode="$emit('update:mode', $event)"
            @load-midi="onLoadMidi"
            @load-music-xml="onLoadMusicXml"
            @select-tracks="$emit('select-tracks', $event)"
            @set-speed="$emit('set-speed', $event)"
            @toggle-loop="$emit('toggle-loop')"
          />

          <!-- 视频导出（ADR 0023）：归入资料页签 -->
          <section class="px-4 pb-4 space-y-2">
            <h3
              class="text-xs font-semibold uppercase tracking-wide text-base-content/50"
            >
              {{ t("videoExport.title") }}
            </h3>
            <VideoExportPanel />
          </section>
        </div>

        <!-- 设置：各层级字段（进阶字段仅全局设置页展示，ADR 0024） -->
        <div
          v-show="tab === 'settings'"
          id="waterfall-panel-settings"
          class="flex-1 min-h-0 overflow-y-auto p-4"
          role="tabpanel"
        >
          <WaterfallSettingsContent />
        </div>
      </aside>
    </transition>
  </Teleport>
</template>

<script setup lang="ts">
/**
 * 瀑布流合并面板（ADR 0025）
 *
 * 一个右侧抽屉承载两组内容，顶部页签切换：
 * - 资料：显示模式、MIDI/MusicXML 加载、播放速度/循环、音轨选择
 * - 设置：瀑布流各层级字段（含视频导出），进阶字段由全局设置页承载
 *
 * 两个页签常驻挂载（v-show），切换时各自保留滚动位置；
 * 抽屉整体在关闭时卸载（v-if），避免离屏表单常驻。
 */
import { watch, onUnmounted } from "vue";
import { useI18n } from "vue-i18n";
import Icon from "@/components/Icon/Icon.vue";
import WaterfallLibraryContent from "./WaterfallLibraryContent.vue";
import WaterfallSettingsContent from "./WaterfallSettingsContent.vue";
import VideoExportPanel from "./VideoExportPanel.vue";
import type { WaterfallPanelTab } from "../composables/useWaterfallUi";
import type { MidiTrackInfo } from "../types";
import type { NoteBlockMode } from "../engine/NoteBlockSystem";

const props = defineProps<{
  /** 面板是否展开（v-model） */
  modelValue: boolean;
  /** 当前页签（v-model:tab） */
  tab: WaterfallPanelTab;
  mode: NoteBlockMode;
  fileName: string;
  tracks: MidiTrackInfo[];
  selectedTracks: number[];
  playbackSpeed: number;
  loop: boolean;
}>();

const emit = defineEmits<{
  (e: "update:modelValue", value: boolean): void;
  (e: "update:tab", value: WaterfallPanelTab): void;
  (e: "update:mode", mode: NoteBlockMode): void;
  (e: "load-midi", file: File): void;
  (e: "load-music-xml", file: File): void;
  (e: "select-tracks", indices: number[]): void;
  (e: "set-speed", speed: number): void;
  (e: "toggle-loop"): void;
}>();

const { t } = useI18n();

/** 页签清单：数组顺序即渲染顺序 */
const TABS: ReadonlyArray<{ value: WaterfallPanelTab; labelKey: string }> = [
  { value: "library", labelKey: "WaterfallPiano.sidePanel.tabLibrary" },
  { value: "settings", labelKey: "WaterfallPiano.sidePanel.tabSettings" },
];

function close() {
  emit("update:modelValue", false);
}

function selectTab(value: WaterfallPanelTab) {
  emit("update:tab", value);
}

/**
 * 文件载入后收起面板：载入即准备播放，让出视野去看方块下落
 * （沿用原资料面板「选完文件即关闭」的行为）。
 */
function onLoadMidi(file: File): void {
  emit("load-midi", file);
  close();
}

function onLoadMusicXml(file: File): void {
  emit("load-music-xml", file);
  close();
}

function onEsc(e: KeyboardEvent) {
  if (e.key !== "Escape") return;
  const target = e.target;
  if (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement
  ) {
    return;
  }
  close();
}

watch(
  () => props.modelValue,
  (open) => {
    if (open) {
      window.addEventListener("keydown", onEsc);
    } else {
      window.removeEventListener("keydown", onEsc);
    }
  },
  { immediate: true },
);

onUnmounted(() => {
  window.removeEventListener("keydown", onEsc);
});
</script>

<style scoped>
.slide-right-enter-active,
.slide-right-leave-active {
  transition:
    transform 0.25s ease,
    opacity 0.25s ease;
}
.slide-right-enter-from,
.slide-right-leave-to {
  transform: translateX(100%);
  opacity: 0;
}
</style>
