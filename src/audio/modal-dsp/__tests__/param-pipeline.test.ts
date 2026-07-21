/**
 * Regression test for RipplerX parameter pipeline bugs.
 *
 * Bug 1: updateParam() sends {type: "setParam"} (singular) to the worklet,
 *        but the worklet's handleMessage only handles {type: "setParams"}
 *        (plural). Individual param changes are silently ignored.
 *
 * Bug 2: store.loadPreset() only changes the preset name string, doesn't
 *        apply the actual preset parameter data to the store state.
 */
import { describe, it, expect, vi, beforeAll } from "vitest";
import { BUILT_IN_PRESETS } from "@/audio/modal-dsp/presets";

// ── Mock AudioWorklet globals before importing the processor ──

let capturedProcessorCtor: any = null;

class MockAudioWorkletProcessor {
  port = {
    onmessage: null as ((e: MessageEvent) => void) | null,
    postMessage: vi.fn(),
  };
}

beforeAll(() => {
  (globalThis as any).AudioWorkletProcessor = MockAudioWorkletProcessor;
  (globalThis as any).registerProcessor = (_name: string, ctor: any) => {
    capturedProcessorCtor = ctor;
  };
  (globalThis as any).sampleRate = 44100;
});

async function loadProcessor() {
  // Dynamic import after globals are set
  await import("@/audio/modal-dsp/ModalSynthProcessor");
  return capturedProcessorCtor;
}

/** Send a message to the processor's message handler */
function send(proc: any, msg: any): void {
  proc.port.onmessage({ data: msg } as MessageEvent);
}

/** Read a param value from the processor's internal cache */
function getParam(proc: any, id: string): number {
  return proc.params[id];
}

describe("RipplerX AudioWorklet parameter pipeline", () => {
  let Processor: any;

  beforeAll(async () => {
    Processor = await loadProcessor();
  });

  it("processor class is captured via registerProcessor", () => {
    expect(Processor).toBeTruthy();
  });

  it("init message initializes the processor", () => {
    const proc = new Processor();
    send(proc, { type: "init", sampleRate: 44100 });
    expect(proc.initialized).toBe(true);
  });

  // ── Bug 1: setParam (singular) is not handled ──
  it("RED: setParam (singular) message updates the param value", () => {
    const proc = new Processor();
    send(proc, { type: "init", sampleRate: 44100 });

    const beforeDecay = getParam(proc, "a_decay");
    // Send a setParam message (singular) — this is what updateParam() sends
    send(proc, { type: "setParam", id: "a_decay", value: 0.99 });

    const afterDecay = getParam(proc, "a_decay");
    // BUG: This will fail because the worklet has no 'setParam' handler
    expect(afterDecay).toBe(0.99);
    expect(afterDecay).not.toBe(beforeDecay);
  });

  // ── Control: setParams (plural) IS handled ──
  it("GREEN (control): setParams (plural) message updates param values", () => {
    const proc = new Processor();
    send(proc, { type: "init", sampleRate: 44100 });

    send(proc, { type: "setParams", params: { a_decay: 0.77, a_hit: 0.5 } });

    expect(getParam(proc, "a_decay")).toBe(0.77);
    expect(getParam(proc, "a_hit")).toBe(0.5);
  });

  // ── Preset loading via worklet ──
  it("loadPreset message applies preset params to the processor", () => {
    const proc = new Processor();
    send(proc, { type: "init", sampleRate: 44100 });

    const harpsi = BUILT_IN_PRESETS["Harpsi"];
    send(proc, { type: "loadPreset", preset: harpsi });

    // Harpsi has a_decay: 4.92
    expect(getParam(proc, "a_decay")).toBeCloseTo(4.92, 2);
    // Harpsi has mallet_stiff: 2188
    expect(getParam(proc, "mallet_stiff")).toBe(2188);
  });

  // ── Param ID format mismatch (regression documentation) ──
  it("setParam with wrong-format ID stores but does not affect DSP params", () => {
    const proc = new Processor();
    send(proc, { type: "init", sampleRate: 44100 });

    const beforeDecay = getParam(proc, "a_decay");

    // Send a setParam with store-style ID — the worklet will store it
    // under "resonatorA_decay" but the DSP reads "a_decay", so no effect
    send(proc, { type: "setParam", id: "resonatorA_decay", value: 0.5 });

    // The wrong-format key is stored but DSP-correct key is unchanged
    expect(getParam(proc, "a_decay")).toBe(beforeDecay);
    // Callers must use worklet-format IDs (a_decay, not resonatorA_decay)
  });
});
