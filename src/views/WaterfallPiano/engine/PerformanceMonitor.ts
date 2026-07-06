// ─── 性能监控：自动降级与恢复 ───
// 当帧率持续低于 minFps 时触发降级；恢复到 targetFps 后自动恢复

export type PerformanceAction = "idle" | "degrade" | "recover";

export class PerformanceMonitor {
  private minFps: number;
  private targetFps: number;
  private lowFpsAccumulator = 0; // 持续低帧率的累计时间（秒）
  private highFpsAccumulator = 0;
  private degraded = false;
  // 触发降级需要持续低帧率的时间（秒）
  private readonly degradeThreshold = 3;
  // 触发恢复需要持续高帧率的时间（秒）
  private readonly recoverThreshold = 5;

  constructor(minFps: number, targetFps: number) {
    this.minFps = minFps;
    this.targetFps = targetFps;
  }

  setThresholds(minFps: number, targetFps: number) {
    this.minFps = minFps;
    this.targetFps = targetFps;
  }

  // 每帧调用，传入当前 fps，返回建议动作
  update(fps: number, deltaSeconds = 1 / 60): PerformanceAction {
    if (fps < this.minFps) {
      this.lowFpsAccumulator += deltaSeconds;
      this.highFpsAccumulator = 0;
      if (!this.degraded && this.lowFpsAccumulator >= this.degradeThreshold) {
        this.degraded = true;
        return "degrade";
      }
    } else if (fps >= this.targetFps) {
      this.highFpsAccumulator += deltaSeconds;
      this.lowFpsAccumulator = 0;
      if (this.degraded && this.highFpsAccumulator >= this.recoverThreshold) {
        this.degraded = false;
        this.lowFpsAccumulator = 0;
        this.highFpsAccumulator = 0;
        return "recover";
      }
    } else {
      // 中间区间：缓慢重置
      this.lowFpsAccumulator = Math.max(
        0,
        this.lowFpsAccumulator - deltaSeconds * 0.5,
      );
      this.highFpsAccumulator = Math.max(
        0,
        this.highFpsAccumulator - deltaSeconds * 0.5,
      );
    }
    return "idle";
  }

  isDegraded(): boolean {
    return this.degraded;
  }

  reset() {
    this.lowFpsAccumulator = 0;
    this.highFpsAccumulator = 0;
    this.degraded = false;
  }
}
