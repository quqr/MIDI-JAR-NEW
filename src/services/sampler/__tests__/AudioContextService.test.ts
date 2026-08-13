import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Tone.js — 仅暴露 AudioContextService 实际使用的 API
const mockRawContext = {
  sampleRate: 44100,
  destination: {},
} as unknown as BaseAudioContext;
const mockToneStart = vi.fn(async (..._args: unknown[]) => {});
const mockToneGetContext = vi.fn((..._args: unknown[]) => ({
  rawContext: mockRawContext,
}));

vi.mock("tone", () => ({
  start: (...args: unknown[]) => mockToneStart(...args),
  getContext: (...args: unknown[]) => mockToneGetContext(...args),
}));

// Mock smplr — 每次构造返回新实例，便于验证 reset 后是否真的重建
type MockLoader = { load: ReturnType<typeof vi.fn> };
type MockScheduler = {
  schedule: ReturnType<typeof vi.fn>;
  stop: ReturnType<typeof vi.fn>;
};
type MockCacheStorage = { fetch: ReturnType<typeof vi.fn> };

const mockSampleLoader = vi.fn((..._args: unknown[]): MockLoader => ({
  load: vi.fn(),
}));
const mockScheduler = vi.fn((..._args: unknown[]): MockScheduler => ({
  schedule: vi.fn(),
  stop: vi.fn(),
}));
const mockCacheStorage = vi.fn((..._args: unknown[]): MockCacheStorage => ({
  fetch: vi.fn(),
}));

vi.mock("smplr", () => ({
  SampleLoader: (...args: unknown[]) => mockSampleLoader(...args),
  Scheduler: (...args: unknown[]) => mockScheduler(...args),
  CacheStorage: (...args: unknown[]) => mockCacheStorage(...args),
}));

// 在 mock 注册后才能 import 被测模块
import {
  initializeAudioContext,
  getAudioContext,
  getLoader,
  getScheduler,
  resetLoader,
  resetScheduler,
  disposeAudioContext,
  audioContextInitialized,
} from "../AudioContextService";

describe("AudioContextService", () => {
  beforeEach(() => {
    // 重置模块级单例状态
    disposeAudioContext();
    // 重置 mock 调用记录（不重置实现）
    mockToneStart.mockClear();
    mockToneGetContext.mockClear();
    mockSampleLoader.mockClear();
    mockScheduler.mockClear();
    mockCacheStorage.mockClear();
  });

  describe("initializeAudioContext", () => {
    it("first call: starts Tone and returns ctx, marks initialized", async () => {
      const ctx = await initializeAudioContext();

      expect(mockToneStart).toHaveBeenCalledTimes(1);
      expect(ctx).toBe(mockRawContext);
      expect(audioContextInitialized.value).toBe(true);
    });

    it("second call: does not call Tone.start again, returns same ctx", async () => {
      const first = await initializeAudioContext();
      const second = await initializeAudioContext();

      expect(mockToneStart).toHaveBeenCalledTimes(1);
      expect(second).toBe(first);
      expect(audioContextInitialized.value).toBe(true);
    });
  });

  describe("getAudioContext", () => {
    it("returns Tone.getContext().rawContext without starting", () => {
      const ctx = getAudioContext();

      expect(mockToneGetContext).toHaveBeenCalledTimes(1);
      expect(ctx).toBe(mockRawContext);
      expect(mockToneStart).not.toHaveBeenCalled();
    });
  });

  describe("getLoader", () => {
    it("creates SampleLoader on first call", () => {
      const loader = getLoader(mockRawContext);

      expect(mockSampleLoader).toHaveBeenCalledTimes(1);
      expect(mockCacheStorage).toHaveBeenCalledWith("midi-jar-sampler");
      expect(loader).toBe(mockSampleLoader.mock.results[0].value);
    });

    it("returns the same instance on subsequent calls", () => {
      const first = getLoader(mockRawContext);
      const second = getLoader(mockRawContext);

      expect(mockSampleLoader).toHaveBeenCalledTimes(1);
      expect(second).toBe(first);
    });
  });

  describe("getScheduler", () => {
    it("creates Scheduler on first call", () => {
      const scheduler = getScheduler(mockRawContext);

      expect(mockScheduler).toHaveBeenCalledTimes(1);
      expect(scheduler).toBe(mockScheduler.mock.results[0].value);
    });

    it("returns the same instance on subsequent calls", () => {
      const first = getScheduler(mockRawContext);
      const second = getScheduler(mockRawContext);

      expect(mockScheduler).toHaveBeenCalledTimes(1);
      expect(second).toBe(first);
    });
  });

  describe("resetLoader", () => {
    it("forces next getLoader to create a new instance", () => {
      const first = getLoader(mockRawContext);
      resetLoader();
      const second = getLoader(mockRawContext);

      expect(mockSampleLoader).toHaveBeenCalledTimes(2);
      expect(second).not.toBe(first);
    });
  });

  describe("resetScheduler", () => {
    it("calls scheduler.stop() and forces next getScheduler to create new", () => {
      const first = getScheduler(mockRawContext);
      const firstStop = first.stop;
      resetScheduler();

      expect(firstStop).toHaveBeenCalledTimes(1);

      const second = getScheduler(mockRawContext);
      expect(mockScheduler).toHaveBeenCalledTimes(2);
      expect(second).not.toBe(first);
    });

    it("does not throw when no scheduler exists", () => {
      expect(() => resetScheduler()).not.toThrow();
    });
  });

  describe("disposeAudioContext", () => {
    it("clears all singletons and resets isInitialized", async () => {
      await initializeAudioContext();
      getLoader(mockRawContext);
      getScheduler(mockRawContext);

      expect(audioContextInitialized.value).toBe(true);

      disposeAudioContext();

      expect(audioContextInitialized.value).toBe(false);

      // 下次 initialize/getLoader/getScheduler 都会重新创建
      await initializeAudioContext();
      expect(mockToneStart).toHaveBeenCalledTimes(2); // 重新启动一次

      getLoader(mockRawContext);
      expect(mockSampleLoader).toHaveBeenCalledTimes(2); // 重新创建

      getScheduler(mockRawContext);
      expect(mockScheduler).toHaveBeenCalledTimes(2); // 重新创建
    });

    it("calls scheduler.stop() during dispose", async () => {
      await initializeAudioContext();
      getScheduler(mockRawContext);
      // 通过 mock.results 取得 Mock 类型的 stop（getScheduler 返回类型是 smplr.Scheduler，丢失 Mock 类型）
      const stopMock = mockScheduler.mock.results[0].value.stop;

      stopMock.mockClear();
      disposeAudioContext();

      expect(stopMock).toHaveBeenCalledTimes(1);
    });
  });
});
