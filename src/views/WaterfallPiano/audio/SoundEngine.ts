import type { AudioPreset, PhysicalPianoConfig } from "../types";

export interface SoundEngineCallbacks {
  onNoteOn?: (midi: number, velocity: number) => void;
  onNoteOff?: (midi: number) => void;
}

/**
 * SoundEngine 抽象接口
 *
 * 所有音频引擎（Tone.js 预设 / 物理建模 worklet）均实现此接口，
 * WaterfallEngine 通过此接口多态调用。
 */
export interface SoundEngine {
  init(): Promise<void>;
  connect(output: AudioNode): void;
  disconnect(): void;

  noteOn(midi: number, velocity: number): void;
  noteOff(midi: number): void;
  setSustain(enabled: boolean): void;

  applyPreset(preset: AudioPreset): void;
  setVolume(db: number): void;
  setReverbWet(wet: number): void;
  setReverbDecay(decay: number): void;
  setConfig(cfg: PhysicalPianoConfig): void;

  setCallbacks(cb: SoundEngineCallbacks): void;
  dispose(): void;
}
