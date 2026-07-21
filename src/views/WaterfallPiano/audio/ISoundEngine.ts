import type { SoundEngineUserConfig } from "../types";

/**
 * 音频引擎接口 — WaterfallEngine 通过此接口与音频后端交互。
 *
 * 实现类：SoundEngine（FMSynth）、SamplerSoundEngine（smplr 采样器）
 */
export interface ISoundEngine {
  init(config?: Partial<SoundEngineUserConfig>): Promise<void>;
  noteOn(midi: number, velocity: number): void;
  noteOff(midi: number): void;
  setSustain(enabled: boolean): void;
  allNotesOff(): void;
  dispose(): void;
  updateConfig(config: SoundEngineUserConfig): void;
  setVolume(v: number): void;
  setVelocitySensitivity(enabled: boolean): void;
}
