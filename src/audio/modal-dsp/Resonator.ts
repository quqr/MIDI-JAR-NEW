// Port from RipplerX Resonator.h/cpp
// Resonator 持有 Partials 和 Waveguide
// 根据所选模型使用 Partials 或 Waveguide 处理输入
// Partials 由 Voice 调谐

import { Partial } from './Partial';
import { Waveguide } from './Waveguide';
import { Filter } from './Filter';
import { ModalModels } from './Models';

/** 最大 partial 数量 */
const MAX_PARTIALS = 64;

export class Resonator {
  silence = 0; // 静音采样计数器
  active = false; // 当静音超过一定时间后变为 false
  srate = 0.0;
  on = false;
  nmodel = 0;
  npartials = 0;
  decay = 0.0;
  radius = 0.0;
  cut = 0.0;

  partials: Partial[] = [];
  waveguide: Waveguide = new Waveguide();
  filter: Filter = new Filter();

  constructor() {
    for (let i = 0; i < MAX_PARTIALS; ++i) {
      this.partials.push(new Partial(i + 1));
    }
  }

  /** 设置 resonator 参数 */
  setParams(
    srate: number, on: boolean, model: number, partials: number,
    decay: number, damp: number, tone: number, hit: number,
    rel: number, inharm: number, cut: number, radius: number,
    vel_decay: number, vel_hit: number, vel_inharm: number,
    vel_damp: number, vel_tone: number
  ): void {
    this.on = on;
    this.nmodel = model;
    this.npartials = partials;
    this.decay = decay;
    this.radius = radius;
    this.srate = srate;
    this.cut = cut;

    const freq = 20.0 * Math.pow(20000.0 / 20.0, cut < 0.0 ? 1 + cut : cut);
    if (cut < 0.0) {
      this.filter.lp(srate, freq, 0.707);
    } else {
      this.filter.hp(srate, freq, 0.707);
    }

    for (const partial of this.partials) {
      partial.damp = damp;
      partial.decay = decay;
      partial.hit = hit;
      partial.inharm = inharm;
      partial.rel = rel;
      partial.tone = tone;
      partial.vel_decay = vel_decay;
      partial.vel_hit = vel_hit;
      partial.vel_inharm = vel_inharm;
      partial.vel_damp = vel_damp;
      partial.vel_tone = vel_tone;
      partial.srate = srate;
    }

    this.waveguide.decay = decay;
    this.waveguide.radius = radius;
    this.waveguide.is_closed = model === ModalModels.ClosedTube;
    this.waveguide.srate = srate;
    this.waveguide.vel_decay = vel_decay;
    this.waveguide.rel = rel;
  }

  /** 激活 resonator */
  activate(): void {
    this.active = true;
    this.silence = 0;
  }

  /** 更新 resonator 的模型和力度 */
  update(
    freq: number, vel: number, isRelease: boolean, pitch_bend: number,
    model: Float64Array, modelGain: Float64Array
  ): void {
    if (this.nmodel === ModalModels.OpenTube || this.nmodel === ModalModels.ClosedTube) {
      this.waveguide.update(model[0] * freq, vel, pitch_bend, isRelease);
    } else {
      for (const partial of this.partials) {
        const idx = partial.k - 1;
        partial.update(freq, model[idx], model[model.length - 1], vel, pitch_bend, isRelease);
        partial.applyGain(modelGain[idx]);
      }
    }
  }

  /** 应用 pitch bend */
  applyPitchBend(bend: number): void {
    if (this.active) {
      if (this.nmodel === ModalModels.OpenTube || this.nmodel === ModalModels.ClosedTube) {
        this.waveguide.applyPitchBend(bend);
      } else {
        for (let p = 0; p < this.npartials; ++p) {
          this.partials[p].applyPitchBend(bend);
        }
      }
    }
  }

  /** 处理一个采样点 */
  process(input: number): number {
    let out = 0.0;

    if (this.active) {
      if (this.nmodel === ModalModels.OpenTube || this.nmodel === ModalModels.ClosedTube) {
        out += this.waveguide.process(input);
      } else {
        for (let p = 0; p < this.npartials; ++p) {
          out += this.partials[p].process(input);
        }
      }
    }

    if (Math.abs(out) + Math.abs(input) > 0.00001)
      this.silence = 0;
    else
      this.silence += 1;

    if (this.silence >= this.srate)
      this.active = false;

    return out;
  }

  /** 清除所有状态 */
  clear(): void {
    for (const partial of this.partials) {
      partial.clear();
    }
    this.waveguide.clear();
    this.filter.clear(0.0);
  }
}
