/**
 * 导出期间的「前台让路」钩子（ADR 0026）
 *
 * 视频导出会在后台再起一个离屏引擎逐帧渲染 + 调用 WebCodecs 编码，
 * 若此时前台页面仍在按帧渲染（瀑布流钢琴的 60fps Ticker：背景 / 音符方块 /
 * 键盘 / Aura 滤镜 / 流体 WebGL）或仍在播放音频，两者争抢同一份 CPU / GPU，
 * 导出速度被明显拖慢。
 *
 * 因此导出开始前 suspend() 掉前台渲染与播放，导出结束（含取消 / 报错）后
 * resume()。约束：
 * - suspend / resume 必须成对——调用方在 finally 里 resume；
 * - 两个方法都幂等，重复调用不叠加副作用；
 * - resume 抛错不能影响导出结果，也不能让前台永久停在暂停态。
 */

/** 前台让路实现：suspend 暂停前台渲染 / 播放，resume 恢复 */
export interface ExportSuspender {
  suspend(): void;
  resume(): void;
}

export class ExportSuspension {
  private suspender: ExportSuspender | null = null;
  private suspended = false;

  /**
   * 绑定 / 换绑 / 解绑让路实现。
   *
   * 若此刻正处于暂停态：先恢复旧钩子再换绑，避免「页面卸载时解绑」这类
   * 路径把前台永久留在冻结状态。
   */
  bind(suspender: ExportSuspender | null): void {
    const prev = this.suspender;
    if (this.suspended) {
      this.suspended = false;
      if (prev && prev !== suspender) this.safe(() => prev.resume());
    }
    this.suspender = suspender;
  }

  /** 暂停前台渲染 / 播放（幂等） */
  suspend(): void {
    if (this.suspended) return;
    this.suspended = true;
    this.safe(() => this.suspender?.suspend());
  }

  /** 恢复前台渲染（幂等） */
  resume(): void {
    if (!this.suspended) return;
    this.suspended = false;
    this.safe(() => this.suspender?.resume());
  }

  /** 当前是否处于暂停态（调试 / 测试用） */
  get isSuspended(): boolean {
    return this.suspended;
  }

  private safe(fn: () => void): void {
    try {
      fn();
    } catch {
      // 前台让路失败不应影响导出流程本身
    }
  }
}
