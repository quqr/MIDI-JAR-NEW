// Parameter definitions for the RipplerX modal synth port
// Extracted from PluginProcessor.cpp constructor
// Each param defines: id, display name, type, range, default, skew, choices (for choice params), step

export type ParamType = 'float' | 'bool' | 'choice' | 'int';

export interface ParamDef {
  id: string;
  name: string;
  type: ParamType;
  min: number;
  max: number;
  default: number;
  skew: number;  // 1.0 = linear, != 1.0 = skewed (JUCE NormalisableRange skew)
  step: number;  // step size for float params
  choices?: string[]; // for choice params
}

// Convert 0-1 normalized value to actual parameter value (JUCE denormalize)
export function denormalizeParam(id: string, normalized: number): number {
  const def = PARAM_DEFS.find(p => p.id === id);
  if (!def) return normalized;

  if (def.type === 'bool') return normalized >= 0.5 ? 1 : 0;
  if (def.type === 'choice') return Math.round(normalized * (def.choices!.length - 1));
  if (def.type === 'int') return Math.round(def.min + normalized * (def.max - def.min));

  // Float with skew
  if (def.skew !== 1.0) {
    return def.min + Math.pow(normalized, def.skew) * (def.max - def.min);
  }
  return def.min + normalized * (def.max - def.min);
}

// Convert actual parameter value to 0-1 normalized value (JUCE normalize)
export function normalizeParam(id: string, value: number): number {
  const def = PARAM_DEFS.find(p => p.id === id);
  if (!def) return value;

  if (def.type === 'bool') return value >= 0.5 ? 1 : 0;
  if (def.type === 'choice') {
    const idx = Math.round(value);
    return def.choices!.length > 1 ? idx / (def.choices!.length - 1) : 0;
  }
  if (def.type === 'int') {
    return def.max > def.min ? (value - def.min) / (def.max - def.min) : 0;
  }

  // Float with skew
  const ratio = (value - def.min) / (def.max - def.min);
  if (def.skew !== 1.0) {
    return Math.pow(Math.max(0, Math.min(1, ratio)), 1.0 / def.skew);
  }
  return Math.max(0, Math.min(1, ratio));
}

export const PARAM_DEFS: ParamDef[] = [
  // ── Mallet ──
  {
    id: 'mallet_type', name: 'Mallet Type', type: 'choice', min: 0, max: 25, default: 0, skew: 1, step: 1,
    choices: ['Impulse', 'Reserved', 'Reserved', 'Reserved', 'Reserved', 'Reserved', 'Reserved', 'Reserved', 'Reserved', 'Reserved', 'Reserved', 'User File', 'Click 1', 'Click 2', 'Click 3', 'Click 4', 'Click 5', 'Click 6', 'Blip', 'Blop', 'Metal 1', 'Metal 2', 'Wood', 'Strike', 'Perc 1', 'Perc 2']
  },
  { id: 'mallet_pitch', name: 'Mallet Pitch', type: 'float', min: -24, max: 24, default: 0, skew: 1, step: 0.01 },
  { id: 'mallet_filter', name: 'Mallet Filter', type: 'float', min: -1, max: 1, default: 0, skew: 1, step: 0.01 },
  { id: 'mallet_mix', name: 'Mallet Mix', type: 'float', min: 0, max: 1, default: 0, skew: 1, step: 0.001 },
  { id: 'mallet_res', name: 'Mallet Resonance', type: 'float', min: 0, max: 1, default: 0.8, skew: 1, step: 0.001 },
  { id: 'mallet_stiff', name: 'Mallet Stiffness', type: 'float', min: 100, max: 5000, default: 600, skew: 0.3, step: 1 },
  { id: 'mallet_ktrack', name: 'Mallet Keytrack', type: 'float', min: 0, max: 1, default: 0, skew: 1, step: 0.001 },

  // ── Resonator A ──
  { id: 'a_on', name: 'A ON', type: 'bool', min: 0, max: 1, default: 1, skew: 1, step: 1 },
  {
    id: 'a_model', name: 'A Model', type: 'choice', min: 0, max: 11, default: 0, skew: 1, step: 1,
    choices: ['String', 'Beam', 'Squared', 'Membrane', 'Plate', 'Drumhead', 'Marimba', 'Open Tube', 'Closed Tube', 'Marimba2', 'Bell', 'Djembe']
  },
  {
    id: 'a_partials', name: 'A Partials', type: 'choice', min: 0, max: 6, default: 3, skew: 1, step: 1,
    choices: ['4', '8', '16', '32', '64', '1', '2']
  },
  { id: 'a_decay', name: 'A Decay', type: 'float', min: 0.01, max: 100, default: 1, skew: 0.2, step: 0.01 },
  { id: 'a_damp', name: 'A Material', type: 'float', min: -1, max: 1, default: 0, skew: 1, step: 0.01 },
  { id: 'a_tone', name: 'A Tone', type: 'float', min: -1, max: 1, default: 0, skew: 1, step: 0.01 },
  { id: 'a_hit', name: 'A HitPos', type: 'float', min: 0.02, max: 0.5, default: 0.26, skew: 1, step: 0.001 },
  { id: 'a_rel', name: 'A Release', type: 'float', min: 0.001, max: 1, default: 1, skew: 1, step: 0.001 },
  { id: 'a_inharm', name: 'A Inharmonic', type: 'float', min: 0.0001, max: 1, default: 0.0001, skew: 0.3, step: 0.0001 },
  { id: 'a_ratio', name: 'A Ratio', type: 'float', min: 0.1, max: 10, default: 1, skew: 0.3, step: 0.01 },
  { id: 'a_cut', name: 'A LowCut', type: 'float', min: -1, max: 1, default: 0, skew: 1, step: 0.001 },
  { id: 'a_radius', name: 'A Tube Radius', type: 'float', min: 0, max: 1, default: 0.5, skew: 1, step: 0.001 },
  { id: 'a_coarse', name: 'A coarse pitch', type: 'float', min: -48, max: 48, default: 0, skew: 1, step: 1 },
  { id: 'a_fine', name: 'A fine pitch', type: 'float', min: -99, max: 99, default: 0, skew: 1, step: 1 },

  // ── Resonator B ──
  { id: 'b_on', name: 'B ON', type: 'bool', min: 0, max: 1, default: 0, skew: 1, step: 1 },
  {
    id: 'b_model', name: 'B Model', type: 'choice', min: 0, max: 11, default: 0, skew: 1, step: 1,
    choices: ['String', 'Beam', 'Squared', 'Membrane', 'Plate', 'Drumhead', 'Marimba', 'Open Tube', 'Closed Tube', 'Marimba2', 'Bell', 'Djembe']
  },
  {
    id: 'b_partials', name: 'B Partials', type: 'choice', min: 0, max: 6, default: 3, skew: 1, step: 1,
    choices: ['4', '8', '16', '32', '64', '1', '2']
  },
  { id: 'b_decay', name: 'B Decay', type: 'float', min: 0.01, max: 100, default: 1, skew: 0.2, step: 0.01 },
  { id: 'b_damp', name: 'B Material', type: 'float', min: -1, max: 1, default: 0, skew: 1, step: 0.01 },
  { id: 'b_tone', name: 'B Tone', type: 'float', min: -1, max: 1, default: 0, skew: 1, step: 0.01 },
  { id: 'b_hit', name: 'B HitPos', type: 'float', min: 0.02, max: 0.5, default: 0.26, skew: 1, step: 0.001 },
  { id: 'b_rel', name: 'B Release', type: 'float', min: 0.001, max: 1, default: 1, skew: 1, step: 0.001 },
  { id: 'b_inharm', name: 'B Inharmonic', type: 'float', min: 0.0001, max: 1, default: 0.0001, skew: 0.3, step: 0.0001 },
  { id: 'b_ratio', name: 'B Ratio', type: 'float', min: 0.1, max: 10, default: 1, skew: 0.3, step: 0.01 },
  { id: 'b_cut', name: 'B LowCut', type: 'float', min: -1, max: 1, default: 0, skew: 1, step: 0.001 },
  { id: 'b_radius', name: 'B Tube Radius', type: 'float', min: 0, max: 1, default: 0.5, skew: 1, step: 0.001 },
  { id: 'b_coarse', name: 'B coarse pitch', type: 'float', min: -48, max: 48, default: 0, skew: 1, step: 1 },
  { id: 'b_fine', name: 'B fine pitch', type: 'float', min: -99, max: 99, default: 0, skew: 1, step: 1 },

  // ── Noise ──
  { id: 'noise_osc', name: 'Noise DC', type: 'float', min: 0, max: 1, default: 0, skew: 1, step: 0.0001 },
  { id: 'noise_mix', name: 'Noise Mix', type: 'float', min: 0, max: 1, default: 0, skew: 0.3, step: 0.0001 },
  { id: 'noise_res', name: 'Noise Resonance', type: 'float', min: 0, max: 1, default: 0, skew: 0.3, step: 0.0001 },
  {
    id: 'noise_filter_mode', name: 'Noise Filter Mode', type: 'choice', min: 0, max: 2, default: 2, skew: 1, step: 1,
    choices: ['LP', 'BP', 'HP']
  },
  { id: 'noise_filter_freq', name: 'Noise Filter Freq', type: 'float', min: 20, max: 20000, default: 20, skew: 0.3, step: 1 },
  { id: 'noise_filter_q', name: 'Noise Filter Q', type: 'float', min: 0.707, max: 4, default: 0.707, skew: 1, step: 0.001 },
  { id: 'noise_att', name: 'Noise Attack', type: 'float', min: 1, max: 20000, default: 1, skew: 0.3, step: 1 },
  { id: 'noise_dec', name: 'Noise Decay', type: 'float', min: 1, max: 20000, default: 500, skew: 0.3, step: 1 },
  { id: 'noise_sus', name: 'Noise Sustain', type: 'float', min: 0, max: 1, default: 0, skew: 1, step: 0.001 },
  { id: 'noise_rel', name: 'Noise Release', type: 'float', min: 1, max: 20000, default: 500, skew: 0.3, step: 1 },
  { id: 'noise_att_ten', name: 'Noise Attack Tension', type: 'float', min: -1, max: 1, default: 0.4, skew: 1, step: 0.001 },
  { id: 'noise_dec_ten', name: 'Noise Decay Tension', type: 'float', min: -1, max: 1, default: 0.4, skew: 1, step: 0.001 },
  { id: 'noise_rel_ten', name: 'Noise Release Tension', type: 'float', min: -1, max: 1, default: 0.4, skew: 1, step: 0.001 },

  // ── Velocity ──
  { id: 'vel_mallet_mix', name: 'Vel Mallet Mix', type: 'float', min: -1, max: 1, default: 0, skew: 1, step: 0.001 },
  { id: 'vel_mallet_res', name: 'Vel Mallet Resonance', type: 'float', min: -1, max: 1, default: 0, skew: 1, step: 0.001 },
  { id: 'vel_mallet_stiff', name: 'Vel Mallet Stiffness', type: 'float', min: -1, max: 1, default: 0, skew: 1, step: 0.001 },
  { id: 'vel_noise_mix', name: 'Vel Noise Mix', type: 'float', min: -1, max: 1, default: 0, skew: 1, step: 0.001 },
  { id: 'vel_noise_res', name: 'Vel Noise Resonance', type: 'float', min: -1, max: 1, default: 0, skew: 1, step: 0.001 },
  { id: 'vel_noise_freq', name: 'Vel Noise Frequency', type: 'float', min: -1, max: 1, default: 0, skew: 1, step: 0.001 },
  { id: 'vel_noise_att', name: 'Vel Noise Attack', type: 'float', min: -1, max: 1, default: 0, skew: 1, step: 0.001 },
  { id: 'vel_noise_dec', name: 'Vel Noise Decay', type: 'float', min: -1, max: 1, default: 0, skew: 1, step: 0.001 },
  { id: 'vel_noise_sus', name: 'Vel Noise Sustain', type: 'float', min: -1, max: 1, default: 0, skew: 1, step: 0.001 },
  { id: 'vel_noise_rel', name: 'Vel Noise Release', type: 'float', min: -1, max: 1, default: 0, skew: 1, step: 0.001 },
  { id: 'vel_noise_q', name: 'Vel Noise Q', type: 'float', min: -1, max: 1, default: 0, skew: 1, step: 0.001 },
  { id: 'vel_a_decay', name: 'Vel A Decay', type: 'float', min: -1, max: 1, default: 0, skew: 1, step: 0.001 },
  { id: 'vel_a_hit', name: 'Vel A Hit', type: 'float', min: -1, max: 1, default: 0, skew: 1, step: 0.001 },
  { id: 'vel_a_inharm', name: 'Vel A Inharmonic', type: 'float', min: -1, max: 1, default: 0, skew: 1, step: 0.001 },
  { id: 'vel_a_damp', name: 'Vel A Material', type: 'float', min: -1, max: 1, default: 0, skew: 1, step: 0.001 },
  { id: 'vel_a_tone', name: 'Vel A Tone', type: 'float', min: -1, max: 1, default: 0, skew: 1, step: 0.001 },
  { id: 'vel_b_decay', name: 'Vel B Decay', type: 'float', min: -1, max: 1, default: 0, skew: 1, step: 0.001 },
  { id: 'vel_b_hit', name: 'Vel B Hit', type: 'float', min: -1, max: 1, default: 0, skew: 1, step: 0.001 },
  { id: 'vel_b_inharm', name: 'Vel B Inharmonic', type: 'float', min: -1, max: 1, default: 0, skew: 1, step: 0.001 },
  { id: 'vel_b_damp', name: 'Vel B Material', type: 'float', min: -1, max: 1, default: 0, skew: 1, step: 0.001 },
  { id: 'vel_b_tone', name: 'Vel B Tone', type: 'float', min: -1, max: 1, default: 0, skew: 1, step: 0.001 },

  // ── Coupling ──
  {
    id: 'couple', name: 'Coupling', type: 'choice', min: 0, max: 1, default: 0, skew: 1, step: 1,
    choices: ['A+B', 'A>B']
  },
  { id: 'ab_mix', name: 'A+B Mix', type: 'float', min: 0, max: 1, default: 0.5, skew: 1, step: 0.001 },
  { id: 'ab_split', name: 'A>B Split', type: 'float', min: 0.01, max: 1, default: 0.01, skew: 0.5, step: 0.001 },

  // ── Global ──
  { id: 'gain', name: 'Res Gain', type: 'float', min: -24, max: 24, default: 0, skew: 1, step: 0.01 },
  { id: 'bend_range', name: 'PitchBend Range', type: 'int', min: 1, max: 24, default: 2, skew: 1, step: 1 },
  { id: 'stereoizer', name: 'Stereoizer', type: 'bool', min: 0, max: 1, default: 1, skew: 1, step: 1 },
  { id: 'reuse_voices', name: 'Reuse Voices', type: 'bool', min: 0, max: 1, default: 0, skew: 1, step: 1 },
  { id: 'fadeout_repeats', name: 'Fadeout Repeated Notes', type: 'bool', min: 0, max: 1, default: 0, skew: 1, step: 1 },
];

/** Map from param id to its definition */
export const PARAM_DEF_MAP = new Map(PARAM_DEFS.map(p => [p.id, p]));

/** Partial count choice index → actual partial count */
export function choiceToPartialCount(choiceIndex: number): number {
  const map = [4, 8, 16, 32, 64, 1, 2];
  return map[choiceIndex] ?? 32;
}

/** Model choice index → model name */
export const MODEL_NAMES = ['String', 'Beam', 'Squared', 'Membrane', 'Plate', 'Drumhead', 'Marimba', 'OpenTube', 'ClosedTube', 'Marimba2', 'Bell', 'Djembe'] as const;
export type ModalModel = typeof MODEL_NAMES[number];
export const MODEL_INDEX: Record<ModalModel, number> = Object.fromEntries(MODEL_NAMES.map((n, i) => [n, i])) as Record<ModalModel, number>;
