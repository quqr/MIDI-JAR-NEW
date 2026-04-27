<template>
  <g :class="diminishedClasses" @click="handleClick">
    <path
      class="sector"
      :d="
        drawSection(
          CX,
          CY,
          section.start,
          section.end,
          (value - 0.5) / 12,
          (value + 0.5) / 12,
        )
      "
      stroke-width="0.5"
    />
    <circle
      class="badge"
      :cx="polar(CX, CY, section.middle, value / 12)[0]"
      :cy="polar(CX, CY, section.middle, value / 12)[1]"
      r="3"
    />
    <SectionLabel
      :rotation="rotation"
      :radius="section.middle"
      :value="value"
      :font-size="3"
      :label="label"
      :tonic="keySignature?.tonic"
      quality="dim"
    />
  </g>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { Chord } from "@tonaljs/chord";
import { KeySignatureConfig } from "@/helpers/note";
import { Section, CircleOfFifthsConfig } from "../types";
import {
  CX,
  CY,
  polar,
  drawSection,
  isChordPressed,
  isNotePressed,
} from "../utils";
import SectionLabel from "./Label.vue";

const props = withDefaults(
  defineProps<{
    label: string[];
    value: number;
    current: number;
    rotation: number;
    section: Section;
    onClick: (value: number) => void;
    chord?: Chord | null;
    notes?: string[];
    keySignature?: KeySignatureConfig;
    config: CircleOfFifthsConfig;
  }>(),
  {
    chord: undefined,
    notes: undefined,
    keySignature: undefined,
  },
);

const emit = defineEmits<{
  click: [value: number];
}>();

const handleClick = () => props.onClick(props.value);

const diminishedClasses = computed(() => [
  "key",
  "key--diminished",
  { "key--selected": props.value === props.current },
  {
    "key--active":
      props.config.highlightSector === "notes"
        ? isNotePressed(props.label[0], props.notes)
        : isChordPressed(props.label[0], "dim", props.chord, props.config),
  },
  { "key--multiple": props.label.length > 1 },
]);
</script>
