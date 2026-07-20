// Port from RipplerX Utils.h LookupTable class
// 使用 Float64Array 代替 vector<double>，提供线性插值和三次插值查找

export class LookupTable {
  private values: Float64Array = new Float64Array(0);
  private min = 0.0;
  private max = 1.0;
  private scaler = 0.0;
  private offset = 0.0;
  private size = 0;

  /** 初始化查找表
   * @param fn - 映射函数，输入 [min, max] 范围的值，返回查表值
   * @param min_ - 输入最小值
   * @param max_ - 输入最大值
   * @param size_ - 表大小（采样点数）
   */
  init(fn: (x: number) => number, min_: number, max_: number, size_: number): void {
    if (max_ <= min_) throw new Error('max must be greater than min');
    if (size_ < 2) throw new Error('size must be at least 2');
    this.min = min_;
    this.max = max_;
    this.size = size_;
    this.values = new Float64Array(size_);

    this.scaler = size_ > 1 ? (size_ - 1) / (max_ - min_) : 0.0;
    this.offset = -min_ * this.scaler;

    for (let i = 0; i < size_; ++i) {
      const x = i / (size_ - 1); // 归一化 [0, 1]
      let mappedX = min_ + x * (max_ - min_);
      mappedX = Math.max(min_, Math.min(max_, mappedX));
      this.values[i] = fn(mappedX);
    }
  }

  /** 线性插值查找 */
  lookup(input: number): number {
    input = Math.max(this.min, Math.min(this.max, input));
    const normalizedIndex = input * this.scaler + this.offset;
    const index = Math.floor(normalizedIndex);

    if (index >= this.size - 1) return this.values[this.size - 1];

    const frac = normalizedIndex - index;
    return this.values[index] + frac * (this.values[index + 1] - this.values[index]);
  }

  /** 三次插值查找 (Catmull-Rom) */
  cubic(input: number): number {
    input = Math.max(this.min, Math.min(this.max, input));
    const idx = input * this.scaler + this.offset;
    const i = Math.floor(idx);
    const t = idx - i;

    const i0 = Math.max(0, i - 1);
    const i1 = i;
    const i2 = Math.min(this.size - 1, i + 1);
    const i3 = Math.min(this.size - 1, i + 2);

    const y0 = this.values[i0];
    const y1 = this.values[i1];
    const y2 = this.values[i2];
    const y3 = this.values[i3];

    const a0 = y3 - y2 - y0 + y1;
    const a1 = y0 - y1 - a0;
    const a2 = y2 - y0;
    const a3 = y1;

    return a0 * t * t * t + a1 * t * t + a2 * t + a3;
  }

  getValues(): Float64Array {
    return this.values;
  }
  getSize(): number {
    return this.size;
  }
  getMin(): number {
    return this.min;
  }
  getMax(): number {
    return this.max;
  }
}

/** 频率工具方法 */
export const Utils = {
  LOG_MAX_OVER_MIN_FREQ: 6.907755278982137, // log(20000 / 20)

  normalToFreq(norm: number): number {
    return 20.0 * Math.exp(norm * Utils.LOG_MAX_OVER_MIN_FREQ);
  },

  freqToNormal(freq: number): number {
    return Math.log(freq / 20.0) / Utils.LOG_MAX_OVER_MIN_FREQ;
  },

  gainTodB(gain: number): number {
    return gain === 0 ? -60.0 : 20.0 * Math.log10(gain);
  },
};
