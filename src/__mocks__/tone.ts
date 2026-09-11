/**
 * Tone.js 全局 Mock（vitest.setup.ts 使用，ADR 0024 测试基建补全）
 *
 * jsdom 测试环境不加载真实音频引擎；需要 Transport 状态推进的测试
 * 直接操作 mockTransport 的字段，或经 vitest.setup.ts 的
 * advanceTestTime() 推进 seconds。
 */
import { vi } from "vitest";

/** 可编程的 Transport 替身：状态字段由 setup 每个用例前重置 */
export const mockTransport = {
  bpm: { value: 120 },
  seconds: 0,
  position: "0:0:0",
  state: "stopped" as "started" | "stopped" | "paused",
  loop: false,
  loopStart: 0,
  loopEnd: 0,
  start: vi.fn(),
  stop: vi.fn(),
  pause: vi.fn(),
  cancel: vi.fn(),
  scheduleRepeat: vi.fn(() => 0),
  scheduleOnce: vi.fn(() => 0),
  schedule: vi.fn(() => 0),
  clear: vi.fn(),
  unsync: vi.fn(),
};

export const mockContext = {
  state: "running",
  resume: vi.fn(),
  rawContext: { resume: vi.fn() },
};

export const mockDestination = {
  volume: { value: 0 },
  connect: vi.fn(),
  disconnect: vi.fn(),
};

/** 默认导出：整体替换 "tone" 模块时使用（vi.mock("tone", ...)） */
const Tone = {
  Transport: mockTransport,
  Context: vi.fn(() => mockContext),
  Destination: mockDestination,
  getTransport: () => mockTransport,
  start: vi.fn(),
  setContext: vi.fn(),
};

export default Tone;
