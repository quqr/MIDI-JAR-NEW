import { describe, it, expect } from "vitest";
import {
  frequencyToMidi,
  midiToNoteName,
  centsOff,
  nearestNote,
  isInTune,
  clampA4,
} from "../utils/pitchMath";

describe("frequencyToMidi", () => {
  it("A4=440Hz 时 440Hz 对应 MIDI 69", () => {
    expect(frequencyToMidi(440, 440)).toBeCloseTo(69, 6);
  });

  it("A4=442Hz 时 442Hz 对应 MIDI 69", () => {
    expect(frequencyToMidi(442, 442)).toBeCloseTo(69, 6);
  });

  it("A0=27.5Hz 对应 MIDI 21（a4=440）", () => {
    expect(frequencyToMidi(27.5, 440)).toBeCloseTo(21, 3);
  });

  it("C8=4186.01Hz 约对应 MIDI 108（a4=440）", () => {
    expect(frequencyToMidi(4186.009, 440)).toBeCloseTo(108, 2);
  });
});

describe("midiToNoteName", () => {
  it("MIDI 69 → A4，MIDI 60 → C4，MIDI 21 → A0", () => {
    expect(midiToNoteName(69)).toBe("A4");
    expect(midiToNoteName(60)).toBe("C4");
    expect(midiToNoteName(21)).toBe("A0");
  });

  it("MIDI 61 → C#4（升号记法）", () => {
    expect(midiToNoteName(61)).toBe("C#4");
  });

  it("MIDI 108 → C8", () => {
    expect(midiToNoteName(108)).toBe("C8");
  });

  it("MIDI < 0 返回 null（超出音名范围）", () => {
    expect(midiToNoteName(-1)).toBeNull();
  });
});

describe("centsOff", () => {
  it("基准频率处偏差为 0", () => {
    expect(centsOff(440, 69, 440)).toBeCloseTo(0, 6);
    expect(centsOff(442, 69, 442)).toBeCloseTo(0, 6);
  });

  it("偏高 100 cents 对应高半音频率", () => {
    // A4 → A#4/Bb4: 440 * 2^(1/12)
    expect(centsOff(440 * Math.pow(2, 1 / 12), 70, 440)).toBeCloseTo(0, 3);
    expect(centsOff(440 * Math.pow(2, 50 / 1200), 69, 440)).toBeCloseTo(50, 3);
    expect(centsOff(440 * Math.pow(2, -30 / 1200), 69, 440)).toBeCloseTo(
      -30,
      3,
    );
  });

  it("基准音变化影响音分计算", () => {
    // 以 440Hz 发声、基准改为 442Hz：偏低
    const cents = centsOff(440, 69, 442);
    expect(cents).toBeLessThan(0);
    expect(cents).toBeCloseTo(1200 * Math.log2(440 / 442), 3);
  });
});

describe("nearestNote", () => {
  it("返回最近的音级与音分偏差", () => {
    const r = nearestNote(440, 440);
    expect(r.midi).toBe(69);
    expect(r.name).toBe("A4");
    expect(r.cents).toBeCloseTo(0, 6);
  });

  it("低于半音中点归属低音级并给出正偏差", () => {
    // 比 A4 高 40 cents
    const r = nearestNote(440 * Math.pow(2, 40 / 1200), 440);
    expect(r.midi).toBe(69);
    expect(r.cents).toBeCloseTo(40, 1);
  });

  it("超过半音中点归属高音级并给出负偏差", () => {
    const r = nearestNote(440 * Math.pow(2, 60 / 1200), 440);
    expect(r.midi).toBe(70);
    expect(r.cents).toBeCloseTo(-40, 1);
  });

  it("a4=432 时 432Hz 判定为 A4 且偏差为 0", () => {
    const r = nearestNote(432, 432);
    expect(r.midi).toBe(69);
    expect(r.cents).toBeCloseTo(0, 6);
  });

  it("极低频（A0）正常判定", () => {
    const r = nearestNote(27.5, 440);
    expect(r.midi).toBe(21);
    expect(r.name).toBe("A0");
  });
});

describe("isInTune", () => {
  it("|cents| ≤ 5 完全准，≤ 10 接近", () => {
    expect(isInTune(0).exact).toBe(true);
    expect(isInTune(5).exact).toBe(true);
    expect(isInTune(5.1).exact).toBe(false);
    expect(isInTune(-5).exact).toBe(true);
    expect(isInTune(9).near).toBe(true);
    expect(isInTune(-9.9).near).toBe(true);
    expect(isInTune(10.1).near).toBe(false);
  });
});

describe("clampA4", () => {
  it("钳制到 430–450 并取整", () => {
    expect(clampA4(425)).toBe(430);
    expect(clampA4(460)).toBe(450);
    expect(clampA4(440.4)).toBe(440);
  });
});
