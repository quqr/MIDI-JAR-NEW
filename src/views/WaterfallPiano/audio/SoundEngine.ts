import * as Tone from "tone";
import { midiToNoteName } from "../constants";
import type { SoundEngineUserConfig } from "../types";

const DEFAULT_VOLUME = 0.8;
const DEFAULT_REVERB_DECAY = 2;
const DEFAULT_REVERB_WET = 0.3;

export interface SoundEngineOptions {
  volume?: number;
  reverbAmount?: number;
  reverbDecay?: number;
  sustain?: boolean;
  velocitySensitivity?: boolean;
}

export class SoundEngine {
  private synth: Tone.PolySynth | null = null;
  private reverb: Tone.Reverb | null = null;
  private sustainedNotes = new Set<string>();
  /** 引用计数：同一音高可被多个音符同时按住，只有计数归零才释放 */
  private heldNotes = new Map<string, number>();
  private sustain = false;
  private velocitySensitivity = true;
  private volume = DEFAULT_VOLUME;
  private initialized = false;

  async init(config?: Partial<SoundEngineUserConfig>): Promise<void> {
    if (this.initialized) {
      // 已初始化，但音频上下文可能被浏览器自动播放策略暂停（尤其在首次 init
      // 发生在非用户手势时）。每次调用都尝试恢复，确保 Transport 能正常推进。
      const ctx = Tone.getContext();
      if (ctx.state !== "running") {
        await ctx.resume();
      }
      return;
    }
    await Tone.start();

    const c = config ?? {};
    this.volume = c.volume ?? DEFAULT_VOLUME;
    this.sustain = c.sustain ?? false;
    this.velocitySensitivity = c.velocitySensitivity ?? true;

    Tone.Destination.volume.value = Tone.gainToDb(this.volume);

    this.reverb = new Tone.Reverb({
      decay: c.reverbDecay ?? DEFAULT_REVERB_DECAY,
      wet: c.reverbAmount ?? DEFAULT_REVERB_WET,
    });
    await this.reverb.generate();

    const envelope = c.envelope ?? {
      attack: 0.002,
      decay: 0.3,
      sustain: 0.3,
      release: 1.0,
    };
    const modEnvelope = c.modulationEnvelope ?? {
      attack: 0.005,
      decay: 0.5,
      sustain: 0.2,
      release: 0.5,
    };

    this.synth = new Tone.PolySynth(Tone.FMSynth, {
      harmonicity: c.harmonicity ?? 2,
      modulationIndex: c.modulationIndex ?? 10,
      oscillator: { type: (c.oscillatorType as Tone.ToneOscillatorType) ?? "triangle" },
      envelope: {
        attack: envelope.attack,
        decay: envelope.decay,
        sustain: envelope.sustain,
        release: envelope.release,
      },
      modulation: { type: "sine" },
      modulationEnvelope: {
        attack: modEnvelope.attack,
        decay: modEnvelope.decay,
        sustain: modEnvelope.sustain,
        release: modEnvelope.release,
      },
    });
    this.synth.maxPolyphony = 64;
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
      // reverbDecay 需要重新 generate，仅在差异较大时执行
      if (Math.abs(this.reverb.decay - config.reverbDecay) > 0.5) {
        this.reverb.decay = config.reverbDecay;
        this.reverb.generate();
      }
    }

    if (this.synth) {
      this.synth.set({
        harmonicity: config.harmonicity,
        modulationIndex: config.modulationIndex,
        oscillator: { type: config.oscillatorType as Tone.ToneOscillatorType },
        envelope: {
          attack: config.envelope.attack,
          decay: config.envelope.decay,
          sustain: config.envelope.sustain,
          release: config.envelope.release,
        },
        modulationEnvelope: {
          attack: config.modulationEnvelope.attack,
          decay: config.modulationEnvelope.decay,
          sustain: config.modulationEnvelope.sustain,
          release: config.modulationEnvelope.release,
        },
      });
    }
  }

  noteOn(midi: number, velocity: number): void {
    if (!this.synth || !this.initialized) return;
    const note = midiToNoteName(midi);
    const vel = this.velocitySensitivity ? velocity / 127 : 0.8;
    const count = this.heldNotes.get(note) ?? 0;
    this.heldNotes.set(note, count + 1);
    this.synth.triggerAttack(note, undefined, vel);
  }

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
    if (this.initialized) {
      Tone.Destination.volume.value = Tone.gainToDb(v);
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
    this.initialized = false;
  }
}
