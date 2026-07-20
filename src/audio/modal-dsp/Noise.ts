// Port from RipplerX Noise.h/cpp
// 噪声生成器，带滤波器和 ADSR 包络
// 使用 Math.random() 替代 std::rand()

import { Filter } from './Filter';
import { Envelope } from './Envelope';

/** 将 sustain 值 [0,1] 转换为 dB */
function susToDb(val: number): number {
  return val * 60.0 - 60.0;
}

export class Noise {
  att = 0.0;
  dec = 0.0;
  sus = -60.0;
  rel = 0.0;
  att_ten = 0.0;
  dec_ten = 0.0;
  rel_ten = 0.0;
  vel_att = 0.0;
  vel_dec = 0.0;
  vel_sus = 0.0;
  vel_rel = 0.0;

  vel_freq = 0.0;
  vel_q = 0.0;
  srate = 44100.0;
  vel = 0.0;
  q = 0.707;
  filter_active = false;

  env: Envelope = new Envelope();

  private filter: Filter = new Filter();
  /** 滤波器副本，用于振荡器激励信号 */
  private osc_filter: Filter = new Filter();
  private fmode = 0;
  private freq = 0.0;

  /** 初始化噪声生成器
   * @param srate - 采样率
   * @param filterMode - 0=LP, 1=BP, 2=HP
   * @param freq - 滤波器频率
   * @param q - 滤波器 Q 值
   * @param att - Attack 时间
   * @param dec - Decay 时间
   * @param sus - Sustain 电平
   * @param rel - Release 时间
   * @param vel_freq - velocity 对频率的影响
   * @param vel_q - velocity 对 Q 的影响
   * @param att_ten - Attack tension
   * @param dec_ten - Decay tension
   * @param rel_ten - Release tension
   * @param vel_att - velocity 对 attack 的影响
   * @param vel_dec - velocity 对 decay 的影响
   * @param vel_sus - velocity 对 sustain 的影响
   * @param vel_rel - velocity 对 release 的影响
   */
  init(
    srate: number, filterMode: number, freq: number, q: number,
    att: number, dec: number, sus: number, rel: number,
    vel_freq: number, vel_q: number,
    att_ten: number, dec_ten: number, rel_ten: number,
    vel_att: number, vel_dec: number, vel_sus: number, vel_rel: number
  ): void {
    this.srate = srate;
    this.fmode = filterMode;
    this.freq = freq;
    this.q = q;
    this.vel_freq = vel_freq;
    this.vel_q = vel_q;
    this.initFilter();

    this.att = att;
    this.dec = dec;
    this.sus = sus;
    this.rel = rel;

    this.att_ten = att_ten;
    this.dec_ten = dec_ten;
    this.rel_ten = rel_ten;

    this.vel_att = vel_att;
    this.vel_dec = vel_dec;
    this.vel_sus = vel_sus;
    this.vel_rel = vel_rel;

    this.initEnvelope();
  }

  /** 触发 attack */
  attack(vel: number): void {
    this.vel = vel;
    this.initFilter();
    this.initEnvelope();
    this.env.attack(1.0);
  }

  /** 初始化滤波器（根据 vel 调制频率和 Q） */
  initFilter(): void {
    const f = Math.min(20000.0, Math.max(20.0, Math.exp(Math.log(this.freq) + this.vel * this.vel_freq * (Math.log(20000.0) - Math.log(20.0)))));
    const res = Math.min(4.0, Math.max(0.707, this.q + this.vel * this.vel_q * (4.0 - 0.707)));

    this.filter_active = this.fmode === 1 || (this.fmode === 0 && f < 20000.0) || (this.fmode === 2 && f > 20.0);

    if (this.fmode === 0) this.filter.lp(this.srate, f, res);
    else if (this.fmode === 1) this.filter.bp(this.srate, f, res);
    else if (this.fmode === 2) this.filter.hp(this.srate, f, res);

    this.osc_filter.copy(this.filter);
  }

  /** 初始化包络（根据 vel 调制 ADSR 参数） */
  initEnvelope(): void {
    const _att = Math.max(1.0, Math.min(20000.0, Math.exp(Math.log(this.att) + this.vel * this.vel_att * (Math.log(20000.0) - Math.log(1.0)))));
    const _dec = Math.max(1.0, Math.min(20000.0, Math.exp(Math.log(this.dec) + this.vel * this.vel_dec * (Math.log(20000.0) - Math.log(1.0)))));
    const _sus = Math.max(0.0, Math.min(1.0, this.sus + this.vel * this.vel_sus));
    const _rel = Math.max(1.0, Math.min(20000.0, Math.exp(Math.log(this.rel) + this.vel * this.vel_rel * (Math.log(20000.0) - Math.log(1.0)))));

    this.env.init(this.srate, _att, _dec, susToDb(_sus), _rel, this.att_ten, this.dec_ten, this.rel_ten);
  }

  /** 触发 release */
  release(): void {
    this.env.release();
  }

  /** 清除状态 */
  clear(): void {
    this.env.reset();
    this.filter.clear(0.0);
    this.osc_filter.clear(0.0);
  }

  /** 处理一个采样点（噪声模式） */
  process(): number {
    if (!this.env.state) return 0.0;
    this.env.process();
    let sample = Math.random() * 2.0 - 1.0;
    if (this.filter_active)
      sample = this.filter.df1(sample);

    if (!this.env.state)
      this.filter.clear(0.0); // 包络结束，清除滤波器避免爆音

    return sample * this.env.env;
  }

  /** 将输入信号通过相同的滤波器和包络处理（用于振荡器激励） */
  processOSC(input: number): number {
    if (!this.env.state) return 0.0;
    return (this.filter_active ? this.osc_filter.df1(input) : input) * this.env.env;
  }
}
