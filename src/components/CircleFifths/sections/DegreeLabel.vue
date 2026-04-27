<template>
  <text
    class="degreeLabel"
    :x="coords[0]"
    :y="coords[1]"
    :text-anchor="anchor === 'left' ? 'start' : 'end'"
    :font-size="fontSize"
    :transform="`rotate(${(value + angleOffset) * 30}, ${coords[0]}, ${coords[1]})`"
  >
    {{ formatSharpsFlats(label) }}
  </text>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { formatSharpsFlats } from "@/helpers/note";
import { Section } from "../types";
import { CX, CY, SUSPENDED_OFFSET, polar } from "../utils";

const props = withDefaults(
  defineProps<{
    offset: number;
    section: Section;
    label: string;
    anchor?: "left" | "right";
    displaySuspended?: boolean;
  }>(),
  {
    anchor: "left",
    displaySuspended: false,
  },
);

const value = computed(() =>
  props.offset < 0 ? 12 + props.offset : props.offset,
);
const suspendedOffset = computed(() =>
  props.displaySuspended ? SUSPENDED_OFFSET : 0,
);
const angleOffset = computed(() =>
  props.anchor === "left"
    ? -0.46 + suspendedOffset.value
    : 0.46 - suspendedOffset.value,
);
const fontSize = computed(() => (props.section.start - props.section.end) / 7);
const wheelOffset = computed(() => -1.2 * fontSize.value);
const coords = computed(() =>
  polar(
    CX,
    CY,
    props.section.start + wheelOffset.value,
    (value.value + angleOffset.value) / 12,
  ),
);
</script>
