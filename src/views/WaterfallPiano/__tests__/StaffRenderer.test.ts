import { describe, it, expect } from "vitest";
import {
  midiToStaffPosition,
  midiToAccidental,
  midiToNoteName,
} from "../engine/StaffRenderer";

describe("StaffRenderer 纯函数", () => {
  describe("midiToStaffPosition", () => {
    it("E4 (MIDI 64) 在位置 0", () => {
      expect(midiToStaffPosition(64)).toBe(0);
    });

    it("F4 (MIDI 65) 在位置 1", () => {
      expect(midiToStaffPosition(65)).toBe(1);
    });

    it("G4 (MIDI 67) 在位置 2", () => {
      expect(midiToStaffPosition(67)).toBe(2);
    });

    it("A4 (MIDI 69) 在位置 3", () => {
      expect(midiToStaffPosition(69)).toBe(3);
    });

    it("B4 (MIDI 71) 在位置 4", () => {
      expect(midiToStaffPosition(71)).toBe(4);
    });

    it("C5 (MIDI 72) 在位置 5", () => {
      expect(midiToStaffPosition(72)).toBe(5);
    });

    it("D5 (MIDI 74) 在位置 6", () => {
      expect(midiToStaffPosition(74)).toBe(6);
    });

    it("E5 (MIDI 76) 在位置 7", () => {
      expect(midiToStaffPosition(76)).toBe(7);
    });

    it("F5 (MIDI 77) 在位置 8（五线谱顶部）", () => {
      expect(midiToStaffPosition(77)).toBe(8);
    });

    it("C4 (MIDI 60) 在位置 -2（五线谱下方加线）", () => {
      expect(midiToStaffPosition(60)).toBe(-2);
    });

    it("升号音符与对应自然音位置相同", () => {
      // C#4 (61) 与 C4 (60) 在五线谱同一位置
      expect(midiToStaffPosition(61)).toBe(midiToStaffPosition(60));
      // F#4 (66) 与 F4 (65) 同位置
      expect(midiToStaffPosition(66)).toBe(midiToStaffPosition(65));
    });

    it("位置随八度递增 7", () => {
      const c4 = midiToStaffPosition(60);
      const c5 = midiToStaffPosition(72);
      expect(c5 - c4).toBe(7);
    });

    it("高音位置大于低音位置", () => {
      const low = midiToStaffPosition(21);
      const high = midiToStaffPosition(108);
      expect(high).toBeGreaterThan(low);
    });
  });

  describe("midiToAccidental", () => {
    it("C4 (60) 无升降号", () => {
      expect(midiToAccidental(60)).toBe("none");
    });

    it("D4 (62) 无升降号", () => {
      expect(midiToAccidental(62)).toBe("none");
    });

    it("E4 (64) 无升降号", () => {
      expect(midiToAccidental(64)).toBe("none");
    });

    it("F4 (65) 无升降号", () => {
      expect(midiToAccidental(65)).toBe("none");
    });

    it("C#4 (61) 有升号", () => {
      expect(midiToAccidental(61)).toBe("sharp");
    });

    it("D#4 (63) 有升号", () => {
      expect(midiToAccidental(63)).toBe("sharp");
    });

    it("F#4 (66) 有升号", () => {
      expect(midiToAccidental(66)).toBe("sharp");
    });

    it("G#4 (68) 有升号", () => {
      expect(midiToAccidental(68)).toBe("sharp");
    });

    it("A#4 (70) 有升号", () => {
      expect(midiToAccidental(70)).toBe("sharp");
    });

    it("所有升号音在不同八度一致", () => {
      // C# 在任何八度都应该是 sharp
      for (let octave = 0; octave <= 8; octave++) {
        const midi = 12 * (octave + 1) + 1; // C# in octave
        if (midi >= 0 && midi <= 127) {
          expect(midiToAccidental(midi)).toBe("sharp");
        }
      }
    });

    it("所有自然音在不同八度一致", () => {
      // C 在任何八度都应该是 none
      for (let octave = 0; octave <= 8; octave++) {
        const midi = 12 * (octave + 1); // C in octave
        if (midi >= 0 && midi <= 127) {
          expect(midiToAccidental(midi)).toBe("none");
        }
      }
    });
  });

  describe("midiToNoteName", () => {
    it("C4 (MIDI 60) → C4", () => {
      expect(midiToNoteName(60)).toBe("C4");
    });

    it("A4 (MIDI 69) → A4", () => {
      expect(midiToNoteName(69)).toBe("A4");
    });

    it("C#4 (MIDI 61) → C#4", () => {
      expect(midiToNoteName(61)).toBe("C#4");
    });

    it("A0 (MIDI 21) → A0", () => {
      expect(midiToNoteName(21)).toBe("A0");
    });

    it("C8 (MIDI 108) → C8", () => {
      expect(midiToNoteName(108)).toBe("C8");
    });

    it("MIDI 0 → C-1", () => {
      expect(midiToNoteName(0)).toBe("C-1");
    });

    it("所有 12 个音名在八度内循环", () => {
      const expected = [
        "C",
        "C#",
        "D",
        "D#",
        "E",
        "F",
        "F#",
        "G",
        "G#",
        "A",
        "A#",
        "B",
      ];
      for (let i = 0; i < 12; i++) {
        const midi = 60 + i; // C4 到 B4
        const name = midiToNoteName(midi);
        expect(name.startsWith(expected[i])).toBe(true);
      }
    });
  });
});
