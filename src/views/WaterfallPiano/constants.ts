import type {
  WaterfallPianoSettings,
  AudioPreset,
  PresetTheme,
  GradientStop,
  VisualThemeId,
  ParticlePresetId,
  StyleParameters,
  ThemePreset,
  ParticleConfig,
  BackgroundConfig,
  PostProcessingConfig,
  NoteTextureConfig,
  NoteBlockParticleConfig,
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

// ─── 默认风格参数 ───
export const defaultStyleParameters: StyleParameters = {
  ambianceIntensity: 0.5,
  particleDensity: 0.5,
  burstForce: 0.5,
  floatSense: 0.5,
  glowIntensity: 0.5,
  colorTemperature: 0.5,
};

// ─── 粒子效果预设 ───
export interface ParticlePresetConfig {
  id: ParticlePresetId;
  labelKey: string;
  overrides: Partial<ParticleConfig>;
}

export const particlePresets: Record<ParticlePresetId, ParticlePresetConfig> = {
  classic: {
    id: "classic",
    labelKey: "waterfallPiano.particlePresets.classic",
    overrides: {
      shape: "circle",
      colorScheme: "pitch",
      size: 6,
      density: 5,
      opacity: 0.9,
      lifecycleCurve: true,
      trailParticle: {
        size: 4,
        colorDecay: 0.5,
        spreadAngle: 30,
        lifetime: 30,
        glowTexture: true,
        turbulence: 0.3,
      },
      hitParticle: {
        count: 8,
        speed: 3,
        lifetime: 20,
        glowTexture: true,
        turbulence: 0.3,
      },
    },
  },
  neon: {
    id: "neon",
    labelKey: "waterfallPiano.particlePresets.neon",
    overrides: {
      shape: "circle",
      colorScheme: "neon",
      size: 8,
      density: 8,
      opacity: 0.95,
      lifecycleCurve: true,
      trailParticle: {
        size: 5,
        colorDecay: 0.3,
        spreadAngle: 45,
        lifetime: 40,
        glowTexture: true,
        turbulence: 0.5,
      },
      hitParticle: {
        count: 16,
        speed: 5,
        lifetime: 30,
        glowTexture: true,
        turbulence: 0.6,
      },
    },
  },
  minimal: {
    id: "minimal",
    labelKey: "waterfallPiano.particlePresets.minimal",
    overrides: {
      shape: "square",
      colorScheme: "cool",
      size: 4,
      density: 3,
      opacity: 0.8,
      lifecycleCurve: false,
      trailParticle: {
        size: 2,
        colorDecay: 0.7,
        spreadAngle: 20,
        lifetime: 15,
        glowTexture: false,
        turbulence: 0.1,
      },
      hitParticle: {
        count: 4,
        speed: 2,
        lifetime: 15,
        glowTexture: false,
        turbulence: 0.1,
      },
    },
  },
  starlight: {
    id: "starlight",
    labelKey: "waterfallPiano.particlePresets.starlight",
    overrides: {
      shape: "star",
      colorScheme: "rainbow",
      size: 7,
      density: 6,
      opacity: 0.9,
      lifecycleCurve: true,
      trailParticle: {
        size: 5,
        colorDecay: 0.4,
        spreadAngle: 60,
        lifetime: 35,
        glowTexture: true,
        turbulence: 0.4,
      },
      hitParticle: {
        count: 12,
        speed: 4,
        lifetime: 25,
        glowTexture: true,
        turbulence: 0.5,
      },
    },
  },
  "retro-crt": {
    id: "retro-crt",
    labelKey: "waterfallPiano.particlePresets.retroCrt",
    overrides: {
      shape: "square",
      colorScheme: "warm",
      size: 5,
      density: 7,
      opacity: 0.85,
      lifecycleCurve: false,
      trailParticle: {
        size: 3,
        colorDecay: 0.6,
        spreadAngle: 25,
        lifetime: 20,
        glowTexture: false,
        turbulence: 0.2,
      },
      hitParticle: {
        count: 10,
        speed: 3,
        lifetime: 18,
        glowTexture: false,
        turbulence: 0.2,
      },
    },
  },
};

// ─── 视觉主题预设（统一所有视觉元素） ───
export interface VisualThemePreset {
  id: VisualThemeId;
  labelKey: string;
  description: string;
  particles: Partial<ParticleConfig>;
  background: Partial<BackgroundConfig>;
  postProcessing: Partial<PostProcessingConfig>;
  noteTexture?: Partial<NoteTextureConfig>;
  noteBlockParticles?: Partial<NoteBlockParticleConfig>;
  styleParameters: StyleParameters;
}

export const visualThemePresets: Record<VisualThemeId, VisualThemePreset> = {
  "classic-glow": {
    id: "classic-glow",
    labelKey: "waterfallPiano.visualThemes.classicGlow",
    description: "Soft glow with classic aesthetics",
    particles: {
      style: "blocks",
      colorScheme: "pitch",
      particlePreset: "classic",
      hitLine: {
        color: "#ffffff",
        glow: true,
        thickness: 2,
        glowRadius: 15,
        glowIntensity: 0.8,
        style: "solid",
        visible: true,
        shaderGlow: true,
      },
    },
    background: {
      type: "preset",
      presetTheme: "night-sky",
      starfieldEnabled: true,
      starfieldDensity: 0.5,
      fluidEnabled: false,
      flowAnimation: true,
      flowSpeed: 1,
    },
    postProcessing: {
      bloom: {
        enabled: true,
        intensity: 0.4,
        threshold: 0.7,
        radius: 8,
        multiPass: true,
      },
      hitLineGlow: { enabled: true, intensity: 0.8, radius: 15 },
    },
    styleParameters: { ...defaultStyleParameters },
  },
  "neon-particles": {
    id: "neon-particles",
    labelKey: "waterfallPiano.visualThemes.neonParticles",
    description: "Vibrant neon particles with intense glow",
    particles: {
      style: "particles",
      colorScheme: "neon",
      particlePreset: "neon",
      hitLine: {
        color: "#ec4899",
        glow: true,
        thickness: 3,
        glowRadius: 25,
        glowIntensity: 1,
        style: "solid",
        visible: true,
        shaderGlow: true,
      },
    },
    background: {
      type: "preset",
      presetTheme: "sunset",
      starfieldEnabled: false,
      fluidEnabled: true,
      fluidResolution: 0.5,
      flowAnimation: true,
      flowSpeed: 1.5,
    },
    postProcessing: {
      bloom: {
        enabled: true,
        intensity: 0.7,
        threshold: 0.6,
        radius: 12,
        multiPass: true,
      },
      hitLineGlow: { enabled: true, intensity: 1, radius: 25 },
    },
    styleParameters: {
      ambianceIntensity: 0.7,
      particleDensity: 0.7,
      burstForce: 0.8,
      floatSense: 0.5,
      glowIntensity: 0.9,
      colorTemperature: 0.6,
    },
  },
  "minimal-tutor": {
    id: "minimal-tutor",
    labelKey: "waterfallPiano.visualThemes.minimalTutor",
    description: "Clean minimal design for teaching",
    particles: {
      style: "blocks",
      colorScheme: "hands",
      particlePreset: "minimal",
      hitLine: {
        color: "#14b8a6",
        glow: false,
        thickness: 2,
        glowRadius: 8,
        glowIntensity: 0.5,
        style: "dashed",
        visible: true,
        shaderGlow: false,
      },
    },
    background: {
      type: "solid",
      solidColor: "#0f172a",
      starfieldEnabled: false,
      fluidEnabled: false,
      flowAnimation: false,
      flowSpeed: 1,
    },
    postProcessing: {
      bloom: {
        enabled: false,
        intensity: 0.3,
        threshold: 0.8,
        radius: 6,
        multiPass: false,
      },
      hitLineGlow: { enabled: false, intensity: 0.4, radius: 8 },
    },
    styleParameters: {
      ambianceIntensity: 0.2,
      particleDensity: 0.3,
      burstForce: 0.3,
      floatSense: 0.2,
      glowIntensity: 0.2,
      colorTemperature: 0.5,
    },
  },
  "starlight-magic": {
    id: "starlight-magic",
    labelKey: "waterfallPiano.visualThemes.starlightMagic",
    description: "Magical starlight with playful particles",
    particles: {
      style: "hybrid",
      colorScheme: "rainbow",
      particlePreset: "starlight",
      hitLine: {
        color: "#fde047",
        glow: true,
        thickness: 2,
        glowRadius: 20,
        glowIntensity: 0.9,
        style: "dotted",
        visible: true,
        shaderGlow: true,
      },
    },
    background: {
      type: "stars",
      starfieldEnabled: true,
      starfieldDensity: 0.9,
      fluidEnabled: false,
      flowAnimation: true,
      flowSpeed: 0.5,
    },
    postProcessing: {
      bloom: {
        enabled: true,
        intensity: 0.5,
        threshold: 0.6,
        radius: 10,
        multiPass: true,
      },
      hitLineGlow: { enabled: true, intensity: 0.9, radius: 20 },
    },
    styleParameters: {
      ambianceIntensity: 0.6,
      particleDensity: 0.6,
      burstForce: 0.6,
      floatSense: 0.8,
      glowIntensity: 0.7,
      colorTemperature: 0.5,
    },
  },
  "retro-crt": {
    id: "retro-crt",
    labelKey: "waterfallPiano.visualThemes.retroCrt",
    description: "Retro CRT style with scanlines",
    particles: {
      style: "blocks",
      colorScheme: "warm",
      particlePreset: "retro-crt",
      hitLine: {
        color: "#22c55e",
        glow: true,
        thickness: 2,
        glowRadius: 12,
        glowIntensity: 0.7,
        style: "solid",
        visible: true,
        shaderGlow: true,
      },
    },
    background: {
      type: "solid",
      solidColor: "#0a0a0a",
      starfieldEnabled: false,
      fluidEnabled: false,
      flowAnimation: false,
      flowSpeed: 1,
    },
    postProcessing: {
      bloom: {
        enabled: true,
        intensity: 0.3,
        threshold: 0.7,
        radius: 6,
        multiPass: false,
      },
      chromaticAberration: { enabled: true, intensity: 0.4 },
      vignette: { enabled: true, intensity: 0.7, radius: 0.5 },
      hitLineGlow: { enabled: true, intensity: 0.7, radius: 12 },
    },
    styleParameters: {
      ambianceIntensity: 0.4,
      particleDensity: 0.5,
      burstForce: 0.5,
      floatSense: 0.3,
      glowIntensity: 0.5,
      colorTemperature: 0.8,
    },
  },
};

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
      shaderGlow: true,
    },
    noteBlock: {
      borderColor: "#ffffff",
      borderWidth: 1,
      borderEnabled: false,
      gradientEnabled: false,
      gradientTopColor: "#6366f1",
      gradientBottomColor: "#14b8a6",
      gradientMidColor: "#3b82f6",
      highlightEnabled: true,
      highlightOpacity: 0.3,
      fadeIn: true,
      fadeOut: true,
      multiLayerGradient: true,
      activeGlow: true,
      activeGlowRadius: 8,
      shadowEnabled: true,
    },
    trailParticle: {
      size: 4,
      colorDecay: 0.5,
      spreadAngle: 30,
      lifetime: 30,
      glowTexture: true,
      turbulence: 0.3,
    },
    hitParticle: {
      count: 8,
      speed: 3,
      lifetime: 20,
      glowTexture: true,
      turbulence: 0.3,
    },
    physics: {
      gravity: 0,
      windX: 0,
      windY: 0,
    },
    particlePreset: "classic",
    lifecycleCurve: true,
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
    fluidResolution: 0.5,
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
    keyBorderWidth: 0,
    keyBorderColor: "#333333",
    separatorEnabled: true,
    separatorColor: "#ffffff",
    separatorThickness: 2,
    staffVisible: false,
    synthesiaFlowDirection: "down",
    showNoteNames: false,
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
      multiPass: true,
    },
    motionBlur: {
      enabled: false,
      strength: 0.3,
      layerOnly: true,
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
    hitLineGlow: {
      enabled: false,
      intensity: 0.8,
      radius: 15,
    },
  },
  noteTexture: {
    preset: "none",
    scale: 1,
    intensity: 0.3,
    customImage: "",
    customImageIntensity: 0.5,
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
  performance: {
    particleHardLimit: 500,
    autoDegrade: true,
    minFps: 45,
    targetFps: 60,
  },
  theme: {
    current: "classic-glow",
    styleParameters: { ...defaultStyleParameters },
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

// ─── 构建主题预设导出对象（用于导入导出） ───
export function buildThemePreset(
  id: VisualThemeId,
  settings: WaterfallPianoSettings,
): ThemePreset {
  const preset = visualThemePresets[id];
  return {
    id,
    name: preset.labelKey,
    particles: settings.particles,
    background: settings.background,
    postProcessing: settings.postProcessing,
    noteTexture: settings.noteTexture,
    noteBlockParticles: settings.noteBlockParticles,
    styleParameters: settings.theme.styleParameters,
  };
}
