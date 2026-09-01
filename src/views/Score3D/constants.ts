import type {
  EnvelopeParams,
  GlowParams,
  TrailLayoutOptions,
} from "./types";

/**
 * MusicXML 无逐音符力度标记（只有 pp/mf/ff 之类的表情记号，常见导出器不落 <velocity>），
 * 此处以常量兜底；力度视觉通道（辉光）因此退化为常量，待后续接入力度来源。
 */
export const DEFAULT_VELOCITY = 0.8;

/** 声部轨配色（按 trackIndex 循环取用；字符串形式便于直接用于 CSS 与 THREE.Color） */
export const TRACK_COLORS: string[] = [
  "#38bdf8",
  "#fb923c",
  "#a78bfa",
  "#34d399",
  "#f472b6",
  "#facc15",
  "#60a5fa",
  "#f87171",
  "#2dd4bf",
  "#c084fc",
];

/** 按声部轨索引取颜色 */
export function trackColor(trackIndex: number): string {
  const len = TRACK_COLORS.length;
  if (len === 0) return "#38bdf8";
  return TRACK_COLORS[((trackIndex % len) + len) % len];
}

/** 能量轨迹管半径（世界单位） */
export const DEFAULT_TRAIL_RADIUS = 0.35;

/** 曲线采样密度：每控制点对应的弧长采样数（播放头时间↔弧长映射表的精度） */
export const CURVE_SAMPLES_PER_UNIT = 8;

/** 默认布局参数 */
export const DEFAULT_LAYOUT_OPTIONS: TrailLayoutOptions = {
  unitsPerSecond: 6,
  unitsPerSemitone: 1.1,
  staffGap: 22,
  chordPolicy: "top",
};

/** 默认光点参数 */
export const DEFAULT_GLOW_PARAMS: GlowParams = {
  radius: 0.9,
  baseIntensity: 0.35,
  peakIntensity: 3.2,
};

/** 默认 ADSR 包络参数 */
export const DEFAULT_ENVELOPE_PARAMS: EnvelopeParams = {
  attack: 0.04,
  decay: 0.18,
  sustain: 0.55,
  release: 0.35,
  velocitySensitivity: 0.5,
};

/** 相机相对光点的默认偏移 */
export const DEFAULT_CAMERA_OFFSET = { x: -6, y: 5, z: 11 };

/** 光点掠过和弦锚点时的点亮窗口（秒） */
export const DEFAULT_ANCHOR_WINDOW = 0.15;
