import type {
  NotationDisplayConfig,
  NotationLayoutConfig,
  NotationStyleConfig,
} from "@/components/Notation/types";
import { getCurrentLocale } from "@/utils/utils";

export type { MidiRoute } from "./midi";
export * from "./chordQuiz";
export interface MessageEventData {
  type: string;
  data?: any;
}

/**
 * 自定义窗口消息事件类型
 */
export interface CustomMessageEvent extends MessageEvent {
  data: MessageEventData;
}

/**
 * 路由配置类型
 */
export interface RouteConfig {
  path: string;
  name: string;
  component: () => Promise<any>;
}

/**
 * 计数器 Store 类型
 */
export interface CounterState {
  count: number;
  doubleCount: number;
}

/**
 * MIDI 相关类型定义
 */
export type MidiMessage = [number, number, number];

export type MidiMessageHandler = (
  message: MidiMessage,
  timestamp: number,
  device: string,
) => void;

export type ApiMidiInput = {
  name: string;
  opened: boolean;
  connected: boolean;
  error: boolean;
};

export type ApiMidiOutput = {
  name: string;
  type: "physical" | "internal" | "websocket";
  opened: boolean;
  connected: boolean;
  error: boolean;
};

export type ApiMidiRoute = {
  input: string;
  output: string;
  type: "physical" | "internal";
  enabled: boolean;
};

export type ApiMidiWire = {
  route: ApiMidiRoute;
  connected: boolean;
};

export type WindowState = {
  x: number | null;
  y: number | null;
  width: number | null;
  height: number | null;
  maximized: boolean;
  alwaysOnTop: boolean;
  changelogDismissed: string | null;
  updateDismissed: string | null;
  path: string;
};

// 导入KeyboardSettings类型
import type { KeyboardSettings } from "./settings";

// 注意：KeyboardSettings 类型已移至 ./piano.ts

export type ChordDisplaySettings = {
  id: string;
  chordNotation: "long" | "short" | "symbol" | "preferred";
  useSustain: boolean;
  detectOnRelease: boolean;
  highlightAlterations: boolean;
  displayKeyboard: boolean;
  displayChord: boolean;
  displayName: boolean;
  displayNotation: boolean;
  displayAltChords: boolean;
  displayIntervals: boolean;
  keyboard: KeyboardSettings;
};

export type ChordDictionarySettings = {
  interactive: "detect" | "play";
  hideDisabled: boolean;
  filterInKey: boolean;
  groupBy: "none" | "quality" | "intervals";
  defaultNotation: "long" | "short" | "symbol";
  disabled: string[];
  aliases: Array<[key: string, value: string]>;
};

export type NotationSettings = {
  key: string;
  accidentals: "flat" | "sharp";
  staffClef: "both" | "bass" | "treble";
  staffTranspose: number;
  display: Partial<NotationDisplayConfig>;
  layout: Partial<NotationLayoutConfig>;
  style: Partial<NotationStyleConfig>;
};

export type CursorSettings = {
  enabled: boolean;
  innerSize: number;
  outerSize: number;
  innerColorSource: "custom" | "theme";
  innerColor: string;
  outerColorSource: "custom" | "theme";
  outerColor: string;
  hoverRingColorSource: "custom" | "theme";
  hoverRingColor: string;
  blendMode: "normal" | "exclusion" | "difference" | "multiply" | "screen";
  followDuration: number;
  hoverDuration: number;
  pulseScale: number;
  hoverMode: "cover" | "border" | "none";
};

export type GeneralSettings = {
  language: "en" | "zh";
  /** 全局帧率悬浮显示（界面左上角，所有页面生效） */
  showFps: boolean;
};

/** 界面特效（MagicBento 风格）设置 */
export type MagicSettings = {
  /** 主开关（默认开启） */
  enabled: boolean;
  /** 边框辉光：radial-gradient + mask-composite 的 1px 边缘光环 */
  borderGlow: boolean;
  /** 全局聚光灯：光斑跟随鼠标并照亮附近卡片 */
  spotlight: boolean;
  /** 3D 倾斜：悬停时卡片随鼠标位置轻微 rotateX/Y */
  tilt: boolean;
  /** 磁性吸附：卡片轻微跟随鼠标平移 */
  magnetism: boolean;
  /** 点击涟漪：点击卡片产生扩散光圈 */
  clickEffect: boolean;
  /** 辉光颜色（hex 存储，运行时转 "r,g,b" 通道串写 CSS 变量） */
  glowColor: string;
  /** 聚光灯半径（px）：光斑影响范围，proximity/fade 随动 */
  spotlightRadius: number;
  /** 光斑最大透明度：聚光灯靠近卡片时的亮度上限 */
  spotlightOpacity: number;
  /** 辉光强度：边框辉光环的 alpha 系数（0.1–1） */
  glowIntensity: number;
  /** 卡片高亮宽度（px）：边框辉光环的宽度（2–16） */
  glowWidth: number;
  /** 最大倾斜角（°）：3D 倾斜公式的角度上限，0 即关闭倾斜 */
  tiltMaxAngle: number;
  /** 磁吸强度：卡片跟随鼠标的偏移系数（0–0.2） */
  magnetismStrength: number;
  /** 涟漪大小：涟漪直径相对卡片角距的倍率（默认 2×） */
  rippleSize: number;
  /** 涟漪时长（ms）：点击涟漪扩散动画时长 */
  rippleDuration: number;
};

// 钢琴设置类型定义
export type PianoSettings = {
  from: string;
  to: string;
  label: "none" | "pitchClass" | "note" | "chordNote" | "interval";
  keyName: "none" | "octave" | "pitchClass" | "note";
  whiteKeyColor: string;
  blackKeyColor: string;
  pressedKeyColor: string;
  keyCornerRadius: number;
  showNoteNames: boolean;
  // 主题集成相关设置
  useThemeColors: boolean; // 是否使用主题颜色（替代硬编码颜色）
};

export type Settings = {
  general: GeneralSettings;
  cursor: CursorSettings;
  chordDisplay: ChordDisplaySettings[];
  chordDictionary: ChordDictionarySettings;
  notation: NotationSettings;
  piano: PianoSettings;
  magic: MagicSettings;
};

/**
 * 默认值
 */

// defaultKeyboardSettings 已移除，改用 createKeyboardSettingsFromPiano 创建

export const defaultChordDisplaySettings: ChordDisplaySettings = {
  id: "default",
  chordNotation: "preferred",
  useSustain: true,
  detectOnRelease: true,
  highlightAlterations: false,
  displayKeyboard: true,
  displayChord: true,
  displayName: true,
  displayNotation: true,
  displayAltChords: true,
  displayIntervals: true,
  keyboard: {
    skin: "coral",
    from: "C3",
    to: "C5",
    label: "pitchClass",
    keyName: "note",
    sizes: {
      radius: 0.4,
    },
    colors: {
      white: "#FBF8F3",
      black: "#2B2020",
      played: "#FF5C5C",
    },
  },
};

export const defaultChordDictionarySettings: ChordDictionarySettings = {
  interactive: "play",
  hideDisabled: false,
  filterInKey: true,
  groupBy: "quality",
  defaultNotation: "short",
  disabled: [],
  aliases: [["maj", ""]],
};

export const defaultNotationSettings: NotationSettings = {
  key: "C",
  accidentals: "flat",
  staffClef: "both",
  staffTranspose: 0,
  display: {},
  layout: {},
  style: {},
};

export const defaultCursorSettings: CursorSettings = {
  enabled: true,
  innerSize: 12,
  outerSize: 42,
  innerColorSource: "theme",
  innerColor: "primary",
  outerColorSource: "theme",
  outerColor: "primary",
  hoverRingColorSource: "theme",
  hoverRingColor: "primary",
  blendMode: "exclusion",
  followDuration: 120,
  hoverDuration: 300,
  pulseScale: 0.6,
  hoverMode: "border",
};

export const defaultGeneralSettings: GeneralSettings = {
  language: getCurrentLocale() as "en" | "zh",
  showFps: false,
};

export const defaultPianoSettings: PianoSettings = {
  from: "C3",
  to: "C5",
  label: "pitchClass",
  keyName: "note",
  whiteKeyColor: "#ffffff",
  blackKeyColor: "#000000",
  pressedKeyColor: "#315bce",
  keyCornerRadius: 0.4,
  showNoteNames: false,
  useThemeColors: true, // 默认使用主题颜色
};

export const defaultMagicSettings: MagicSettings = {
  enabled: true, // 默认开启；≤768px / 无 hover 设备自动禁用悬停类特效
  borderGlow: true,
  spotlight: true,
  tilt: true, // 默认启用 3D 倾斜
  magnetism: true,
  clickEffect: true,
  glowColor: "#8400FF", // 对应参考实现 "132, 0, 255"
  spotlightRadius: 300, // 对应 useMagicSpotlight SPOTLIGHT_RADIUS
  spotlightOpacity: 0.8, // 对应 SPOTLIGHT_MAX_OPACITY
  glowIntensity: 0.8, // 对应 magic.css 边框辉光环 alpha 系数
  glowWidth: 2, // 对应 magic.css ::after 辉光环宽度（px）
  tiltMaxAngle: 10, // 对应 magic.ts tilt 公式 ±10°
  magnetismStrength: 0.05, // 对应 magic.ts 磁吸偏移 ×0.05
  rippleSize: 2, // 对应 magic.ts 涟漪直径 2×max corner distance
  rippleDuration: 800, // 对应 magic.ts onClick 涟漪 anime duration
};

export const defaultSettings: Settings = {
  general: defaultGeneralSettings,
  cursor: defaultCursorSettings,
  chordDisplay: [defaultChordDisplaySettings],
  chordDictionary: defaultChordDictionarySettings,
  notation: defaultNotationSettings,
  piano: defaultPianoSettings,
  magic: defaultMagicSettings,
};

export const defaultWindowState: WindowState = {
  x: null,
  y: null,
  width: null,
  height: null,
  maximized: false,
  alwaysOnTop: false,
  changelogDismissed: "100.0.0",
  updateDismissed: null,
  path: "/",
};
