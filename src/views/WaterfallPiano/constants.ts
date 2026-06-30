import type {
  WaterfallPianoSettings,
  AudioPreset,
} from "./types";

// ─── 默认设置 ───
export const defaultWaterfallSettings: WaterfallPianoSettings = {
  particles: {
    style: "blocks",
    shape: "circle",
    colorScheme: "pitch",
    customColors: { low: "#6366f1", mid: "#14b8a6", high: "#f59e0b" },
    speed: 2,
    lookAhead: 3,
    size: 8,
    opacity: 0.9,
    density: 5,
    trail: false,
    cornerRadius: 3,
    hitLine: {
      color: "#ffffff",
      glow: true,
      thickness: 2,
      glowRadius: 15,
      glowIntensity: 0.8,
      style: "solid",
      visible: true,
    },
    noteBlock: {
      borderColor: "#ffffff",
      borderWidth: 1,
      borderEnabled: false,
      gradientEnabled: false,
      gradientTopColor: "#6366f1",
      gradientBottomColor: "#14b8a6",
      highlightEnabled: true,
      highlightOpacity: 0.3,
      fadeIn: true,
      fadeOut: true,
    },
    trailParticle: {
      size: 4,
      colorDecay: 0.5,
      spreadAngle: 30,
      lifetime: 30,
    },
    hitParticle: {
      count: 8,
      speed: 3,
      lifetime: 20,
    },
    physics: {
      gravity: 0,
      windX: 0,
      windY: 0,
    },
  },
  background: {
    type: "preset",
    solidColor: "#1a1a2e",
    gradientDirection: "linear-vertical",
    gradientStart: "#0f0c29",
    gradientEnd: "#302b63",
    presetTheme: "night-sky",
    imageFile: "",
    imageBlur: 0,
    imageDarken: 0.5,
    imageFitMode: "cover",
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
    keyBorderWidth: 0,
    keyBorderColor: "#333333",
    separatorEnabled: true,
    separatorColor: "#ffffff",
    separatorThickness: 2,
  },
  audio: {
    preset: "grand-piano",
    volume: 80,
    reverbAmount: 30,
    reverbDecay: 2,
    sustain: false,
    velocitySensitivity: true,
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
  postProcessing: {
    bloom: {
      enabled: false,
      intensity: 0.5,
      threshold: 0.7,
      radius: 8,
    },
    motionBlur: {
      enabled: false,
      strength: 0.3,
    },
    chromaticAberration: {
      enabled: false,
      intensity: 0.3,
    },
    vignette: {
      enabled: false,
      intensity: 0.5,
      radius: 0.7,
    },
  },
  noteTexture: {
    preset: "none",
    scale: 1,
    intensity: 0.3,
  },
  noteBlockParticles: {
    surfaceEmission: {
      enabled: false,
      rate: 0.3,
      speed: 1,
      lifetime: 20,
    },
    hitExplosion: {
      enabled: false,
      count: 12,
      speed: 4,
      lifetime: 25,
    },
    orbiting: {
      enabled: false,
      count: 4,
      radius: 10,
      speed: 2,
    },
  },
};

// ─── 音色预设信息 ───
export const audioPresets: Record<
  AudioPreset,
  { labelKey: string; description: string }
> = {
  "grand-piano": {
    labelKey: "waterfallPiano.presets.grandPiano",
    description: "Classic piano sound",
  },
  "electric-piano": {
    labelKey: "waterfallPiano.presets.electricPiano",
    description: "FM synthesis electric piano",
  },
  "bright-piano": {
    labelKey: "waterfallPiano.presets.brightPiano",
    description: "Bright and clear piano",
  },
  "mellow-piano": {
    labelKey: "waterfallPiano.presets.mellowPiano",
    description: "Soft and warm piano",
  },
  organ: {
    labelKey: "waterfallPiano.presets.organ",
    description: "Classic organ sound",
  },
  "synth-pad": {
    labelKey: "waterfallPiano.presets.synthPad",
    description: "Ambient synth pad",
  },
};

// ─── 预设背景主题颜色 ───
export const presetThemes = {
  "night-sky": { start: "#0f0c29", end: "#302b63" },
  ocean: { start: "#000428", end: "#004e92" },
  sunset: { start: "#1a1a2e", end: "#e94560" },
  aurora: { start: "#0a2e1a", end: "#2d6a4f" },
  forest: { start: "#0b1a0b", end: "#1b4332" },
};

// ─── 键盘快捷键映射 ───
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

// ─── 键盘范围定义 ───
export const KEYBOARD_RANGES: Record<string, { from: number; to: number }> = {
  "88": { from: 21, to: 108 },
  "61": { from: 36, to: 96 },
  "49": { from: 36, to: 84 },
};
