import * as Tone from "tone";
import { midiToNoteName } from "../constants";

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
  private heldNotes = new Set<string>();
  private sustain = false;
  private velocitySensitivity = true;
  private volume = DEFAULT_VOLUME;
  private initialized = false;

  async init(options: SoundEngineOptions = {}): Promise<void> {
    if (this.initialized) return;
    await Tone.start();

    this.volume = options.volume ?? DEFAULT_VOLUME;
    this.sustain = options.sustain ?? false;
    this.velocitySensitivity = options.velocitySensitivity ?? true;

    Tone.Destination.volume.value = Tone.gainToDb(this.volume);

    this.reverb = new Tone.Reverb({
      decay: options.reverbDecay ?? DEFAULT_REVERB_DECAY,
      wet: options.reverbAmount ?? DEFAULT_REVERB_WET,
    });
    await this.reverb.generate();

    this.synth = new Tone.PolySynth(Tone.FMSynth, {
      harmonicity: 2,
      modulationIndex: 10,
      oscillator: { type: "triangle" },
      envelope: {
        attack: 0.005,
        decay: 0.3,
        sustain: 0.3,
        release: 1.2,
      },
      modulation: { type: "sine" },
      modulationEnvelope: {
        attack: 0.01,
        decay: 0.5,
        sustain: 0.2,
        release: 0.5,
      },
    });
    this.synth.maxPolyphony = 32;
    this.synth.connect(this.reverb);
    this.reverb.toDestination();

    this.initialized = true;
  }

  noteOn(midi: number, velocity: number): void {
    if (!this.synth || !this.initialized) return;
    const note = midiToNoteName(midi);
    const vel = this.velocitySensitivity ? velocity / 127 : 0.8;
    this.heldNotes.add(note);
    this.synth.triggerAttack(note, undefined, vel);
  }

  noteOff(midi: number): void {
    if (!this.synth || !this.initialized) return;
    const note = midiToNoteName(midi);
    this.heldNotes.delete(note);
    if (!this.sustain) {
      this.synth.triggerRelease(note);
    } else {
      this.sustainedNotes.add(note);
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
