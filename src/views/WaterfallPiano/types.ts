// ─── 颜色方案 ───
export type ColorScheme =
  | "pitch"
  | "hands"
  | "rainbow"
  | "warm"
  | "cool"
  | "neon"
  | "custom";

// ─── 背景类型 ───
export type BackgroundType =
  | "solid"
  | "gradient"
  | "preset"
  | "image"
  | "stars";

// ─── 图片适配方式 ───
export type ImageFitMode = "cover" | "stretch" | "center" | "tile";

// ─── 渐变方向 ───
export type GradientDirection =
  | "linear-vertical"
  | "linear-horizontal"
  | "radial";

// ─── 预设主题 ───
export type PresetTheme =
  | "night-sky"
  | "ocean"
  | "sunset"
  | "aurora"
  | "forest";

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

// ─── 多色渐变停靠点 ───
export interface GradientStop {
  position: number; // 0-1
  color: string; // hex
}

// ─── 瀑布流视觉配置 ───
export interface HitLineConfig {
  visible: boolean;
  color: string;
  thickness: number;
}

export interface ParticleConfig {
  colorScheme: ColorScheme;
  customColors: { low: string; mid: string; high: string };
  speed: number;
  lookAhead: number;
  opacity: number;
  cornerRadius: number;
  hitLine: HitLineConfig;
}

// ─── 流体高级参数（从 @/engine/fluid 重新导出，保持单一类型源） ───
export type { FluidAdvancedParams } from "@/engine/fluid";

// ─── 背景配置 ───
export interface BackgroundConfig {
  type: BackgroundType;
  solidColor: string;
  gradientDirection: GradientDirection;
  gradientStart: string;
  gradientEnd: string;
  gradientStops: GradientStop[];
  presetTheme: PresetTheme;
  imageFile: string;
  imageBlur: number;
  imageDarken: number;
  imageFitMode: ImageFitMode;
  starfieldEnabled: boolean;
  starfieldDensity: number;
  fluidEnabled: boolean;
  fluidQuality: FluidQuality;
  fluidStyle: FluidStyle;
  fluidAdvanced: boolean;
  fluidParams: import("@/engine/fluid").FluidAdvancedParams;
  flowAnimation: boolean;
  flowSpeed: number;
}

// ─── 键盘配置 ───
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

// ─── MIDI 文件配置 ───
export interface MidiFileConfig {
  playbackSpeed: number;
  selectedTracks: number[];
  trackColors: string[];
  loop: boolean;
  showNoteNames: boolean;
}

// ─── 合成器包络配置 ───
export interface SynthEnvelopeConfig {
  attack: number;
  decay: number;
  sustain: number;
  release: number;
}

// ─── 音频引擎用户配置 ───
export interface SoundEngineUserConfig {
  volume: number;
  reverbAmount: number;
  reverbDecay: number;
  sustain: boolean;
  velocitySensitivity: boolean;
  harmonicity: number;
  modulationIndex: number;
  oscillatorType: string;
  envelope: SynthEnvelopeConfig;
  modulationEnvelope: SynthEnvelopeConfig;
}

// ─── 瀑布流钢琴总配置 ───
export interface WaterfallPianoSettings {
  particles: ParticleConfig;
  background: BackgroundConfig;
  keyboard: KeyboardConfig;
  midiFile: MidiFileConfig;
  sound: SoundEngineUserConfig;
}

// ─── 录制的音符 ───
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

// ─── 调度的音符事件（Synthesia 模式） ───
export interface ScheduledNote {
  midi: number;
  velocity: number;
  time: number;
  duration: number;
  hand: "left" | "right" | "unknown";
  trackIndex: number;
}
