<template>
  <g class="degreeLabels pointer-events-none">
    <DegreeLabel
      v-for="degree in degrees"
      :key="degree.label"
      :anchor="props.scale === 'minor' ? 'right' : 'left'"
      :offset="degree.offset"
      :section="degree.section"
      :label="degree.label"
      :display-suspended="degree.displaySuspended"
    />
  </g>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { range } from "@/helpers/array";
import { Sections, CircleOfFifthsConfig } from "../types";
import { getDegreePosition } from "../utils";
import DegreeLabel from "./DegreeLabel.vue";

const props = withDefaults(
  defineProps<{
    scale: "major" | "minor";
    sections: Sections;
    config?: CircleOfFifthsConfig;
  }>(),
  {
    config: () => ({}),
  },
);

const degrees = computed(() => {
  return range(0, 6)
    .map((degree) => {
      const position = getDegreePosition(props.scale, degree, props.config);
      if (!position) return null;

      const [sectionType, offset, label] = position;
      const section = props.sections[sectionType];
      const displaySuspended =
        (sectionType === "major" || sectionType === "minor") &&
        props.config?.displaySuspended;

      return {
        label,
        offset,
        section,
        displaySuspended,
      };
    })
    .filter((d): d is NonNullable<typeof d> => d !== null);
});
</script>
