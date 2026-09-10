import type { ClickKind, ClickVoiceConfig } from "../types";

/**
 * 各级重音 / 细分的点击音色。
 *
 * 音高递减 + 衰减递减 = 强弱层次可听；噪声瞬态提供木鱼般的「敲击感」。
 * silent 档峰值 0，保留配置只为让类型完备（调用方不会触发它）。
 */
export const CLICK_VOICES: Record<ClickKind, ClickVoiceConfig> = {
  strong: {
    wave: "triangle",
    freq: 1760,
    decay: 0.055,
    peak: 1,
    noisePeak: 0.35,
    noiseDecay: 0.01,
    pan: 0,
  },
  medium: {
    wave: "triangle",
    freq: 1318.5,
    decay: 0.045,
    peak: 0.7,
    noisePeak: 0.22,
    noiseDecay: 0.008,
    pan: 0,
  },
  weak: {
    wave: "sine",
    freq: 880,
    decay: 0.035,
    peak: 0.48,
    noisePeak: 0.14,
    noiseDecay: 0.006,
    pan: 0,
  },
  silent: {
    wave: "sine",
    freq: 880,
    decay: 0.02,
    peak: 0,
    noisePeak: 0,
    noiseDecay: 0.006,
    pan: 0,
  },
  subdivision: {
    wave: "sine",
    freq: 1600,
    decay: 0.018,
    peak: 0.32,
    noisePeak: 0.08,
    noiseDecay: 0.005,
    pan: 0,
  },
};
