/**
 * 乐谱滚动（Score Scroll）模块公开出口
 */
export type {
  ScoreMusicFont,
  ScoreBackgroundStyle,
  ScoreEffectSettings,
  ScoreAppearanceSettings,
  ScoreScrollSettings,
  ScoreNoteInfo,
  ScoreMeasureInfo,
  ScoreSystemInfo,
  ScoreMetaInfo,
  ScorePlaybackState,
} from "./types";
export {
  defaultScoreScrollSettings,
  STORAGE_KEY,
  SETTINGS_VERSION,
  EFFECT_PARAM_RANGE,
  MUSIC_FONTS,
  BACKGROUND_STYLES,
  NOTE_MATCH_TOLERANCE_BEATS,
} from "./constants";
export { useScoreScrollStore } from "./stores/ScoreScroll";
