<template>
  <g :class="['dominants', { 'dominants--selected': current === value }]">
    <template v-for="(l, index) in labels" :key="l">
      <g :class="dominantClasses(index, l)">
        <path
          :id="`dominants_${value}_${index}_followpath`"
          class="followPath"
          :d="
            drawArc(CX, CY, section.middle, angleStart(index), angleEnd(index))
          "
        />
        <path
          class="sector"
          :d="
            drawSection(
              CX,
              CY,
              section.start,
              section.end,
              angleStart(index),
              angleEnd(index),
            )
          "
          stroke-width="0.5"
        />
        <text font-size="2" text-anchor="middle">
          <textPath
            :href="`#dominants_${value}_${index}_followpath`"
            start-offset="50%"
          >
            {{
              formatLabel(getNoteInKeySignature(l, keySignature?.notes), "dom")
            }}
          </textPath>
        </text>
      </g>
    </template>
  </g>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { Chord } from "@tonaljs/chord";
import { getNoteInKeySignature, KeySignatureConfig } from "@/helpers/note";
import { Section, CircleOfFifthsConfig } from "../types";
import {
  CX,
  CY,
  drawArc,
  drawSection,
  isChordPressed,
  formatLabel,
} from "../utils";

const props = withDefaults(
  defineProps<{
    value: number;
    current: number;
    label: string | string[];
    section: Section;
    chord?: Chord | null;
    keySignature?: KeySignatureConfig;
    config: CircleOfFifthsConfig;
  }>(),
  {
    chord: undefined,
    keySignature: undefined,
  },
);

const labels = computed(() =>
  Array.isArray(props.label) ? props.label : [props.label],
);

const angleStart = (index: number) =>
  (props.value - 0.5 + index / labels.value.length) / 12;
const angleEnd = (index: number) =>
  (props.value - 0.5 + (index + 1) / labels.value.length) / 12;

const dominantClasses = (index: number, l: string) => [
  { "dominant--active": isChordPressed(l, "dom", props.chord, props.config) },
  {
    "dominant--isInScale":
      props.config?.highlightInScale &&
      index === 0 &&
      props.current === props.value,
  },
];
</script>
