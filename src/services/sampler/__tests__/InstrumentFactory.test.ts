import { describe, it, expect, vi, beforeEach } from "vitest";
import type { InstrumentInfo } from "@/stores/sampler";

// 跟踪每个 smplr 构造函数被调用时的 (ctx, options)
type CallRecord = { ctx: unknown; options: Record<string, unknown> };
const calls: Map<string, CallRecord[]> = new Map();

function recordCall(name: string, ctx: unknown, options: unknown): SmplrLike {
  const list = calls.get(name) ?? [];
  list.push({ ctx, options: options as Record<string, unknown> });
  calls.set(name, list);
  return {
    ready: Promise.resolve(),
    start: vi.fn(),
    stop: vi.fn(),
    output: { volume: 100, disconnect: vi.fn() },
    loadProgress: { loaded: 0, total: 0 },
    dispose: vi.fn(),
  };
}

interface SmplrLike {
  ready: Promise<void>;
  start: ReturnType<typeof vi.fn>;
  stop: ReturnType<typeof vi.fn>;
  output: { volume: number; disconnect: ReturnType<typeof vi.fn> };
  loadProgress: { loaded: number; total: number };
  dispose: ReturnType<typeof vi.fn>;
}

vi.mock("smplr", () => ({
  SplendidGrandPiano: (ctx: unknown, options: unknown) =>
    recordCall("SplendidGrandPiano", ctx, options),
  Soundfont: (ctx: unknown, options: unknown) =>
    recordCall("Soundfont", ctx, options),
  ElectricPiano: (ctx: unknown, options: unknown) =>
    recordCall("ElectricPiano", ctx, options),
  Mallet: (ctx: unknown, options: unknown) =>
    recordCall("Mallet", ctx, options),
  Mellotron: (ctx: unknown, options: unknown) =>
    recordCall("Mellotron", ctx, options),
  DrumMachine: (ctx: unknown, options: unknown) =>
    recordCall("DrumMachine", ctx, options),
  Smolken: (ctx: unknown, options: unknown) =>
    recordCall("Smolken", ctx, options),
  Versilian: (ctx: unknown, options: unknown) =>
    recordCall("Versilian", ctx, options),
}));

import { createInstrument } from "../InstrumentFactory";

const fakeCtx = { sampleRate: 44100 } as unknown as BaseAudioContext;
const fakeLoader = { load: vi.fn() };
const fakeScheduler = { schedule: vi.fn() };

function makeInfo(
  factory: InstrumentInfo["factory"],
  overrides: Partial<InstrumentInfo> = {},
): InstrumentInfo {
  return {
    id: "test-id",
    name: "Test",
    category: "Piano",
    factory,
    ...overrides,
  };
}

describe("InstrumentFactory", () => {
  beforeEach(() => {
    calls.clear();
  });

  it("splendid-grand-piano: calls SplendidGrandPiano with decayTime and no instrument", () => {
    const info = makeInfo("splendid-grand-piano", {
      id: "acoustic_grand_piano",
    });
    createInstrument(fakeCtx, fakeLoader, fakeScheduler, info);

    const recorded = calls.get("SplendidGrandPiano");
    expect(recorded).toHaveLength(1);
    expect(recorded![0].ctx).toBe(fakeCtx);
    expect(recorded![0].options).toMatchObject({
      volume: 100,
      loader: fakeLoader,
      scheduler: fakeScheduler,
      decayTime: 0.5,
    });
    expect(recorded![0].options).not.toHaveProperty("instrument");
  });

  it("soundfont: calls Soundfont with instrument = info.id", () => {
    const info = makeInfo("soundfont", { id: "acoustic_grand_piano" });
    createInstrument(fakeCtx, fakeLoader, fakeScheduler, info);

    const recorded = calls.get("Soundfont");
    expect(recorded).toHaveLength(1);
    expect(recorded![0].options).toMatchObject({
      instrument: "acoustic_grand_piano",
      volume: 100,
      loader: fakeLoader,
      scheduler: fakeScheduler,
    });
  });

  it("electric-piano with factoryOptions.instrument: uses the override", () => {
    const info = makeInfo("electric-piano", {
      id: "electric_piano_cp80",
      factoryOptions: { instrument: "CP80" },
    });
    createInstrument(fakeCtx, fakeLoader, fakeScheduler, info);

    const recorded = calls.get("ElectricPiano");
    expect(recorded).toHaveLength(1);
    expect(recorded![0].options.instrument).toBe("CP80");
  });

  it("electric-piano without factoryOptions.instrument: falls back to info.id", () => {
    const info = makeInfo("electric-piano", { id: "electric_piano_default" });
    createInstrument(fakeCtx, fakeLoader, fakeScheduler, info);

    const recorded = calls.get("ElectricPiano");
    expect(recorded).toHaveLength(1);
    expect(recorded![0].options.instrument).toBe("electric_piano_default");
  });

  it("drum-machine: uses TR-808 regardless of info", () => {
    const info = makeInfo("drum-machine", { id: "drum_machine_808" });
    createInstrument(fakeCtx, fakeLoader, fakeScheduler, info);

    const recorded = calls.get("DrumMachine");
    expect(recorded).toHaveLength(1);
    expect(recorded![0].options.instrument).toBe("TR-808");
  });

  it("drum-abuse: falls back to Soundfont (no dedicated factory)", () => {
    const info = makeInfo("drum-abuse", { id: "drum_abuse_kit" });
    createInstrument(fakeCtx, fakeLoader, fakeScheduler, info);

    const recorded = calls.get("Soundfont");
    expect(recorded).toHaveLength(1);
    expect(recorded![0].options.instrument).toBe("drum_abuse_kit");
    // 不应有 drum-abuse 专属构造函数被调用
    expect(calls.has("DrumMachine")).toBe(false);
  });

  it("mallet/mellotron/smolken/versilian: use factoryInstrument resolution", () => {
    const cases: Array<{
      factory: InstrumentInfo["factory"];
      ctor: string;
      override?: string;
      expected: string;
    }> = [
      { factory: "mallet", ctor: "Mallet", expected: "mallet_default" },
      {
        factory: "mellotron",
        ctor: "Mellotron",
        override: "MellotronStrings",
        expected: "MellotronStrings",
      },
      { factory: "smolken", ctor: "Smolken", expected: "smolken_default" },
      {
        factory: "versilian",
        ctor: "Versilian",
        expected: "versilian_default",
      },
    ];

    for (const c of cases) {
      calls.clear();
      const info = makeInfo(c.factory, {
        id: `${c.factory}_default`,
        factoryOptions: c.override ? { instrument: c.override } : undefined,
      });
      createInstrument(fakeCtx, fakeLoader, fakeScheduler, info);

      const recorded = calls.get(c.ctor);
      expect(recorded).toHaveLength(1);
      expect(recorded![0].options.instrument).toBe(c.expected);
    }
  });

  it("all calls include volume=100, loader, scheduler in options", () => {
    const factories: InstrumentInfo["factory"][] = [
      "splendid-grand-piano",
      "soundfont",
      "electric-piano",
      "mallet",
      "mellotron",
      "drum-machine",
      "smolken",
      "versilian",
      "drum-abuse",
    ];

    for (const f of factories) {
      calls.clear();
      const info = makeInfo(f, { id: `${f}_id` });
      createInstrument(fakeCtx, fakeLoader, fakeScheduler, info);

      // 任意构造函数应被调用且共享 options 一致
      const allCalls = Array.from(calls.values()).flat();
      expect(allCalls).toHaveLength(1);
      expect(allCalls[0].options.volume).toBe(100);
      expect(allCalls[0].options.loader).toBe(fakeLoader);
      expect(allCalls[0].options.scheduler).toBe(fakeScheduler);
      expect(allCalls[0].ctx).toBe(fakeCtx);
    }
  });

  it("returns the smplr instance produced by the constructor", () => {
    const info = makeInfo("soundfont", { id: "acoustic_grand_piano" });
    const instance = createInstrument(fakeCtx, fakeLoader, fakeScheduler, info);

    expect(instance).toBeDefined();
    expect(instance.ready).toBeInstanceOf(Promise);
    expect(typeof instance.start).toBe("function");
    expect(typeof instance.stop).toBe("function");
    expect(typeof instance.dispose).toBe("function");
  });
});
