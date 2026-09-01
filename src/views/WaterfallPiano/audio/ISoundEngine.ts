/**
 * 音频引擎接口 — WaterfallEngine 通过此接口与音频后端交互。
 *
 * 实现类：SamplerSoundEngine（smplr 采样器，音频配置由 useSamplerService 管理）
 */
export interface ISoundEngine {
  init(): Promise<void>;
  noteOn(midi: number, velocity: number): void;
  noteOff(midi: number): void;
  setSustain(enabled: boolean): void;
  allNotesOff(): void;
  dispose(): void;
  setVolume(v: number): void;
  setVelocitySensitivity(enabled: boolean): void;
}
