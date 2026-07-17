import type { WaterfallPianoSettings } from "./types";

// ─── 默认设置 ───
export const defaultWaterfallSettings: WaterfallPianoSettings = {
  particles: {
    colorScheme: "pitch",
    customColors: { low: "#6366f1", mid: "#14b8a6", high: "#f59e0b" },
    speed: 2,
    lookAhead: 3,
    opacity: 1.0,
    cornerRadius: 3,
    hitExplosionRadius: 0.03,
    hitLine: {
      visible: true,
      color: "#ffffff",
      thickness: 2,
    },
  },
  background: {
    type: "solid",
    solidColor: "#1a1a2e",
    fluidEnabled: true,
    fluidQuality: "medium",
    fluidStyle: "standard",
    fluidAdvanced: false,
    fluidParams: {
      hitExplosion: true,
      blockCoverage: false,
      splatRadius: 0.005,
    },
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
  sound: {
    volume: 0.8,
    reverbAmount: 0.3,
    reverbDecay: 2,
    sustain: false,
    velocitySensitivity: true,
    harmonicity: 2,
    modulationIndex: 10,
    oscillatorType: "triangle",
    envelope: {
      attack: 0.002,
      decay: 0.3,
      sustain: 0.3,
      release: 1.0,
    },
    modulationEnvelope: {
      attack: 0.005,
      decay: 0.5,
      sustain: 0.2,
      release: 0.5,
    },
  },
  aura: {
    enabled: true,
    style: "glow",
    target: "triggered",
    intensity: 50,
    radius: 12,
    animationSpeed: 1.0,
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
export const SETTINGS_VERSION = 4; // 递增此版本号可强制重置 localStorage 中的旧设置
export const RECORDING_STORAGE_KEY = "waterfall-piano-recordings";

// ─── MIDI 路由 namespace ───
export const MIDI_NAMESPACE = "waterfall-piano/default";

/** 键盘范围定义，from/to 为 MIDI 音符号 */
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
const NOTE_NAMES = [
  "C",
  "C#",
  "D",
  "D#",
  "E",
  "F",
  "F#",
  "G",
  "G#",
  "A",
  "A#",
  "B",
];

/**
 * 将 MIDI 音符号转换为音名（如 60 → "C4"）
 * @param midi - MIDI 音符号（0-127）
 * @returns 音名字符串，格式为 音名+八度（如 "C#3"）
 */
export function midiToNoteName(midi: number): string {
  const octave = Math.floor(midi / 12) - 1;
  return NOTE_NAMES[midi % 12] + octave;
}

/**
 * 将音名转换为 MIDI 音符号（如 "C4" → 60）
 * @param name - 音名字符串，格式为 音名+八度（如 "F#5"）
 * @returns MIDI 音符号；解析失败时返回 60（C4）
 */
export function noteNameToMidi(name: string): number {
  const match = name.match(/^([A-G]#?)(-?\d+)$/);
  if (!match) return 60;
  const idx = NOTE_NAMES.indexOf(match[1]);
  if (idx < 0) return 60;
  return (parseInt(match[2], 10) + 1) * 12 + idx;
}

/**
 * 获取 MIDI 音符号对应的音高类名（不含八度，如 61 → "C#"）
 * @param midi - MIDI 音符号（0-127）
 * @returns 音高类名（C, C#, D, ... B）
 */
export function midiToPitchClass(midi: number): string {
  return NOTE_NAMES[midi % 12];
}
