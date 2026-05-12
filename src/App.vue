<script setup lang="ts">
import { computed } from "vue";
import { useRoute } from "vue-router";
import { RouterView } from "vue-router";
import AppNavbar from "@/views/Layout/AppNavbar.vue";
import CustomCursor from "@/components/CustomCursor.vue";

const route = useRoute();
const isWidgetRoute = computed(() => route.name === "widget");
</script>

<template>
  <CustomCursor v-if="!isWidgetRoute" />
  <RouterView v-if="isWidgetRoute" />
  <div v-else class="grid grid-rows-[auto_1fr_auto] h-screen w-screen bg-base-300">
    <AppNavbar />
    <RouterView />
  </div>
</template>
