import * as Tone from "tone";
import type { AudioPreset } from "../types";

export interface AudioEngineCallbacks {
  onNoteOn?: (midi: number, velocity: number) => void;
  onNoteOff?: (midi: number) => void;
}

export class AudioEngine {
  private synth: Tone.PolySynth | null = null;
  private reverb: Tone.Reverb | null = null;
  private volume: Tone.Volume | null = null;
  private compressor: Tone.Compressor | null = null;
  private filter: Tone.Filter | null = null;
  currentPreset: AudioPreset = "grand-piano";
  private sustainEnabled = false;
  private sustainedNotes = new Set<number>();
  private activeNotes = new Map<number, string>();
  private callbacks: AudioEngineCallbacks = {};

  setCallbacks(callbacks: AudioEngineCallbacks) {
    this.callbacks = callbacks;
  }

  async init() {
    await Tone.start();

    // Create audio chain: synth → filter → compressor → reverb → volume → destination
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

    this.applyPreset("grand-piano");
  }

  applyPreset(preset: AudioPreset) {
    this.currentPreset = preset;

    // Dispose previous synth
    if (this.synth) {
      this.synth.disconnect();
      this.synth.dispose();
    }

    switch (preset) {
      case "grand-piano":
        // Rich piano with harmonics
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
        if (this.filter) this.filter.frequency.value = 6000;
        break;

      case "electric-piano":
        // Classic Rhodes-style EP
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
        if (this.filter) this.filter.frequency.value = 5000;
        break;

      case "bright-piano":
        // Bright, shimmering piano
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
        if (this.filter) this.filter.frequency.value = 10000;
        break;

      case "mellow-piano":
        // Warm, soft piano
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
        if (this.filter) this.filter.frequency.value = 4000;
        break;

      case "organ":
        // Organ with drawbar-like harmonics
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
        if (this.filter) this.filter.frequency.value = 8000;
        break;

      case "synth-pad":
        // Lush ambient pad
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
        if (this.filter) this.filter.frequency.value = 3000;
        break;
    }

    // Connect synth through the audio chain
    if (this.synth && this.filter) {
      this.synth.connect(this.filter);
    }
  }

  noteOn(midi: number, velocity = 100) {
    if (!this.synth) return;

    const note = Tone.Frequency(midi, "midi").toNote();
    const vel = velocity / 127;

    // If already playing, release first
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

  releaseSustainedNotes() {
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

  setVolume(db: number) {
    if (this.volume) {
      this.volume.volume.value = db;
    }
  }

  setReverbWet(wet: number) {
    if (this.reverb) {
      this.reverb.wet.value = wet;
    }
  }

  setReverbDecay(decay: number) {
    if (this.reverb) {
      const wet = this.reverb.wet.value;
      this.reverb.dispose();
      this.reverb = new Tone.Reverb({ wet, decay });
      this.reverb.connect(this.volume!);
      this.reverb.generate();
      if (this.compressor) {
        this.compressor.disconnect();
        this.compressor.connect(this.reverb);
      }
    }
  }

  setSustain(enabled: boolean) {
    this.sustainEnabled = enabled;
    if (!enabled) {
      this.releaseSustainedNotes();
    }
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
    if (this.reverb) {
      this.reverb.dispose();
      this.reverb = null;
    }
    if (this.volume) {
      this.volume.dispose();
      this.volume = null;
    }
    if (this.compressor) {
      this.compressor.dispose();
      this.compressor = null;
    }
    if (this.filter) {
      this.filter.dispose();
      this.filter = null;
    }
    this.activeNotes.clear();
    this.sustainedNotes.clear();
  }
}
