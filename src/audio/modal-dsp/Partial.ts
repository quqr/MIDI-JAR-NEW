// Port from RipplerX Partial.h/cpp
// 二阶带通滤波器，附带 decay/frequency/amplitude 计算
// 用于 modal synthesis 的单个 partial

import { LookupTable } from './LookupTable';

/** 缓存上一次 initA1LUT 的采样率，避免重复建表 */
let _a1LUTSrate = 0.0;

export class Partial {
  /** a1 系数查找表（用于 pitch bend 时快速重算） */
  static a1LUT: LookupTable = new LookupTable();
  /** sin 查找表（用于振荡器激励） */
  static sinLUT: LookupTable = new LookupTable();

  /** 初始化静态查找表，仅在采样率变化时重建 */
  static initA1LUT(sampleRate: number): void {
    if (_a1LUTSrate !== sampleRate) {
      const fMin = 1.0;
      const fMax = 20000.0;
      const LUT_SIZE = 4096;

      Partial.a1LUT.init(
        (f: number) => {
          const omega = 2 * Math.PI * f / sampleRate;
          return -2.0 * Math.cos(omega);
        },
        fMin, fMax, LUT_SIZE
      );

      Partial.sinLUT.init(
        (norm: number) => Math.sin(2 * Math.PI * norm),
        0.0, 1.0, LUT_SIZE
      );

      _a1LUTSrate = sampleRate;
    }
  }

  srate = 0.0;
  /** Partial 编号 (从 1 开始) */
  k: number;
  decay = 0.0;
  damp = 0.0;
  tone = 0.0;
  hit = 0.0;
  rel = 0.0;
  inharm = 0.0;
  radius = 0.0;
  vel_decay = 0.0;
  vel_hit = 0.0;
  vel_inharm = 0.0;
  vel_damp = 0.0;
  vel_tone = 0.0;

  f_k = 1000.0;
  out_of_range = false;

  private base_f_k = 1000.0;
  private b0 = 0.0;
  private b2 = 0.0;
  private a0 = 1.0;
  private a1 = 0.0;
  private a2 = 0.0;

  private x1 = 0.0;
  private x2 = 0.0;
  private y1 = 0.0;
  private y2 = 0.0;

  constructor(n: number) {
    this.k = n;
  }

  /** 更新 partial 的频率和滤波器系数
   * @param f_0 - 基频
   * @param ratio - 模态频率比
   * @param ratio_max - 模态最大频率比（用于 tone 计算）
   * @param vel - 力度 [0,1]
   * @param pitch_bend - pitch bend 因子
   * @param isRelease - 是否在 release 阶段
   */
  update(f_0: number, ratio: number, ratio_max: number, vel: number, pitch_bend: number, isRelease: boolean): void {
    this.out_of_range = false;
    let inharm_k = Math.max(0.0, Math.min(1.0, Math.exp(Math.log(this.inharm) + vel * this.vel_inharm * -Math.log(0.0001)) - 0.0001));
    inharm_k = Math.sqrt(1 + inharm_k * (ratio - 1) * (ratio - 1));
    this.f_k = f_0 * ratio * inharm_k;
    this.base_f_k = this.f_k;
    this.f_k *= pitch_bend;

    let decay_k = Math.max(0.01, Math.min(100.0, Math.exp(Math.log(this.decay) + vel * this.vel_decay * (Math.log(100.0) - Math.log(0.01)))));
    if (isRelease) decay_k *= this.rel;

    if (this.f_k >= 20000.0 || this.f_k < 1.0 || decay_k === 0.0) {
      this.out_of_range = true;
    }

    const f_max = Math.min(20000.0, f_0 * ratio_max * inharm_k);
    const omega = 2 * Math.PI * this.f_k / this.srate;
    const alpha = 2 * Math.PI / this.srate; // approx 1 sec decay

    const damp_base = Math.min(1.0, Math.max(-1.0, this.damp + this.vel_damp * 2.0 * vel));
    const damp_k = damp_base <= 0
      ? Math.pow(f_0 / this.f_k, damp_base * 2.0)
      : Math.pow(f_max / this.f_k, damp_base * 2.0);

    decay_k /= damp_k;

    const tone_base = Math.min(1.0, Math.max(-1.0, this.tone + this.vel_tone * 2.0 * vel));
    const tone_gain = tone_base <= 0
      ? Math.pow(this.f_k / f_0, tone_base * 12 / 6)
      : Math.pow(this.f_k / f_max, tone_base * 12 / 6);

    let amp_k = Math.abs(Math.sin(Math.PI * this.k * Math.max(0.02, Math.min(0.5, this.hit + this.vel_hit * vel / 2.0))));
    amp_k *= 35.0;

    // Bandpass filter coefficients (normalized)
    this.b0 = alpha * tone_gain * amp_k;
    this.b2 = -alpha * tone_gain * amp_k;
    this.a0 = decay_k ? 1.0 + alpha / decay_k : 0.0;
    this.a1 = -2.0 * Math.cos(omega);
    this.a2 = decay_k ? 1.0 - alpha / decay_k : 0.0;
  }

  /** 处理一个采样点 */
  process(input: number): number {
    if (this.out_of_range) return 0.0;
    const output = ((this.b0 * input + this.b2 * this.x2) - (this.a1 * this.y1 + this.a2 * this.y2)) / this.a0;
    this.x2 = this.x1;
    this.x1 = input;
    this.y2 = this.y1;
    this.y1 = output;
    return output;
  }

  /** 对 b0/b2 施加增益 */
  applyGain(gain: number): void {
    this.b0 *= gain;
    this.b2 *= gain;
  }

  /** 应用 pitch bend（使用 a1LUT 快速重算 a1） */
  applyPitchBend(pitch_bend: number): void {
    this.out_of_range = false;
    this.f_k = this.base_f_k * pitch_bend;
    if (this.f_k < 1.0 || this.f_k > 20000.0) {
      this.out_of_range = true;
      return;
    }
    this.a1 = Partial.a1LUT.lookup(this.f_k);
  }

  /** 清除内部状态 */
  clear(): void {
    this.x1 = this.x2 = this.y1 = this.y2 = 0;
  }
}
