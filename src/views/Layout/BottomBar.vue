<template>

  <nav class="bottom-bar">
    <grid class="grid grid-cols-2">
      <!-- 快速调性切换工具栏 -->
      <QuickChangeKeyToolbar />
      <!-- MIDI 延迟监控器 -->
      <LatencyMonitor />
    </grid>
  </nav>
</template>

<script setup lang="ts">
// 导入底部栏子组件
import QuickChangeKeyToolbar from "./QuickChangeKeyToolbar.vue";
import LatencyMonitor from "./LatencyMonitor.vue";
</script>
