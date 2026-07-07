<template>
  <div
    class="card bg-base-100/60 backdrop-blur-md shadow-lg border border-base-200/30 px-4 py-2 min-w-[400px]"
  >
    <div class="flex items-center gap-3">
      <!-- 录制控制 -->
      <div class="flex items-center gap-1">
        <button
          class="btn btn-circle btn-sm"
          :class="{ 'btn-error': isRecording }"
          :aria-label="t('waterfallPiano.record')"
          :title="t('waterfallPiano.record') + ' (Space)'"
          @click="$emit('toggleRecord')"
        >
          <span class="text-xs">●</span>
        </button>
        <button
          class="btn btn-circle btn-sm btn-ghost"
          :aria-label="t('waterfallPiano.stop')"
          :title="t('waterfallPiano.stop')"
          @click="$emit('stopAll')"
        >
          <span class="text-xs">■</span>
        </button>
        <button
          class="btn btn-circle btn-sm"
          :class="{ 'btn-success': isPlaying }"
          :disabled="!hasContent"
          :aria-label="
            isPlaying ? t('waterfallPiano.pause') : t('waterfallPiano.play')
          "
          :title="
            (isPlaying ? t('waterfallPiano.pause') : t('waterfallPiano.play')) +
            ' (Enter)'
          "
          @click="$emit('togglePlayback')"
        >
          <span class="text-xs">{{ isPlaying ? '❚❚' : '▶' }}</span>
        </button>
      </div>

      <div class="divider divider-horizontal mx-0 h-6" />

      <!-- 进度条（所有回放都显示） -->
      <div
        v-if="hasContent"
        class="flex items-center gap-2 flex-1 min-w-[120px]"
      >
        <span class="text-xs opacity-50 font-mono w-10 text-right">{{
          formatTime(currentTime)
        }}</span>
        <input
          type="range"
          class="range range-xs range-primary flex-1"
          min="0"
          :max="duration"
          step="0.1"
          :value="currentTime"
          :disabled="!seekable"
          @input="onSeek"
        />
        <span class="text-xs opacity-50 font-mono w-10">{{
          formatTime(duration)
        }}</span>
      </div>

      <div class="divider divider-horizontal mx-0 h-6" />

      <!-- MIDI 导入 -->
      <button
        class="btn btn-ghost btn-sm gap-1"
        :aria-label="t('waterfallPiano.importMidi')"
        @click="fileInput?.click()"
      >
        <span class="text-xs">⬆</span>
        <span class="text-xs">MIDI</span>
      </button>
      <input
        ref="fileInput"
        type="file"
        accept=".mid,.midi"
        class="hidden"
        @change="onFileSelected"
      />

      <!-- 录制状态 -->
      <div v-if="isRecording" class="badge badge-error badge-sm animate-pulse">
        REC
      </div>

      <!-- 已录制音符数 -->
      <div
        v-if="noteCount > 0 && !midiFileName"
        class="badge badge-success badge-sm"
      >
        {{ noteCount }} notes
      </div>

      <!-- MIDI 文件名 -->
      <span v-if="midiFileName" class="text-xs opacity-50 truncate max-w-32">
        {{ midiFileName }}
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, toRef } from "vue";
import { useI18n } from "vue-i18n";
import { useWaterfallPianoStore } from "../stores/waterfallPiano";

const { t } = useI18n();
const store = useWaterfallPianoStore();
const fileInput = ref<HTMLInputElement>();

const isRecording = toRef(store, "isRecording");
const isPlaying = toRef(store, "isPlaying");
const noteCount = computed(() => store.recordedNotes.length);
const midiFileName = computed(() => store.currentMidiFileName);

const duration = ref(0);
const currentTime = ref(0);
const seekable = ref(false);

const hasContent = computed(
  () => noteCount.value > 0 || midiFileName.value !== "",
);

const emit = defineEmits<{
  toggleRecord: [];
  stopAll: [];
  togglePlayback: [];
  importMidi: [file: File];
  seek: [seconds: number];
}>();

function onFileSelected(e: Event) {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  if (file) {
    emit("importMidi", file);
  }
  input.value = "";
}

function onSeek(e: Event) {
  const input = e.target as HTMLInputElement;
  const seconds = parseFloat(input.value);
  emit("seek", seconds);
}

function setProgress(_progress: number, seconds: number) {
  currentTime.value = seconds;
}

function setMidiInfo(name: string, dur: number) {
  store.currentMidiFileName = name;
  duration.value = dur;
  seekable.value = true;
}

function setDuration(dur: number) {
  duration.value = dur;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

defineExpose({ setProgress, setMidiInfo, setDuration });
</script>
