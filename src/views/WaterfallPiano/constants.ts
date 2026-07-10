import type {
  WaterfallPianoSettings,
  PresetTheme,
  GradientStop,
} from "./types";

// ─── 多色渐变预设主题 ───
export interface PresetThemePalette {
  stops: GradientStop[];
  starColor: string;
  accentColor: string;
}

export const presetThemes: Record<PresetTheme, PresetThemePalette> = {
  "night-sky": {
    stops: [
      { position: 0, color: "#0a0a1f" },
      { position: 0.5, color: "#1a1a3e" },
      { position: 1, color: "#2d1b4e" },
    ],
    starColor: "#ffffff",
    accentColor: "#6366f1",
  },
  ocean: {
    stops: [
      { position: 0, color: "#001220" },
      { position: 0.5, color: "#003566" },
      { position: 1, color: "#0077b6" },
    ],
    starColor: "#caf0f8",
    accentColor: "#00b4d8",
  },
  sunset: {
    stops: [
      { position: 0, color: "#0f0c29" },
      { position: 0.4, color: "#e94560" },
      { position: 0.8, color: "#f59e0b" },
      { position: 1, color: "#fde047" },
    ],
    starColor: "#fef3c7",
    accentColor: "#ec4899",
  },
  aurora: {
    stops: [
      { position: 0, color: "#0a2e1a" },
      { position: 0.3, color: "#1b4332" },
      { position: 0.6, color: "#2d6a4f" },
      { position: 1, color: "#52b788" },
    ],
    starColor: "#d8f3dc",
    accentColor: "#40db81",
  },
  forest: {
    stops: [
      { position: 0, color: "#0b1a0b" },
      { position: 0.5, color: "#1b4332" },
      { position: 1, color: "#2d5016" },
    ],
    starColor: "#d9e8d0",
    accentColor: "#74c69d",
  },
};

// ─── 默认设置 ───
export const defaultWaterfallSettings: WaterfallPianoSettings = {
  particles: {
    colorScheme: "pitch",
    customColors: { low: "#6366f1", mid: "#14b8a6", high: "#f59e0b" },
    speed: 2,
    lookAhead: 3,
    opacity: 1.0,
    cornerRadius: 3,
    hitLine: {
      visible: true,
      color: "#ffffff",
      thickness: 2,
    },
  },
  background: {
    type: "preset",
    solidColor: "#1a1a2e",
    gradientDirection: "linear-vertical",
    gradientStart: "#0f0c29",
    gradientEnd: "#302b63",
    gradientStops: [
      { position: 0, color: "#0f0c29" },
      { position: 0.5, color: "#1a1a3e" },
      { position: 1, color: "#302b63" },
    ],
    presetTheme: "night-sky",
    imageFile: "",
    imageBlur: 0,
    imageDarken: 0.5,
    imageFitMode: "cover",
    starfieldEnabled: true,
    starfieldDensity: 0.5,
    fluidEnabled: false,
    fluidQuality: "medium",
    fluidStyle: "standard",
    fluidAdvanced: false,
    fluidParams: { hitExplosion: true, blockCoverage: false, splatRadius: 0.005 },
    flowAnimation: true,
    flowSpeed: 1,
  },
  keyboard: {
    visible: true,
    range: "88",
    customFrom: "A0",
    customTo: "C8",
    keyLabel: "none",
    whiteKeyColor: "#f0f0f0",
    blackKeyColor: "#1a1a1a",
    pressedKeyColor: "#6366f1",
    heightRatio: 0.3,
    keyCornerRadius: 0,
    keyBorderWidth: 1,
    keyBorderColor: "#333333",
    gapBlur: 6,
    separatorEnabled: true,
    separatorColor: "#ffffff",
    separatorThickness: 2,
    staffVisible: false,
    synthesiaFlowDirection: "down",
    showNoteNames: false,
  },
  midiFile: {
    playbackSpeed: 1,
    selectedTracks: [],
    trackColors: [
      "#6366f1",
      "#ec4899",
      "#14b8a6",
      "#f59e0b",
      "#8b5cf6",
      "#06b6d4",
      "#ef4444",
      "#22c55e",
    ],
    loop: false,
    showNoteNames: false,
  },
};

// ─── 键盘快捷键映射（A-K → C4-C5） ───
export const keyboardMap: Record<string, number> = {
  a: 60, // C4
  w: 61, // C#4
  s: 62, // D4
  e: 63, // D#4
  d: 64, // E4
  f: 65, // F4
  t: 66, // F#4
  g: 67, // G4
  y: 68, // G#4
  h: 69, // A4
  u: 70, // A#4
  j: 71, // B4
  k: 72, // C5
};

// ─── 持久化键 ───
export const STORAGE_KEY = "waterfall-piano-settings";
export const RECORDING_STORAGE_KEY = "waterfall-piano-recordings";

// ─── MIDI 路由 namespace ───
export const MIDI_NAMESPACE = "waterfall-piano/default";

// ─── 键盘范围定义 ───
export const KEYBOARD_RANGES: Record<string, { from: number; to: number }> = {
  "88": { from: 21, to: 108 },
  "61": { from: 36, to: 96 },
  "49": { from: 36, to: 84 },
};

// ─── 响应式断点 ───
export const NARROW_BREAKPOINT = 768;

// ─── 窄屏收束范围（C2-C6，49 键） ───
export const NARROW_RANGE = { from: 36, to: 84 };

// ─── 音名 ↔ MIDI 工具 ───
const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

export function midiToNoteName(midi: number): string {
  const octave = Math.floor(midi / 12) - 1;
  return NOTE_NAMES[midi % 12] + octave;
}

export function noteNameToMidi(name: string): number {
  const match = name.match(/^([A-G]#?)(-?\d+)$/);
  if (!match) return 60;
  const idx = NOTE_NAMES.indexOf(match[1]);
  if (idx < 0) return 60;
  return (parseInt(match[2], 10) + 1) * 12 + idx;
}

export function midiToPitchClass(midi: number): string {
  return NOTE_NAMES[midi % 12];
}
