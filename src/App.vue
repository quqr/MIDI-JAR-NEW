<script setup lang="ts">
import { ref } from "vue";
import { RouterView } from "vue-router";
import AppNavbar from "@/views/Layout/AppNavbar.vue";
import CustomCursor from "@/components/CustomCursor.vue";
import { useBrowserSupport } from "@/composables/useBrowserSupport";
import { isTauri } from "@/utils/tauri";

const { showMidiWarning } = useBrowserSupport();
const inTauri = isTauri();
const midiWarningVisible = ref(true);

function dismissMidiWarning() {
  midiWarningVisible.value = false;
}
</script>

<template>
  <CustomCursor />
  <div
    v-if="!inTauri && showMidiWarning && midiWarningVisible"
    class="midi-warning"
    role="alert"
  >
    <span class="midi-warning__accent" aria-hidden="true"></span>
    <span class="midi-warning__text"
      >当前浏览器不支持 Web MIDI API，请使用 Chrome 或 Edge 以获得完整 MIDI
      体验</span
    >
    <button
      class="btn btn-ghost btn-xs midi-warning__close"
      aria-label="关闭"
      @click="dismissMidiWarning"
    >
      ✕
    </button>
  </div>
  <div class="grid grid-rows-[auto_1fr_auto] h-screen w-screen bg-base-100">
    <AppNavbar />
    <RouterView />
  </div>
</template>

<style scoped>
.midi-warning {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.5rem 1rem 0.5rem 0.75rem;
  background-color: var(--hig-warning-container);
  color: var(--color-base-content);
  font-size: var(--text-hig-sm);
  border-left: 3px solid var(--color-warning);
  border-radius: var(--radius-hig-md);
  margin: 0.5rem 0.5rem 0;
}

.midi-warning__accent {
  display: none;
}

.midi-warning__text {
  flex: 1;
}

.midi-warning__close {
  color: color-mix(in oklch, var(--color-base-content) 70%, transparent);
}
</style>
