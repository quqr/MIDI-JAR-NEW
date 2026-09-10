/**
 * 编辑器交互 composable：把 store 的光标/选区与渲染层连接起来。
 *
 * 职责边界：
 * - **本文件**：光标移动、选区扩展、和弦输入/删除的**语义动作**。
 * - `useChartKeyboard`：把键盘事件翻译成这里的动作（只做映射，不含业务）。
 * - `stores/ChordChart`：持有状态与历史。
 *
 * 所有移动都基于 `domain/editing` 的纯函数，保证行为可被单独冒烟验证。
 */

import { computed } from "vue";

import { useChordChartStore } from "../stores/ChordChart";
import {
  cursorDown,
  cursorLeft,
  cursorRight,
  cursorUp,
  cursorToAdjacentSystem,
  normalizeSelection,
} from "../domain/editing";

import type { CursorPos } from "../domain/types";

export function useChartEditor() {
  const store = useChordChartStore();

  const cursor = computed(() => store.cursor);
  const chart = computed(() => store.chart);

  /** 当前光标所在小节的和弦数（0 = 空小节） */
  const currentChordCount = computed(() => {
    const m = chart.value.measures[cursor.value.measureIndex];
    return m?.chords.length ?? 0;
  });

  /**
   * 光标是否落在某个具体和弦上。
   * 小节级光标（chordIndex === null）返回 false。
   */
  const hasChordFocus = computed(
    () => cursor.value.chordIndex !== null && currentChordCount.value > 0,
  );

  /* ── 移动 ─────────────────────────────────────────── */

  function moveLeft(): void {
    store.setCursor(cursorLeft(chart.value, cursor.value));
  }

  function moveRight(): void {
    store.setCursor(cursorRight(chart.value, cursor.value));
  }

  function moveUp(): void {
    store.setCursor(cursorUp(chart.value, cursor.value));
  }

  function moveDown(): void {
    store.setCursor(cursorDown(chart.value, cursor.value));
  }

  /** 上下移到相邻 system 的同一槽位（跨谱行跳转） */
  function moveToAdjacentSystem(dir: 1 | -1): void {
    store.setCursor(cursorToAdjacentSystem(store.systems, cursor.value, dir));
  }

  /** 跳到最后一个小节的最后一个和弦 */
  function moveToEnd(): void {
    const lastMeasure = chart.value.measures.length - 1;
    const count = chart.value.measures[lastMeasure]?.chords.length ?? 0;
    store.setCursor({
      measureIndex: lastMeasure,
      chordIndex: count > 0 ? count - 1 : null,
    });
  }

  /** 跳到开头 */
  function moveToStart(): void {
    const count = chart.value.measures[0]?.chords.length ?? 0;
    store.setCursor({ measureIndex: 0, chordIndex: count > 0 ? 0 : null });
  }

  /* ── 选区 ─────────────────────────────────────────── */

  /** 从当前光标扩展到目标位置（Shift+方向键） */
  function extendTo(target: CursorPos): void {
    const anchor = store.selection?.anchor ?? cursor.value;
    store.setSelection({ anchor, focus: target });
    store.setCursor(target);
  }

  function extendLeft(): void {
    extendTo(cursorLeft(chart.value, cursor.value));
  }

  function extendRight(): void {
    extendTo(cursorRight(chart.value, cursor.value));
  }

  function extendUp(): void {
    extendTo(cursorUp(chart.value, cursor.value));
  }

  function extendDown(): void {
    extendTo(cursorDown(chart.value, cursor.value));
  }

  function clearSelection(): void {
    store.setSelection(null);
  }

  /** 选区内涉及的小节索引范围（含端点，升序） */
  const selectedMeasureRange = computed<[number, number] | null>(() => {
    const sel = store.selection;
    if (!sel) return null;
    const [start, end] = normalizeSelection(sel);
    return [start.measureIndex, end.measureIndex];
  });

  /* ── 和弦动作 ─────────────────────────────────────── */

  /** 删除当前和弦（有选区则删除选区涉及的整个小节内容由调用方决定） */
  function deleteAtCursor(): boolean {
    const { measureIndex, chordIndex } = cursor.value;
    if (chordIndex === null) return false;
    const measure = chart.value.measures[measureIndex];
    if (!measure || chordIndex >= measure.chords.length) return false;
    store.deleteChord(measureIndex, chordIndex);
    return true;
  }

  /** 清空当前小节的全部和弦 */
  function clearMeasure(): boolean {
    const { measureIndex } = cursor.value;
    const measure = chart.value.measures[measureIndex];
    if (!measure || measure.chords.length === 0) return false;
    store.clearMeasure(measureIndex);
    store.setCursor({ measureIndex, chordIndex: null });
    return true;
  }

  /* ── 历史 ─────────────────────────────────────────── */

  function undo(): void {
    store.undo();
  }

  function redo(): void {
    store.redo();
  }

  return {
    // store（供键盘层调历史）
    store,
    // 状态
    cursor,
    chart,
    currentChordCount,
    hasChordFocus,
    selectedMeasureRange,
    // 移动
    moveLeft,
    moveRight,
    moveUp,
    moveDown,
    moveToAdjacentSystem,
    moveToStart,
    moveToEnd,
    // 选区
    extendLeft,
    extendRight,
    extendUp,
    extendDown,
    clearSelection,
    // 动作
    deleteAtCursor,
    clearMeasure,
    // 历史
    undo,
    redo,
  };
}
