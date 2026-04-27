<template>
  <g :class="['alterations', { 'alterations--selected': value === current }]">
    <path
      :id="`alteration_${value}_followpath`"
      class="followPath"
      :d="
        drawArc(CX, CY, section.middle, (value - 0.5) / 12, (value + 0.5) / 12)
      "
    />
    <text
      v-if="labels.length > 1"
      :class="{ 'alteration--selected': isKeySelected(value, 0, tonic) }"
      font-size="3"
      text-anchor="middle"
    >
      <textPath :href="`#alteration_${value}_followpath`" start-offset="33%">
        {{ formatSharpsFlats(labels[0]) }}
      </textPath>
    </text>
    <text
      v-if="labels.length > 1"
      :class="{ 'alteration--selected': isKeySelected(value, 1, tonic) }"
      font-size="3"
      text-anchor="middle"
    >
      <textPath :href="`#alteration_${value}_followpath`" start-offset="66%">
        {{ formatSharpsFlats(labels[1]) }}
      </textPath>
    </text>
    <text
      v-else
      class="alteration--selected"
      font-size="3"
      text-anchor="middle"
    >
      <textPath :href="`#alteration_${value}_followpath`" start-offset="50%">
        {{ formatSharpsFlats(labels[0]) }}
      </textPath>
    </text>
  </g>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { formatSharpsFlats } from "@/helpers/note";
import { Section } from "../types";
import { CX, CY, drawArc, isKeySelected } from "../utils";

const props = defineProps<{
  value: number;
  current: number;
  label: string | string[];
  section: Section;
  tonic: string | undefined;
}>();

const labels = computed(() =>
  Array.isArray(props.label) ? props.label : [props.label],
);
</script>
