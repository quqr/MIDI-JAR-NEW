import { describe, it, expect, vi, beforeEach } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { useSamplerService } from "../useSamplerService";
import { useSamplerStore } from "@/stores/sampler";

// Mock smplr module
vi.mock("smplr", () => ({
  SplendidGrandPiano: vi.fn(() => ({
    ready: Promise.resolve(),
    start: vi.fn(),
    stop: vi.fn(),
    output: { volume: 100, disconnect: vi.fn() },
    loadProgress: { loaded: 0, total: 0 },
    dispose: vi.fn(),
  })),
  Soundfont: vi.fn(() => ({
    ready: Promise.resolve(),
    start: vi.fn(),
    stop: vi.fn(),
    output: { volume: 100, disconnect: vi.fn() },
    loadProgress: { loaded: 0, total: 0 },
    dispose: vi.fn(),
  })),
  ElectricPiano: vi.fn(() => ({
    ready: Promise.resolve(),
    start: vi.fn(),
    stop: vi.fn(),
    output: { volume: 100, disconnect: vi.fn() },
    loadProgress: { loaded: 0, total: 0 },
    dispose: vi.fn(),
  })),
  Mallet: vi.fn(() => ({
    ready: Promise.resolve(),
    start: vi.fn(),
    stop: vi.fn(),
    output: { volume: 100, disconnect: vi.fn() },
    loadProgress: { loaded: 0, total: 0 },
    dispose: vi.fn(),
  })),
  Mellotron: vi.fn(() => ({
    ready: Promise.resolve(),
    start: vi.fn(),
    stop: vi.fn(),
    output: { volume: 100, disconnect: vi.fn() },
    loadProgress: { loaded: 0, total: 0 },
    dispose: vi.fn(),
  })),
  DrumMachine: vi.fn(() => ({
    ready: Promise.resolve(),
    start: vi.fn(),
    stop: vi.fn(),
    output: { volume: 100, disconnect: vi.fn() },
    loadProgress: { loaded: 0, total: 0 },
    dispose: vi.fn(),
  })),
  Smolken: vi.fn(() => ({
    ready: Promise.resolve(),
    start: vi.fn(),
    stop: vi.fn(),
    output: { volume: 100, disconnect: vi.fn() },
    loadProgress: { loaded: 0, total: 0 },
    dispose: vi.fn(),
  })),
  Versilian: vi.fn(() => ({
    ready: Promise.resolve(),
    start: vi.fn(),
    stop: vi.fn(),
    output: { volume: 100, disconnect: vi.fn() },
    loadProgress: { loaded: 0, total: 0 },
    dispose: vi.fn(),
  })),
  getSoundfontNames: vi.fn(() => [
    "acoustic_grand_piano",
    "marimba",
    "violin",
    "trumpet",
    "flute",
  ]),
  CacheStorage: vi.fn(() => ({
    fetch: vi.fn(),
  })),
  SampleLoader: vi.fn(() => ({
    load: vi.fn(),
  })),
  Scheduler: vi.fn(() => ({
    schedule: vi.fn(),
    stop: vi.fn(),
  })),
}));

// Mock Tone.js
vi.mock("tone", () => ({
  start: vi.fn(() => Promise.resolve()),
  context: {
    rawContext: {
      createOscillator: vi.fn(),
      createGain: vi.fn(),
      destination: {},
    },
  },
}));

describe("useSamplerService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setActivePinia(createPinia());
  });

  describe("batchDownloadInstruments", () => {
    it("should handle empty list", async () => {
      const service = useSamplerService();
      const result = await service.batchDownloadInstruments([]);

      expect(result.succeeded).toEqual([]);
      expect(result.failed).toEqual([]);
    });

    it("should download multiple instruments successfully", async () => {
      const service = useSamplerService();

      // 使用 catalog 中已有的音源 ID
      const result = await service.batchDownloadInstruments([
        "acoustic_grand_piano",
        "marimba",
      ]);

      expect(result.succeeded).toHaveLength(2);
      expect(result.succeeded).toContain("acoustic_grand_piano");
      expect(result.succeeded).toContain("marimba");
      expect(result.failed).toHaveLength(0);
    });

    it("should continue downloading when one instrument fails", async () => {
      const service = useSamplerService();

      // 批量下载：一个有效，一个不存在
      const result = await service.batchDownloadInstruments([
        "acoustic_grand_piano",
        "nonexistent-instrument",
      ]);

      expect(result.succeeded).toHaveLength(1);
      expect(result.succeeded).toContain("acoustic_grand_piano");
      expect(result.failed).toHaveLength(1);
      expect(result.failed[0].id).toBe("nonexistent-instrument");
      expect(result.failed[0].error).toContain("Unknown instrument");
    });

    it("should handle all instruments failing", async () => {
      const service = useSamplerService();

      const result = await service.batchDownloadInstruments([
        "nonexistent-1",
        "nonexistent-2",
        "nonexistent-3",
      ]);

      expect(result.succeeded).toHaveLength(0);
      expect(result.failed).toHaveLength(3);
      expect(
        result.failed.every((f) => f.error.includes("Unknown instrument")),
      ).toBe(true);
    });

    it("should record error messages for failed instruments", async () => {
      const store = useSamplerStore();
      const service = useSamplerService();

      store.registerInstrument({
        id: "test-piano",
        name: "Test Piano",
        category: "Piano",
        factory: "soundfont",
      });

      const result = await service.batchDownloadInstruments([
        "test-piano",
        "invalid-instrument",
      ]);

      // 验证错误信息被记录
      expect(result.failed[0].error).toBeTruthy();
      expect(typeof result.failed[0].error).toBe("string");
    });
  });

  describe("single instrument cache operations", () => {
    it("should handle cache size for multiple instruments", async () => {
      const service = useSamplerService();

      // 使用 catalog 中已有的音源 ID
      const instrumentIds = ["acoustic_grand_piano", "marimba", "violin"];

      // 批量下载
      const downloadResult =
        await service.batchDownloadInstruments(instrumentIds);
      expect(downloadResult.succeeded).toHaveLength(3);

      // 验证每个音源的缓存大小可以独立查询
      const cacheSize = await service.getCacheSize();
      expect(typeof cacheSize).toBe("number");
      expect(cacheSize).toBeGreaterThanOrEqual(0);
    });
  });
});
