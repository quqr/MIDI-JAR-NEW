<template>
  <ChordDisplayModule v-if="moduleId" :moduleId="moduleId" />
  <slot />
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useRoute } from "vue-router";
import ChordDisplayModule from "./ChordDisplayModule.vue";

const route = useRoute();

const moduleId = computed(() => {
  return (route.params.moduleId as string) || "";
});
</script>
