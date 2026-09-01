import { describe, expect, it } from "vitest";
import { matchNotes } from "../utils/beatMap";
import type { ScoreNoteInfo } from "../types";

function note(beat: number, midi: number): ScoreNoteInfo {
  return {
    beat,
    midi,
    durationBeats: 1,
    measureIndex: 0,
    x: 0,
    y: 0,
    width: 10,
    height: 10,
  };
}

describe("matchNotes", () => {
  const notes = [
    note(0, 60),
    note(0, 64),
    note(0, 67), // C 大三和弦
    note(1, 72),
    note(2.5, 65),
  ];

  it("精确命中单音", () => {
    expect(matchNotes(notes, 1, 72, 0.5)).toHaveLength(1);
    expect(matchNotes(notes, 1, 72, 0.5)[0].midi).toBe(72);
  });

  it("同拍多音符（和弦）全部命中", () => {
    const hits = matchNotes(notes, 0, 64, 0.5);
    expect(hits).toHaveLength(1);
    const chord = [60, 64, 67].flatMap((m) => matchNotes(notes, 0, m, 0.5));
    expect(chord).toHaveLength(3);
  });

  it("容差窗口内的音符命中", () => {
    expect(matchNotes(notes, 1.4, 72, 0.5)).toHaveLength(1);
    expect(matchNotes(notes, 2.2, 65, 0.5)).toHaveLength(1);
  });

  it("容差窗口外不命中", () => {
    expect(matchNotes(notes, 1.6, 72, 0.5)).toHaveLength(0);
    expect(matchNotes(notes, 0, 72, 0.5)).toHaveLength(0);
  });

  it("音高不同不命中", () => {
    expect(matchNotes(notes, 0, 61, 0.5)).toHaveLength(0);
  });

  it("空音符列表返回空", () => {
    expect(matchNotes([], 0, 60, 0.5)).toHaveLength(0);
  });
});
