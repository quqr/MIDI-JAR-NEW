<template>
  <RouterLink :to="to" custom v-slot="{ navigate, href, isActive }">
    <a
      :href="href"
      class="btn btn-ghost btn-sm rounded-lg normal-case font-inherit duration-150"
      :class="{ 'bg-primary/10 text-primary font-semibold': isActive }"
      @click="navigate"
    >
      <slot />
    </a>
  </RouterLink>
</template>

<script setup lang="ts">
import { RouterLink } from "vue-router";

defineProps<{
  to: string;
}>();
</script>
