<template>
  <nav class="bottom-bar">
    <div class="grid grid-cols-1 sm:grid-cols-2">
      <QuickChangeKeyToolbar />
      <LatencyMonitor />
    </div>
  </nav>
</template>

<script setup lang="ts">
// 导入底部栏子组件
import QuickChangeKeyToolbar from "./QuickChangeKeyToolbar.vue";
import LatencyMonitor from "./LatencyMonitor.vue";
</script>
