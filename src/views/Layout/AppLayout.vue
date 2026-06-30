<template>
  <div class="w-full flex-1 min-h-0 flex flex-col overflow-hidden">
    <BlackholeBackground ref="blackholeBgRef" />
    <RouterView />
  </div>
</template>

<script setup lang="ts">
import { ref, provide } from "vue";
import { RouterView } from "vue-router";
import BlackholeBackground from "@/views/Blackhole/BlackholeBackground.vue";

const blackholeBgRef = ref<InstanceType<typeof BlackholeBackground>>();

provide("blackholeBg", blackholeBgRef);
</script>
