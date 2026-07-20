// Port from RipplerX Filter.h/cpp
// RBJ 二阶 IIR 滤波器，支持 LP / BP / HP
// 使用 Direct Form I (df1) 结构

export class Filter {
  private a1 = 0.0;
  private a2 = 0.0;
  private b0 = 0.0;
  private b1 = 0.0;
  private b2 = 0.0;
  private x0 = 0.0;
  private x1 = 0.0;
  private y0 = 0.0;
  private y1 = 0.0;

  /** 设置为低通滤波器 */
  lp(srate: number, freq: number, q: number): void {
    const w0 = 2 * Math.PI * Math.min(freq / srate, 0.49);
    const alpha = Math.sin(w0) / (2.0 * q);

    const a0 = 1.0 + alpha;
    const scale = 1.0 / a0;
    this.a1 = Math.cos(w0) * -2.0 * scale;
    this.a2 = (1.0 - alpha) * scale;

    this.b2 = this.b0 = (1.0 + this.a1 + this.a2) * 0.25;
    this.b1 = this.b0 * 2.0;
  }

  /** 设置为带通滤波器 */
  bp(srate: number, freq: number, q: number): void {
    const w0 = 2 * Math.PI * Math.min(freq / srate, 0.49);
    const alpha = Math.sin(w0) / (2.0 * q);

    const a0 = 1.0 + alpha;
    const scale = 1.0 / a0;
    this.a1 = Math.cos(w0) * -2.0 * scale;
    this.a2 = (1.0 - alpha) * scale;

    this.b2 = -(this.b0 = (1.0 - this.a2) * 0.5 * q);
    this.b1 = 0.0;
  }

  /** 设置为高通滤波器 */
  hp(srate: number, freq: number, q: number): void {
    const w0 = 2 * Math.PI * Math.min(freq / srate, 0.49);
    const alpha = Math.sin(w0) / (2.0 * q);

    const a0 = 1.0 + alpha;
    const scale = 1.0 / a0;
    this.a1 = Math.cos(w0) * -2.0 * scale;
    this.a2 = (1.0 - alpha) * scale;

    this.b2 = this.b0 = (1.0 - this.a1 + this.a2) * 0.25;
    this.b1 = this.b0 * -2.0;
  }

  /** 将滤波器内部状态清零到指定输入值 */
  clear(input: number): void {
    this.x0 = this.x1 = input;
    this.y0 = this.y1 = (input / (1.0 + this.a1 + this.a2)) * (this.b0 + this.b1 + this.b2);
  }

  /** Direct Form I 处理一个采样点 */
  df1(sample: number): number {
    const x2 = this.x1;
    this.x1 = this.x0;
    this.x0 = sample;

    const y2 = this.y1;
    this.y1 = this.y0;
    this.y0 = this.b0 * this.x0 + this.b1 * this.x1 + this.b2 * x2 - this.a1 * this.y1 - this.a2 * y2;

    return this.y0;
  }

  /** 从另一个 Filter 拷贝系数（不含状态） */
  copy(f: Filter): void {
    this.a1 = f.a1;
    this.a2 = f.a2;
    this.b0 = f.b0;
    this.b1 = f.b1;
    this.b2 = f.b2;
  }
}
