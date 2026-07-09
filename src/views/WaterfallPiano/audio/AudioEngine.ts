import * as Tone from "tone";
import type { AudioPreset, PhysicalPianoConfig } from "../types";
import type { SoundEngine, SoundEngineCallbacks } from "./SoundEngine";
import type { OutputChain } from "./OutputChain";

export class AudioEngine implements SoundEngine {
  private synth: Tone.PolySynth | null = null;
  currentPreset: AudioPreset = "grand-piano";
  private sustainEnabled = false;
  private sustainedNotes = new Set<number>();
  private activeNotes = new Map<number, string>();
  private callbacks: SoundEngineCallbacks = {};
  private outputChain: OutputChain;

  constructor(outputChain: OutputChain) {
    this.outputChain = outputChain;
  }

  setCallbacks(callbacks: SoundEngineCallbacks) {
    this.callbacks = callbacks;
  }

  async init() {
    await Tone.start();
    this.applyPreset("grand-piano");
  }

  connect(output: AudioNode): void {
    if (this.synth) {
      this.synth.connect(output);
    }
  }

  disconnect(): void {
    if (this.synth) {
      this.synth.disconnect();
    }
  }

  applyPreset(preset: AudioPreset) {
    if (preset === "physical-piano") {
      // PhysicalPianoEngine handles this preset
      return;
    }

    this.currentPreset = preset;

    // Dispose previous synth
    if (this.synth) {
      this.synth.disconnect();
      this.synth.dispose();
    }

    switch (preset) {
      case "grand-piano":
        this.synth = new Tone.PolySynth(Tone.Synth, {
          oscillator: {
            type: "fmtriangle",
            modulationType: "sine",
            harmonicity: 0.5,
            modulationIndex: 1,
          },
          envelope: {
            attack: 0.005,
            decay: 0.8,
            sustain: 0.3,
            release: 1.5,
          },
          volume: -8,
        });
        if (this.outputChain?.filter) this.outputChain.filter.frequency.value = 6000;
        break;

      case "electric-piano":
        this.synth = new Tone.PolySynth(Tone.FMSynth, {
          harmonicity: 3,
          modulationIndex: 8,
          oscillator: { type: "sine" },
          envelope: {
            attack: 0.001,
            decay: 0.5,
            sustain: 0.2,
            release: 1.0,
          },
          modulation: { type: "square" },
          modulationEnvelope: {
            attack: 0.002,
            decay: 0.3,
            sustain: 0.1,
            release: 0.5,
          },
          volume: -10,
        });
        if (this.outputChain?.filter) this.outputChain.filter.frequency.value = 5000;
        break;

      case "bright-piano":
        this.synth = new Tone.PolySynth(Tone.Synth, {
          oscillator: {
            type: "fmsquare",
            modulationType: "sine",
            harmonicity: 2,
            modulationIndex: 3,
          },
          envelope: {
            attack: 0.002,
            decay: 0.4,
            sustain: 0.4,
            release: 1.2,
          },
          volume: -12,
        });
        if (this.outputChain?.filter) this.outputChain.filter.frequency.value = 10000;
        break;

      case "mellow-piano":
        this.synth = new Tone.PolySynth(Tone.Synth, {
          oscillator: {
            type: "fmtriangle",
            modulationType: "sine",
            harmonicity: 0.3,
            modulationIndex: 0.8,
          },
          envelope: {
            attack: 0.01,
            decay: 1.0,
            sustain: 0.5,
            release: 2.0,
          },
          volume: -6,
        });
        if (this.outputChain?.filter) this.outputChain.filter.frequency.value = 4000;
        break;

      case "organ":
        this.synth = new Tone.PolySynth(Tone.Synth, {
          oscillator: {
            type: "fatcustom",
            partials: [0.5, 1, 1.5, 2, 2.5, 3],
            spread: 10,
            count: 3,
          },
          envelope: {
            attack: 0.01,
            decay: 0.1,
            sustain: 0.9,
            release: 0.3,
          },
          volume: -12,
        });
        if (this.outputChain?.filter) this.outputChain.filter.frequency.value = 8000;
        break;

      case "synth-pad":
        this.synth = new Tone.PolySynth(Tone.Synth, {
          oscillator: {
            type: "fatcustom",
            partials: [1, 0.5, 0.3, 0.2],
            spread: 30,
            count: 4,
          },
          envelope: {
            attack: 0.8,
            decay: 1.5,
            sustain: 0.7,
            release: 3.0,
          },
          volume: -15,
        });
        if (this.outputChain?.filter) this.outputChain.filter.frequency.value = 3000;
        break;
    }

    // Connect synth through the audio chain
    if (this.synth && this.outputChain?.filter) {
      this.synth.connect(this.outputChain.filter);
    }
  }

  noteOn(midi: number, velocity = 100) {
    if (!this.synth) return;

    const note = Tone.Frequency(midi, "midi").toNote();
    const vel = velocity / 127;

    if (this.activeNotes.has(midi)) {
      this.synth.triggerRelease([note], Tone.now());
    }

    this.synth.triggerAttack(note, Tone.now(), vel);
    this.activeNotes.set(midi, note);
    this.callbacks.onNoteOn?.(midi, velocity);
  }

  noteOff(midi: number) {
    if (!this.synth) return;

    if (this.sustainEnabled) {
      this.sustainedNotes.add(midi);
      return;
    }

    const note = this.activeNotes.get(midi);
    if (note) {
      this.synth.triggerRelease([note], Tone.now());
      this.activeNotes.delete(midi);
      this.callbacks.onNoteOff?.(midi);
    }
  }

  setSustain(enabled: boolean) {
    this.sustainEnabled = enabled;
    if (!enabled) {
      this.releaseSustainedNotes();
    }
  }

  setVolume(db: number): void {
    this.outputChain?.setVolume(db);
  }

  setReverbWet(wet: number): void {
    this.outputChain?.setReverbWet(wet);
  }

  setReverbDecay(decay: number): void {
    this.outputChain?.setReverbDecay(decay);
  }

  setConfig(_cfg: PhysicalPianoConfig): void {
    // Tone.js engine does not support physical config
  }

  private releaseSustainedNotes() {
    if (!this.synth) return;
    for (const midi of this.sustainedNotes) {
      const note = this.activeNotes.get(midi);
      if (note) {
        this.synth.triggerRelease([note], Tone.now());
        this.activeNotes.delete(midi);
        this.callbacks.onNoteOff?.(midi);
      }
    }
    this.sustainedNotes.clear();
  }

  isNoteActive(midi: number): boolean {
    return this.activeNotes.has(midi);
  }

  getActiveNotes(): number[] {
    return Array.from(this.activeNotes.keys());
  }

  dispose() {
    if (this.synth) {
      this.synth.disconnect();
      this.synth.dispose();
      this.synth = null;
    }
    this.activeNotes.clear();
    this.sustainedNotes.clear();
  }
}
