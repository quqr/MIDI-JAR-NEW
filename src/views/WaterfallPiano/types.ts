// ─── 视觉风格 ───
export type VisualStyle = "blocks" | "particles" | "hybrid";

// ─── 颜色方案 ───
export type ColorScheme =
  "pitch" | "hands" | "rainbow" | "warm" | "cool" | "neon" | "custom";

// ─── 粒子形状 ───
export type ParticleShape = "circle" | "square" | "note" | "star";

// ─── 背景类型 ───
export type BackgroundType =
  "solid" | "gradient" | "preset" | "image" | "stars" | "fluid";

// ─── 图片适配方式 ───
export type ImageFitMode = "cover" | "stretch" | "center" | "tile";

// ─── 纹理预设 ───
export type TexturePreset =
  "none" | "noise" | "stripes" | "dots" | "glow" | "metallic";

// ─── 渐变方向 ───
export type GradientDirection =
  "linear-vertical" | "linear-horizontal" | "radial";

// ─── 预设主题 ───
export type PresetTheme =
  "night-sky" | "ocean" | "sunset" | "aurora" | "forest";

// ─── Synthesia 流动方向 ───
export type FlowDirection = "up" | "down";

// ─── 主题预设标识 ───
export type VisualThemeId =
  | "classic-glow"
  | "neon-particles"
  | "minimal-tutor"
  | "starlight-magic"
  | "retro-crt";

// ─── 粒子效果预设标识 ───
export type ParticlePresetId =
  "classic" | "neon" | "minimal" | "starlight" | "retro-crt";

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

// ─── 多色渐变停靠点 ───
export interface GradientStop {
  position: number; // 0-1
  color: string; // hex
}

// ─── 风格参数（主题系统的第二层级） ───
export interface StyleParameters {
  ambianceIntensity: number; // 氛围强度 0-1，影响粒子密度、发光强度、背景动态速度
  particleDensity: number; // 粒子浓度 0-1
  burstForce: number; // 爆发力度 0-1，影响命中爆炸
  floatSense: number; // 漂浮感 0-1，影响粒子漂浮速度
  glowIntensity: number; // 光芒强度 0-1
  colorTemperature: number; // 颜色温度 0-1，0=冷 1=暖
}

// ─── 瀑布流视觉配置 ───
export interface HitLineConfig {
  color: string;
  glow: boolean;
  thickness: number;
  glowRadius: number;
  glowIntensity: number;
  style: HitLineStyle;
  visible: boolean;
  shaderGlow: boolean; // 使用 shader 实现泛光（替代多层矩形）
}

export interface NoteBlockConfig {
  borderColor: string;
  borderWidth: number;
  borderEnabled: boolean;
  gradientEnabled: boolean;
  gradientTopColor: string;
  gradientBottomColor: string;
  gradientMidColor: string; // 新增：中间色，用于多层渐变
  highlightEnabled: boolean;
  highlightOpacity: number;
  fadeIn: boolean;
  fadeOut: boolean;
  multiLayerGradient: boolean; // 多层渐变（高光 → 主色 → 暗部）
  activeGlow: boolean; // 活跃音符柔和边缘发光
  activeGlowRadius: number;
  shadowEnabled: boolean; // 微妙阴影
}

export interface TrailParticleConfig {
  size: number;
  colorDecay: number;
  spreadAngle: number;
  lifetime: number;
  glowTexture: boolean; // 使用预渲染发光纹理
  turbulence: number; // 湍流强度 0-1
}

export interface HitParticleConfig {
  count: number;
  speed: number;
  lifetime: number;
  glowTexture: boolean;
  turbulence: number;
}

export interface ParticlePhysicsConfig {
  gravity: number;
  windX: number;
  windY: number;
}

export interface ParticleConfig {
  style: VisualStyle;
  shape: ParticleShape;
  colorScheme: ColorScheme;
  customColors: { low: string; mid: string; high: string };
  speed: number;
  lookAhead: number;
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
  particlePreset: ParticlePresetId; // 粒子效果预设
  lifecycleCurve: boolean; // 生命周期曲线（Particular 风格）
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
  fluidEnabled: boolean; // 流体模拟
  fluidResolution: number; // 流体模拟分辨率比例 0.25-1
  flowAnimation: boolean; // 渐变流动动画
  flowSpeed: number; // 流动速度倍率
}

// ─── 后处理配置 ───
export interface PostProcessingConfig {
  bloom: {
    enabled: boolean;
    intensity: number;
    threshold: number;
    radius: number;
    multiPass: boolean; // 多 pass 下采样/上采样
  };
  motionBlur: {
    enabled: boolean;
    strength: number;
    layerOnly: boolean; // 仅作用于音符块层
  };
  chromaticAberration: {
    enabled: boolean;
    intensity: number;
  };
  vignette: {
    enabled: boolean;
    intensity: number;
    radius: number;
  };
  hitLineGlow: {
    enabled: boolean; // 命中线 shader 泛光
    intensity: number;
    radius: number;
  };
}

// ─── 音符块纹理配置 ───
export interface NoteTextureConfig {
  preset: TexturePreset;
  scale: number;
  intensity: number;
  customImage: string; // 自定义纹理图片（dataURL）
  customImageIntensity: number;
}

// ─── 音符块粒子配置（增强版）───
export interface NoteBlockParticleConfig {
  surfaceEmission: {
    enabled: boolean;
    rate: number;
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
  particleHardLimit: number; // 粒子数量硬上限（默认 500，最大 2000）
  autoDegrade: boolean; // 自动降级
  minFps: number; // 触发降级的帧率阈值
  targetFps: number; // 目标帧率
}

// ─── 主题配置（第三层级） ───
export interface ThemeConfig {
  current: VisualThemeId; // 当前主题
  styleParameters: StyleParameters; // 风格参数
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
  performance: PerformanceConfig;
  theme: ThemeConfig;
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

// ─── 主题预设（用于导入导出） ───
export interface ThemePreset {
  id: VisualThemeId;
  name: string;
  particles: ParticleConfig;
  background: BackgroundConfig;
  postProcessing: PostProcessingConfig;
  noteTexture: NoteTextureConfig;
  noteBlockParticles: NoteBlockParticleConfig;
  styleParameters: StyleParameters;
}
