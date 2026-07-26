import { describe, it, expect, beforeEach } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { useNotes } from "../useNotes";

/**
 * 回归测试：ChordDisplay 钢琴点击行为（toggleNote 持久切换模式）
 *
 * 期望行为：
 *   点击 A → A 亮（toggle on）
 *   再点击 A → A 灭（toggle off）
 *   点击 A → A 亮，点击 B → A 和 B 都亮（持久，互不影响）
 *   再点击 A → A 灭，只剩 B
 */
describe("useNotes — ChordDisplay toggleNote 持久切换", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it("点击同音应切换开关", () => {
    const notes = useNotes({
      namespace: `test-${Math.random().toString(36).slice(2)}`,
    });

    notes.toggleNote(60);
    expect(notes.clickedMidiNotes.value).toEqual([60]);

    notes.toggleNote(60);
    expect(notes.clickedMidiNotes.value).toEqual([]);
  });

  it("点击不同音应持久叠加，互不影响", () => {
    const notes = useNotes({
      namespace: `test-${Math.random().toString(36).slice(2)}`,
    });

    notes.toggleNote(60);
    notes.toggleNote(66);

    // 两个都应保持高亮（持久切换）
    expect(
      [...notes.clickedMidiNotes.value].sort((a, b) => a - b),
    ).toEqual([60, 66]);

    // 关闭 A，B 应仍然保持
    notes.toggleNote(60);
    expect(notes.clickedMidiNotes.value).toEqual([66]);

    // 关闭 B
    notes.toggleNote(66);
    expect(notes.clickedMidiNotes.value).toEqual([]);
  });

  it("toggleNote 应清除 played/sustained 状态，避免残留导致额外高亮", () => {
    const notes = useNotes({
      namespace: `test-${Math.random().toString(36).slice(2)}`,
    });

    // 模拟 playedMidiNotes 有残留（例如来自 MIDI 输入）
    notes.playedMidiNotes.value = [72];
    notes.sustainedMidiNotes.value = [75];

    // toggleNote 应清空 played/sustained，只保留 clicked
    notes.toggleNote(60);

    const allHighlighted = [
      ...notes.playedMidiNotes.value,
      ...notes.sustainedMidiNotes.value,
      ...notes.clickedMidiNotes.value,
    ];
    expect(allHighlighted).toEqual([60]);
  });
});
