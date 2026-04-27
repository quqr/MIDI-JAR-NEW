<template>
  <g :class="suspendedClasses" @click="handleClick">
    <path
      class="sector"
      :d="
        drawSection(
          CX,
          CY,
          section.start,
          section.end,
          (value + anchor * 0.5) / 12,
          (value + anchor * (0.5 - SUSPENDED_OFFSET)) / 12,
        )
      "
      stroke-width="0.5"
    />
    <SectionSusLabel
      :value="value"
      :section="section"
      :font-size="1.5"
      :label="label"
      :key-signature="keySignature"
      :quality="quality"
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
  FIFTHS_MAJOR,
  FIFTHS_MINOR,
  drawSection,
  isSusInScale,
  isChordPressed,
} from "../utils";
import SectionSusLabel from "./SusLabel.vue";

const props = withDefaults(
  defineProps<{
    value: number;
    current: number;
    section: Section;
    sectionType: "major" | "minor";
    quality: "sus2" | "sus4";
    onClick: (value: number) => void;
    chord?: Chord | null;
    keySignature?: KeySignatureConfig;
    config: CircleOfFifthsConfig;
  }>(),
  {
    chord: undefined,
    keySignature: undefined,
  },
);

const anchor = computed(() => (props.quality === "sus2" ? 1 : -1));
const label = computed(() =>
  props.sectionType === "minor"
    ? FIFTHS_MINOR[props.value]
    : FIFTHS_MAJOR[props.value],
);

const handleClick = () => props.onClick(props.value);

const suspendedClasses = computed(() => [
  "key",
  "key--suspended",
  { "key--selected": props.value === props.current },
  {
    "key--isInScale": isSusInScale(
      props.current,
      props.value,
      props.quality,
      props.sectionType,
    ),
  },
  {
    "key--active": isChordPressed(
      label.value[0],
      props.quality,
      props.chord,
      props.config,
    ),
  },
]);
</script>
