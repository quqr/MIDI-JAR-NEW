<template>
  <polygon
    :points="drawRegularPolygon(3, origin[0], origin[1], 2, 0)"
    class="arrow"
  />
</template>

<script setup lang="ts">
import { computed } from "vue";
import { Section } from "../types";
import { CX, CY, polar, drawRegularPolygon } from "../utils";

const props = defineProps<{
  section: Section;
}>();

const origin = computed(() => polar(CX, CY, props.section.start - 2, 0));
</script>
