<template>
  <text
    class="name name--sus"
    :x="polar(CX, CY, section.middle, angle)[0]"
    :y="polar(CX, CY, section.middle, angle)[1]"
    text-anchor="middle"
    :font-size="fontSize"
    :dy="0.33 * fontSize"
    :transform="`rotate(${angle * 360 + (quality === 'sus4' ? -90 : 90)}, ${cPolar(
      CX,
      CY,
      section.middle,
      angle,
    )})`"
  >
    {{
      formatLabel(
        getNoteInKeySignature(labels[0], keySignature?.notes),
        quality,
      )
    }}
  </text>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { KeySignatureConfig, getNoteInKeySignature } from "@/helpers/note";
import { Section } from "../types";
import { CX, CY, SUSPENDED_OFFSET, polar, cPolar, formatLabel } from "../utils";

const props = withDefaults(
  defineProps<{
    value: number;
    label: string | string[];
    section: Section;
    fontSize: number;
    keySignature?: KeySignatureConfig;
    quality: string;
  }>(),
  {
    keySignature: undefined,
  },
);

const labels = computed(() =>
  Array.isArray(props.label) ? props.label : [props.label],
);

const angle = computed(() =>
  props.quality === "sus4"
    ? (props.value - (0.5 - SUSPENDED_OFFSET / 2)) / 12
    : (props.value + (0.5 - SUSPENDED_OFFSET / 2)) / 12,
);
</script>
