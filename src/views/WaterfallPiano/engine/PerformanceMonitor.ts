const WINDOW_SIZE = 60;
const DEGRADE_THRESHOLD_FPS = 45;
const DEGRADE_CONSECUTIVE_FRAMES = 30;

/**
 * 帧率监控器，基于滑动窗口统计 FPS 并在持续低帧率时触发降级标记
 */
export class PerformanceMonitor {
  private frameTimes: number[] = [];
  private lowFpsStreak = 0;
  private degraded = false;

  /**
   * 记录一帧的耗时，并更新 FPS 统计与降级状态
   * @param deltaTime - 本帧耗时（毫秒），若 ≤ 0 则按 16.67ms 处理
   */
  recordFrame(deltaTime: number): void {
    const dt = deltaTime > 0 ? deltaTime : 16.67;
    this.frameTimes.push(dt);
    if (this.frameTimes.length > WINDOW_SIZE) {
      this.frameTimes.shift();
    }
    const fps = 1000 / dt;
    if (fps < DEGRADE_THRESHOLD_FPS) {
      this.lowFpsStreak++;
      if (this.lowFpsStreak >= DEGRADE_CONSECUTIVE_FRAMES) {
        this.degraded = true;
      }
    } else {
      this.lowFpsStreak = 0;
      this.degraded = false;
    }
  }

  getFps(): number {
    if (this.frameTimes.length === 0) return 0;
    const avg =
      this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length;
    return avg > 0 ? 1000 / avg : 0;
  }

  getFrameTime(): number {
    if (this.frameTimes.length === 0) return 0;
    return this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length;
  }

  /**
   * 判断是否应进入降级模式（FPS 持续低于阈值）
   * @returns 是否处于降级状态
   */
  shouldDegrade(): boolean {
    return this.degraded;
  }

  reset(): void {
    this.frameTimes = [];
    this.lowFpsStreak = 0;
    this.degraded = false;
  }
}
