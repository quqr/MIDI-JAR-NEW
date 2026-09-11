import type { PianoTheme } from "./config/pianoThemes";

// ─── 颜色方案 ───
export type ColorScheme =
  | "pitch"
  | "hands"
  | "rainbow"
  | "warm"
  | "cool"
  | "neon"
  | "custom";

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

// ─── 流体画布层叠位置 ───
// "top": 流体 canvas 在 PixiJS canvas 之上（染料会遮蔽瀑布流/键盘）
// "bottom": 流体 canvas 在 PixiJS canvas 之下（背景透明，流体作为底层背景穿透显示）
export type FluidLayerPosition = "top" | "bottom";

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
  duration: number; // 脉冲周期 (s, 1-60, default: 6)

  // ── 第 4 层：Glow 样式专属 ──
  glowPeakOpacity: number; // glow ::before 峰值透明度 (%, 0-100, default: 100)
  glowPeakBlur: number; // glow ::before 峰值模糊 (px, 4-30, default: 12)
  glowAfterPeakOpacity: number; // glow ::after 峰值透明度 (%, 0-100, default: 60)
  glowAfterPeakBlur: number; // glow ::after 峰值模糊 (px, 10-40, default: 24)

  // ── 第 5 层：颜色 ──
  primaryColor?: string; // 主色（仅 custom 模式）
}

/** 粒子方块效果配置（方块由粒子网格组成，移植自 ParticleText 视觉） */
export interface BlockParticleConfig {
  enabled: boolean; // 总开关，default false
  gridSize: number; // 采样步长 px（越小越密），3-14, default 6
  particleSize: number; // 粒子尺寸 px，1-14, default 6（≈gridSize 保证覆盖）
  scatter: number; // 方块出现时的初始散开距离 px，0-160, default 60（0=直接就位）
  stagger: number; // 聚拢延迟系数 ms（delay=seed*stagger），0-1500, default 420
  highlightColor: string; // 高光色（targetX/width 渐变混合目标），default "#ffffff"
  entryGather: boolean; // 方块出现时播放入场聚拢动画（对应 reference trigger 模式），default true
  idleDrift: number; // 待机漂移幅度 px，0-4, default 0.7
  pointerRepelRadius: number; // 指针排斥半径 px，0-200, default 100（0=关闭）
  pointerRepelForce: number; // 指针排斥力度 px，0-80, default 30
  burstStrength: number; // 触发爆发距离 px（触发沿重新散开），0-160, default 60（0=关闭）
  gatherDuration: number; // 聚拢时长 ms，200-2000, default 600
  glow: boolean; // 粒子辉光（AdditiveBlending 模拟），default true
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
  blockParticle: BlockParticleConfig;
}

// ─── 流体高级参数（从 @/engine/fluid 重新导出，保持单一类型源） ───
export type { FluidAdvancedParams, SplatPerturbation } from "@/engine/fluid";

/** Galaxy 星系粒子背景配置（移植自 reactbits Galaxy，核心参数） */
export interface GalaxyConfig {
  enabled: boolean; // 总开关，default false
  density: number; // 粒子密度倍率 0.2–2, default 1
  glowIntensity: number; // 辉光强度 0–1, default 0.18
  saturation: number; // 饱和度 0–1, default 0.3
  hueShift: number; // 色相偏移 0–360, default 265（useThemeColors=false 时生效）
  rotationSpeed: number; // 星系旋转速度 0–1, default 0.1
  starSpeed: number; // 星星闪烁速度 0–1, default 0.5
  speed: number; // 全局速度倍率 0–3, default 1
  useThemeColors: boolean; // true 时从 daisyUI --color-primary 派生色相
}

/** 背景渲染配置，支持纯色底色、自定义背景图片和流体动画效果 */
export interface BackgroundConfig {
  solidColor: string;
  /**
   * 自定义背景图片（dataURL）。作为最底层绘制：图片存在时覆盖纯色底，
   * 无图/加载失败/流体激活时回退到 solidColor。
   */
  backgroundImage?: string;
  galaxy: GalaxyConfig;
  fluidEnabled: boolean;
  fluidQuality: FluidQuality;
  fluidStyle: FluidStyle;
  fluidParams: import("@/engine/fluid").FluidAdvancedParams;
  /** 流体 canvas 相对 PixiJS canvas 的层叠位置 */
  fluidLayerPosition: FluidLayerPosition;
}

/** 后期效果配置（基于 pixi-filters） */
export interface EffectsConfig {
  // AdvancedBloomFilter：应用到 waterfall 层，使音符方块/光晕产生泛光
  advancedBloomEnabled: boolean;
  advancedBloomThreshold: number; // 0-1，亮度阈值
  advancedBloomBloomScale: number; // 0-5，泛光强度
  advancedBloomBlur: number; // 0-20，泛光模糊
  // BackdropBlurFilter：应用到 fluid 层，模糊其背后的 background 层
  backdropBlurEnabled: boolean;
  backdropBlurStrength: number; // 0-20，模糊强度
}

/** 钢琴键盘的布局、外观与交互配置 */
export interface KeyboardConfig {
  visible: boolean;
  range: KeyboardRange;
  customFrom: string;
  customTo: string;
  keyLabel: KeyLabel;
  /** 钢琴主题预设；设置后渲染器使用主题色板覆盖各独立颜色字段 */
  theme?: PianoTheme;
  whiteKeyColor: string;
  blackKeyColor: string;
  pressedKeyColor: string;
  heightRatio: number;
  /** 黑键高度占白键高度的比例 (0.3-0.8) */
  blackKeyHeightRatio: number;
  keyCornerRadius: number;
  keyBorderWidth: number;
  keyBorderColor: string;
  separatorEnabled: boolean;
  separatorColor: string;
  separatorThickness: number;
  showNoteNames: boolean;
  /**
   * 电脑键盘弹奏时的默认力度（0-127）。
   * 历史硬编码默认值：90（WaterfallCanvas.vue L79）
   */
  defaultVelocity: number;
}

/** MIDI 文件播放控制与音轨显示配置 */
export interface MidiFileConfig {
  playbackSpeed: number;
  loop: boolean;
  /**
   * 推断为右手的轨道索引。
   * 历史硬编码默认值：0（MidiFilePlayer.ts L93）
   */
  rightHandTrackIdx: number;
  /**
   * 推断为左手的轨道索引。
   * 历史硬编码默认值：1（MidiFilePlayer.ts L94）
   */
  leftHandTrackIdx: number;
}

/** 瀑布流钢琴的完整设置项（音频由全局采样器管理，无合成器参数） */
export interface WaterfallPianoSettings {
  particles: ParticleConfig;
  background: BackgroundConfig;
  keyboard: KeyboardConfig;
  midiFile: MidiFileConfig;
  aura: AuraConfig;
  effects: EffectsConfig;
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
  /** 预计算的唯一键 "trackIndex-midi-time"，避免每帧模板字符串分配 */
  key?: string;
}
