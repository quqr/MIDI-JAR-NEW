import { vi } from "vitest";

// 模拟 Transport 状态
export const mockTransport = {
  bpm: { value: 120 },
  seconds: 0,
  position: "0:0:0",
  state: "stopped" as "stopped" | "started" | "paused",
  loop: false,
  loopStart: 0,
  loopEnd: 0,

  start: vi.fn(function (this: typeof mockTransport, _time?: number) {
    this.state = "started";
    return this;
  }),
  stop: vi.fn(function (this: typeof mockTransport, _time?: number) {
    this.state = "stopped";
    return this;
  }),
  pause: vi.fn(function (this: typeof mockTransport, _time?: number) {
    this.state = "paused";
    return this;
  }),
  cancel: vi.fn(function (this: typeof mockTransport) {
    return this;
  }),
  scheduleRepeat: vi.fn(function (
    this: typeof mockTransport,
    _cb: () => void,
    _interval: number,
    _startTime?: number,
  ) {
    return 0;
  }),
  clear: vi.fn(function (this: typeof mockTransport, _id: number) {
    return this;
  }),
  setLoopPoints: vi.fn(function (
    this: typeof mockTransport,
    start: number,
    end: number,
  ) {
    this.loopStart = start;
    this.loopEnd = end;
    return this;
  }),
};

const Tone = {
  start: vi.fn(async () => {}),
  getContext: vi.fn(() => ({
    state: "running" as const,
    resume: vi.fn(async () => {}),
  })),
  getTransport: vi.fn(() => mockTransport),
  Destination: {
    volume: { value: 0 },
  },
  gainToDb: vi.fn((gain: number) => Math.log10(gain) * 20),
};

export default Tone;
export const start = Tone.start;
export const getContext = Tone.getContext;
export const getTransport = Tone.getTransport;
export const Destination = Tone.Destination;
export const gainToDb = Tone.gainToDb;
