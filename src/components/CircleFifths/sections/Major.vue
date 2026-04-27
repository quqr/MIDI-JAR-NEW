<template>
  <g :class="majorClasses" @click="handleClick">
    <path
      class="sector"
      :d="
        drawSection(
          CX,
          CY,
          section.start,
          section.end,
          (value - (0.5 - suspendedOffset)) / 12,
          (value + (0.5 - suspendedOffset)) / 12,
        )
      "
      stroke-width="0.5"
    />
    <circle
      class="badge"
      :cx="polar(CX, CY, section.middle, value / 12)[0]"
      :cy="polar(CX, CY, section.middle, value / 12)[1]"
      r="3.6"
    />
    <SectionLabel
      :value="value"
      :rotation="rotation"
      :radius="section.middle"
      :font-size="4"
      :label="label"
      :tonic="keySignature?.tonic"
      quality="major"
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
  SUSPENDED_OFFSET,
  polar,
  drawSection,
  isInScale,
  isChordPressed,
  isNotePressed,
  isMainSection,
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

const suspendedOffset = computed(() =>
  props.config.displaySuspended ? SUSPENDED_OFFSET : 0,
);

const handleClick = () => props.onClick(props.value);

const majorClasses = computed(() => [
  "key",
  "key--major",
  { "key--isMainSection": isMainSection("major", props.config) },
  { "key--selected": props.value === props.current },
  {
    "key--isInScale":
      props.config?.highlightInScale && isInScale(props.current, props.value),
  },
  {
    "key--active":
      props.config.highlightSector === "notes"
        ? isNotePressed(props.label[0], props.notes)
        : isChordPressed(props.label[0], "major", props.chord, props.config),
  },
  { "key--multiple": props.label.length > 1 },
]);
</script>
