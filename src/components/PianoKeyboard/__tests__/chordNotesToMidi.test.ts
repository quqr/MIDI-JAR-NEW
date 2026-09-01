import { describe, it, expect } from "vitest";
import { chordNotesToMidi } from "../utils";

/**
 * 回归测试：ChordDisplay 点击 A3 + E4 后 E3 自动亮起的 bug
 *
 * Bug 描述：用户点击 A3 (midi=57) 和 E4 (midi=64)，
 * Chord.detect 识别为 A5 和弦（notes=["A","E"]）。
 * 旧版 chordNotesToMidi 总是选范围内第一个匹配，
 * 把 "E" 映射到 E3 (midi=52) 而非用户点击的 E4 (midi=64)，
 * 导致 E3 被自动高亮（"幽灵键"）。
 *
 * 修复：chordNotesToMidi 接收 hintMidi 参数，
 * 优先匹配 hint 中相同音级的 MIDI，回退才用范围内第一个。
 */
describe("chordNotesToMidi — hint 优先匹配", () => {
  const FROM = 48; // C3
  const TO = 83; // B5

  it("无 hint 时回退到范围内第一个匹配（保持兼容）", () => {
    expect(chordNotesToMidi(["A", "E"], FROM, TO)).toEqual([57, 52]);
    // A3=57, E3=52
  });

  it("点击 A3 + E4 后，chord 高亮应匹配用户点击的位置，而非 E3", () => {
    // 用户点击 A3 (57) 和 E4 (64)
    const hint = [57, 64];
    // chord = A5, notes = ["A", "E"]
    const result = chordNotesToMidi(["A", "E"], FROM, TO, hint);
    expect(result).toEqual([57, 64]);
    // 关键：不应包含 52 (E3)
    expect(result).not.toContain(52);
  });

  it("hint 中有匹配音级时优先用 hint 的 MIDI", () => {
    // 用户点击 A3 (57) 和 E4 (64) 和 C5 (72)
    const hint = [57, 64, 72];
    // chord = Am, notes = ["A", "C", "E"]
    const result = chordNotesToMidi(["A", "C", "E"], FROM, TO, hint);
    expect(result).toEqual([57, 72, 64]);
  });

  it("hint 中无匹配音级时回退到范围内第一个", () => {
    // 用户只点了 A3, E4，但 chord 是 Cmaj (notes=["C","E","G"])
    const hint = [57, 64];
    const result = chordNotesToMidi(["C", "E", "G"], FROM, TO, hint);
    // C → hint 无 C → 回退 C3=48
    // E → hint 有 E4=64 → 64
    // G → hint 无 G → 回退 G3=55
    expect(result).toEqual([48, 64, 55]);
  });

  it("空 notes 返回空数组", () => {
    expect(chordNotesToMidi([], FROM, TO, [57])).toEqual([]);
  });

  it("空 hint 等价于不传 hint", () => {
    expect(chordNotesToMidi(["A", "E"], FROM, TO, [])).toEqual([57, 52]);
  });

  it("hint 音级在可见范围外时回退到范围内第一个匹配（窄音域下和弦音仍可见）", () => {
    // 和弦测验窄音域：C4–C5（60–72），题目音符 E3=52 越界
    const NARROW_FROM = 60; // C4
    const NARROW_TO = 72; // C5
    // "E" 应回退到范围内第一个 E（E4=64），而非越界的 52
    expect(chordNotesToMidi(["E"], NARROW_FROM, NARROW_TO, [52])).toEqual([
      64,
    ]);
    // "A" 应回退到 A4=69
    expect(chordNotesToMidi(["A"], NARROW_FROM, NARROW_TO, [57])).toEqual([
      69,
    ]);
  });

  it("双升/双降记法的音名按音级数字匹配，不再被静默丢弃", () => {
    // A#aug 的 chordNotes = ["A#", "C##", "E##"]（tonal 双升记法）
    // 旧实现用字符串字面量比较，"C##"/"E##" 永远匹配不上 → 只高亮 A# 一个键
    const result = chordNotesToMidi(["A#", "C##", "E##"], 48, 83);
    // A# → A#3=58；C## → 音级 2（D）→ D3=50；E## → 音级 6（F#）→ F#3=54
    expect(result).toEqual([58, 50, 54]);
    // 双降："Fb" → 音级 4（E）→ E3=52
    expect(chordNotesToMidi(["Fb"], 48, 83)).toEqual([52]);
  });

  it("无法解析的音名（如空串或非法字符）被跳过", () => {
    expect(chordNotesToMidi(["", "X", "A"], 48, 83)).toEqual([57]);
  });
});

