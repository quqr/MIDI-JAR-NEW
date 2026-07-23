export { default as ChordIntervals } from "./ChordIntervals.vue";
export { INTERVALS, getPlayedIntervals, isIncludedAs } from "./utils";

// Props类型定义（避免从.vue文件导出）
export interface ChordIntervalsProps {
  className?: string;
  intervals?: string[];
  targets?: string[];
  pitchClasses?: string[];
  tonic?: string | null;
  quizMode?: boolean;
}
