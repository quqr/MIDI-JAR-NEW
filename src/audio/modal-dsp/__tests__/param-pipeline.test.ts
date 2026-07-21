/**
 * Regression test for RipplerX parameter pipeline bugs.
 *
 * Bug 1: updateParam() sends {type: "setParam"} (singular) to the worklet,
 *        but the worklet's handleMessage only handles {type: "setParams"}
 *        (plural). Individual param changes are silently ignored.
 *
 * Bug 2: store.loadPreset() only changes the preset name string, doesn't
 *        apply the actual preset parameter data to the store state.
 *
 * Bug 3 (this round): status messages used `cpuUsage` field name on the
 *        worklet side, but the main thread read `msg.utilization` — always NaN.
 *
 * Bug 4 (this round): `gain` AudioParam declared 0-1 but consumed as dB in
 *        process(). AudioParam removed; gain now flows via MessagePort as dB.
 *
 * Bug 5 (this round): `process()` called `voices.filter(...)` every 64 frames,
 *        allocating a new array in the audio thread (violates spec 009: 零分配).
 */
import { describe, it, expect, vi, beforeAll } from "vitest";
import { BUILT_IN_PRESETS } from "@/audio/modal-dsp/presets";
import {
  stateToWorkletParams,
  applyWorkletParamsToState,
  workletIdsAffectedBy,
} from "@/audio/modal-dsp/paramMapping";
import { defaultRipplerXState } from "@/views/RipplerX/stores/ripplerx";
import type { RipplerXState } from "@/views/RipplerX/stores/ripplerx";

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

  // ── Bug 1: setParam (singular) was not handled ──
  it("setParam (singular) message updates the param value", () => {
    const proc = new Processor();
    send(proc, { type: "init", sampleRate: 44100 });

    const beforeDecay = getParam(proc, "a_decay");
    send(proc, { type: "setParam", id: "a_decay", value: 0.99 });

    const afterDecay = getParam(proc, "a_decay");
    expect(afterDecay).toBe(0.99);
    expect(afterDecay).not.toBe(beforeDecay);
  });

  // ── Control: setParams (plural) IS handled ──
  it("setParams (plural) message updates param values", () => {
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

    expect(getParam(proc, "a_decay")).toBeCloseTo(4.92, 2);
    expect(getParam(proc, "mallet_stiff")).toBe(2188);
  });

  // ── Param ID format mismatch (regression documentation) ──
  it("setParam with wrong-format ID stores but does not affect DSP params", () => {
    const proc = new Processor();
    send(proc, { type: "init", sampleRate: 44100 });

    const beforeDecay = getParam(proc, "a_decay");
    send(proc, { type: "setParam", id: "resonatorA_decay", value: 0.5 });

    expect(getParam(proc, "a_decay")).toBe(beforeDecay);
  });

  // ── Bug 3: status message field name must be `cpuUsage` (not `utilization`) ──
  it("status message uses `cpuUsage` field (not `utilization`)", () => {
    const proc = new Processor();
    send(proc, { type: "init", sampleRate: 44100 });

    // Force at least STATUS_INTERVAL (64) process() calls so a status message fires
    const outputs = [[[new Float32Array(128)], [new Float32Array(128)]]];
    for (let i = 0; i < 70; i++) {
      proc.process([], outputs, {});
    }

    // `mock.calls` is an array of call-arg arrays: [[arg0, arg1, ...], ...]
    const statusCalls = proc.port.postMessage.mock.calls.filter(
      (call: any[]) => call[0]?.type === "status",
    );
    expect(statusCalls.length).toBeGreaterThan(0);

    const lastStatus = statusCalls[statusCalls.length - 1][0];
    expect(lastStatus).toHaveProperty("cpuUsage");
    expect(lastStatus).not.toHaveProperty("utilization");
    expect(typeof lastStatus.cpuUsage).toBe("number");
    // CPU usage should be a finite, non-negative ratio (perf.now() may be 0 in test env → 0)
    expect(lastStatus.cpuUsage).toBeGreaterThanOrEqual(0);
    expect(Number.isFinite(lastStatus.cpuUsage)).toBe(true);
  });

  // ── Bug 4: gain AudioParam must be removed (only flow via MessagePort) ──
  it("does not declare any AudioParam descriptors (gain flows via MessagePort)", () => {
    // parameterDescriptors static getter was removed; gain is no longer an AudioParam
    expect(Processor.parameterDescriptors).toBeUndefined();
  });

  // ── Bug 5: process() must not allocate via voices.filter ──
  // Smoke test: 100 process() calls should not throw and should keep returning true
  it("process() runs 100 times without allocation errors", () => {
    const proc = new Processor();
    send(proc, { type: "init", sampleRate: 44100 });
    const outputs = [[[new Float32Array(128)], [new Float32Array(128)]]];
    for (let i = 0; i < 100; i++) {
      expect(proc.process([], outputs, {})).toBe(true);
    }
  });
});

describe("paramMapping module (single source of truth)", () => {
  // Round-trip: state → worklet params → state should preserve values for non-combined fields
  it("stateToWorkletParams → applyWorkletParamsToState round-trips non-combined params", () => {
    const state: RipplerXState = JSON.parse(JSON.stringify(defaultRipplerXState));
    // Mutate some fields
    state.resonatorA.decay = 0.42;
    state.resonatorA.on = false;
    state.mallet.stiffness = 1234;
    state.noise.mix = 0.7;
    state.gain.gain = -6;

    const flat = stateToWorkletParams(state);
    expect(flat.a_decay).toBe(0.42);
    expect(flat.a_on).toBe(0);
    expect(flat.mallet_stiff).toBe(1234);
    expect(flat.noise_mix).toBe(0.7);
    expect(flat.gain).toBe(-6);

    // Apply to a fresh default state
    const fresh: RipplerXState = JSON.parse(JSON.stringify(defaultRipplerXState));
    applyWorkletParamsToState(flat, fresh);
    expect(fresh.resonatorA.decay).toBe(0.42);
    expect(fresh.resonatorA.on).toBe(false);
    expect(fresh.mallet.stiffness).toBe(1234);
    expect(fresh.noise.mix).toBe(0.7);
    expect(fresh.gain.gain).toBe(-6);
  });

  // Combined params: a_coarse = resonatorA.coarse + pitch.coarseA
  it("a_coarse forward = resonatorA.coarse + pitch.coarseA; reverse writes to resonatorA.coarse only", () => {
    const state: RipplerXState = JSON.parse(JSON.stringify(defaultRipplerXState));
    state.resonatorA.coarse = 5;
    state.pitch.coarseA = 3;

    const flat = stateToWorkletParams(state);
    expect(flat.a_coarse).toBe(8);

    // Reverse: preset with a_coarse=10 should set resonatorA.coarse=10, pitch.coarseA=0
    const fresh: RipplerXState = JSON.parse(JSON.stringify(defaultRipplerXState));
    applyWorkletParamsToState({ a_coarse: 10 }, fresh);
    expect(fresh.resonatorA.coarse).toBe(10);
    expect(fresh.pitch.coarseA).toBe(0);
  });

  // workletIdsAffectedBy: changing resonatorA.coarse should report a_coarse
  it("workletIdsAffectedBy returns affected worklet IDs for a store path", () => {
    const state: RipplerXState = JSON.parse(JSON.stringify(defaultRipplerXState));
    state.resonatorA.coarse = 7;
    state.pitch.coarseA = 1;

    const affected = workletIdsAffectedBy("resonatorA", "coarse", state);
    expect(affected).toHaveLength(1);
    expect(affected[0].id).toBe("a_coarse");
    expect(affected[0].value).toBe(8);
  });

  it("workletIdsAffectedBy returns empty array for unknown store path", () => {
    const state: RipplerXState = JSON.parse(JSON.stringify(defaultRipplerXState));
    const affected = workletIdsAffectedBy("nonexistent", "x", state);
    expect(affected).toHaveLength(0);
  });

  // Preset round-trip via store.applyWorkletParams (delegates to module)
  it("preset gain in dB is preserved through applyWorkletParamsToState", () => {
    const preset = BUILT_IN_PRESETS["Harpsi"]; // gain: 6.24 dB
    const state: RipplerXState = JSON.parse(JSON.stringify(defaultRipplerXState));
    applyWorkletParamsToState(preset, state);
    expect(state.gain.gain).toBeCloseTo(6.24, 2);
  });
});
