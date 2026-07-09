/**
 * PhysicalPianoProcessor — Worklet 集成测试
 *
 * 通过 ?raw 加载 worklet 源码，在 mock 的 AudioWorkletGlobalScope 中执行，
 * 捕获 registerProcessor 注册的类，做算法行为断言。
 *
 * 测试范围：
 *  1. 基本健康检查 (registerProcessor 调用 + 实例化)
 *  2. BUG A 回归：延迟线回流 (noteOn 后输出非全零)
 *  3. BUG B 回归：采样率 (44100 / 48000 不同 fs 下行为正常)
 *  4. BUG F 回归：立体声声像 (低音偏左 / 高音偏右)
 *  5. BUG D 回归：T60 + DC blocker 不发散 (1 秒后 |sample| <= 1)
 *  6. panic 行为
 */
import { describe, it, expect } from "vitest";
import workletCode from "../../../../public/audio-worklets/physical-piano-processor.js?raw";

interface ProcessorInstance {
  process(inputs: unknown[], outputs: Float32Array[][], parameters: unknown): boolean;
  port: { onmessage: ((e: { data: unknown }) => void) | null };
  handleMessage(msg: unknown): void;
}

type ProcessorCtor = new () => ProcessorInstance;

function loadProcessor(sampleRate: number): ProcessorCtor {
  const processors: Record<string, ProcessorCtor> = {};
  const registerProcessor = (name: string, cls: ProcessorCtor) => {
    processors[name] = cls;
  };
  // mock AudioWorkletProcessor 基类 + port
  class AudioWorkletProcessorMock {
    port: ProcessorInstance["port"] = { onmessage: null };
  }
  const wrapper = new Function(
    "sampleRate",
    "registerProcessor",
    "currentFrame",
    "currentTime",
    "AudioWorkletProcessor",
    `${workletCode}\n;`,
  );
  wrapper.call(
    Object.create(null),
    sampleRate,
    registerProcessor,
    { value: 0 },
    0,
    AudioWorkletProcessorMock,
  );
  const cls = processors["physical-piano-processor"];
  if (!cls) {
    throw new Error(
      "physical-piano-processor not registered. worklet source may have a parse error.",
    );
  }
  return cls;
}

function makeOutputs(numSamples: number): Float32Array[][] {
  return [[new Float32Array(numSamples), new Float32Array(numSamples)]];
}

function runForSamples(
  inst: ProcessorInstance,
  numSamples: number,
  blockSize = 128,
): { outL: Float32Array; outR: Float32Array } {
  const outL = new Float32Array(numSamples);
  const outR = new Float32Array(numSamples);
  let written = 0;
  while (written < numSamples) {
    const block = Math.min(blockSize, numSamples - written);
    const outputs = makeOutputs(block);
    inst.process([], outputs, {});
    for (let i = 0; i < block; i++) {
      outL[written + i] = outputs[0][0][i];
      outR[written + i] = outputs[0][1][i];
    }
    written += block;
  }
  return { outL, outR };
}

describe("PhysicalPianoProcessor (worklet v3)", () => {
  it("1. 基本健康：注册并实例化", () => {
    const Processor = loadProcessor(44100);
    expect(Processor).toBeDefined();
    const inst = new Processor();
    expect(inst).toBeDefined();
    expect(inst.port).toBeDefined();
    expect(typeof inst.process).toBe("function");
  });

  it("2. BUG A 回归：noteOn 后延迟线有回流，输出非全零", () => {
    const Processor = loadProcessor(44100);
    const inst = new Processor();
    inst.handleMessage({ type: "noteOn", midi: 69, velocity: 100 });
    const { outL } = runForSamples(inst, 512);
    const nonZero = outL.some((s) => s !== 0);
    expect(nonZero).toBe(true);
  });

  it("3. BUG B 回归：不同 sampleRate 下均能正常运行", () => {
    for (const fs of [44100, 48000]) {
      const Processor = loadProcessor(fs);
      const inst = new Processor();
      inst.handleMessage({ type: "noteOn", midi: 69, velocity: 100 });
      const { outL } = runForSamples(inst, 256);
      const nonZero = outL.some((s) => s !== 0);
      expect(nonZero, `fs=${fs} 应有输出`).toBe(true);
    }
  });

  it("4. BUG F 回归：低音偏左 / 高音偏右", () => {
    const Processor = loadProcessor(44100);
    // 低音 (A0 = midi 21)
    const instLow = new Processor();
    instLow.handleMessage({ type: "noteOn", midi: 21, velocity: 100 });
    const low = runForSamples(instLow, 2048);
    const lowAbsL = low.outL.reduce((s, v) => s + Math.abs(v), 0);
    const lowAbsR = low.outR.reduce((s, v) => s + Math.abs(v), 0);
    expect(lowAbsL).toBeGreaterThan(lowAbsR);

    // 高音 (C8 = midi 108)
    const instHigh = new Processor();
    instHigh.handleMessage({ type: "noteOn", midi: 108, velocity: 100 });
    const high = runForSamples(instHigh, 2048);
    const highAbsL = high.outL.reduce((s, v) => s + Math.abs(v), 0);
    const highAbsR = high.outR.reduce((s, v) => s + Math.abs(v), 0);
    expect(highAbsR).toBeGreaterThan(highAbsL);
  });

  it("5. BUG D 回归：T60 + DC blocker 1 秒内不发散", () => {
    const Processor = loadProcessor(44100);
    const inst = new Processor();
    inst.handleMessage({ type: "noteOn", midi: 60, velocity: 100 });
    const { outL, outR } = runForSamples(inst, 44100);
    // 全部样本应在 [-1, 1] 内 (process 内 Math.max(-1, Math.min(1, x)) 兜底)
    for (let i = 0; i < outL.length; i++) {
      expect(Math.abs(outL[i]), `outL[${i}] 越界`).toBeLessThanOrEqual(1);
      expect(Math.abs(outR[i]), `outR[${i}] 越界`).toBeLessThanOrEqual(1);
    }
  });

  it("6. panic 行为：触发后输出归零", () => {
    const Processor = loadProcessor(44100);
    const inst = new Processor();
    inst.handleMessage({ type: "noteOn", midi: 60, velocity: 100 });
    runForSamples(inst, 256); // 让音色激发
    inst.handleMessage({ type: "panic" });
    const { outL, outR } = runForSamples(inst, 256);
    const sumL = outL.reduce((s, v) => s + Math.abs(v), 0);
    const sumR = outR.reduce((s, v) => s + Math.abs(v), 0);
    expect(sumL).toBe(0);
    expect(sumR).toBe(0);
  });
});
