// ─── 颜色方案 ───
export type ColorScheme =
  | "pitch"
  | "hands"
  | "rainbow"
  | "warm"
  | "cool"
  | "neon"
  | "custom";

// ─── 背景类型（仅保留纯色） ───
export type BackgroundType = "solid";

// ─── Synthesia 流动方向 ───
export type FlowDirection = "up" | "down";

// ─── 键盘范围 ───
export type KeyboardRange = "88" | "61" | "49" | "custom";

// ─── 按键标签 ───
export type KeyLabel = "none" | "note" | "pitchClass" | "octave";

// ─── 播放状态 ───
export type PlaybackState = "idle" | "playing" | "paused";

// ─── 播放内容类型 ───
export type ContentType = "none" | "recording" | "midi";

// ─── 流体模拟质量预设 ───
export type FluidQuality = "low" | "medium" | "high";

// ─── 流体模拟风格预设 ───
export type FluidStyle = "gentle" | "standard" | "turbulent";

// ─── Aura 样式类型 ───
export type AuraStyle = "none" | "glow" | "rainbow" | "dual" | "custom";

// ─── Aura 应用场景 ───
export type AuraTarget = "triggered" | "all" | "off";

/** 多色渐变停靠点，用于流体预设中的颜色渐变定义 */
export interface GradientStop {
  position: number; // 0-1
  color: string; // hex
}

/** 瀑布流命中线（音符触底线）的视觉配置 */
export interface HitLineConfig {
  visible: boolean;
  color: string;
  thickness: number;
}

/** Aura 发光效果配置 — 全部变量对标 DaisyUI CSS */
export interface AuraConfig {
  enabled: boolean; // 是否启用 Aura
  style: AuraStyle; // Aura 样式
  target: AuraTarget; // 应用场景

  // ── 第 1 层：Aura 区域（--aura-padding） ──
  padding: number; // 发光范围 (px, 0-30, default: 2)

  // ── 第 2 层：双层光晕（::before / ::after） ──
  innerBlur: number; // 内层模糊 (px, 1-30, default: 4)
  innerOpacity: number; // 内层亮度 (%, 0-100, default: 70)
  outerBlur: number; // 外层模糊 (px, 4-60, default: 16)
  outerOpacity: number; // 外层亮度 (%, 0-100, default: 30)

  // ── 第 3 层：动画（@keyframes aura） ──
  duration: number; // 旋转周期 (s, 1-60, default: 6)
  rotationRange: number; // 旋转范围 (deg, 90-1080, default: 360)

  // ── 第 4 层：光束形状（conic-gradient 参数） ──
  beamAngle: number; // 光束起始角 (deg, 0-360, default: 225)
  beamWidth: number; // 光束宽度 (deg, 10-350, default: 135)

  // ── 第 5 层：Glow 样式专属 ──
  glowExtent: number; // 径向渐变截止点 (%, 50-150, default: 90)
  glowPeakOpacity: number; // glow ::before 峰值透明度 (%, 0-100, default: 100)
  glowPeakBlur: number; // glow ::before 峰值模糊 (px, 4-30, default: 12)
  glowAfterPeakOpacity: number; // glow ::after 峰值透明度 (%, 0-100, default: 60)
  glowAfterPeakBlur: number; // glow ::after 峰值模糊 (px, 10-40, default: 24)

  // ── 第 5 层：Rainbow 样式专属 ──
  rainbowMargin: number; // 彩虹透明边缘 (%, 0-50, default: 10)

  // ── 第 5 层：Dual 样式专属 ──
  dualOffRatio: number; // Dual 关闭占空比 (%, 0-80, default: 40)
  dualOnRatio: number; // Dual 开启占空比 (%, 10-90, default: 50)

  // ── 第 6 层：颜色 ──
  primaryColor?: string; // 主色（仅 custom 模式）
  backgroundColor?: string; // 背景色（仅 dual 和 custom 模式）
}

/** 瀑布流音符方块的视觉与行为配置 */
export interface ParticleConfig {
  colorScheme: ColorScheme;
  customColors: { low: string; mid: string; high: string };
  speed: number;
  lookAhead: number;
  opacity: number;
  cornerRadius: number;
  hitLine: HitLineConfig;
  hitExplosionRadius: number; // 命中爆炸大小（0-0.1）
}

// ─── 流体高级参数（从 @/engine/fluid 重新导出，保持单一类型源） ───
export type { FluidAdvancedParams, SplatPerturbation } from "@/engine/fluid";

/** 背景渲染配置，支持纯色底色和流体动画效果 */
export interface BackgroundConfig {
  type: BackgroundType;
  solidColor: string;
  fluidEnabled: boolean;
  fluidQuality: FluidQuality;
  fluidStyle: FluidStyle;
  fluidAdvanced: boolean;
  fluidParams: import("@/engine/fluid").FluidAdvancedParams;
}

/** 钢琴键盘的布局、外观与交互配置 */
export interface KeyboardConfig {
  visible: boolean;
  range: KeyboardRange;
  customFrom: string;
  customTo: string;
  keyLabel: KeyLabel;
  whiteKeyColor: string;
  blackKeyColor: string;
  pressedKeyColor: string;
  heightRatio: number;
  keyCornerRadius: number;
  keyBorderWidth: number;
  keyBorderColor: string;
  gapBlur: number;
  separatorEnabled: boolean;
  separatorColor: string;
  separatorThickness: number;
  staffVisible: boolean;
  synthesiaFlowDirection: FlowDirection;
  showNoteNames: boolean;
}

/** MIDI 文件播放控制与音轨显示配置 */
export interface MidiFileConfig {
  playbackSpeed: number;
  selectedTracks: number[];
  trackColors: string[];
  loop: boolean;
  showNoteNames: boolean;
}

/** 合成器 ADSR 包络参数 */
export interface SynthEnvelopeConfig {
  attack: number;
  decay: number;
  sustain: number;
  release: number;
}

// ─── 振荡器类型 ───
export type OscillatorType = "triangle" | "sine" | "square" | "sawtooth";

/** 音频合成引擎的全部用户可调参数 */
export interface SoundEngineUserConfig {
  volume: number;
  reverbAmount: number;
  reverbDecay: number;
  sustain: boolean;
  velocitySensitivity: boolean;
  harmonicity: number;
  modulationIndex: number;
  oscillatorType: OscillatorType;
  envelope: SynthEnvelopeConfig;
  modulationEnvelope: SynthEnvelopeConfig;
}

/** 瀑布流钢琴的完整设置项，由六个子配置段组成 */
export interface WaterfallPianoSettings {
  particles: ParticleConfig;
  background: BackgroundConfig;
  keyboard: KeyboardConfig;
  midiFile: MidiFileConfig;
  sound: SoundEngineUserConfig;
  aura: AuraConfig;
}

/** 实时录制产生的单个音符记录 */
export interface RecordedNote {
  midi: number;
  velocity: number;
  time: number;
  duration: number;
  hand?: "left" | "right";
}

// ─── MIDI 音轨信息 ───
export interface MidiTrackInfo {
  index: number;
  name: string;
  noteCount: number;
  instrument: string;
}

/** Synthesia 模式下已调度待播放的音符事件 */
export interface ScheduledNote {
  midi: number;
  velocity: number;
  time: number;
  duration: number;
  hand: "left" | "right" | "unknown";
  trackIndex: number;
}
