// ─── 视觉风格 ───
export type VisualStyle = "blocks" | "particles" | "hybrid";

// ─── 颜色方案 ───
export type ColorScheme =
  | "pitch"
  | "hands"
  | "rainbow"
  | "warm"
  | "cool"
  | "neon"
  | "custom";

// ─── 粒子形状 ───
export type ParticleShape = "circle" | "square" | "note" | "star";

// ─── 背景类型 ───
export type BackgroundType = "solid" | "gradient" | "preset" | "image" | "stars";

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

// ─── 音色预设 ───
export type AudioPreset =
  | "grand-piano"
  | "electric-piano"
  | "bright-piano"
  | "mellow-piano"
  | "organ"
  | "synth-pad";

// ─── 键盘范围 ───
export type KeyboardRange = "88" | "61" | "49" | "custom";

// ─── 按键标签 ───
export type KeyLabel = "none" | "note" | "pitchClass" | "octave";

// ─── 质量档位 ───
export type QualityLevel = "low" | "medium" | "high";

// ─── 播放状态 ───
export type PlaybackState = "idle" | "playing" | "paused";

// ─── 播放内容类型 ───
export type ContentType = "none" | "recording" | "midi";

// ─── 瀑布流视觉配置 ───
export interface ParticleConfig {
  style: VisualStyle;
  shape: ParticleShape;
  colorScheme: ColorScheme;
  customColors: { low: string; mid: string; high: string };
  speed: number; // 实时模式的上升速度
  lookAhead: number; // MIDI 模式的提前显示时间（秒）
  size: number;
  opacity: number;
  density: number;
  trail: boolean;
  cornerRadius: number;
  hitLineColor: string;
  hitLineGlow: boolean;
}

// ─── 背景配置 ───
export interface BackgroundConfig {
  type: BackgroundType;
  solidColor: string;
  gradientDirection: GradientDirection;
  gradientStart: string;
  gradientEnd: string;
  presetTheme: PresetTheme;
  imageFile: string;
  imageBlur: number;
  imageDarken: number;
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
}

// ─── 音频配置 ───
export interface AudioConfig {
  preset: AudioPreset;
  volume: number;
  reverbAmount: number;
  reverbDecay: number;
  sustain: boolean;
  velocitySensitivity: boolean;
}

// ─── MIDI 文件配置 ───
export interface MidiFileConfig {
  playbackSpeed: number;
  selectedTracks: number[];
  trackColors: string[];
  loop: boolean;
  showNoteNames: boolean;
}

// ─── 性能配置 ───
export interface PerformanceConfig {
  quality: QualityLevel;
  maxParticles: number;
}

// ─── 瀑布流钢琴总配置 ───
export interface WaterfallPianoSettings {
  particles: ParticleConfig;
  background: BackgroundConfig;
  keyboard: KeyboardConfig;
  audio: AudioConfig;
  midiFile: MidiFileConfig;
  performance: PerformanceConfig;
}

// ─── 录制的音符 ───
export interface RecordedNote {
  midi: number;
  velocity: number;
  time: number; // ms from recording start
  duration: number; // ms
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
  time: number; // 秒，音符开始时间
  duration: number; // 秒
  hand: "left" | "right" | "unknown";
  trackIndex: number;
}
