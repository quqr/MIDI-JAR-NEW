<script setup lang="ts">
import { RouterView } from "vue-router";
import AppNavbar from "@/views/Layout/AppNavbar.vue";
import CustomCursor from "@/components/CustomCursor.vue";
</script>

<template>
  <CustomCursor />
  <div class="grid grid-rows-[auto_1fr_auto] h-screen w-screen bg-base-300">
    <AppNavbar />
    <RouterView />

    <!-- <BottomBar /> -->
  </div>
</template>
