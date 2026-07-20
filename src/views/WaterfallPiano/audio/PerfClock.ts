/**
 * 时钟抽象接口与基于 performance.now() 的实现
 *
 * 统一 MidiFilePlayer 和 Recorder 的时钟源，
 * 替代 MidiFilePlayer 对 Tone.Transport 的静态依赖。
 */

/** 时钟接口 */
export interface Clock {
  start(): void;
  pause(): void;
  stop(): void;
  seek(seconds: number): void;
  getPosition(): number;
  setRate(rate: number): void;
  getRate(): number;
}

/**
 * 基于 performance.now() 的高精度时钟
 *
 * 使用方式：
 * - start() 开始计时
 * - pause() 暂停并冻结位置
 * - stop() 重置到零
 * - seek() 跳转到指定位置
 * - setRate() 设置倍速（1.0 = 原速）
 * - getPosition() 获取当前位置（秒）
 */
export class PerfClock implements Clock {
  private rate = 1;
  private running = false;
  /** 暂停时冻结的位置（秒） */
  private frozenPosition = 0;
  /** 上次 start/resume 时的 performance.now() 时间戳 */
  private startStamp = 0;

  start(): void {
    if (this.running) return;
    this.running = true;
    this.startStamp = performance.now();
  }

  pause(): void {
    if (!this.running) return;
    this.frozenPosition = this.getPosition();
    this.running = false;
  }

  stop(): void {
    this.running = false;
    this.frozenPosition = 0;
    this.startStamp = 0;
  }

  seek(seconds: number): void {
    this.frozenPosition = seconds;
    if (this.running) {
      this.startStamp = performance.now();
    }
  }

  getPosition(): number {
    if (!this.running) return this.frozenPosition;
    const elapsed = (performance.now() - this.startStamp) / 1000;
    return this.frozenPosition + elapsed * this.rate;
  }

  setRate(rate: number): void {
    if (rate <= 0) return;
    // 先冻结当前位置，再用新速率继续
    this.frozenPosition = this.getPosition();
    this.startStamp = performance.now();
    this.rate = rate;
  }

  getRate(): number {
    return this.rate;
  }
}
