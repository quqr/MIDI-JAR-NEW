/**
 * 和弦谱编辑器 store。
 *
 * 职责划分（见 ADR 0022）：
 * - **本 store**：曲目根对象 + 选区/光标 + 撤销重做栈 + 自动保存调度。
 * - **`useChartPersistence`**：唯一读写 localStorage 的地方。
 * - **`domain/*`**：纯函数，不感知 store。
 *
 * 撤销模型：**整曲快照数组**（iReal 的编辑粒度是「和弦级增删」，单步改动很小，
 * 快照成本远低于 command pattern 的实现复杂度）。上限 `MAX_UNDO_DEPTH`，
 * 超出时从头部淘汰。`undo`/`redo` 只动指针、不裁剪，便于在中间插入新分支。
 */

import { defineStore } from "pinia";
import { computed, ref, shallowRef, watch } from "vue";

import { AUTOSAVE_DEBOUNCE_MS, MAX_UNDO_DEPTH } from "../constants";
import { createChordUnit, createEmptyChart } from "../domain/empty";
import {
  applyMeasureEdit,
  clampCursor,
  insertChord,
  insertMeasureAt,
  reindexAnchorsAfterInsert,
  reindexAnchorsAfterRemove,
  removeChord,
  removeMeasureAt,
  setAlternate,
  setChordBeats,
  toggleChordSize,
  transposeChart,
} from "../domain/editing";
import { layoutSystems, validateChart } from "../domain/grid";
import { parseChordUnit } from "../domain/chordText";
import {
  loadChart,
  removeChart,
  saveChart,
  serializeChart,
  deserializeChart,
  upsertLibraryEntry,
} from "../composables/useChartPersistence";
import { debounce } from "@/helpers/debounce";
import { deepClone } from "@/helpers/object";

import type {
  ChartMeasure,
  ChartMeta,
  ChordBeats,
  ChordUnit,
  ChordChart,
  CursorPos,
  SectionMark,
  Selection,
} from "../domain/types";

export const useChordChartStore = defineStore("chordChart", () => {
  /* ── 根状态 ───────────────────────────────────────── */

  /** 当前曲目 id；null = 未打开任何曲目 */
  const chartId = ref<string | null>(null);
  /** 当前曲目根对象 */
  const chart = ref(createEmptyChart(16));
  /** 脏标记（有未保存改动） */
  const dirty = ref(false);

  /** 撤销栈（元素为整曲快照） */
  const undoStack = shallowRef<ChordChart[]>([]);
  /** 重做栈 */
  const redoStack = shallowRef<ChordChart[]>([]);

  /* ── 选区与光标 ───────────────────────────────────── */

  const cursor = ref<CursorPos>({ measureIndex: 0, chordIndex: null });
  const selection = ref<Selection | null>(null);

  /* ── 派生 ─────────────────────────────────────────── */

  /** system 分页结果（每项是若干小节索引） */
  const systems = computed(() => layoutSystems(chart.value.measures));

  /** 全曲校验问题 */
  const issues = computed(() => validateChart(chart.value));

  /** 能否撤销 / 重做 */
  const canUndo = computed(() => undoStack.value.length > 0);
  const canRedo = computed(() => redoStack.value.length > 0);

  /** 小节总数 */
  const measureCount = computed(() => chart.value.measures.length);

  /* ── 历史 ─────────────────────────────────────────── */

  /**
   * 在改动前压入快照。
   *
   * 约定：**所有变更入口必须在写 `chart.value` 之前调用本函数**。
   * 压栈即清空 redo（新分支），并裁掉超出深度的最旧快照。
   */
  function pushHistory(): void {
    undoStack.value = [...undoStack.value, deepClone(chart.value)].slice(
      -MAX_UNDO_DEPTH,
    );
    redoStack.value = [];
    dirty.value = true;
  }

  function undo(): void {
    const stack = undoStack.value;
    if (stack.length === 0) return;
    redoStack.value = [...redoStack.value, deepClone(chart.value)];
    chart.value = stack[stack.length - 1];
    undoStack.value = stack.slice(0, -1);
    clampCursorToChart();
    dirty.value = true;
  }

  function redo(): void {
    const stack = redoStack.value;
    if (stack.length === 0) return;
    undoStack.value = [...undoStack.value, deepClone(chart.value)];
    chart.value = stack[stack.length - 1];
    redoStack.value = stack.slice(0, -1);
    clampCursorToChart();
    dirty.value = true;
  }

  /** 清空历史（打开/新建曲目时调用） */
  function clearHistory(): void {
    undoStack.value = [];
    redoStack.value = [];
  }

  /* ── 自动保存 ─────────────────────────────────────── */

  const flushSave = debounce(() => {
    const id = chartId.value;
    if (!id) return;
    saveChart(id, chart.value);
    upsertLibraryEntry(id, chart.value);
    dirty.value = false;
  }, AUTOSAVE_DEBOUNCE_MS);

  watch(chart, () => flushSave(), { deep: true });

  /** 立即落盘（切换曲目 / 卸载前调用） */
  function saveNow(): void {
    flushSave.cancel();
    const id = chartId.value;
    if (!id) return;
    saveChart(id, chart.value);
    upsertLibraryEntry(id, chart.value);
    dirty.value = false;
  }

  /* ── 曲目生命周期 ─────────────────────────────────── */

  /** 打开指定曲目；不存在则视为无操作 */
  function openChart(id: string): boolean {
    if (chartId.value && chartId.value !== id) saveNow();
    const loaded = loadChart(id);
    if (!loaded) return false;
    chartId.value = id;
    chart.value = loaded;
    clearHistory();
    cursor.value = { measureIndex: 0, chordIndex: null };
    selection.value = null;
    dirty.value = false;
    return true;
  }

  /** 在当前 store 中装载一张新曲目（由调用方负责创建存储条目） */
  function attachChart(id: string, next: ChordChart): void {
    chartId.value = id;
    chart.value = next;
    clearHistory();
    cursor.value = { measureIndex: 0, chordIndex: null };
    selection.value = null;
    dirty.value = false;
  }

  /** 关闭当前曲目（先落盘） */
  function closeChart(): void {
    saveNow();
    chartId.value = null;
    chart.value = createEmptyChart(16);
    clearHistory();
    cursor.value = { measureIndex: 0, chordIndex: null };
    selection.value = null;
    dirty.value = false;
  }

  /** 删除曲目并关闭（若删除的是当前曲目） */
  function deleteChart(id: string): void {
    if (chartId.value === id) {
      removeChart(id);
      chartId.value = null;
      chart.value = createEmptyChart(16);
      clearHistory();
      dirty.value = false;
      return;
    }
    removeChart(id);
  }

  /* ── 光标 ─────────────────────────────────────────── */

  function setCursor(pos: CursorPos): void {
    cursor.value = clampCursor(chart.value, pos);
  }

  function setSelection(sel: Selection | null): void {
    selection.value = sel;
  }

  /** 撤销/重做或删小节后，把光标夹回有效范围 */
  function clampCursorToChart(): void {
    cursor.value = clampCursor(chart.value, cursor.value);
  }

  /* ── 编辑动作（全部经 pushHistory + 纯函数） ───────── */

  /**
   * 写入 / 替换指定位置的和弦（位置不存在则补齐）。
   *
   * ⚠️ 入参统一过 `createChordUnit` 补默认值：调用方（输入面板 / 上下文面板 /
   * 导入）可能只给出部分字段，直接落库会留下 `undefined` 字段，
   * 让 `size`/`noChord` 等布尔与枚举判断静默失真。
   */
  function putChord(
    measureIndex: number,
    chordIndex: number,
    unit: ChordUnit,
  ): void {
    const next = createChordUnit(unit);
    pushHistory();
    chart.value.measures = applyMeasureEdit(
      chart.value.measures,
      measureIndex,
      (m) => {
        const chords = [...m.chords];
        while (chords.length < chordIndex) {
          chords.push(createPlaceholderChord());
        }
        if (chords.length === chordIndex) {
          chords.push(next);
        } else {
          chords[chordIndex] = next;
        }
        return { ...m, chords };
      },
    );
  }

  /** 在指定位置插入和弦（后续和弦右移） */
  function addChord(
    measureIndex: number,
    chordIndex: number,
    unit: ChordUnit,
  ): void {
    pushHistory();
    chart.value.measures = applyMeasureEdit(
      chart.value.measures,
      measureIndex,
      (m) => ({
        ...m,
        chords: insertChord(m.chords, chordIndex, createChordUnit(unit)),
      }),
    );
  }

  /** 删除指定和弦 */
  function deleteChord(measureIndex: number, chordIndex: number): void {
    pushHistory();
    chart.value.measures = applyMeasureEdit(
      chart.value.measures,
      measureIndex,
      (m) => ({ ...m, chords: removeChord(m.chords, chordIndex) }),
    );
    clampCursorToChart();
  }

  /** 修改和弦时长 */
  function changeChordBeats(
    measureIndex: number,
    chordIndex: number,
    beats: ChordBeats,
  ): void {
    pushHistory();
    chart.value.measures = applyMeasureEdit(
      chart.value.measures,
      measureIndex,
      (m) => ({
        ...m,
        chords: m.chords.map((c, i) =>
          i === chordIndex ? setChordBeats(c, beats) : c,
        ),
      }),
    );
  }

  /** 修改元信息 */
  function updateMeta(patch: Partial<ChartMeta>): void {
    pushHistory();
    chart.value.meta = { ...chart.value.meta, ...patch };
  }

  /** 修改整小节属性（拍号 / 小节线 / 反复标记等，**不含 chords**） */
  function updateMeasure(
    measureIndex: number,
    patch: Partial<Omit<ChartMeasure, "chords">>,
  ): void {
    pushHistory();
    chart.value.measures = applyMeasureEdit(
      chart.value.measures,
      measureIndex,
      (m) => ({ ...m, ...patch }),
    );
  }

  /** 清空某小节的全部和弦（chords 有独立 API，故不走 updateMeasure） */
  function clearMeasure(measureIndex: number): void {
    pushHistory();
    chart.value.measures = applyMeasureEdit(
      chart.value.measures,
      measureIndex,
      (m) => ({ ...m, chords: [] }),
    );
    clampCursorToChart();
  }

  /** 在当前曲目末尾追加一个小节 */
  function appendMeasure(): void {
    pushHistory();
    const measures = chart.value.measures;
    const last = measures[measures.length - 1];
    chart.value.measures = [
      ...measures,
      {
        timeSignature: last?.timeSignature ?? null,
        grouping: last?.grouping ?? null,
        chords: [],
        barlineStart: "single",
        repeat: null,
        barlineEnd: "single",
      },
    ];
  }

  /** 删除末尾小节（保留至少 1 个） */
  function removeLastMeasure(): void {
    if (chart.value.measures.length <= 1) return;
    pushHistory();
    chart.value.measures = chart.value.measures.slice(0, -1);
    clampCursorToChart();
  }

  /**
   * 在指定位置插入小节（继承前一小节拍号，避免中途意外换拍）。
   * 段落记号 / 谱面文字挂在小节索引上，必须同步后移。
   */
  function insertMeasure(index: number): void {
    pushHistory();
    chart.value.measures = insertMeasureAt(chart.value.measures, index);
    chart.value.sections = reindexAnchorsAfterInsert(
      chart.value.sections,
      index,
    );
    chart.value.texts = reindexAnchorsAfterInsert(chart.value.texts, index);
    clampCursorToChart();
  }

  /**
   * 删除指定小节（至少保留 1 个）。挂在被删小节上的段落 / 文字一并清除，
   * 其后锚点索引前移。索引越界时为无操作（不进历史）。
   */
  function removeMeasure(index: number): void {
    if (index < 0 || index >= chart.value.measures.length) return;
    if (chart.value.measures.length <= 1) return;
    pushHistory();
    chart.value.measures = removeMeasureAt(chart.value.measures, index);
    chart.value.sections = reindexAnchorsAfterRemove(
      chart.value.sections,
      index,
    );
    chart.value.texts = reindexAnchorsAfterRemove(chart.value.texts, index);
    clampCursorToChart();
  }

  /**
   * 整曲移调（和弦根音 / 低音 / 上方小和弦 + 调号主音；单步入历史）。
   * 拼写偏好复用全局 `settings.notation.accidentals`，由调用方传入。
   */
  function transposeChartSemitones(
    semitones: number,
    preference: "flat" | "sharp",
  ): void {
    if (semitones === 0) return;
    replaceChart(transposeChart(chart.value, semitones, preference));
  }

  /** 替换整张曲目（移调 / 导入等整体变换走这里，单步入历史） */
  function replaceChart(next: ChordChart): void {
    pushHistory();
    chart.value = next;
    clampCursorToChart();
  }

  /* ── 和弦级：尺寸 / 上方小和弦 ─────────────────────── */

  /** 切换某和弦的显示尺寸（normal ↔ small） */
  function toggleChordSizeAt(measureIndex: number, chordIndex: number): void {
    pushHistory();
    chart.value.measures = applyMeasureEdit(
      chart.value.measures,
      measureIndex,
      (m) => ({
        ...m,
        chords: m.chords.map((c, i) =>
          i === chordIndex ? toggleChordSize(c) : c,
        ),
      }),
    );
  }

  /**
   * 设置 / 清除某和弦的上方小和弦（alternate）；传 null 或空串清除。
   *
   * 接受**文本**而非 ChordUnit——面板侧是输入框，且文本解析必须与主输入
   * 面板走同一条路径（`parseChordUnit`），否则两边写法会产生分歧。
   */
  function setAlternateAt(
    measureIndex: number,
    chordIndex: number,
    text: string | null,
  ): void {
    const trimmed = text?.trim() ?? "";
    const parsed = trimmed === "" ? null : parseChordUnit(trimmed, 4, true);
    pushHistory();
    chart.value.measures = applyMeasureEdit(
      chart.value.measures,
      measureIndex,
      (m) => ({
        ...m,
        chords: m.chords.map((c, i) =>
          i === chordIndex ? setAlternate(c, parsed) : c,
        ),
      }),
    );
  }

  /* ── 小节级：段落记号 / 谱面文字 ───────────────────── */

  /** 读某小节的段落记号；无则 null */
  function sectionAt(measureIndex: number): SectionMark | null {
    const hit = chart.value.sections.find(
      (s) => s.measureIndex === measureIndex,
    );
    return hit?.mark ?? null;
  }

  /** 设置 / 清除某小节的段落记号；传 null 清除。每小节至多一个 */
  function setSectionAt(measureIndex: number, mark: SectionMark | null): void {
    pushHistory();
    const rest = chart.value.sections.filter(
      (s) => s.measureIndex !== measureIndex,
    );
    chart.value.sections =
      mark === null
        ? rest
        : [...rest, { measureIndex, mark }].sort(
            (a, b) => a.measureIndex - b.measureIndex,
          );
  }

  /** 读某小节的谱面文字；无则空串 */
  function textAt(measureIndex: number): string {
    const hit = chart.value.texts.find((t) => t.measureIndex === measureIndex);
    return hit?.content ?? "";
  }

  /** 设置 / 清除某小节的谱面文字；空白串视为清除。每小节至多一条 */
  function setTextAt(measureIndex: number, content: string): void {
    pushHistory();
    const rest = chart.value.texts.filter(
      (t) => t.measureIndex !== measureIndex,
    );
    const trimmed = content.trim();
    chart.value.texts =
      trimmed === ""
        ? rest
        : [
            ...rest,
            { content: trimmed, verticalOffset: null, measureIndex },
          ].sort((a, b) => a.measureIndex - b.measureIndex);
  }

  /* ── 导入导出 ─────────────────────────────────────── */

  function exportText(): string {
    return serializeChart(chart.value);
  }

  /** 从文本导入并替换当前曲目；失败返回 false */
  function importText(text: string): boolean {
    const parsed = deserializeChart(text);
    if (!parsed) return false;
    replaceChart(parsed);
    return true;
  }

  return {
    // 状态
    chartId,
    chart,
    dirty,
    cursor,
    selection,
    // 派生
    systems,
    issues,
    canUndo,
    canRedo,
    measureCount,
    // 历史
    undo,
    redo,
    pushHistory,
    clearHistory,
    // 持久化
    saveNow,
    openChart,
    attachChart,
    closeChart,
    deleteChart,
    // 光标
    setCursor,
    setSelection,
    // 编辑
    putChord,
    addChord,
    deleteChord,
    changeChordBeats,
    toggleChordSizeAt,
    setAlternateAt,
    updateMeta,
    updateMeasure,
    clearMeasure,
    sectionAt,
    setSectionAt,
    textAt,
    setTextAt,
    appendMeasure,
    removeLastMeasure,
    insertMeasure,
    removeMeasure,
    transposeChartSemitones,
    replaceChart,
    // 导入导出
    exportText,
    importText,
  };
});

/* ── 局部辅助 ─────────────────────────────────────────── */

/** 占位和弦（用于补齐间断的 chordIndex；不发声、显示为空） */
function createPlaceholderChord(): ChordUnit {
  return createChordUnit();
}
