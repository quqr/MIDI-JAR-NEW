// ─── 视觉风格 ───
export type VisualStyle = "blocks" | "particles" | "hybrid";

// ─── 颜色方案 ───
export type ColorScheme =
  "pitch" | "hands" | "rainbow" | "warm" | "cool" | "neon" | "custom";

// ─── 粒子形状 ───
export type ParticleShape = "circle" | "square" | "note" | "star";

// ─── 背景类型 ───
export type BackgroundType =
  "solid" | "gradient" | "preset" | "image" | "stars";

// ─── 图片适配方式 ───
export type ImageFitMode = "cover" | "stretch" | "center" | "tile";

// ─── 纹理预设 ───
export type TexturePreset = "none" | "noise" | "stripes" | "dots" | "glow" | "metallic";

// ─── 渐变方向 ───
export type GradientDirection =
  "linear-vertical" | "linear-horizontal" | "radial";

// ─── 预设主题 ───
export type PresetTheme =
  "night-sky" | "ocean" | "sunset" | "aurora" | "forest";

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

// ─── 播放状态 ───
export type PlaybackState = "idle" | "playing" | "paused";

// ─── 播放内容类型 ───
export type ContentType = "none" | "recording" | "midi";

// ─── 命中线样式 ───
export type HitLineStyle = "solid" | "dashed" | "dotted";

// ─── 瀑布流视觉配置 ───
export interface HitLineConfig {
  color: string;
  glow: boolean;
  thickness: number; // 线条粗细（像素）
  glowRadius: number; // 发光扩散范围
  glowIntensity: number; // 发光强度 0-1
  style: HitLineStyle; // 线条样式
  visible: boolean; // 是否显示
}

export interface NoteBlockConfig {
  borderColor: string;
  borderWidth: number;
  borderEnabled: boolean;
  gradientEnabled: boolean;
  gradientTopColor: string;
  gradientBottomColor: string;
  highlightEnabled: boolean;
  highlightOpacity: number;
  fadeIn: boolean; // 淡入动画
  fadeOut: boolean; // 淡出动画
}

export interface TrailParticleConfig {
  size: number;
  colorDecay: number; // 颜色衰减速度 0-1
  spreadAngle: number; // 扩散角度 0-180
  lifetime: number; // 生命周期（帧数）
}

export interface HitParticleConfig {
  count: number;
  speed: number;
  lifetime: number; // 生命周期（帧数）
}

export interface ParticlePhysicsConfig {
  gravity: number; // 重力加速度
  windX: number; // X 方向风力
  windY: number; // Y 方向风力
}

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
  hitLine: HitLineConfig;
  noteBlock: NoteBlockConfig;
  trailParticle: TrailParticleConfig;
  hitParticle: HitParticleConfig;
  physics: ParticlePhysicsConfig;
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
  imageFitMode: ImageFitMode;
}

// ─── 后处理配置 ───
export interface PostProcessingConfig {
  bloom: {
    enabled: boolean;
    intensity: number; // 0-1
    threshold: number; // 0-1, 亮度阈值
    radius: number; // 模糊半径
  };
  motionBlur: {
    enabled: boolean;
    strength: number; // 0-1
  };
  chromaticAberration: {
    enabled: boolean;
    intensity: number; // 0-1
  };
  vignette: {
    enabled: boolean;
    intensity: number; // 0-1
    radius: number; // 0-1, 暗角范围
  };
}

// ─── 音符块纹理配置 ───
export interface NoteTextureConfig {
  preset: TexturePreset;
  scale: number; // 纹理缩放
  intensity: number; // 0-1, 纹理可见度
}

// ─── 音符块粒子配置（增强版）───
export interface NoteBlockParticleConfig {
  surfaceEmission: {
    enabled: boolean;
    rate: number; // 每帧粒子数
    speed: number;
    lifetime: number;
  };
  hitExplosion: {
    enabled: boolean;
    count: number;
    speed: number;
    lifetime: number;
  };
  orbiting: {
    enabled: boolean;
    count: number;
    radius: number;
    speed: number;
  };
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
  heightRatio: number; // 键盘占屏幕高度的比例 0.1-0.5
  keyCornerRadius: number; // 按键圆角
  keyBorderWidth: number; // 按键边框粗细
  keyBorderColor: string; // 按键边框颜色
  separatorEnabled: boolean; // 键盘分隔线
  separatorColor: string;
  separatorThickness: number;
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

// ─── 瀑布流钢琴总配置 ───
export interface WaterfallPianoSettings {
  particles: ParticleConfig;
  background: BackgroundConfig;
  keyboard: KeyboardConfig;
  audio: AudioConfig;
  midiFile: MidiFileConfig;
  postProcessing: PostProcessingConfig;
  noteTexture: NoteTextureConfig;
  noteBlockParticles: NoteBlockParticleConfig;
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
