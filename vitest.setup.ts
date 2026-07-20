import { vi, beforeEach } from "vitest";

// ─────────────────────────────────────────────────────────────────────────
// Tone.js Mock - 重置状态
// ─────────────────────────────────────────────────────────────────────────

// 导入 mock 模块以访问 mockTransport
import { mockTransport } from "./src/__mocks__/tone";

// 每个测试前重置 Transport 状态
beforeEach(() => {
  mockTransport.bpm.value = 120;
  mockTransport.seconds = 0;
  mockTransport.position = "0:0:0";
  mockTransport.state = "stopped";
  mockTransport.loop = false;
  mockTransport.loopStart = 0;
  mockTransport.loopEnd = 0;
  // 清理 rAF Map 避免溢出
  rafCallbacks.clear();
  rafId = 0;
});

// ─────────────────────────────────────────────────────────────────────────
// Canvas Mock - 为 jsdom 环境提供 Canvas 2D Context
// ─────────────────────────────────────────────────────────────────────────

// Mock Canvas 2D Context
const mockCanvasContext = {
  fillStyle: "",
  strokeStyle: "",
  lineWidth: 1,
  font: "10px sans-serif",
  textAlign: "left" as const,
  textBaseline: "top" as const,
  globalAlpha: 1,
  globalCompositeOperation: "source-over" as const,

  clearRect: vi.fn(),
  fillRect: vi.fn(),
  strokeRect: vi.fn(),
  fillText: vi.fn(),
  strokeText: vi.fn(),
  measureText: vi.fn(() => ({ width: 10 })),
  beginPath: vi.fn(),
  closePath: vi.fn(),
  moveTo: vi.fn(),
  lineTo: vi.fn(),
  arc: vi.fn(),
  arcTo: vi.fn(),
  rect: vi.fn(),
  ellipse: vi.fn(),
  fill: vi.fn(),
  stroke: vi.fn(),
  clip: vi.fn(),
  save: vi.fn(),
  restore: vi.fn(),
  translate: vi.fn(),
  rotate: vi.fn(),
  scale: vi.fn(),
  transform: vi.fn(),
  setTransform: vi.fn(),
  resetTransform: vi.fn(),
  createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
  createRadialGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
  createPattern: vi.fn(),
  drawImage: vi.fn(),
  getImageData: vi.fn(() => ({ data: new Uint8ClampedArray(4) })),
  putImageData: vi.fn(),
  createImageData: vi.fn(() => ({ data: new Uint8ClampedArray(4) })),
  setLineDash: vi.fn(),
  getLineDash: vi.fn(() => []),
  lineDashOffset: 0,
};

// Mock HTMLCanvasElement.getContext
HTMLCanvasElement.prototype.getContext = vi.fn(function (
  this: HTMLCanvasElement,
  contextId: string,
  _options?: unknown,
): RenderingContext | null {
  if (contextId === "2d") {
    return mockCanvasContext as unknown as CanvasRenderingContext2D;
  }
  return null;
}) as typeof HTMLCanvasElement.prototype.getContext;

// Mock requestAnimationFrame for animation loop tests
let rafId = 0;
const rafCallbacks = new Map<number, FrameRequestCallback>();
const MAX_RAF_CALLBACKS = 1000; // 防止 Map 溢出

globalThis.requestAnimationFrame = vi.fn((cb: FrameRequestCallback): number => {
  const id = ++rafId;
  // 防止 Map 溢出：超过限制时清理旧的回调
  if (rafCallbacks.size >= MAX_RAF_CALLBACKS) {
    rafCallbacks.clear();
  }
  rafCallbacks.set(id, cb);
  // 不立即调用回调，避免无限微任务循环
  // 测试应使用 vi.advanceTimersByTime() 来推进帧
  return id;
});

globalThis.cancelAnimationFrame = vi.fn((id: number) => {
  rafCallbacks.delete(id);
});

// Mock performance.now()
if (!globalThis.performance) {
  globalThis.performance = {
    now: () => Date.now(),
  } as Performance;
}

// ─────────────────────────────────────────────────────────────────────────
// Helper to advance time in tests
// ─────────────────────────────────────────────────────────────────────────

declare global {
  var advanceTestTime: (ms: number) => void;
}

// 用于测试中手动推进 Transport 时间
globalThis.advanceTestTime = (ms: number) => {
  const secondsAdvance = ms / 1000;
  mockTransport.seconds += secondsAdvance;
};
