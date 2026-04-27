<template>
  <g class="modes">
    <g v-for="(offset, index) in MODE_OFFSETS" class="mode" :key="index">
      <path
        :id="`mode_${index}_followpath`"
        class="followPath"
        :d="
          drawArc(
            CX,
            CY,
            section.middle,
            (offset + scaleOffset - 0.5) / 12,
            (offset + scaleOffset + 0.5) / 12,
          )
        "
      />
      <path
        class="modeSeparator"
        :d="
          drawLineSeparator(
            CX,
            CY,
            section.start,
            section.end,
            (offset + scaleOffset - 0.5) / 12,
          )
        "
        :fill="DEGREE_COLORS[index]"
      />
      <text font-size="1.6" text-anchor="start">
        <textPath :href="`#mode_${index}_followpath`" start-offset="2%">
          {{ MODE_NAMES[index] }}
        </textPath>
      </text>
    </g>
  </g>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { Section, CircleOfFifthsConfig } from "../types";
import {
  CX,
  CY,
  DEGREE_COLORS,
  MODE_OFFSETS,
  MODE_NAMES,
  drawArc,
  drawLineSeparator,
} from "../utils";

const props = defineProps<{
  section: Section;
  config: CircleOfFifthsConfig;
}>();

const scale = computed(() => {
  if (props.config?.scale === "major" && props.config?.displayMajor) {
    return "major";
  }
  if (
    (props.config?.scale === "minor" && props.config?.displayMinor) ||
    (props.config?.scale === "major" && !props.config.displayMajor)
  ) {
    return "minor";
  }
  return "major";
});

const scaleOffset = computed(() => (scale.value === "minor" ? -3 : 0));
</script>
