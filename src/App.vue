<script setup lang="ts">
import { RouterView } from "vue-router";
import TopBar from "@/views/Layout/TopBar.vue";
import BottomBar from "@/views/Layout/BottomBar.vue";
</script>

<template>
<div class="flex flex-col h-screen bg-base-200">
  <TopBar class="flex-shrink-0 h-16" />
  <main class="flex-1">
    <RouterView />
  </main>
  <BottomBar class="flex-shrink-0 h-10" />
</div>
</template>
