import { defineStore } from "pinia";
import { ref, watch } from "vue";
import { loadFromStorage, saveToStorage } from "@/helpers/storage";
import { debounce } from "@/helpers/debounce";

// ── Resonator model list ──
export const RESONATOR_MODELS = [
  "String",
  "Bar",
  "Tube",
  "Mirror",
  "Membrane",
  "Plate",
  "Shell",
  "Drum",
  "Marimba",
  "Vibraphone",
  "Glockenspiel",
  "Custom",
] as const;
export type ResonatorModel = (typeof RESONATOR_MODELS)[number];

// ── Partial counts ──
export const PARTIAL_COUNTS = [4, 8, 16, 32, 64] as const;

// ── Noise filter types ──
export const NOISE_FILTER_TYPES = ["LP", "BP", "HP"] as const;

// ── Mallet types ──
export const MALLET_TYPES = ["Impulse", "Samples"] as const;

// ── Coupling modes ──
export const COUPLING_MODES = ["A+B Parallel", "A>B Serial"] as const;

// ── Parameter defaults (JUCE normalised 0-1 + denormalised for display) ──
export interface NoiseParams {
  filterType: number; // 0=LP, 1=BP, 2=HP
  mix: number;        // 0-1
  resonance: number;  // 0-1
  frequency: number;  // 0-1
  q: number;          // 0-1
  attack: number;     // 0-1
  decay: number;      // 0-1
  sustain: number;    // 0-1
  release: number;    // 0-1
  attackTension: number;  // 0-1
  decayTension: number;   // 0-1
  releaseTension: number; // 0-1
}

export interface MalletParams {
  type: number;      // 0=Impulse, 1=Samples
  mix: number;       // 0-1
  resonance: number; // 0-1
  stiffness: number; // 0-1
  pitch: number;     // 0-1
  filter: number;    // 0-1
  keyTracking: number; // 0-1
}

export interface ResonatorParams {
  on: boolean;
  model: number;       // index into RESONATOR_MODELS
  partials: number;    // index into PARTIAL_COUNTS → 4/8/16/32/64
  decay: number;       // 0-1
  damp: number;        // 0-1
  tone: number;        // 0-1
  hit: number;         // 0-1
  release: number;     // 0-1
  inharmonicity: number; // 0-1
  ratio: number;       // 0-1
  cut: number;         // 0-1
  radius: number;      // 0-1
  coarse: number;      // semitones -24..24
  fine: number;        // cents -100..100
}

export interface CouplingParams {
  mode: number; // 0=A+B Parallel, 1=A>B Serial
  mix: number;  // 0-1
  split: number; // 0-1
}

export interface PitchParams {
  coarseA: number; // semitones
  fineA: number;   // cents
  coarseB: number;
  fineB: number;
  bendRange: number; // semitones
}

export interface GainParams {
  gain: number; // 0-1
}

export interface RipplerXState {
  polyphony: number;       // 1-16
  velocityMapping: boolean;
  currentPreset: string;
  noise: NoiseParams;
  mallet: MalletParams;
  resonatorA: ResonatorParams;
  resonatorB: ResonatorParams;
  coupling: CouplingParams;
  pitch: PitchParams;
  gain: GainParams;
}

const STORAGE_KEY = "midi-jar-ripplerx";

export const defaultRipplerXState: RipplerXState = {
  polyphony: 8,
  velocityMapping: true,
  currentPreset: "Init",
  noise: {
    filterType: 0,
    mix: 0.3,
    resonance: 0.0,
    frequency: 0.5,
    q: 0.5,
    attack: 0.0,
    decay: 0.5,
    sustain: 0.0,
    release: 0.3,
    attackTension: 0.5,
    decayTension: 0.5,
    releaseTension: 0.5,
  },
  mallet: {
    type: 0,
    mix: 1.0,
    resonance: 0.5,
    stiffness: 0.5,
    pitch: 0.5,
    filter: 0.5,
    keyTracking: 0.5,
  },
  resonatorA: {
    on: true,
    model: 0,
    partials: 3, // index 3 → 32
    decay: 0.5,
    damp: 0.0,
    tone: 0.0,
    hit: 0.26,
    release: 0.5,
    inharmonicity: 0.0,
    ratio: 0.5,
    cut: 1.0,
    radius: 0.5,
    coarse: 0,
    fine: 0,
  },
  resonatorB: {
    on: false,
    model: 0,
    partials: 3,
    decay: 0.5,
    damp: 0.0,
    tone: 0.0,
    hit: 0.26,
    release: 0.5,
    inharmonicity: 0.0,
    ratio: 0.5,
    cut: 1.0,
    radius: 0.5,
    coarse: 0,
    fine: 0,
  },
  coupling: {
    mode: 0,
    mix: 0.5,
    split: 0.5,
  },
  pitch: {
    coarseA: 0,
    fineA: 0,
    coarseB: 0,
    fineB: 0,
    bendRange: 2,
  },
  gain: {
    gain: 0.7,
  },
};

/** Built-in preset names */
export const BUILTIN_PRESETS = [
  "Init",
  "Harpsi",
  "Harp",
  "Sankyo",
  "Tubes",
  "Stars",
  "DoorBell",
  "Bells",
  "Bells2",
  "KeyRing",
  "Sink",
  "Cans",
  "Gong",
  "Bong",
  "Marimba",
  "Fight",
  "Tabla",
  "Tabla2",
  "Strings",
  "OldClock",
  "Crystal",
  "Ride",
  "Ride2",
  "Crash",
  "Vibes",
  "Flute",
  "Fifths",
  "Kalimba",
] as const;

function loadState(): RipplerXState {
  const stored = loadFromStorage<Partial<RipplerXState>>({
    key: STORAGE_KEY,
    defaultValue: {},
  });
  if (Object.keys(stored).length > 0) {
    return {
      ...defaultRipplerXState,
      ...stored,
      noise: { ...defaultRipplerXState.noise, ...stored.noise },
      mallet: { ...defaultRipplerXState.mallet, ...stored.mallet },
      resonatorA: { ...defaultRipplerXState.resonatorA, ...stored.resonatorA },
      resonatorB: { ...defaultRipplerXState.resonatorB, ...stored.resonatorB },
      coupling: { ...defaultRipplerXState.coupling, ...stored.coupling },
      pitch: { ...defaultRipplerXState.pitch, ...stored.pitch },
      gain: { ...defaultRipplerXState.gain, ...stored.gain },
    };
  }
  return { ...defaultRipplerXState };
}

export const useRipplerXStore = defineStore("RipplerX", () => {
  const state = ref<RipplerXState>(loadState());

  function setParam<K extends keyof RipplerXState>(
    section: K,
    key: keyof RipplerXState[K],
    value: unknown,
  ) {
    (state.value[section] as Record<string, unknown>)[key as string] = value;
  }

  function loadPreset(name: string) {
    state.value.currentPreset = name;
    // Presets will be loaded via useModalSynth which sets all params
  }

  function resetToDefaults() {
    state.value = { ...defaultRipplerXState };
  }

  const debouncedSave = debounce((s: RipplerXState) => {
    saveToStorage(STORAGE_KEY, s);
  }, 300) as (s: RipplerXState) => void;

  watch(state, (s) => debouncedSave(s), { deep: true });

  return {
    state,
    setParam,
    loadPreset,
    resetToDefaults,
  };
});
