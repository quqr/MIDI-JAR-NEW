import type { MidiRoute } from "./midi";
import type {
  NotationDisplayConfig,
  NotationLayoutConfig,
  NotationStyleConfig,
} from "@/components/Notation/types";
import { getCurrentLocale } from "@/utils/utils";

export type { MidiRoute } from "./midi";
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

export type KeyboardSettings = {
  skin: "classic" | "flat";
  from: string;
  to: string;
  label: "none" | "pitchClass" | "note" | "chordNote" | "interval";
  keyName: "none" | "octave" | "pitchClass" | "note";
  keyInfo: "none" | "tonic" | "interval" | "tonicAndInterval";
  fadeOutDuration: number;
  textOpacity: number;
  displaySustained: boolean;
  wrap: boolean;
  sizes: {
    radius: number;
    height: number;
    ratio: number;
    bevel: boolean;
  };
  colors: {
    white: string | null;
    black: string | null;
    played: string | null;
    wrapped: string | null;
    sustained: string | null;
  };
};

export type ChordDisplaySettings = {
  id: string;
  chordNotation: "long" | "short" | "symbol" | "preferred";
  allowOmissions: boolean;
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
  transitionDuration: number;
  hoverMode: "cover" | "border" | "none";
};

export type GeneralSettings = {
  language: "en" | "zh";
};

export type Settings = {
  general: GeneralSettings;
  midiRoutes: MidiRoute[];
  cursor: CursorSettings;
  chordDisplay: ChordDisplaySettings[];
  chordDictionary: ChordDictionarySettings;
  notation: NotationSettings;
};

/**
 * 默认值
 */
export const defaultKeyboardSettings: KeyboardSettings = {
  skin: "classic",
  from: "C3",
  to: "C5",
  label: "pitchClass",
  keyName: "note",
  keyInfo: "tonicAndInterval",
  fadeOutDuration: 0,
  textOpacity: 0.5,
  displaySustained: true,
  wrap: false,
  sizes: {
    radius: 0.4,
    height: 6,
    ratio: 0.6,
    bevel: true,
  },
  colors: {
    white: "#ffffff",
    black: "#000000",
    played: "#315bce",
    wrapped: "#1d367b",
    sustained: "#808080",
  },
};

export const defaultChordDisplaySettings: ChordDisplaySettings = {
  id: "default",
  chordNotation: "preferred",
  allowOmissions: true,
  useSustain: true,
  detectOnRelease: true,
  highlightAlterations: false,
  displayKeyboard: true,
  displayChord: true,
  displayName: true,
  displayNotation: true,
  displayAltChords: true,
  displayIntervals: true,
  keyboard: defaultKeyboardSettings,
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
  transitionDuration: 100,
  hoverMode: "border",
};

export const defaultGeneralSettings: GeneralSettings = {
  language: getCurrentLocale() as "en" | "zh",
};

export const defaultSettings: Settings = {
  general: defaultGeneralSettings,
  midiRoutes: [],
  cursor: defaultCursorSettings,
  chordDisplay: [defaultChordDisplaySettings],
  chordDictionary: defaultChordDictionarySettings,
  notation: defaultNotationSettings,
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
