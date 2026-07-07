<template>
  <div class="flex items-center justify-center gap-2 overflow-x-auto py-2">
    <div
      v-for="(interval, index) in INTERVALS.BASE"
      :key="interval"
      class="flex flex-col items-center justify-center rounded-md transition-all duration-hig-fast"
      :class="{
        'font-bold': activeAsMap[index] || targetAsMap[index],
        '': activeAsMap[index] || targetAsMap[index] || playedMap[index],
      }"
    >
      <template v-if="activeAsMap[index] || targetAsMap[index]">
        <span class="text-xs font-semibold text-accent">{{
          activeAsMap[index] || targetAsMap[index]
        }}</span>
      </template>
      <template v-else>
        <span class="text-xs text-base-content/60">{{ interval }}</span>
        <span class="text-xs text-base-content/60">{{
          OCTAVE_INTERVALS[index]
        }}</span>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { INTERVALS, getPlayedIntervals, isIncludedAs } from "./utils";

export interface ChordIntervalsProps {
  className?: string;
  intervals?: string[];
  targets?: string[];
  pitchClasses?: string[];
  tonic?: string | null;
  quizMode?: boolean;
}

const props = withDefaults(defineProps<ChordIntervalsProps>(), {
  className: "",
  intervals: () => [],
  targets: () => [],
  pitchClasses: () => [],
  tonic: null,
  quizMode: false,
});

const playedMap = computed(() => {
  const result = getPlayedIntervals(props.tonic, props.pitchClasses);
  return result.map((v: number) => Math.min(4, v));
});

const OCTAVE_INTERVALS = INTERVALS.OCTAVE;

const activeAsMap = computed(() =>
  INTERVALS.BASE.map((i) => isIncludedAs(i, props.intervals)),
);

const targetAsMap = computed(() =>
  INTERVALS.BASE.map((i) => isIncludedAs(i, props.targets)),
);
</script>
