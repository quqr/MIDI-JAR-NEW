<template>
  <div class="sticky bottom-0 z-40 bg-base-200 shadow-md p-3">
    <div class="flex flex-wrap items-start gap-3">
      <!-- 快速调性切换工具栏 -->
      <!-- MIDI 延迟监控器 -->
      <!-- <LatencyMonitor class="flex-shrink-0" /> -->
      <!-- <span
        v-if="midiDevices.length === 0"
        class="midi-device midi-device--empty"
      >
        {{ $t("topBar.noMidiDevices") }}
      </span> -->
    </div>
  </div>
</template>

<script setup lang="ts"></script>
