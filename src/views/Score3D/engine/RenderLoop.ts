/** 渲染循环：rAF 驱动，回调每帧执行一次 */
export class RenderLoop {
  private handle = 0;
  private running = false;

  constructor(private readonly callback: () => void) {}

  start(): void {
    if (this.running) return;
    this.running = true;
    const tick = () => {
      if (!this.running) return;
      this.callback();
      this.handle = requestAnimationFrame(tick);
    };
    this.handle = requestAnimationFrame(tick);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.handle);
  }

  get isRunning(): boolean {
    return this.running;
  }
}
