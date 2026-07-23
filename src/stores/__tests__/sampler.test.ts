import { describe, it, expect, vi, beforeEach } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { useSamplerStore } from "../sampler";

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

describe("useSamplerStore", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setActivePinia(createPinia());
  });

  it("should initialize with default state", () => {
    const store = useSamplerStore();
    expect(store.currentInstrumentId).toBeNull();
    expect(store.instruments).toEqual({});
    expect(store.isLoading).toBe(false);
    expect(store.isReady).toBe(false);
  });

  it("should register an instrument", () => {
    const store = useSamplerStore();
    store.registerInstrument({
      id: "test-piano",
      name: "Test Piano",
      category: "Piano",
      factory: "soundfont",
    });
    expect(store.instruments["test-piano"]).toBeDefined();
    expect(store.instruments["test-piano"].name).toBe("Test Piano");
  });

  it("should set current instrument id via ref", () => {
    const store = useSamplerStore();
    store.currentInstrumentId = "test-piano";
    expect(store.currentInstrumentId).toBe("test-piano");
  });

  it("should track loading state via ref", () => {
    const store = useSamplerStore();
    store.isLoading = true;
    expect(store.isLoading).toBe(true);
    store.isLoading = false;
    expect(store.isLoading).toBe(false);
  });

  it("should update load progress via ref", () => {
    const store = useSamplerStore();
    store.loadProgress = { loaded: 5, total: 10 };
    expect(store.loadProgress).toEqual({ loaded: 5, total: 10 });
  });

  it("should set ready state via ref", () => {
    const store = useSamplerStore();
    store.isReady = true;
    expect(store.isReady).toBe(true);
  });

  it("should get current instrument info", () => {
    const store = useSamplerStore();
    store.registerInstrument({
      id: "test-marimba",
      name: "Marimba",
      category: "Percussive",
      factory: "soundfont",
    });
    store.currentInstrumentId = "test-marimba";
    expect(store.currentInstrument?.name).toBe("Marimba");
  });

  it("should return null currentInstrument when nothing is selected", () => {
    const store = useSamplerStore();
    expect(store.currentInstrument).toBeNull();
  });

  it("should build GM instrument catalog", () => {
    const store = useSamplerStore();
    const catalog = store.gmInstrumentCatalog;
    expect(catalog.length).toBeGreaterThan(0);
    expect(catalog.some((i) => i.category === "Piano")).toBe(true);
  });
});
