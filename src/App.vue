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
    class="alert alert-warning m-2"
    role="alert"
  >
    <span
      >当前浏览器不支持 Web MIDI API，请使用 Chrome 或 Edge 以获得完整 MIDI
      体验</span
    >
    <button
      class="btn btn-ghost btn-xs"
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
