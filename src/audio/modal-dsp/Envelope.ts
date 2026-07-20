// Port from RipplerX Envelope.h/cpp
// ADSR 包络，支持 tension/shape 控制
// 状态机: 0=Off, 1=Attack, 2=Decay, 4=Sustain, 8=Release

export class Envelope {
  att = 0.0;
  dec = 0.0;
  sus = 0.0;
  rel = 0.0;
  scale = 0.0;
  env = 0.0;
  /** 状态: 0=Off, 1=Attack, 2=Decay, 4=Sustain, 8=Release */
  state = 0;

  ab = 0.0; // attack coefficient
  ac = 0.0;
  db = 0.0; // decay coefficient
  dc = 0.0;
  rb = 0.0; // release coefficient
  rc = 0.0;
  ta = 0.0; // tension attack
  td = 0.0; // tension decay
  tr = 0.0; // tension release

  /** 将 tension 从 [-1,1] 归一化到曲线参数 */
  private normalizeTension(t: number): number {
    t += 1.0;
    if (t === 1.0) return 100.0;
    return t > 1.0 ? 3.001 - t : 0.001 + t;
  }

  /** 计算包络系数 */
  private calcCoefs(
    targetB1: number, targetB2: number, targetC: number,
    rate: number, tension: number, mult: number
  ): [b: number, c: number] {
    let c: number, b: number, t: number;
    if (tension > 1.0) { // slow-start shape
      t = Math.pow(tension - 1, 3.0);
      c = Math.exp(Math.log((targetC + t) / t) / rate);
      b = (targetB1 - mult * t) * (1 - c);
    } else { // fast-start shape (inverse exponential)
      t = Math.pow(tension, 3);
      c = Math.exp(-Math.log((targetC + t) / t) / rate);
      b = (targetB2 + mult * t) * (1 - c);
    }
    return [b, c];
  }

  /** 重新计算 attack 和 decay 系数 */
  private recalcCoefs(): void {
    // attack 系数
    const [ab, ac] = this.calcCoefs(0.0, this.scale, this.scale, this.att, this.ta, 1.0);
    this.ab = ab;
    this.ac = ac;
    // decay 系数
    const [db, dc] = this.calcCoefs(1.0, this.sus * this.scale, (1.0 - this.sus) * this.scale, this.dec, this.td, -1.0);
    this.db = db;
    this.dc = dc;
  }

  /** 初始化 ADSR 参数
   * @param srate - 采样率
   * @param a - Attack 时间 (ms)
   * @param d - Decay 时间 (ms)
   * @param s - Sustain 电平 (dB)
   * @param r - Release 时间 (ms)
   * @param tensionA - Attack tension [-1, 1]
   * @param tensionD - Decay tension [-1, 1]
   * @param tensionR - Release tension [-1, 1]
   */
  init(srate: number, a: number, d: number, s: number, r: number, tensionA: number, tensionD: number, tensionR: number): void {
    this.att = Math.max(a, 1.0) * 0.001 * srate;
    this.dec = Math.max(d, 1.0) * 0.001 * srate;
    this.sus = Math.pow(10.0, Math.min(s, 0.0) / 20.0);
    this.rel = Math.max(r, 1.0) * 0.001 * srate;

    this.ta = this.normalizeTension(tensionA);
    this.td = this.normalizeTension(-1.0 * tensionD);
    this.tr = this.normalizeTension(-1.0 * tensionR);
  }

  reset(): void {
    this.state = 0;
    this.env = 0.0;
  }

  /** 触发 Attack 阶段 */
  attack(scale: number): void {
    this.scale = scale;
    this.recalcCoefs();
    this.state = 1;
  }

  /** 进入 Decay 阶段 */
  private decay(): void {
    this.env = this.scale;
    this.state = 2;
  }

  /** 进入 Sustain 阶段 */
  private sustain(): void {
    this.env = this.scale * this.sus;
    this.state = 4;
  }

  /** 触发 Release 阶段 */
  release(): void {
    const [rb, rc] = this.calcCoefs(
      Math.max(this.env, this.sus) * this.scale,
      0.0,
      Math.max(this.env, this.sus) * this.scale,
      this.rel, this.tr, -1.0
    );
    this.rb = rb;
    this.rc = rc;
    this.state = 8;
  }

  /** 处理一个采样点，返回当前状态 */
  process(): number {
    if (!this.state) return 0;

    if (this.state === 1) { // Attack
      this.env = this.ab + this.env * this.ac;
      if (this.env >= this.scale) this.decay();
    } else if (this.state === 2) { // Decay
      this.env = this.db + this.env * this.dc;
      if (this.env <= this.sus * this.scale) this.sustain();
    } else if (this.state === 8) { // Release
      this.env = this.rb + this.env * this.rc;
      if (this.env <= 0) this.reset();
    }

    return this.state;
  }
}
