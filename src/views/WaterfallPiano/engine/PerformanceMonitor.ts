const WINDOW_SIZE = 60;
const DEGRADE_THRESHOLD_FPS = 45;
const DEGRADE_CONSECUTIVE_FRAMES = 30;

export class PerformanceMonitor {
  private frameTimes: number[] = [];
  private lowFpsStreak = 0;
  private degraded = false;

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

  shouldDegrade(): boolean {
    return this.degraded;
  }

  reset(): void {
    this.frameTimes = [];
    this.lowFpsStreak = 0;
    this.degraded = false;
  }
}
