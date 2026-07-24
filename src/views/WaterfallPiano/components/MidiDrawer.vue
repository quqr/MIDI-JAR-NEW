<template>
  <Teleport to="body">
    <MotionDrawer
      :is-open="modelValue"
      side="right"
      :width="320"
      @close="close"
    >
      <div
        class="flex flex-col flex-1 min-h-0"
        role="dialog"
        aria-modal="false"
        :aria-label="t('WaterfallPiano.midiDrawer.title')"
      >
        <!-- 标题栏 -->
        <div
          class="flex-shrink-0 px-4 py-3 flex items-center justify-between border-b border-base-300"
        >
          <h2 class="text-hig-lg font-bold">
            {{ t("WaterfallPiano.midiDrawer.title") }}
          </h2>
          <button
            class="btn btn-sm btn-ghost btn-circle tooltip tooltip-bottom"
            data-tip="关闭"
            @click="close"
          >
            <Icon name="x" :size="16" />
          </button>
        </div>

        <div class="flex-1 min-h-0 overflow-y-auto p-4 space-y-4">
          <!-- 模式选择 -->
          <div class="form-control">
            <label class="label">
              <span class="label-text font-semibold text-hig-sm">{{
                t("WaterfallPiano.midiDrawer.mode")
              }}</span>
            </label>
            <div class="join w-full">
              <button
                class="btn btn-xs join-item flex-1"
                :class="mode === 'realtime' ? 'btn-primary' : 'btn-outline'"
                @click="$emit('update:mode', 'realtime')"
              >
                {{ t("WaterfallPiano.midiDrawer.realtime") }}
              </button>
              <button
                class="btn btn-xs join-item flex-1"
                :class="mode === 'synthesia' ? 'btn-primary' : 'btn-outline'"
                @click="$emit('update:mode', 'synthesia')"
              >
                {{ t("WaterfallPiano.midiDrawer.synthesia") }}
              </button>
            </div>
          </div>

          <!-- MIDI 文件加载 -->
          <div class="form-control">
            <label class="label">
              <span class="label-text font-semibold text-hig-sm">{{
                t("WaterfallPiano.midiDrawer.midiFile")
              }}</span>
            </label>
            <label class="btn btn-sm btn-outline w-full">
              <Icon name="upload" :size="14" />
              {{ t("WaterfallPiano.midiDrawer.loadFile") }}
              <input
                type="file"
                accept=".mid,.midi"
                class="hidden"
                @change="onFileSelect"
              />
            </label>
            <div
              v-if="fileName"
              class="text-hig-xs mt-1 text-base-content/70 truncate"
            >
              {{ fileName }}
            </div>
          </div>

          <!-- 播放控制 -->
          <div class="form-control">
            <label class="label">
              <span class="label-text font-semibold text-hig-sm">{{
                t("WaterfallPiano.midiDrawer.playback")
              }}</span>
            </label>
            <div class="flex gap-2">
              <button
                class="btn btn-sm btn-circle tooltip tooltip-bottom"
                data-tip="播放"
                :class="isPlaying && !isPaused ? 'btn-primary' : 'btn-ghost'"
                :disabled="!hasContent || isPlaying"
                @click="$emit('play')"
              >
                <Icon name="play" :size="14" />
              </button>
              <button
                class="btn btn-sm btn-circle btn-ghost tooltip tooltip-bottom"
                data-tip="暂停"
                :disabled="!isPlaying"
                @click="$emit('pause')"
              >
                <Icon name="pause" :size="14" />
              </button>
              <button
                class="btn btn-sm btn-circle btn-ghost tooltip tooltip-bottom"
                data-tip="停止"
                :disabled="!isPlaying && !isPaused"
                @click="$emit('stop')"
              >
                <Icon name="stop" :size="14" />
              </button>
              <button
                class="btn btn-sm btn-circle tooltip tooltip-bottom"
                data-tip="录制"
                :class="isRecording ? 'btn-error' : 'btn-ghost'"
                @click="$emit('toggle-record')"
              >
                <Icon name="circle" :size="14" />
              </button>
            </div>
          </div>

          <!-- 播放速度 -->
          <div class="form-control">
            <label class="label">
              <span class="label-text font-semibold text-hig-sm">速度</span>
              <span class="label-text-alt tabular"
                >{{ playbackSpeed.toFixed(1) }}x</span
              >
            </label>
            <input
              type="range"
              min="0.25"
              max="2"
              step="0.05"
              :value="playbackSpeed"
              class="range range-xs range-primary"
              @input="
                $emit(
                  'set-speed',
                  parseFloat(($event.target as HTMLInputElement).value),
                )
              "
            />
          </div>

          <!-- 循环开关 -->
          <div class="form-control">
            <label class="label cursor-pointer">
              <span class="label-text font-semibold text-hig-sm">循环</span>
              <input
                type="checkbox"
                :checked="loop"
                class="toggle toggle-primary toggle-sm"
                @change="$emit('toggle-loop')"
              />
            </label>
          </div>

          <!-- 音轨选择 -->
          <div v-if="tracks.length > 0" class="form-control">
            <label class="label">
              <span class="label-text font-semibold text-hig-sm">音轨</span>
            </label>
            <div class="space-y-1 max-h-40 overflow-y-auto">
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
                <span class="label-text text-hig-xs">
                  {{ track.name || `Track ${track.index + 1}` }}
                  <span class="opacity-60"
                    >({{ track.noteCount }} notes)</span
                  >
                </span>
              </label>
            </div>
          </div>
        </div>
      </div>
    </MotionDrawer>
  </Teleport>
</template>

<script setup lang="ts">
import { watch, onUnmounted } from "vue";
import { useI18n } from "vue-i18n";
import Icon from "@/components/Icon/Icon.vue";
import { MotionDrawer } from "@/components/motion";
import type { MidiTrackInfo } from "../types";
import type { NoteBlockMode } from "../engine/NoteBlockSystem";

const props = defineProps<{
  modelValue: boolean;
  mode: NoteBlockMode;
  isRecording: boolean;
  isPlaying: boolean;
  isPaused: boolean;
  currentTime: number;
  duration: number;
  fileName: string;
  tracks: MidiTrackInfo[];
  selectedTracks: number[];
  playbackSpeed: number;
  loop: boolean;
  hasContent: boolean;
}>();

const emit = defineEmits<{
  (e: "update:modelValue", value: boolean): void;
  (e: "update:mode", mode: NoteBlockMode): void;
  (e: "toggle-record"): void;
  (e: "play"): void;
  (e: "pause"): void;
  (e: "stop"): void;
  (e: "seek", seconds: number): void;
  (e: "load-midi", file: File): void;
  (e: "select-tracks", indices: number[]): void;
  (e: "set-speed", speed: number): void;
  (e: "toggle-loop"): void;
}>();

const { t } = useI18n();

function close() {
  emit("update:modelValue", false);
}

function onFileSelect(e: Event) {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  if (file) {
    emit("load-midi", file);
    close();
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
