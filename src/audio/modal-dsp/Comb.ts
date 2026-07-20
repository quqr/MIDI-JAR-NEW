// Port from RipplerX Comb.h
// 立体声 Comb 滤波器（stereoizer）

export class Comb {
  private pos = 0;
  private buf: Float64Array = new Float64Array(0);

  /** 初始化 comb 滤波器
   * @param srate - 采样率
   */
  init(srate: number): void {
    this.pos = 0;
    const size = Math.floor(20 * srate / 1000);
    this.buf = new Float64Array(size);
  }

  /** 处理一个采样点，返回 [left, right] 立体声输出 */
  process(input: number): [left: number, right: number] {
    this.buf[this.pos] = input;
    this.pos = (this.pos + 1) % this.buf.length;

    return [
      input + this.buf[this.pos] * 0.33,
      input - this.buf[this.pos] * 0.33,
    ];
  }
}
