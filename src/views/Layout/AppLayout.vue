<template>
  <div class="w-full flex-1 min-h-0 flex flex-col overflow-hidden">
    <MotionPageTransition :route-key="topLevelKey">
      <RouterView />
    </MotionPageTransition>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { RouterView, useRoute } from "vue-router";
import { MotionPageTransition } from "@/components/motion";

const route = useRoute();
// 仅顶层路由变化时触发转场，避免与子路由（Settings / ChordDictionary）内部转场叠加
const topLevelKey = computed(() => "/" + (route.path.split("/")[1] ?? ""));
</script>
