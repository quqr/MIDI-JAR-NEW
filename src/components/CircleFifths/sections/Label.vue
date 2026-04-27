<template>
  <template v-if="labels.length > 1">
    <text
      :class="['name', { 'name--selected': isKeySelected(value, 0, tonic) }]"
      :x="polar(CX, CY, radius, value / 12)[0]"
      :y="polar(CX, CY, radius, value / 12)[1]"
      text-anchor="middle"
      :font-size="fontSize / 1.5"
      :dy="-0.1 * fontSize"
      :dx="-0.25 * fontSize"
      :transform="`rotate(${rotation}, ${cPolar(CX, CY, radius, value / 12)})`"
    >
      {{ formatLabel(labels[0], quality) }}
    </text>
    <text
      :class="['name', { 'name--selected': isKeySelected(value, 1, tonic) }]"
      :x="polar(CX, CY, radius, value / 12)[0]"
      :y="polar(CX, CY, radius, value / 12)[1]"
      text-anchor="middle"
      :font-size="fontSize / 1.5"
      :dy="0.6 * fontSize"
      :dx="0.25 * fontSize"
      :transform="`rotate(${rotation}, ${cPolar(CX, CY, radius, value / 12)})`"
    >
      {{ formatLabel(labels[1], quality) }}
    </text>
  </template>
  <text
    v-else
    class="name"
    :x="polar(CX, CY, radius, value / 12)[0]"
    :y="polar(CX, CY, radius, value / 12)[1]"
    text-anchor="middle"
    :font-size="fontSize"
    :dy="0.33 * fontSize"
    :transform="`rotate(${rotation}, ${cPolar(CX, CY, radius, value / 12)})`"
  >
    {{ formatLabel(labels[0], quality) }}
  </text>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { CX, CY, polar, cPolar, isKeySelected, formatLabel } from "../utils";

const props = withDefaults(
  defineProps<{
    value: number;
    label: string | string[];
    rotation: number;
    radius: number;
    fontSize: number;
    tonic?: string;
    quality: string;
  }>(),
  {
    tonic: undefined,
  },
);

const labels = computed(() =>
  Array.isArray(props.label) ? props.label : [props.label],
);
</script>
