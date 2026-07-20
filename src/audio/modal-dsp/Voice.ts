// Port from RipplerX Voice.h/cpp
// 单复音 Voice，持有 ResonatorA、ResonatorB、Mallet 和 Noise
// 计算耦合谐振器的分裂频率，并调谐 resonator 的模态
// MTS-ESP 未移植（Web 不支持），note2freq 始终使用标准调音

import { Mallet, MalletType } from './Mallet';
import { Noise } from './Noise';
import { Resonator } from './Resonator';
import { Models, ModalModels } from './Models';
import { Sampler } from './Sampler';
import { Partial } from './Partial';

/** 重复音符 fade out 时间 (ms) */
const REPEAT_NOTE_FADE_MS = 1;

export class Voice {
  note = 0;
  freq = 0.0;
  vel = 0.0;
  isRelease = false;
  isPressed = false; // 用于 audioIn
  couple = false;
  malletKtrack = 0.0;
  split = 0.0;
  srate = 44100.0;
  a_ratio = 1.0; // 用于重计算模型
  b_ratio = 1.0; // 用于重计算模型
  pressed_ts: number = 0; // 时间戳，用于排序音符
  release_ts: number = 0;

  // 用于重复音符的 fade out
  isFading = false;
  fadeTotalSamples = 0;
  fadeSamples = 0;
  malletType: MalletType = MalletType.kImpulse;
  malletFreq = 0.0;
  newFreq = 0.0;
  newVel = 0.0;
  newNote = 0;

  aPitchFactor = 1.0;
  bPitchFactor = 1.0;
  pitchBend = 1.0;

  mallet: Mallet;
  noise: Noise = new Noise();
  resA: Resonator = new Resonator();
  resB: Resonator = new Resonator();

  private models: Models;
  private aPhases: Float64Array = new Float64Array(64);
  private bPhases: Float64Array = new Float64Array(64);

  constructor(models: Models, sampler: Sampler) {
    this.models = models;
    this.mallet = new Mallet(sampler);
  }

  /** MIDI 音符转频率（标准调音，无 MTS-ESP） */
  note2freq(note: number): number {
    return 440 * Math.pow(2.0, (note - 69) / 12.0);
  }

  /** 触发音符 */
  trigger(
    timestamp: number, srate: number, note: number, vel: number,
    malletType: MalletType, malletFreq: number, malletKTrack: number,
    skipFade: boolean
  ): void {
    this.srate = srate;
    this.malletType = malletType;
    this.malletFreq = malletFreq;

    this.newVel = vel;
    this.newNote = note;
    this.newFreq = this.note2freq(note);
    this.malletKtrack = malletKTrack;

    this.isRelease = false;
    this.isPressed = true;
    this.pressed_ts = timestamp;

    // 在重新触发前 fade out 活跃的 voice
    if (skipFade) {
      this.triggerStart(false);
    } else if ((this.resA.on && this.resA.active) || (this.resB.on && this.resB.active)) {
      this.isFading = true;
      this.fadeTotalSamples = Math.floor(REPEAT_NOTE_FADE_MS * 0.001 * srate);
      this.fadeSamples = this.fadeTotalSamples;
      this.updateResonators();
    } else {
      this.triggerStart(true);
    }
  }

  /** Fade out 处理，返回当前 fade 增益 */
  fadeOut(): number {
    this.fadeSamples--;
    if (this.fadeSamples <= 0) {
      this.isFading = false;
      this.triggerStart(true);
    }
    return this.isFading ? this.fadeSamples / this.fadeTotalSamples : 1.0;
  }

  /** 实际触发音符 */
  triggerStart(reset: boolean): void {
    if (reset) {
      this.resA.clear();
      this.resB.clear();
    }
    this.note = this.newNote;
    this.vel = this.newVel;
    this.freq = this.newFreq;

    this.mallet.trigger(this.malletType, this.srate, this.malletFreq, this.note, this.malletKtrack);
    this.noise.attack(this.vel);
    if (this.resA.on) this.resA.activate();
    if (this.resB.on) this.resB.activate();
    this.updateResonators();
  }

  /** 释放音符 */
  release(timestamp: number): void {
    this.isRelease = true;
    this.isPressed = false;
    this.release_ts = timestamp;
    this.noise.release();
    this.updateResonators();
  }

  /** 清除所有状态 */
  clear(): void {
    this.mallet.clear();
    this.noise.clear();
    this.resA.clear();
    this.resB.clear();
  }

  /** 设置耦合模式和分裂参数 */
  setCoupling(couple: boolean, split: number): void {
    this.couple = couple;
    this.split = split;
  }

  /** 设置音高参数
   * @param a_coarse - A 侧粗调（半音）
   * @param b_coarse - B 侧粗调（半音）
   * @param a_fine - A 侧微调（音分）
   * @param b_fine - B 侧微调（音分）
   * @param pitch_bend - pitch bend 因子
   */
  setPitch(a_coarse: number, b_coarse: number, a_fine: number, b_fine: number, pitch_bend: number): void {
    this.aPitchFactor = Math.pow(2.0, (a_coarse + a_fine / 100.0) / 12.0);
    this.bPitchFactor = Math.pow(2.0, (b_coarse + b_fine / 100.0) / 12.0);
    this.pitchBend = pitch_bend;
  }

  /** 设置模型 ratio */
  setRatio(a_ratio: number, b_ratio: number): void {
    this.a_ratio = a_ratio;
    this.b_ratio = b_ratio;
  }

  /** 对模型数组应用 pitch 因子 */
  private applyPitch(model: Float64Array, factor: number): void {
    for (let i = 0; i < model.length; i++) {
      model[i] *= factor;
    }
  }

  /** 应用 pitch bend */
  applyPitchBend(bend: number): void {
    if (bend !== this.pitchBend) {
      this.pitchBend = bend;
      if (this.resA.on) this.resA.applyPitchBend(bend);
      if (this.resB.on) this.resB.applyPitchBend(bend);
    }
  }

  /** 处理振荡器阵列（用于振荡器激励模式）
   * @param isA - true 处理 A 侧，false 处理 B 侧
   */
  processOscillators(isA: boolean): number {
    const res = isA ? this.resA : this.resB;
    const phases = isA ? this.aPhases : this.bPhases;

    let final_ = 0.0;
    if (!res.on) return final_;

    const isTube = res.nmodel === ModalModels.OpenTube || res.nmodel === ModalModels.ClosedTube;

    if (isTube) {
      phases[0] += res.waveguide.f_k / this.srate;
      if (phases[0] > 1.0) phases[0] -= 1.0;
      final_ += res.nmodel === ModalModels.OpenTube
        ? phases[0] * -2 + 1 // 锯齿波产生与开管相同的谐波
        : phases[0] < 0.5 ? -1 : 1; // 方波产生与闭管相同的谐波
    } else {
      for (let i = 0; i < res.npartials; i++) {
        const partial = res.partials[i];
        if (!partial.out_of_range) {
          phases[i] += partial.f_k / this.srate;
          if (phases[i] > 1.0) phases[i] -= 1.0;
          final_ += Partial.sinLUT.lookup(phases[i]);
        }
      }
    }

    final_ *= isTube ? 0.125 : 0.004; // 增益归一化

    return final_;
  }

  /** 计算频率分裂量 */
  private freqShift(fa: number, fb: number): number {
    const avg = (fa + fb) / 2.0;
    const k = this.split + Math.cos(avg) / 5.0; // 伪随机偏移，使频率耦合不完全同步
    const w = avg + Math.sqrt(Math.pow((fa - fb) / 2.0, 2.0) + Math.pow(k / 2.5, 2.0));
    return Math.abs(Math.max(fa, fb) - w);
  }

  /** 计算串行耦合的频率分裂 */
  private calcFrequencyShifts(
    aModel: Float64Array, bModel: Float64Array
  ): [aShifts: Float64Array, bShifts: Float64Array] {
    const aShifts = aModel.slice();
    const bShifts = bModel.slice();

    for (let i = 0; i < 64; ++i) {
      const fa = aModel[i];
      for (let j = 0; j < 64; ++j) {
        const fb = bModel[j];
        if (Math.abs(fa - fb) <= 4.0) {
          const shift = this.freqShift(fa * this.freq, fb * this.freq) / this.freq;
          aShifts[i] += fa > fb ? shift : -shift;
          bShifts[i] += fa > fb ? -shift : shift;
        }
      }
    }

    return [aShifts, bShifts];
  }

  /** 更新两个 resonator 的模态 */
  updateResonators(): void {
    let aModel: Float64Array = this.models.aModels[this.resA.nmodel].slice();
    let bModel: Float64Array = this.models.bModels[this.resB.nmodel].slice();
    const aGain = this.models.getGains(this.resA.nmodel as ModalModels);
    const bGain = this.models.getGains(this.resB.nmodel as ModalModels);

    if (this.resA.nmodel === ModalModels.Djembe) {
      aModel = this.models.calcDjembe(this.freq, this.a_ratio);
    }
    if (this.resB.nmodel === ModalModels.Djembe) {
      bModel = this.models.calcDjembe(this.freq, this.b_ratio);
    }

    if (this.aPitchFactor !== 1.0) this.applyPitch(aModel, this.aPitchFactor);
    if (this.bPitchFactor !== 1.0) this.applyPitch(bModel, this.bPitchFactor);

    // 如果耦合模式为串行，应用频率分裂
    if (this.couple && this.resA.on && this.resB.on) {
      const [aShifts, bShifts] = this.calcFrequencyShifts(aModel, bModel);
      aModel = aShifts;
      bModel = bShifts;
    }

    if (this.resA.on) this.resA.update(this.freq, this.vel, this.isRelease, this.pitchBend, aModel, aGain);
    if (this.resB.on) this.resB.update(this.freq, this.vel, this.isRelease, this.pitchBend, bModel, bGain);
  }
}
