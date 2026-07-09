// ─── 颜色方案 ───
export type ColorScheme =
  "pitch" | "hands" | "rainbow" | "warm" | "cool" | "neon" | "custom";

// ─── 背景类型 ───
export type BackgroundType =
  "solid" | "gradient" | "preset" | "image" | "stars" | "fluid";

// ─── 图片适配方式 ───
export type ImageFitMode = "cover" | "stretch" | "center" | "tile";

// ─── 渐变方向 ───
export type GradientDirection =
  "linear-vertical" | "linear-horizontal" | "radial";

// ─── 预设主题 ───
export type PresetTheme =
  "night-sky" | "ocean" | "sunset" | "aurora" | "forest";

// ─── Synthesia 流动方向 ───
export type FlowDirection = "up" | "down";

// ─── 音色预设 ───
export type AudioPreset =
  | "grand-piano"
  | "electric-piano"
  | "bright-piano"
  | "mellow-piano"
  | "organ"
  | "synth-pad"
  | "physical-piano";

// ─── 键盘范围 ───
export type KeyboardRange = "88" | "61" | "49" | "custom";

// ─── 按键标签 ───
export type KeyLabel = "none" | "note" | "pitchClass" | "octave";

// ─── 播放状态 ───
export type PlaybackState = "idle" | "playing" | "paused";

// ─── 播放内容类型 ───
export type ContentType = "none" | "recording" | "midi";

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

// ─── 流体模拟质量预设 ───
export type FluidQuality = "low" | "medium" | "high";

// ─── 流体模拟风格预设 ───
export type FluidStyle = "gentle" | "standard" | "turbulent";

// ─── 流体模拟高级参数覆盖（精简后用户可调旋钮） ───
export interface FluidAdvancedParams {
  SPLAT_RADIUS?: number;        // 1-100 溅射半径
  SPLAT_COLOR_HUE?: number;     // 0-1 色相，undefined 时用音高映射
  DENSITY_DISSIPATION?: number; // 0-4 拖尾长度（值大=消散快=拖尾短）
  VELOCITY_DISSIPATION?: number;// 0-4 流动持久度（值大=消散快=流动短）
  BLOOM?: boolean;              // 发光开关
  BLOOM_INTENSITY?: number;     // 0.1-2.0 发光强度
  HIT_EXPLOSION?: boolean;      // 命中爆炸发射开关
  BLOCK_COVERAGE?: boolean;     // 块体覆盖发射开关
}

// ─── 背景配置 ───
export interface BackgroundConfig {
  type: BackgroundType;
  solidColor: string;
  gradientDirection: GradientDirection;
  gradientStart: string;
  gradientEnd: string;
  gradientStops: GradientStop[]; // 多色渐变停靠点
  presetTheme: PresetTheme;
  imageFile: string;
  imageBlur: number;
  imageDarken: number;
  imageFitMode: ImageFitMode;
  starfieldEnabled: boolean; // 粒子星空
  starfieldDensity: number; // 0-1
  fluidEnabled: boolean; // 流体模拟（旧字段，保留以向后兼容已持久化设置）
  fluidResolution: number; // 流体模拟分辨率比例 0.25-1（旧字段，保留兼容）
  // 真实流体模拟（WebGL-Fluid-Simulation）配置
  fluidQuality: FluidQuality; // 质量预设
  fluidStyle: FluidStyle; // 风格预设
  fluidAdvanced: boolean; // 是否启用高级参数覆盖
  fluidParams: FluidAdvancedParams; // 高级模式参数覆盖
  flowAnimation: boolean; // 渐变流动动画
  flowSpeed: number; // 流动速度倍率
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
  separatorEnabled: boolean;
  separatorColor: string;
  separatorThickness: number;
  staffVisible: boolean; // 五线谱指示器
  synthesiaFlowDirection: FlowDirection; // Synthesia 流动方向
  showNoteNames: boolean; // 音符块音名标签
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

// ─── 物理建模钢琴参数 ───
export interface PhysicalPianoConfig {
  brightness: number;          // 0..1 默认 0.6  亮度
  resonance: number;           // 0..1 默认 0.4  音板共鸣
  sustain: number;             // 0..1 默认 0.3  延音时长
  decay: number;               // 0..1 默认 0.5  衰减
  hammerHardness: number;      // 0..1 默认 0.5  槌击硬度
  velocitySensitivity: number; // 0..1 默认 0.7  力度感应
  inharmonicity: number;       // 0..1 默认 0.2  非谐性
  strikePosition: number;      // 0..1 默认 0.125 槌击位置
  polyphony: number;           // 1..32 默认 16  复音数
  masterGain: number;          // 0..1 默认 0.9  主增益
}

// ─── MIDI 文件配置 ───
export interface MidiFileConfig {
  playbackSpeed: number;
  selectedTracks: number[];
  trackColors: string[];
  loop: boolean;
  showNoteNames: boolean;
}

// ─── 瀑布流钢琴总配置 ───
export interface WaterfallPianoSettings {
  particles: ParticleConfig;
  background: BackgroundConfig;
  keyboard: KeyboardConfig;
  audio: AudioConfig;
  physicalPiano: PhysicalPianoConfig;
  midiFile: MidiFileConfig;
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
