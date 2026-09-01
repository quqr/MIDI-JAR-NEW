import { describe, expect, it } from "vitest";
import { evaluateEnvelope, evaluateGlowSine } from "../engine/envelope";
import type { EnvelopeParams } from "../types";

const PARAMS: EnvelopeParams = {
  attack: 0.1,
  decay: 0.2,
  sustain: 0.5,
  release: 0.3,
  velocitySensitivity: 0.5,
};

/** 一个从 1 秒按到 3 秒、力度 0.8 的音符 */
const NOTE = { timeOn: 1, timeOff: 3, velocity: 0.8 };

describe("evaluateGlowSine", () => {
  it("力度 0 → 0；力度 1 → 1", () => {
    expect(evaluateGlowSine(0)).toBe(0);
    expect(evaluateGlowSine(1)).toBeCloseTo(1, 10);
  });

  it("力度 0.5 → sin(π/4)，非线性中段抬升", () => {
    expect(evaluateGlowSine(0.5)).toBeCloseTo(Math.sin(Math.PI / 4), 10);
  });
});

describe("evaluateEnvelope — 时间边界", () => {
  it("音符开始前为 0", () => {
    expect(evaluateEnvelope(0.5, NOTE, PARAMS)).toBe(0);
    expect(evaluateEnvelope(1, NOTE, PARAMS)).toBe(0);
  });

  it("远超释放期后为 0", () => {
    expect(evaluateEnvelope(3.3 + 0.01, NOTE, PARAMS)).toBe(0);
  });

  it("timeOff 恰好等于当前时刻：仍处于持续电平", () => {
    const value = evaluateEnvelope(3, NOTE, PARAMS);
    expect(value).toBeGreaterThan(0);
    expect(value).toBeLessThanOrEqual(1);
  });

  it("t < 0 与 t > 总长：安全返回 0", () => {
    expect(
      evaluateEnvelope(-1, { timeOn: 0, timeOff: 1, velocity: 1 }, PARAMS),
    ).toBe(0);
  });
});

describe("evaluateEnvelope — 包络相位", () => {
  it("起音段：相对电平随时间线性上升", () => {
    const atStart = evaluateEnvelope(1.05, NOTE, PARAMS);
    const atMid = evaluateEnvelope(1.075, NOTE, PARAMS);
    expect(atStart).toBeGreaterThan(0);
    expect(atMid).toBeGreaterThan(atStart);
  });

  it("衰减段回落至持续电平", () => {
    const atAttackEnd = evaluateEnvelope(1.1, NOTE, PARAMS);
    const atSustain = evaluateEnvelope(1.3, NOTE, PARAMS);
    expect(atSustain).toBeLessThan(atAttackEnd);
    expect(atSustain).toBeCloseTo(0.5, 1);
  });

  it("持续段电平稳定", () => {
    const a = evaluateEnvelope(2.0, NOTE, PARAMS);
    const b = evaluateEnvelope(2.5, NOTE, PARAMS);
    expect(a).toBeCloseTo(b, 10);
  });

  it("释放段：电平从持续值衰减到 0", () => {
    const atReleaseStart = evaluateEnvelope(3.0, NOTE, PARAMS);
    const atReleaseMid = evaluateEnvelope(3.15, NOTE, PARAMS);
    expect(atReleaseMid).toBeLessThan(atReleaseStart);
    expect(atReleaseMid).toBeGreaterThan(0);
  });
});

describe("evaluateEnvelope — 力度敏感度", () => {
  it("sensitivity = 0：包络与力度无关", () => {
    const weak = evaluateEnvelope(2, NOTE, {
      ...PARAMS,
      velocitySensitivity: 0,
    });
    const loud = evaluateEnvelope(
      2,
      { ...NOTE, velocity: 1 },
      {
        ...PARAMS,
        velocitySensitivity: 0,
      },
    );
    expect(weak).toBeCloseTo(loud, 10);
  });

  it("sensitivity = 1：输出等于力度 × 包络", () => {
    const value = evaluateEnvelope(2, NOTE, {
      ...PARAMS,
      velocitySensitivity: 1,
    });
    const raw = evaluateEnvelope(
      2,
      { ...NOTE, velocity: 1 },
      {
        ...PARAMS,
        velocitySensitivity: 1,
      },
    );
    expect(value).toBeCloseTo(0.8 * raw, 10);
  });

  it("零力度音符在 sensitivity = 1 时完全静默", () => {
    expect(
      evaluateEnvelope(
        2,
        { ...NOTE, velocity: 0 },
        {
          ...PARAMS,
          velocitySensitivity: 1,
        },
      ),
    ).toBe(0);
  });

  it("输出始终在 [0,1] 区间", () => {
    for (let t = 0.8; t <= 3.4; t += 0.02) {
      const value = evaluateEnvelope(t, NOTE, PARAMS);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(1);
    }
  });
});
