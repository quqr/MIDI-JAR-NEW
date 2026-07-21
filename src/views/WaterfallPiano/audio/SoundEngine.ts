import { midiToNoteName } from "../constants";
import { defaultWaterfallSettings } from "../constants";
import type { SoundEngineUserConfig, SynthEnvelopeConfig } from "../types";
import type { ISoundEngine } from "./ISoundEngine";

// 默认配置唯一来源：从 constants.ts 读取
const D = defaultWaterfallSettings.sound;

/** reverbDecay 变化超过此阈值才重新生成脉冲响应 */
const REVERB_REGEN_THRESHOLD = 1.0;

/**
 * 将自定义 SynthEnvelopeConfig 转换为 Tone.js 原生 envelope 参数格式，
 * 过滤掉多余字段（如 hand、trackIndex 等）
 */
function toEnvelopeConfig(e: SynthEnvelopeConfig) {
  return {
    attack: e.attack,
    decay: e.decay,
    sustain: e.sustain,
    release: e.release,
  };
}

export interface SoundEngineOptions {
  volume?: number;
  reverbAmount?: number;
  reverbDecay?: number;
  sustain?: boolean;
  velocitySensitivity?: boolean;
}

/**
 * 基于 Tone.js FMSynth 的钢琴音源引擎，
 * 支持 MIDI 音符触发、延音踏板、力度灵敏度及混响效果。
 * 内部通过引用计数机制处理同一音高被多个音符同时按住的情况。
 */
export class SoundEngine implements ISoundEngine {
  private Tone: typeof import("tone") | null = null;
  private synth: import("tone").PolySynth | null = null;
  private reverb: import("tone").Reverb | null = null;
  private sustainedNotes = new Set<string>();
  /** 引用计数：同一音高可被多个音符同时按住，只有计数归零才释放 */
  private heldNotes = new Map<string, number>();
  private sustain = false;
  private velocitySensitivity = true;
  private volume = D.volume;
  private initialized = false;
  /** 并发 init 去重 */
  private initPromise: Promise<void> | null = null;
  /** 防止并发生成脉冲响应 */
  private reverbGenerating = false;
  private pendingReverbDecay: number | null = null;

  /**
   * 初始化音频引擎，创建 FMSynth、Reverb 等音频节点。
   * 若已初始化则仅尝试恢复被浏览器暂停的音频上下文。
   * 并发安全：多次调用只会执行一次初始化。
   * @param config - 可选的用户配置，未指定的字段使用 constants.ts 中的默认值
   */
  async init(config?: Partial<SoundEngineUserConfig>): Promise<void> {
    if (this.initialized) {
      // 已初始化，但音频上下文可能被浏览器自动播放策略暂停
      const ctx = this.Tone?.getContext();
      if (ctx && ctx.state !== "running") {
        await ctx.resume();
      }
      return;
    }
    // 并发去重
    if (this.initPromise) return this.initPromise;
    this.initPromise = this.doInit(config).finally(() => {
      this.initPromise = null;
    });
    return this.initPromise;
  }

  private async doInit(config?: Partial<SoundEngineUserConfig>): Promise<void> {
    // Dynamic import to defer Tone.js loading until user interaction
    this.Tone = await import("tone");

    await this.Tone.start();

    const c = config ?? {};
    this.volume = c.volume ?? D.volume;
    this.sustain = c.sustain ?? D.sustain;
    this.velocitySensitivity = c.velocitySensitivity ?? D.velocitySensitivity;

    this.Tone.Destination.volume.value = this.Tone.gainToDb(this.volume);

    this.reverb = new this.Tone.Reverb({
      decay: c.reverbDecay ?? D.reverbDecay,
      wet: c.reverbAmount ?? D.reverbAmount,
    });
    await this.reverb.generate();

    const envelope = c.envelope ?? D.envelope;
    const modEnvelope = c.modulationEnvelope ?? D.modulationEnvelope;

    this.synth = new this.Tone.PolySynth(this.Tone.FMSynth, {
      harmonicity: c.harmonicity ?? D.harmonicity,
      modulationIndex: c.modulationIndex ?? D.modulationIndex,
      oscillator: { type: c.oscillatorType ?? D.oscillatorType } as Record<
        string,
        unknown
      >,
      envelope: toEnvelopeConfig(envelope),
      modulation: { type: "sine" },
      modulationEnvelope: toEnvelopeConfig(modEnvelope),
    });
    // 降低复音数：钢琴实际峰值复音 ~10-16，24 足够且大幅降低 CPU
    this.synth.maxPolyphony = 24;
    this.synth.connect(this.reverb);
    this.reverb.toDestination();

    this.initialized = true;
  }

  /** 从 store 配置更新运行时参数 */
  updateConfig(config: SoundEngineUserConfig): void {
    this.setVolume(config.volume);
    this.setVelocitySensitivity(config.velocitySensitivity);
    this.setSustain(config.sustain);

    if (this.reverb) {
      this.reverb.wet.value = config.reverbAmount;
      // reverbDecay 需要重新 generate，仅在差异较大时执行（防抖）
      const currentDecay = this.reverb.decay as number;
      if (
        Math.abs(currentDecay - config.reverbDecay) > REVERB_REGEN_THRESHOLD
      ) {
        this.scheduleReverbGenerate(config.reverbDecay);
      }
    }

    if (this.synth) {
      this.synth.set({
        harmonicity: config.harmonicity,
        modulationIndex: config.modulationIndex,
        oscillator: { type: config.oscillatorType },
        envelope: toEnvelopeConfig(config.envelope),
        modulationEnvelope: toEnvelopeConfig(config.modulationEnvelope),
      } as Record<string, unknown>);
    }
  }

  /**
   * 防抖式异步生成脉冲响应，避免并发生成和主线程阻塞
   */
  private async scheduleReverbGenerate(decay: number): Promise<void> {
    if (this.reverbGenerating) {
      // 正在生成，暂存最新值
      this.pendingReverbDecay = decay;
      return;
    }
    this.reverbGenerating = true;
    this.reverb!.decay = decay;
    await this.reverb!.generate();
    this.reverbGenerating = false;
    // 处理积压的更新
    if (this.pendingReverbDecay !== null) {
      const next = this.pendingReverbDecay;
      this.pendingReverbDecay = null;
      await this.scheduleReverbGenerate(next);
    }
  }

  /**
   * 触发 MIDI 音符发声，同一音高多次触发会累加引用计数
   * @param midi - MIDI 音符编号 (0-127)
   * @param velocity - 力度值 (0-127)
   */
  noteOn(midi: number, velocity: number): void {
    if (!this.synth || !this.initialized) return;
    const note = midiToNoteName(midi);
    const vel = this.velocitySensitivity ? velocity / 127 : 0.8;
    const count = this.heldNotes.get(note) ?? 0;
    this.heldNotes.set(note, count + 1);
    this.synth.triggerAttack(note, undefined, vel);
  }

  /**
   * 释放 MIDI 音符，引用计数归零时才真正停止发声；
   * 若延音踏板开启，音符会暂存到 sustainedNotes 中待踏板释放时统一释放
   * @param midi - MIDI 音符编号 (0-127)
   */
  noteOff(midi: number): void {
    if (!this.synth || !this.initialized) return;
    const note = midiToNoteName(midi);
    const count = this.heldNotes.get(note) ?? 0;
    if (count <= 1) {
      this.heldNotes.delete(note);
      if (!this.sustain) {
        this.synth.triggerRelease(note);
      } else {
        this.sustainedNotes.add(note);
      }
    } else {
      this.heldNotes.set(note, count - 1);
    }
  }

  setSustain(enabled: boolean): void {
    this.sustain = enabled;
    if (!enabled) {
      for (const note of this.sustainedNotes) {
        if (!this.heldNotes.has(note)) {
          this.synth?.triggerRelease(note);
        }
      }
      this.sustainedNotes.clear();
    }
  }

  setVolume(v: number): void {
    this.volume = v;
    if (this.initialized && this.Tone) {
      this.Tone.Destination.volume.value = this.Tone.gainToDb(v);
    }
  }

  setVelocitySensitivity(enabled: boolean): void {
    this.velocitySensitivity = enabled;
  }

  allNotesOff(): void {
    if (!this.synth || !this.initialized) return;
    this.synth.releaseAll();
    this.heldNotes.clear();
    this.sustainedNotes.clear();
  }

  dispose(): void {
    this.allNotesOff();
    this.synth?.dispose();
    this.reverb?.dispose();
    this.synth = null;
    this.reverb = null;
    this.Tone = null;
    this.initialized = false;
    this.reverbGenerating = false;
    this.pendingReverbDecay = null;
  }
}
