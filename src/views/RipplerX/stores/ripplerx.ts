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
  }

  /**
   * Apply worklet-style flat params (from BUILT_IN_PRESETS or .ripx) to
   * the structured store state. This is the reverse of syncAllParams().
   */
  function applyWorkletParams(params: Record<string, number>) {
    const s = state.value;
    const p = params;

    // Mallet
    if (p.mallet_type !== undefined) s.mallet.type = p.mallet_type;
    if (p.mallet_pitch !== undefined) s.mallet.pitch = p.mallet_pitch;
    if (p.mallet_filter !== undefined) s.mallet.filter = p.mallet_filter;
    if (p.mallet_mix !== undefined) s.mallet.mix = p.mallet_mix;
    if (p.mallet_res !== undefined) s.mallet.resonance = p.mallet_res;
    if (p.mallet_stiff !== undefined) s.mallet.stiffness = p.mallet_stiff;
    if (p.mallet_ktrack !== undefined) s.mallet.keyTracking = p.mallet_ktrack;

    // Resonator A
    if (p.a_on !== undefined) s.resonatorA.on = p.a_on >= 0.5;
    if (p.a_model !== undefined) s.resonatorA.model = p.a_model;
    if (p.a_partials !== undefined) s.resonatorA.partials = p.a_partials;
    if (p.a_decay !== undefined) s.resonatorA.decay = p.a_decay;
    if (p.a_damp !== undefined) s.resonatorA.damp = p.a_damp;
    if (p.a_tone !== undefined) s.resonatorA.tone = p.a_tone;
    if (p.a_hit !== undefined) s.resonatorA.hit = p.a_hit;
    if (p.a_rel !== undefined) s.resonatorA.release = p.a_rel;
    if (p.a_inharm !== undefined) s.resonatorA.inharmonicity = p.a_inharm;
    if (p.a_ratio !== undefined) s.resonatorA.ratio = p.a_ratio;
    if (p.a_cut !== undefined) s.resonatorA.cut = p.a_cut;
    if (p.a_radius !== undefined) s.resonatorA.radius = p.a_radius;

    // Resonator B
    if (p.b_on !== undefined) s.resonatorB.on = p.b_on >= 0.5;
    if (p.b_model !== undefined) s.resonatorB.model = p.b_model;
    if (p.b_partials !== undefined) s.resonatorB.partials = p.b_partials;
    if (p.b_decay !== undefined) s.resonatorB.decay = p.b_decay;
    if (p.b_damp !== undefined) s.resonatorB.damp = p.b_damp;
    if (p.b_tone !== undefined) s.resonatorB.tone = p.b_tone;
    if (p.b_hit !== undefined) s.resonatorB.hit = p.b_hit;
    if (p.b_rel !== undefined) s.resonatorB.release = p.b_rel;
    if (p.b_inharm !== undefined) s.resonatorB.inharmonicity = p.b_inharm;
    if (p.b_ratio !== undefined) s.resonatorB.ratio = p.b_ratio;
    if (p.b_cut !== undefined) s.resonatorB.cut = p.b_cut;
    if (p.b_radius !== undefined) s.resonatorB.radius = p.b_radius;

    // Noise
    if (p.noise_mix !== undefined) s.noise.mix = p.noise_mix;
    if (p.noise_res !== undefined) s.noise.resonance = p.noise_res;
    if (p.noise_filter_freq !== undefined) s.noise.frequency = p.noise_filter_freq;
    if (p.noise_filter_q !== undefined) s.noise.q = p.noise_filter_q;
    if (p.noise_filter_mode !== undefined) s.noise.filterType = p.noise_filter_mode;
    if (p.noise_att !== undefined) s.noise.attack = p.noise_att;
    if (p.noise_dec !== undefined) s.noise.decay = p.noise_dec;
    if (p.noise_sus !== undefined) s.noise.sustain = p.noise_sus;
    if (p.noise_rel !== undefined) s.noise.release = p.noise_rel;
    if (p.noise_att_ten !== undefined) s.noise.attackTension = p.noise_att_ten;
    if (p.noise_dec_ten !== undefined) s.noise.decayTension = p.noise_dec_ten;
    if (p.noise_rel_ten !== undefined) s.noise.releaseTension = p.noise_rel_ten;

    // Coupling
    if (p.couple !== undefined) s.coupling.mode = p.couple;
    if (p.ab_mix !== undefined) s.coupling.mix = p.ab_mix;
    if (p.ab_split !== undefined) s.coupling.split = p.ab_split;

    // Pitch
    if (p.bend_range !== undefined) s.pitch.bendRange = p.bend_range;

    // Gain
    if (p.gain !== undefined) s.gain.gain = p.gain;
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
    applyWorkletParams,
    resetToDefaults,
  };
});
