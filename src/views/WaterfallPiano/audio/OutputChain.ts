import * as Tone from "tone";

/**
 * OutputChain — 共享音频输出链
 *
 * 从 AudioEngine.init() 抽出的 filter→compressor→reverb→volume→destination。
 *
 * input 是一个 Tone.Gain 节点（桥接），两个引擎都可连接：
 * - AudioEngine (Tone.PolySynth): synth.connect(gain) — Tone-to-Tone
 * - PhysicalPianoEngine (AudioWorkletNode): node.connect(gain.input!) — AudioNode-to-AudioNode
 *
 * rawInput 返回 gain 的底层 GainNode，供原生 AudioNode 连接。
 */
export class OutputChain {
  readonly gain: Tone.Gain;
  filter!: Tone.Filter;
  compressor!: Tone.Compressor;
  reverb!: Tone.Reverb;
  volume!: Tone.Volume;

  private _initialized = false;

  /** 供 Tone.js 引擎连接的 Tone.Gain 节点 */
  get input(): Tone.Gain {
    return this.gain;
  }

  /** 供原生 AudioNode（如 AudioWorkletNode）连接 */
  get rawInput(): AudioNode | undefined {
    return this.gain.input;
  }

  constructor() {
    this.gain = new Tone.Gain(1);
  }

  async init(): Promise<void> {
    if (this._initialized) return;

    this.volume = new Tone.Volume(-6).toDestination();

    this.reverb = new Tone.Reverb({ wet: 0.25, decay: 2.5 }).connect(this.volume);
    await this.reverb.generate();

    this.compressor = new Tone.Compressor({
      threshold: -24,
      ratio: 4,
      attack: 0.003,
      release: 0.25,
    }).connect(this.reverb);

    this.filter = new Tone.Filter({
      frequency: 8000,
      type: "lowpass",
      rolloff: -12,
    }).connect(this.compressor);

    this.gain.connect(this.filter);

    this._initialized = true;
  }

  setVolume(db: number): void {
    if (this.volume) {
      this.volume.volume.value = db;
    }
  }

  setReverbWet(wet: number): void {
    if (this.reverb) {
      this.reverb.wet.value = wet;
    }
  }

  setReverbDecay(decay: number): void {
    if (this.reverb) {
      const wet = this.reverb.wet.value;
      this.reverb.dispose();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      this.reverb = new (Tone.Reverb as any)({ wet, decay });
      this.reverb.connect(this.volume);
      this.reverb.generate();
      if (this.compressor) {
        this.compressor.disconnect();
        this.compressor.connect(this.reverb);
      }
    }
  }

  dispose(): void {
    this.gain?.dispose();
    this.filter?.dispose();
    this.compressor?.dispose();
    this.reverb?.dispose();
    this.volume?.dispose();
    this._initialized = false;
  }
}
