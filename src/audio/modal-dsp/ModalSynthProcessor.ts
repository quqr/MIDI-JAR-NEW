// AudioWorklet processor for the RipplerX modal synth port
// Wraps all DSP: voices, resonators, mallet, noise, comb stereo, limiter
//
// Message types from main thread:
//   { type: 'init', sampleRate: number }
//   { type: 'noteOn', note: number, velocity: number }
//   { type: 'noteOff', note: number }
//   { type: 'noteOffAll' }
//   { type: 'pitchBend', value: number }  // -1 to 1
//   { type: 'sustain', value: boolean }
//   { type: 'setParams', params: Record<string, number> }
//   { type: 'loadPreset', preset: Record<string, number> }
//   { type: 'loadSample', data: Float32Array, sampleRate: number }
//
// Messages to main thread:
//   { type: 'initialized', sampleRate: number }
//   { type: 'status', rms: number, cpuUsage: number, activeVoices: number }

import { Models } from './Models';
import { Partial as ModalPartial } from './Partial';
import { MalletType } from './Mallet';
import { Voice } from './Voice';
import { Comb } from './Comb';
import { Limiter } from './Limiter';
import { Sampler } from './Sampler';
import { choiceToPartialCount } from './ParamDefs';

const MAX_POLYPHONY = 16;
const BEND_GLIDE_MS = 2;

// Status report interval (every N process() calls)
const STATUS_INTERVAL = 64;

class ModalSynthProcessor extends AudioWorkletProcessor {
  // DSP components
  private models!: Models;
  private sampler!: Sampler;
  private voices: Voice[] = [];
  private comb!: Comb;
  private limiter!: Limiter;

  // Parameter cache (0-1 normalized for choice/bool, actual values for float)
  private params: Record<string, number> = {};

  // Pitch bend state
  private startBend = 1.0;
  private curBend = 1.0;
  private targetBend = 1.0;
  private bendStep = 0.1;
  private remainingSamplesBend = -1;
  private totalSamplesBend = 0;

  // Voice management
  private notePressCount = 0;
  private noteReleaseCount = 0;
  private sustainPedal = false;
  private sustainPedalNotes: { note: number }[] = [];

  // Model change tracking
  private lastAModel = -1;
  private lastBModel = -1;
  private lastAPartials = -1;
  private lastBPartials = -1;
  private lastMalletType = MalletType.kImpulse;

  // RMS tracking
  private rmsAccum = 0;
  private rmsCount = 0;

  // Status reporting
  private processCount = 0;

  // Initialization flag
  private initialized = false;

  constructor() {
    super();
    this.port.onmessage = this.handleMessage.bind(this);
  }

  private handleMessage(event: MessageEvent): void {
    const msg = event.data;

    switch (msg.type) {
      case 'init':
        this.initProcessor(msg.sampleRate || sampleRate);
        break;
      case 'noteOn':
        this.onNote(msg.note, msg.velocity);
        break;
      case 'noteOff':
        this.offNote(msg.note);
        break;
      case 'noteOffAll':
        this.clearVoices();
        break;
      case 'pitchBend':
        this.setBendTarget(msg.value);
        break;
      case 'sustain':
        this.handleSustain(msg.value);
        break;
      case 'setParams':
        this.setParams(msg.params);
        break;
      case 'loadPreset':
        this.loadPreset(msg.preset);
        break;
      case 'loadSample':
        this.sampler?.loadSampleFromFloat32Array(msg.data, msg.sampleRate);
        break;
    }
  }

  private initProcessor(srate: number): void {
    // Initialize lookup tables
    ModalPartial.initA1LUT(srate);

    // Create DSP objects
    this.models = new Models();
    this.sampler = new Sampler();
    this.comb = new Comb();
    this.limiter = new Limiter();

    this.comb.init(srate);
    this.limiter.init(srate);

    // Pre-allocate voices
    this.voices = [];
    for (let i = 0; i < MAX_POLYPHONY; i++) {
      this.voices.push(new Voice(this.models, this.sampler));
    }

    // Initialize default parameters
    this.initDefaultParams();
    this.onSlider(srate);

    this.totalSamplesBend = Math.floor(BEND_GLIDE_MS * 0.001 * srate);
    this.initialized = true;

    this.port.postMessage({ type: 'initialized', sampleRate: srate });
  }

  private initDefaultParams(): void {
    // Set defaults from ParamDefs (actual values, not normalized)
    this.params = {
      mallet_type: 0,
      mallet_pitch: 0,
      mallet_filter: 0,
      mallet_mix: 0,
      mallet_res: 0.8,
      mallet_stiff: 600,
      mallet_ktrack: 0,
      a_on: 1,
      a_model: 0,
      a_partials: 3,  // choice index for "32"
      a_decay: 1,
      a_damp: 0,
      a_tone: 0,
      a_hit: 0.26,
      a_rel: 1,
      a_inharm: 0.0001,
      a_ratio: 1,
      a_cut: 0,
      a_radius: 0.5,
      a_coarse: 0,
      a_fine: 0,
      b_on: 0,
      b_model: 0,
      b_partials: 3,
      b_decay: 1,
      b_damp: 0,
      b_tone: 0,
      b_hit: 0.26,
      b_rel: 1,
      b_inharm: 0.0001,
      b_ratio: 1,
      b_cut: 0,
      b_radius: 0.5,
      b_coarse: 0,
      b_fine: 0,
      noise_osc: 0,
      noise_mix: 0,
      noise_res: 0,
      noise_filter_mode: 2,
      noise_filter_freq: 20,
      noise_filter_q: 0.707,
      noise_att: 1,
      noise_dec: 500,
      noise_sus: 0,
      noise_rel: 500,
      noise_att_ten: 0.4,
      noise_dec_ten: 0.4,
      noise_rel_ten: 0.4,
      vel_mallet_mix: 0,
      vel_mallet_res: 0,
      vel_mallet_stiff: 0,
      vel_noise_mix: 0,
      vel_noise_res: 0,
      vel_noise_freq: 0,
      vel_noise_att: 0,
      vel_noise_dec: 0,
      vel_noise_sus: 0,
      vel_noise_rel: 0,
      vel_noise_q: 0,
      vel_a_decay: 0,
      vel_a_hit: 0,
      vel_a_inharm: 0,
      vel_a_damp: 0,
      vel_a_tone: 0,
      vel_b_decay: 0,
      vel_b_hit: 0,
      vel_b_inharm: 0,
      vel_b_damp: 0,
      vel_b_tone: 0,
      couple: 0,
      ab_mix: 0.5,
      ab_split: 0.01,
      gain: 0,
      bend_range: 2,
      stereoizer: 1,
      reuse_voices: 0,
      fadeout_repeats: 0,
    };
  }

  private getP(id: string): number {
    return this.params[id] ?? 0;
  }

  private getBool(id: string): boolean {
    return this.getP(id) >= 0.5;
  }

  private getInt(id: string): number {
    return Math.round(this.getP(id));
  }

  // ── Voice management ──

  private pickVoice(note: number): number {
    const reuseVoices = this.getBool('reuse_voices');
    const polyphony = MAX_POLYPHONY;

    // Priority 1: note already playing in a voice
    if (reuseVoices) {
      for (let i = 0; i < polyphony; i++) {
        if (this.voices[i].note === note) return i;
      }
    }

    let pick = 0;
    for (let i = 1; i < polyphony; i++) {
      const v1 = this.voices[i];
      const v2 = this.voices[pick];

      // Priority 2: Released voices come before pressed ones
      if (!v1.isPressed && v2.isPressed) {
        pick = i;
      } else if (v1.isPressed && !v2.isPressed) {
        // keep current pick
      }
      // Priority 3: Among released voices, pick oldest release
      else if (!v1.isPressed && !v2.isPressed) {
        if (v1.release_ts < v2.release_ts) pick = i;
      }
      // Priority 4: Among pressed voices, pick oldest press
      else if (v1.isPressed && v2.isPressed) {
        if (v1.pressed_ts < v2.pressed_ts) pick = i;
      }
    }

    return pick;
  }

  private onNote(note: number, velocity: number): void {
    if (!this.initialized) return;
    const srate = sampleRate;
    const vel = velocity / 127;

    const nvoice = this.pickVoice(note);
    const voice = this.voices[nvoice];

    const reuseVoices = this.getBool('reuse_voices');
    const fadeoutRepeats = this.getBool('fadeout_repeats');
    const skipFadeout = reuseVoices && !fadeoutRepeats && voice.note === note;

    const malletType = this.getInt('mallet_type') as MalletType;
    const malletStiff = this.getP('mallet_stiff');
    const malletKtrack = this.getP('mallet_ktrack');
    const velMalletStiff = this.getP('vel_mallet_stiff');

    const malletFreq = Math.max(100, Math.min(5000,
      Math.exp(Math.log(malletStiff) + vel * velMalletStiff * 2 * (Math.log(5000) - Math.log(100)))
    ));

    voice.trigger(++this.notePressCount, srate, note, vel, malletType, malletFreq, malletKtrack, skipFadeout);

    // Remove from sustain pedal notes
    this.sustainPedalNotes = this.sustainPedalNotes.filter(n => n.note !== note);
  }

  private offNote(note: number): void {
    // If sustain pedal is held, defer note-off
    if (this.sustainPedal) {
      this.sustainPedalNotes.push({ note });
      return;
    }
    for (let i = 0; i < MAX_POLYPHONY; i++) {
      const voice = this.voices[i];
      if (voice.note === note && !voice.isRelease) {
        voice.release(++this.noteReleaseCount);
      }
    }
  }

  private handleSustain(value: boolean): void {
    this.sustainPedal = value;
    if (!value) {
      for (const n of this.sustainPedalNotes) {
        this.offNote(n.note);
      }
      this.sustainPedalNotes = [];
    }
  }

  private clearVoices(): void {
    for (let i = 0; i < MAX_POLYPHONY; i++) {
      this.voices[i].clear();
    }
  }

  // ── Pitch bend ──

  private setBendTarget(normalized: number): void {
    const bendRange = this.getP('bend_range');
    this.startBend = this.curBend;
    this.targetBend = Math.pow(2.0, normalized * bendRange / 12.0);
    this.remainingSamplesBend = this.totalSamplesBend;
    this.bendStep = (this.targetBend - this.startBend) / this.totalSamplesBend;
  }

  private interpolatePitchBend(): void {
    if (this.remainingSamplesBend > 0) {
      this.curBend += this.bendStep;
      this.remainingSamplesBend--;
      if (this.remainingSamplesBend === 0) {
        this.curBend = this.targetBend;
      }
    }
  }

  // ── Parameter updates ──

  private setParams(params: Record<string, number>): void {
    for (const [id, value] of Object.entries(params)) {
      this.params[id] = value;
    }
    this.onSlider(sampleRate);
  }

  private loadPreset(preset: Record<string, number>): void {
    for (const [id, value] of Object.entries(preset)) {
      this.params[id] = value;
    }
    this.clearVoices();
    this.resetLastModels();
    this.onSlider(sampleRate);
  }

  private resetLastModels(): void {
    this.lastAModel = this.getInt('a_model');
    this.lastAPartials = this.getInt('a_partials');
    this.lastBModel = this.getInt('b_model');
    this.lastBPartials = this.getInt('b_partials');
  }

  private onSlider(srate: number): void {
    const malletType = this.getInt('mallet_type') as MalletType;
    const malletPitch = this.getP('mallet_pitch');
    const malletFilter = this.getP('mallet_filter');

    const noiseFilterFreq = this.getP('noise_filter_freq');
    const noiseFilterMode = this.getInt('noise_filter_mode');
    const noiseFilterQ = this.getP('noise_filter_q');
    const noiseAtt = this.getP('noise_att');
    const noiseDec = this.getP('noise_dec');
    const noiseSus = this.getP('noise_sus');
    const noiseRel = this.getP('noise_rel');
    const noiseAttTen = this.getP('noise_att_ten');
    const noiseDecTen = this.getP('noise_dec_ten');
    const noiseRelTen = this.getP('noise_rel_ten');
    const velNoiseFreq = this.getP('vel_noise_freq');
    const velNoiseQ = this.getP('vel_noise_q');
    const velNoiseAtt = this.getP('vel_noise_att');
    const velNoiseDec = this.getP('vel_noise_dec');
    const velNoiseSus = this.getP('vel_noise_sus');
    const velNoiseRel = this.getP('vel_noise_rel');

    let aOn = this.getBool('a_on');
    let aModel = this.getInt('a_model');
    let aPartials = this.getInt('a_partials');
    let aDecay = this.getP('a_decay');
    let aDamp = this.getP('a_damp');
    let aTone = this.getP('a_tone');
    let aHit = this.getP('a_hit');
    let aRel = this.getP('a_rel');
    let aInharm = this.getP('a_inharm');
    let aRatio = this.getP('a_ratio');
    let aCut = this.getP('a_cut');
    let aRadius = this.getP('a_radius');

    let bOn = this.getBool('b_on');
    let bModel = this.getInt('b_model');
    let bPartials = this.getInt('b_partials');
    let bDecay = this.getP('b_decay');
    let bDamp = this.getP('b_damp');
    let bTone = this.getP('b_tone');
    let bHit = this.getP('b_hit');
    let bRel = this.getP('b_rel');
    let bInharm = this.getP('b_inharm');
    let bRatio = this.getP('b_ratio');
    let bCut = this.getP('b_cut');
    let bRadius = this.getP('b_radius');

    const velADecay = this.getP('vel_a_decay');
    const velAHit = this.getP('vel_a_hit');
    const velAInharm = this.getP('vel_a_inharm');
    const velADamp = this.getP('vel_a_damp');
    const velATone = this.getP('vel_a_tone');
    const velBDecay = this.getP('vel_b_decay');
    const velBHit = this.getP('vel_b_hit');
    const velBInharm = this.getP('vel_b_inharm');
    const velBDamp = this.getP('vel_b_damp');
    const velBTone = this.getP('vel_b_tone');

    const aCoarse = this.getP('a_coarse');
    const aFine = this.getP('a_fine');
    const bCoarse = this.getP('b_coarse');
    const bFine = this.getP('b_fine');

    const couple = this.getBool('couple');
    const split = this.getP('ab_split') * 100.0;

    // Model change handling
    if (aModel !== this.lastAModel) {
      aRatio = aModel === 1 ? 2.0 : aModel === 11 ? 1.0 : 0.78; // Beam=1, Djembe=11
      this.params['a_ratio'] = aRatio;
      this.clearVoices();
      this.lastAModel = aModel;
    }
    if (bModel !== this.lastBModel) {
      bRatio = bModel === 1 ? 2.0 : bModel === 11 ? 1.0 : 0.78;
      this.params['b_ratio'] = bRatio;
      this.clearVoices();
      this.lastBModel = bModel;
    }
    if (this.lastAPartials !== aPartials) {
      this.clearVoices();
      this.lastAPartials = aPartials;
    }
    if (this.lastBPartials !== bPartials) {
      this.clearVoices();
      this.lastBPartials = bPartials;
    }

    // Convert choice to actual partial count
    const aPartialsCount = choiceToPartialCount(aPartials);
    const bPartialsCount = choiceToPartialCount(bPartials);

    // Recalculate ratio-dependent models
    if (aModel === 1) this.models.recalcBeam(true, aRatio);      // Beam
    else if (aModel === 3) this.models.recalcMembrane(true, aRatio);  // Membrane
    else if (aModel === 4) this.models.recalcPlate(true, aRatio);     // Plate
    if (bModel === 1) this.models.recalcBeam(false, bRatio);
    else if (bModel === 3) this.models.recalcMembrane(false, bRatio);
    else if (bModel === 4) this.models.recalcPlate(false, bRatio);

    // Mallet type change
    if (malletType !== this.lastMalletType) {
      this.lastMalletType = malletType;
      if (malletType > MalletType.kUserFile) {
        this.sampler.loadInternalSample(malletType);
      }
      this.clearVoices();
    }

    this.sampler.setPitch(malletPitch);

    // Update all voices
    for (let i = 0; i < MAX_POLYPHONY; i++) {
      const voice = this.voices[i];
      voice.noise.init(srate, noiseFilterMode, noiseFilterFreq, noiseFilterQ,
        noiseAtt, noiseDec, noiseSus, noiseRel, velNoiseFreq, velNoiseQ,
        noiseAttTen, noiseDecTen, noiseRelTen,
        velNoiseAtt, velNoiseDec, velNoiseSus, velNoiseRel
      );
      voice.setPitch(aCoarse, bCoarse, aFine, bFine, this.curBend);
      voice.setRatio(aRatio, bRatio);
      voice.resA.setParams(srate, aOn, aModel, aPartialsCount, aDecay, aDamp, aTone, aHit,
        aRel, aInharm, aCut, aRadius, velADecay, velAHit, velAInharm, velADamp, velATone);
      voice.resB.setParams(srate, bOn, bModel, bPartialsCount, bDecay, bDamp, bTone, bHit,
        bRel, bInharm, bCut, bRadius, velBDecay, velBHit, velBInharm, velBDamp, velBTone);
      voice.setCoupling(couple, split);
      voice.updateResonators();
      if (malletType >= MalletType.kUserFile) {
        voice.mallet.setFilter(malletFilter);
      }
    }
  }

  // ── Process loop ──

  process(inputs: Float32Array[][], outputs: Float32Array[][], _parameters: Record<string, Float32Array>): boolean {
    if (!this.initialized) return true;

    const output = outputs[0];
    if (!output || output.length === 0) return true;

    const numSamples = output[0].length;

    const aOn = this.getBool('a_on');
    const bOn = this.getBool('b_on');
    const malletMix = this.getP('mallet_mix');
    const malletRes = this.getP('mallet_res');
    const velMalletMix = this.getP('vel_mallet_mix');
    const velMalletRes = this.getP('vel_mallet_res');
    const noiseOsc = this.getP('noise_osc');
    const noiseMixVal = this.getP('noise_mix');
    const noiseResVal = this.getP('noise_res');
    const velNoiseMix = this.getP('vel_noise_mix');
    const velNoiseRes = this.getP('vel_noise_res');
    const serial = this.getBool('couple');
    const abMix = this.getP('ab_mix');
    const gainDb = this.getP('gain');
    const gain = Math.pow(10.0, gainDb / 20.0);
    const stereoizer = this.getBool('stereoizer');

    // Get input audio if present (for sidechain)
    const hasInput = inputs.length > 0 && inputs[0].length > 0;

    for (let s = 0; s < numSamples; s++) {
      this.interpolatePitchBend();

      let dirOut = 0.0;
      let aOut = 0.0;
      let bOut = 0.0;

      // Mix input audio
      let audioIn = 0.0;
      if (hasInput) {
        for (let ch = 0; ch < inputs[0].length; ch++) {
          audioIn += inputs[0][ch][s];
        }
        audioIn /= inputs[0].length;
      }

      for (let i = 0; i < MAX_POLYPHONY; i++) {
        const voice = this.voices[i];
        let resOut = 0.0;

        // Apply pitch bend
        if (this.remainingSamplesBend >= 0) {
          voice.applyPitchBend(this.curBend);
          if (this.remainingSamplesBend === 0) {
            this.remainingSamplesBend = -1;
          }
        }

        // Voice fade out for repeat notes
        const voiceFadeOutEnv = voice.isFading ? voice.fadeOut() : 1.0;

        // Process mallet
        const msample = voice.mallet.process();
        if (msample !== 0) {
          dirOut += msample * Math.max(0, Math.min(1, malletMix + velMalletMix * voice.vel)) * voiceFadeOutEnv;
          resOut += msample * Math.max(0, Math.min(1, malletRes + velMalletRes * voice.vel));
        }

        // Process audio input
        if (audioIn !== 0 && voice.isPressed) {
          resOut += audioIn;
        }

        // Process noise
        const noise = voice.noise.process();
        if (voice.noise.env.state !== 0) {
          const osc = noiseOsc > 0.0 && (noiseResVal > 0.0 || velNoiseRes > 0.0)
            ? voice.noise.processOSC(voice.processOscillators(false) + voice.processOscillators(true)) * noiseOsc
            : 0.0;
          dirOut += noise * Math.max(0, Math.min(1, noiseMixVal + velNoiseMix * voice.vel)) * voiceFadeOutEnv;
          resOut += (noise * (1.0 - noiseOsc) + osc) * Math.max(0, Math.min(1, noiseResVal + velNoiseRes * voice.vel));
        }

        // Resonator A
        let outFromA = 0.0;
        if (aOn) {
          let out = voice.resA.process(resOut);
          if (voice.resA.cut !== 0.0) {
            out = voice.resA.filter.df1(out);
          }
          aOut += out * voiceFadeOutEnv;
          outFromA = out;
        }

        // Resonator B
        if (bOn) {
          let out = voice.resB.process(aOn && serial ? outFromA : resOut);
          if (voice.resB.cut !== 0.0) {
            out = voice.resB.filter.df1(out);
          }
          bOut += out * voiceFadeOutEnv;
        }
      }

      // Mix resonator outputs
      let resOut = 0.0;
      if (aOn && bOn) {
        resOut = serial ? bOut : aOut * (1 - abMix) + bOut * abMix;
      } else {
        resOut = aOut + bOut;
      }

      const totalOut = dirOut + resOut * gain;

      // Apply comb stereo and limiter
      let spl0: number, spl1: number;
      if (stereoizer) {
        [spl0, spl1] = this.comb.process(totalOut);
      } else {
        spl0 = totalOut;
        spl1 = totalOut;
      }
      const [left, right] = this.limiter.process(spl0, spl1);

      // Write output
      if (output[0]) output[0][s] = left;
      if (output[1]) output[1][s] = right;

      // RMS accumulation
      this.rmsAccum += left * left;
      this.rmsCount++;
    }

    // Periodic status report
    this.processCount++;
    if (this.processCount >= STATUS_INTERVAL) {
      this.processCount = 0;
      const rms = this.rmsCount > 0 ? Math.sqrt(this.rmsAccum / this.rmsCount) : 0;
      this.rmsAccum = 0;
      this.rmsCount = 0;

      const activeVoices = this.voices.filter(v => v.isPressed || (v.resA.active) || (v.resB.active)).length;

      this.port.postMessage({
        type: 'status',
        rms,
        cpuUsage: 0,  // CPU usage not easily measurable in AudioWorklet
        activeVoices,
      });
    }

    return true;
  }

  static get parameterDescriptors(): AudioParamDescriptor[] {
    return [
      {
        name: 'gain',
        defaultValue: 1.0,
        minValue: 0.0,
        maxValue: 1.0,
        automationRate: 'a-rate' as AudioParamAutomationRate,
      },
    ];
  }
}

// Register the processor
registerProcessor('modal-synth', ModalSynthProcessor);
