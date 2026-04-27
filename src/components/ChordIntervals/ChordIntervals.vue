<template>
  <div class="d-flex align-center gap-2 overflow-x-auto py-2">
    <div
      v-for="(interval, index) in INTERVALS.BASE"
      :key="interval"
      class="flex flex-col items-center justify-end rounded-md transition-all duration-200"
      :class="{
        'font-bold': activeAsMap[index] || targetAsMap[index],
        'bg-base-300':
          !activeAsMap[index] && !targetAsMap[index] && !playedMap[index],
      }"
      :style="{
        width: '2.5rem',
        fontSize: '0.75rem',
        lineHeight: '1rem',
        height: heightMap[playedMap[index]] || '50%',
        backgroundColor: bgColors[index],
        transition: 'height 200ms, background-color 200ms',
      }"
    >
      <template v-if="activeAsMap[index] || targetAsMap[index]">
        <span class="text-xs font-semibold text-white">{{
          activeAsMap[index] || targetAsMap[index]
        }}</span>
      </template>
      <template v-else>
        <span class="text-xs text-base-content/80">{{ interval }}</span>
        <span class="text-xs text-base-content/50">{{
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

const heightMap: Record<number, string> = {
  0: "50%",
  1: "60%",
  2: "70%",
  3: "80%",
  4: "90%",
};

const OCTAVE_INTERVALS = INTERVALS.OCTAVE;

const activeAsMap = computed(() =>
  INTERVALS.BASE.map((i) => isIncludedAs(i, props.intervals)),
);

const targetAsMap = computed(() =>
  INTERVALS.BASE.map((i) => isIncludedAs(i, props.targets)),
);

const hasTargets = computed(() => props.targets && props.targets.length > 0);

const bgColors = computed(() => {
  return INTERVALS.BASE.map((_, index) => {
    const activeAs = activeAsMap.value[index];
    const targetAs = targetAsMap.value[index];
    const isPlayed = playedMap.value[index];

    let bgColor = "hsl(var(--n) / 0.5)";

    if (activeAs || targetAs) {
      if (hasTargets.value) {
        if (targetAs && (activeAs || isPlayed)) {
          bgColor = "hsl(var(--su))";
        } else if (targetAs) {
          bgColor = props.quizMode ? "hsl(var(--n) / 0.5)" : "hsl(var(--p))";
        } else if (activeAs) {
          bgColor = "hsl(var(--p))";
        } else if (isPlayed) {
          bgColor = "hsl(var(--er))";
        }
      } else {
        bgColor = "hsl(var(--p))";
      }
    } else if (isPlayed) {
      bgColor = hasTargets.value ? "hsl(var(--er))" : "hsl(var(--p))";
    }

    return bgColor;
  });
});
</script>
