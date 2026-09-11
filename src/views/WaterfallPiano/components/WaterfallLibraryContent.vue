<template>
  <!-- 资料内容（ADR 0025）：显示模式、MIDI/MusicXML 加载、播放选项与音轨选择。
       纯内容组件——抽屉外壳（遮罩/滑入/关闭）由 WaterfallSidePanel 提供，
       本组件只负责分组内容与事件上报，可在任意容器里复用。 -->
  <div class="p-4 space-y-5">
    <!-- 显示模式 -->
    <section class="space-y-2">
      <h3
        class="text-xs font-semibold uppercase tracking-wide text-base-content/50"
      >
        {{ t("WaterfallPiano.midiDrawer.mode") }}
      </h3>
      <div class="join w-full">
        <button
          class="btn btn-sm join-item flex-1"
          :class="mode === 'realtime' ? 'btn-primary' : 'btn-outline'"
          @click="$emit('update:mode', 'realtime')"
        >
          {{ t("WaterfallPiano.midiDrawer.realtime") }}
        </button>
        <button
          class="btn btn-sm join-item flex-1"
          :class="mode === 'synthesia' ? 'btn-primary' : 'btn-outline'"
          @click="$emit('update:mode', 'synthesia')"
        >
          {{ t("WaterfallPiano.midiDrawer.synthesia") }}
        </button>
      </div>
    </section>

    <!-- 文件加载：MIDI / MusicXML -->
    <section class="space-y-2">
      <h3
        class="text-xs font-semibold uppercase tracking-wide text-base-content/50"
      >
        {{ t("WaterfallPiano.library.files") }}
      </h3>
      <label class="btn btn-sm btn-outline w-full justify-start">
        <Icon name="midi" :size="14" />
        {{ t("WaterfallPiano.midiDrawer.loadFile") }}
        <input
          type="file"
          accept=".mid,.midi"
          class="hidden"
          @change="(e) => onFileSelect(e, 'midi')"
        />
      </label>
      <label class="btn btn-sm btn-outline w-full justify-start">
        <Icon name="book" :size="14" />
        {{ t("WaterfallPiano.library.loadMusicXml") }}
        <input
          type="file"
          accept=".musicxml,.xml,.mxl"
          class="hidden"
          @change="(e) => onFileSelect(e, 'musicxml')"
        />
      </label>
      <p v-if="fileName" class="text-xs text-base-content/60 truncate">
        {{ fileName }}
      </p>
    </section>

    <!-- 播放选项 -->
    <section class="space-y-2">
      <h3
        class="text-xs font-semibold uppercase tracking-wide text-base-content/50"
      >
        {{ t("WaterfallPiano.library.playbackOptions") }}
      </h3>
      <div class="space-y-1">
        <div class="flex items-center justify-between text-sm">
          <span>{{ t("WaterfallPiano.library.speed") }}</span>
          <span class="tabular-nums text-base-content/60">
            {{ playbackSpeed.toFixed(2) }}x
          </span>
        </div>
        <input
          type="range"
          min="0.25"
          max="2"
          step="0.05"
          :value="playbackSpeed"
          class="range range-xs range-primary w-full"
          :aria-label="t('WaterfallPiano.library.speed')"
          @input="
            $emit(
              'set-speed',
              parseFloat(($event.target as HTMLInputElement).value),
            )
          "
        />
      </div>
      <div class="flex items-center justify-between text-sm py-1">
        <span>{{ t("WaterfallPiano.library.loop") }}</span>
        <input
          type="checkbox"
          :checked="loop"
          class="toggle toggle-primary toggle-sm"
          @change="$emit('toggle-loop')"
        />
      </div>
    </section>

    <!-- 音轨选择（仅 MIDI 文件） -->
    <section v-if="tracks.length > 0" class="space-y-2">
      <h3
        class="text-xs font-semibold uppercase tracking-wide text-base-content/50"
      >
        {{ t("WaterfallPiano.library.tracks") }}
      </h3>
      <div class="space-y-1 max-h-48 overflow-y-auto pr-1">
        <label
          v-for="track in tracks"
          :key="track.index"
          class="label cursor-pointer justify-start gap-2 py-1"
        >
          <input
            type="checkbox"
            :checked="selectedTracks.includes(track.index)"
            class="checkbox checkbox-xs checkbox-primary"
            @change="onTrackToggle(track.index)"
          />
          <span class="text-xs">
            {{ track.name || t("WaterfallPiano.library.trackFallback", { n: track.index + 1 }) }}
            <span class="opacity-60">({{ track.noteCount }})</span>
          </span>
        </label>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
/**
 * 资料内容（ADR 0025）：原左侧资料面板（WaterfallLibraryPanel）去掉抽屉外壳
 * 后的纯内容部分，供合并面板（WaterfallSidePanel）的「资料」页签使用。
 *
 * 不持有开合状态、不监听 Esc、不做 Teleport —— 这些属于外壳职责。
 */
import { useI18n } from "vue-i18n";
import Icon from "@/components/Icon/Icon.vue";
import type { MidiTrackInfo } from "../types";
import type { NoteBlockMode } from "../engine/NoteBlockSystem";

const props = defineProps<{
  mode: NoteBlockMode;
  fileName: string;
  tracks: MidiTrackInfo[];
  selectedTracks: number[];
  playbackSpeed: number;
  loop: boolean;
}>();

const emit = defineEmits<{
  (e: "update:mode", mode: NoteBlockMode): void;
  (e: "load-midi", file: File): void;
  (e: "load-music-xml", file: File): void;
  (e: "select-tracks", indices: number[]): void;
  (e: "set-speed", speed: number): void;
  (e: "toggle-loop"): void;
}>();

const { t } = useI18n();

function onFileSelect(e: Event, kind: "midi" | "musicxml") {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  if (file) {
    if (kind === "midi") {
      emit("load-midi", file);
    } else {
      emit("load-music-xml", file);
    }
  }
  input.value = "";
}

function onTrackToggle(index: number) {
  const current = [...props.selectedTracks];
  const idx = current.indexOf(index);
  if (idx >= 0) {
    current.splice(idx, 1);
  } else {
    current.push(index);
  }
  emit("select-tracks", current);
}
</script>
