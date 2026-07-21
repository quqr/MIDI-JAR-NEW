// AudioWorklet processor for the RipplerX modal synth port
// Wraps all DSP: voices, resonators, mallet, noise, comb stereo, limiter
//
// 消息协议（main thread → worklet）：
//   { type: 'init', sampleRate: number }
//   { type: 'noteOn', note: number, velocity: number }
//   { type: 'noteOff', note: number }
//   { type: 'noteOffAll' }
//   { type: 'pitchBend', value: number }  // -1 to 1
//   { type: 'sustain', value: boolean }
//   { type: 'setParam', id: string, value: number }     // 单参数（滑块拖动）
//   { type: 'setParams', params: Record<string, number> } // 批量（init/preset）
//   { type: 'loadPreset', preset: Record<string, number> }
//   { type: 'loadSample', data: Float32Array, sampleRate: number }
//
// 消息协议（worklet → main thread）：
//   { type: 'initialized', sampleRate: number }
//   { type: 'status', rms: number, cpuUsage: number, activeVoices: number }
//   cpuUsage ∈ [0, 1]：process() 实际耗时 / buffer 时长。

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

  // CPU 使用率跟踪：累加 process() 耗时与 buffer 时长，周期性上报比值。
  private cpuTimeAccum = 0;
  private cpuBufferDurationAccum = 0;

  // Status reporting
  private processCount = 0;

  // Initialization flag
  private initialized = false;

  constructor() {
    super();
    this.port.onmessage = this.handleMessage.bind(this);
  }

  /**
   * 处理 main thread → worklet 消息。按 `msg.type` 分派到对应处理函数。
   * @param event - MessagePort 消息事件，data 为上述协议中的对象。
   */
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
      case 'setParam':
        this.params[msg.id] = msg.value;
        this.applyParamsToVoices(sampleRate);
        break;
      case 'loadPreset':
        this.loadPreset(msg.preset);
        break;
      case 'loadSample':
        this.sampler?.loadSampleFromFloat32Array(msg.data, msg.sampleRate);
        break;
    }
  }

  /**
   * 初始化 DSP 模块（查找表、voices、comb、limiter）并应用默认参数。
   * 由 `init` 消息触发；在此之前 `process()` 早退不发声。
   * 注：spec 002-dsp-architecture.md 期望构造器内预分配，但 AudioWorklet
   * 全局 `sampleRate` 在构造时可能未就绪，因此延后到首个消息。
   * @param srate - 采样率（Hz）
   */
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
    this.applyParamsToVoices(srate);

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

  /**
   * 选择用于触发新音符的 voice 槽位。
   * 优先级（reuse_voices 开启时）：① 已在演奏同音的 voice →
   * ② 已 release 的 voice 中最早 release 的 → ③ 仍在 press 的 voice 中最早 press 的。
   * @returns voice 在 this.voices 中的索引
   */
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

  /**
   * 触发 note-on：选 voice、计算 mallet 频率（含 velocity 调制）、调用 voice.trigger。
   * @param note - MIDI 音符号
   * @param velocity - 0-127
   */
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

    // 从持音缓存中移除（重新按下覆盖之前的 release 缓存）
    this.sustainPedalNotes = this.sustainPedalNotes.filter(n => n.note !== note);
  }

  /**
   * 触发 note-off：如持音踏板按下则缓存；否则对所有演奏该音的 voice 调用 release。
   */
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

  /** 设置持音踏板状态；释放时统一对所有缓存音符调用 offNote。 */
  private handleSustain(value: boolean): void {
    this.sustainPedal = value;
    if (!value) {
      for (const n of this.sustainPedalNotes) {
        this.offNote(n.note);
      }
      this.sustainPedalNotes = [];
    }
  }

  /** 清空所有 voice（用于 model/preset 切换时强制重置）。 */
  private clearVoices(): void {
    for (let i = 0; i < MAX_POLYPHONY; i++) {
      this.voices[i].clear();
    }
  }

  // ── Pitch bend ──

  /** 设置弯音目标（normalized ∈ [-1, 1] → 频率倍率 2^(±bendRange/12)）。 */
  private setBendTarget(normalized: number): void {
    const bendRange = this.getP('bend_range');
    this.startBend = this.curBend;
    this.targetBend = Math.pow(2.0, normalized * bendRange / 12.0);
    this.remainingSamplesBend = this.totalSamplesBend;
    this.bendStep = (this.targetBend - this.startBend) / this.totalSamplesBend;
  }

  /** 每 sample 推进一步弯音 glide，达到目标后停止。 */
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

  /** 批量写入参数并立即应用到 voices。用于 init / setParams / loadPreset。 */
  private setParams(params: Record<string, number>): void {
    for (const [id, value] of Object.entries(params)) {
      this.params[id] = value;
    }
    this.applyParamsToVoices(sampleRate);
  }

  /**
   * 加载预置：批量写入参数、清空 voice（避免参数切换产生爆音）、
   * 重置 model 跟踪状态、应用参数到 voices。
   */
  private loadPreset(preset: Record<string, number>): void {
    for (const [id, value] of Object.entries(preset)) {
      this.params[id] = value;
    }
    this.clearVoices();
    this.resetLastModels();
    this.applyParamsToVoices(sampleRate);
  }

  /** 把当前 a_model/a_partials/b_model/b_partials 写入 last* 跟踪字段（避免预设后立即误触发 model 重算）。 */
  private resetLastModels(): void {
    this.lastAModel = this.getInt('a_model');
    this.lastAPartials = this.getInt('a_partials');
    this.lastBModel = this.getInt('b_model');
    this.lastBPartials = this.getInt('b_partials');
  }

  /**
   * 把当前 `this.params` 应用到所有 voices 的 DSP 子模块（resonator/noise/mallet/coupling）。
   * 名称从 C++ 原版的 `onSlider` 沿用而来，但实际触发源包括 setParam / setParams /
   * loadPreset / init——不止滑块。故重命名为 applyParamsToVoices。
   */
  private applyParamsToVoices(srate: number): void {
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

  /**
   * AudioWorklet 主处理函数。逐 sample 渲染所有 voices 并写入 stereo output。
   * 设计要点（spec 009-performance-benchmark.md）：
   * - `process()` 内零对象分配——active voice 计数用 in-place 循环而非 `Array.filter`。
   * - CPU 耗时由 `performance.now()` 测量并周期性上报。
   * @returns true 保持 processor 存活
   */
  process(inputs: Float32Array[][], outputs: Float32Array[][], _parameters: Record<string, Float32Array>): boolean {
    if (!this.initialized) return true;

    const procStart = (typeof performance !== 'undefined' && performance.now) ? performance.now() : 0;

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

    // 周期性状态上报：RMS、CPU 占比、活跃 voice 数。
    // CPU 占比 = 累计 process() 耗时 / 累计 buffer 时长，反映音频线程负载。
    // active voice 计数用 in-place 循环，避免 `Array.filter` 在音频线程分配数组（spec 009: 零分配）。
    const procEnd = (procStart !== 0 && typeof performance !== 'undefined' && performance.now)
      ? performance.now() : 0;
    if (procEnd !== 0) {
      this.cpuTimeAccum += (procEnd - procStart);
      this.cpuBufferDurationAccum += (numSamples / sampleRate) * 1000;
    }

    this.processCount++;
    if (this.processCount >= STATUS_INTERVAL) {
      this.processCount = 0;
      const rms = this.rmsCount > 0 ? Math.sqrt(this.rmsAccum / this.rmsCount) : 0;
      this.rmsAccum = 0;
      this.rmsCount = 0;

      let activeVoices = 0;
      for (let i = 0; i < MAX_POLYPHONY; i++) {
        const v = this.voices[i];
        if (v.isPressed || v.resA.active || v.resB.active) activeVoices++;
      }

      const cpuUsage = this.cpuBufferDurationAccum > 0
        ? this.cpuTimeAccum / this.cpuBufferDurationAccum
        : 0;
      this.cpuTimeAccum = 0;
      this.cpuBufferDurationAccum = 0;

      this.port.postMessage({
        type: 'status',
        rms,
        cpuUsage,
        activeVoices,
      });
    }

    return true;
  }
}

// Register the processor
registerProcessor('modal-synth', ModalSynthProcessor);
