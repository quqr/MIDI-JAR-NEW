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
  // ── 以下为可选的前瞻调度扩展（score-scroll 播放用，实现方可缺省） ──
  /**
   * 前瞻调度：在音频时钟 when（AudioContext 秒）精确触发音符，
   * 持续 duration 秒后自动收尾——主线程卡顿不再影响发声节拍。
   * 引擎不支持时调用方需回退为轮询 noteOn。
   */
  scheduleNote?(
    midi: number,
    velocity: number,
    when: number,
    duration: number,
  ): void;
  /** 取消所有尚未发声的前瞻调度音符（暂停/跳转时调用） */
  cancelScheduledNotes?(): void;
  /** 音频时钟当前值（AudioContext 秒）；引擎无音频时钟时返回 null */
  getAudioNow?(): number | null;
}
