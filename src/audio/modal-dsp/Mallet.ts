// Port from RipplerX Mallet.h/cpp
// 鼓槌生成器，支持 impulse 和 sample 两种模式
// impulse: 单位脉冲经带通滤波器
// sample: 基于采样的鼓槌

import { Filter } from './Filter';
import { Sampler } from './Sampler';

/** 鼓槌类型枚举 */
export enum MalletType {
  kImpulse = 0,
  kReserved1 = 1,
  kReserved2 = 2,
  kReserved3 = 3,
  kReserved4 = 4,
  kReserved5 = 5,
  kReserved6 = 6,
  kReserved7 = 7,
  kReserved8 = 8,
  kReserved9 = 9,
  kReserved10 = 10,
  kUserFile = 11,
  kSample1 = 12,
  kSample2 = 13,
  kSample3 = 14,
  kSample4 = 15,
  kSample5 = 16,
  kSample6 = 17,
  kSample7 = 18,
  kSample8 = 19,
  kSample9 = 20,
  kSample10 = 21,
  kSample11 = 22,
  kSample12 = 23,
  kSample13 = 24,
  kSample14 = 25,
}

export class Mallet {
  srate = 44100.0;

  // impulse mallet 字段
  impulse = 0.0;
  countdown = 0;
  env = 0.0;
  impulse_filter: Filter = new Filter();

  // sample mallet 字段
  ktrack = 0.0; // key tracking
  keytrack_factor = 1.0;
  playback = Infinity;
  playback_speed = 1.0;
  disable_filter = false;
  sample_filter: Filter = new Filter();

  private sampler: Sampler;
  private type: MalletType = MalletType.kImpulse;

  constructor(sampler: Sampler) {
    this.sampler = sampler;
  }

  /** 触发鼓槌
   * @param type - 鼓槌类型
   * @param srate - 采样率
   * @param freq - 滤波器频率（impulse 模式）
   * @param note - MIDI 音符编号（用于 key tracking）
   * @param ktrack - key tracking 系数
   */
  trigger(type: MalletType, srate: number, freq: number, note: number, ktrack: number): void {
    this.type = type;
    this.srate = srate;
    this.ktrack = ktrack;

    if (type === MalletType.kImpulse) {
      this.impulse_filter.bp(srate, freq, 0.707);
      this.countdown = Math.floor(srate / 10.0); // 100ms 倒计时
      this.impulse = 1.0;
      this.env = Math.exp(-100.0 / srate);
    } else {
      this.keytrack_factor = Math.pow(2.0, ((note - 60) / 12.0) * ktrack);
      this.playback_speed = this.sampler.wavesrate / srate;
      this.playback = 0.0;
    }
  }

  /** 清除状态 */
  clear(): void {
    this.countdown = 0;
    this.impulse = 0.0;
    this.playback = Infinity;
    this.impulse_filter.clear(0.0);
    this.sample_filter.clear(0.0);
  }

  /** 处理一个采样点 */
  process(): number {
    let sample = 0.0;

    if (this.type === MalletType.kImpulse && this.countdown > 0) {
      sample = this.impulse_filter.df1(this.impulse) * 2.0;
      this.countdown -= 1;
      this.impulse *= this.env;
    } else if (this.type >= MalletType.kUserFile && this.playback < this.sampler.waveform.length) {
      sample = this.sampler.waveCubic(this.playback);
      this.playback += this.playback_speed * this.sampler.pitchfactor * this.keytrack_factor;

      if (!this.disable_filter) {
        sample = this.sample_filter.df1(sample);
      }
    }

    return sample;
  }

  /** 设置 sample mallet 的滤波器
   * @param norm - 归一化频率参数，0=禁用，正数=HP，负数=LP
   */
  setFilter(norm: number): void {
    const freq = 20.0 * Math.pow(20000.0 / 20.0, norm < 0.0 ? 1 + norm : norm);
    this.disable_filter = norm === 0.0;
    if (!this.disable_filter) {
      if (norm < 0.0) {
        this.sample_filter.lp(this.srate, freq, 0.707);
      } else {
        this.sample_filter.hp(this.srate, freq, 0.707);
      }
    }
  }
}
