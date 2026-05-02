<script setup lang="ts">
import { RouterView } from "vue-router";
import AppNavbar from "@/views/Layout/AppNavbar.vue";
import BottomBar from "@/views/Layout/BottomBar.vue";
import CustomCursor from "@/components/CustomCursor.vue";
</script>

<template>
  <CustomCursor />
  <div class="flex flex-col h-screen bg-base-300">
    <AppNavbar />
    <main class="flex-1 overflow-y-auto main-content scrollbar-thin">
      <RouterView />
    </main>
    <BottomBar />
  </div>
</template>
