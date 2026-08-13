<template>
  <div class="w-full">
    <div class="grid grid-cols-6 gap-1.5" role="list" :aria-label="ariaLabel">
      <div
        v-for="(label, index) in BASE_LABELS"
        :key="label"
        class="interval-cell"
        role="listitem"
      >
        <div
          class="card"
          :class="
            activeAsMap[index] || targetAsMap[index]
              ? 'bg-info '
              : 'bg-base-200 '
          "
        >
          <div class="card-body">
            <div
              class="text-center font-bold"
              :class="
                activeAsMap[index] || targetAsMap[index]
                  ? ' text-info-content'
                  : 'text-base-content'
              "
            >
              {{ label }}
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import {
  INTERVALS,
  BASE_LABELS,
  isIncludedAs,
  getPlayedIntervals,
} from "./utils";

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

const { t } = useI18n();

const ariaLabel = computed(() => t("chordIntervals.label", { count: 12 }));

/** 从 intervals prop 推导的活跃音程映射 */
const activeFromIntervals = computed(() =>
  INTERVALS.BASE.map((i) => isIncludedAs(i, props.intervals)),
);

/** 从 pitchClasses + tonic 回退推导的活跃音程映射（当 intervals 为空时使用） */
const activeFromPitchClasses = computed(() => {
  if (props.intervals.length > 0) return Array(12).fill(null);
  const played = getPlayedIntervals(props.tonic, props.pitchClasses);
  return played.map((count) => (count > 0 ? true : null));
});

const activeAsMap = computed(() =>
  INTERVALS.BASE.map(
    (_, index) =>
      activeFromIntervals.value[index] || activeFromPitchClasses.value[index],
  ),
);

const targetAsMap = computed(() =>
  INTERVALS.BASE.map((i) => isIncludedAs(i, props.targets)),
);
</script>
