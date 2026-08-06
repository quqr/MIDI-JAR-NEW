/**
 * 交互控制器：将原生 Pointer Events 转换为业务语义的"音符触发事件"
 *
 * 负责监听 DOM Pointer 事件、状态机管理（按下/移动/抬起）以及坐标到 MIDI
 * 音符号的映射，主引擎不再关心 touchAction 或 offsetX 等底层细节。
 */

export interface InteractionControllerDeps {
  /** 由 KeyboardRenderer 提供：像素坐标 → MIDI 音符号（null 表示未命中） */
  xToMidi: (x: number, y: number) => number | null;
  /** 业务回调：触发音符发声 */
  onNoteOn: (midi: number, velocity: number) => void;
  /** 业务回调：停止音符 */
  onNoteOff: (midi: number) => void;
}

const DEFAULT_VELOCITY = 90;

/**
 * 处理 PixiJS canvas 上的 Pointer 交互，将其映射为 MIDI 音符触发事件
 */
export class InteractionController {
  private deps: InteractionControllerDeps;
  private canvas: HTMLCanvasElement | null = null;
  private pointerDown = false;
  private activePointerMidi: number | null = null;

  constructor(deps: InteractionControllerDeps) {
    this.deps = deps;
  }

  /**
   * 绑定 Pointer Events 到 PixiJS canvas，设置 touchAction='none'
   * @param canvas - PixiJS Application 的 canvas 元素
   */
  enable(canvas: HTMLCanvasElement): void {
    this.canvas = canvas;
    canvas.style.touchAction = "none";
    canvas.addEventListener("pointerdown", this.onPointerDown);
    canvas.addEventListener("pointermove", this.onPointerMove);
    canvas.addEventListener("pointerup", this.onPointerUp);
    canvas.addEventListener("pointercancel", this.onPointerUp);
    canvas.addEventListener("pointerleave", this.onPointerUp);
  }

  /**
   * 解绑所有监听器，重置内部状态
   * 若有按住的音符，触发 onNoteOff 清理，避免音符泄漏
   */
  disable(): void {
    if (this.canvas) {
      this.canvas.removeEventListener("pointerdown", this.onPointerDown);
      this.canvas.removeEventListener("pointermove", this.onPointerMove);
      this.canvas.removeEventListener("pointerup", this.onPointerUp);
      this.canvas.removeEventListener("pointercancel", this.onPointerUp);
      this.canvas.removeEventListener("pointerleave", this.onPointerUp);
      this.canvas = null;
    }
    // 清理已按住的音符，避免泄漏
    if (this.activePointerMidi !== null) {
      this.deps.onNoteOff(this.activePointerMidi);
      this.activePointerMidi = null;
    }
    this.pointerDown = false;
  }

  /** 释放资源（等同 disable，语义化命名） */
  dispose(): void {
    this.disable();
  }

  private onPointerDown = (e: PointerEvent): void => {
    this.pointerDown = true;
    const midi = this.deps.xToMidi(e.offsetX, e.offsetY);
    if (midi !== null) {
      this.activePointerMidi = midi;
      this.deps.onNoteOn(midi, DEFAULT_VELOCITY);
    }
  };

  private onPointerMove = (e: PointerEvent): void => {
    if (!this.pointerDown) return;
    const midi = this.deps.xToMidi(e.offsetX, e.offsetY);
    if (midi !== null && midi !== this.activePointerMidi) {
      if (this.activePointerMidi !== null) {
        this.deps.onNoteOff(this.activePointerMidi);
      }
      this.activePointerMidi = midi;
      this.deps.onNoteOn(midi, DEFAULT_VELOCITY);
    }
  };

  private onPointerUp = (): void => {
    this.pointerDown = false;
    if (this.activePointerMidi !== null) {
      this.deps.onNoteOff(this.activePointerMidi);
      this.activePointerMidi = null;
    }
  };
}
