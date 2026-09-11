/**
 * 演奏时间线编译器（纯函数，无 Vue / Pinia / 音频依赖）。
 *
 * 职责：把 `ChordChart` 展开为**线性演奏序列**——处理外层 chorus（meta.repeats）
 * 与谱内反复/跳转（RepeatMark），并为每个演奏小节推导 chordUnit 级拍位。
 * 拍位推导**只存在于本模块**（含 chordOffsets 逻辑），生成层与 UI 一律消费本模块输出。
 *
 * 语义约定（见 .trae/documents/ireal-pro-playback-engine.md）：
 * - `meta.repeats` 为外层 chorus 次数；每个 chorus 重置内层跳转状态机。
 * - 只有逆反复线（`repeat-end` 无对应 `repeat-start`）→ 默认从上一个反复段起点（初始为第 0 小节）反复。
 * - endings：一段连续的带 `ending` 标记的小节构成 ending 组；第 p 次经过时演奏
 *   `min(p, 组内最大编号)` 号 ending，跳过其余。
 * - `jump`：D.C. 回第 0 小节，D.S. 回 segno 小节；`al-fine` 播到 `end`（Fine）小节停；
 *   `al-coda` 在**再次到达跳转指令所在小节**时跳到 coda 小节（两跳语义）；
 *   `al-1st` 跳回时 ending 状态重置为第 1 遍（重演 1st ending）。
 * - `end`（END 记号）：最后一个 chorus 停在该小节；非末 chorus 继续播放；
 *   同时充当 al-fine 的 Fine 目标。
 * - 容错：跳转目标缺失（无 segno / 无 coda）→ 记 warning、忽略跳转继续播放；
 *   展开总条数超过 `MAX_TIMELINE_ENTRIES` → 抛 `ChartTooComplexError` 防死循环。
 */

import type {
  ChartMeasure,
  ChordChart,
  ChordUnit,
  TimeSignature,
} from "../domain/types";
import { chordOffsets, measureCells, resolveTimeSignature } from "../domain/grid";

/* ── 输出类型 ─────────────────────────────────────────── */

/** 时间线内的一个和弦单元（unit 级拍位，供 compGenerator 直接消费） */
export interface TimelineChordUnit {
  /** 引用谱内和弦单元（含 N.C.） */
  chord: ChordUnit;
  /** 时间线绝对拍位（从 0 起） */
  startBeat: number;
  /** 占用拍数（1 | 1.5 | 2 | 3 | 4） */
  beats: number;
}

/** 时间线内的一次小节演奏（同源小节可出现多次：反复 / 多 chorus） */
export interface TimelineEntry {
  /** 源小节索引 */
  measureIndex: number;
  /** 播放序（0 起；同 measureIndex 一对多时的消歧键） */
  playIndex: number;
  /** 小节起始的绝对拍位 */
  startBeat: number;
  /** 小节总拍数（逐小节拍号） */
  beats: number;
  /** 该小节生效拍号 */
  timeSignature: TimeSignature;
  /** unit 级拍位（拍位推导只发生在本模块） */
  chordUnits: TimelineChordUnit[];
  /** 所属 chorus 序号（0 起，等于外层循环计数） */
  chorusIndex: number;
}

/** 编译结果 */
export interface PerformanceTimeline {
  /** 线性演奏序列 */
  entries: TimelineEntry[];
  /** 总拍数（= 末条 entry 的 startBeat + beats） */
  totalBeats: number;
  /** 容错警告（跳转目标缺失等，不阻塞播放） */
  warnings: string[];
}

/** 编译选项 */
export interface CompileTimelineOptions {
  /** 覆盖外层 chorus 次数；缺省用 chart.meta.repeats（至少 1） */
  repeats?: number;
}

/** 病态谱面（展开超限）异常——调用方应提示用户修改谱面 */
export class ChartTooComplexError extends Error {
  constructor(entryCount: number) {
    super(`Timeline expansion exceeded ${entryCount} entries (pathological chart?)`);
    this.name = "ChartTooComplexError";
  }
}

/** 展开总条数上限（防病态谱面死循环炸内存） */
export const MAX_TIMELINE_ENTRIES = 100_000;

/* ── 内部状态机 ───────────────────────────────────────── */

interface JumpState {
  /** D.C. / D.S. 是否已执行过（每 chorus 各最多一次，防环） */
  dcDone: boolean;
  dsDone: boolean;
  /** al-coda：是否已处于「第二跳等待」阶段 */
  codaArmed: boolean;
  /** 触发 al-coda 第二跳的指令所在小节索引 */
  codaJumpSource: number | null;
}

/* ── 主入口 ───────────────────────────────────────────── */

/**
 * 把和弦谱编译为演奏时间线。
 * @throws {ChartTooComplexError} 展开超过 MAX_TIMELINE_ENTRIES
 */
export function compileTimeline(
  chart: ChordChart,
  options: CompileTimelineOptions = {},
): PerformanceTimeline {
  const { measures } = chart;
  const repeats = Math.max(1, options.repeats ?? chart.meta.repeats ?? 1);
  const warnings: string[] = [];

  if (measures.length === 0) {
    return { entries: [], totalBeats: 0, warnings };
  }

  // 预扫描定位标记
  const segnoIndex = measures.findIndex(
    (m) => m.repeat?.segno === true,
  );
  const codaIndex = measures.findIndex((m) => m.repeat?.coda === true);

  const entries: TimelineEntry[] = [];
  let playIndex = 0;
  let startBeat = 0;
  let aborted = false; // END 记号命中（末 chorus）

  for (let chorus = 0; chorus < repeats && !aborted; chorus += 1) {

    // 每 chorus 重置内层状态机
    let cursor = 0;
    let activeRepeatStart = 0; // 逆反复线默认回到上一个段起点（初始：曲首）
    let currentPass = 1; // 当前反复段的经过次数（1 起）
    const repeatEndCounts = new Map<number, number>();
    const jump: JumpState = { dcDone: false, dsDone: false, codaArmed: false, codaJumpSource: null };

    while (cursor < measures.length) {
      if (entries.length >= MAX_TIMELINE_ENTRIES) {
        throw new ChartTooComplexError(MAX_TIMELINE_ENTRIES);
      }

      const measure = measures[cursor];
      const mark = measure.repeat;

      // ── al-coda 第二跳：到达指令小节 → 跳 coda ──
      if (
        jump.codaArmed &&
        jump.codaJumpSource !== null &&
        cursor === jump.codaJumpSource
      ) {
        if (codaIndex >= 0) {
          cursor = codaIndex;
        } else {
          warnings.push("D.C./D.S. al Coda: 未找到 Coda 记号，忽略第二跳");
        }
        jump.codaArmed = false;
        jump.codaJumpSource = null;
        continue;
      }

      // ── ending 过滤：跳过本次经过不该演奏的 ending ──
      if (mark?.ending !== null && mark?.ending !== undefined) {
        const target = endingTargetForPass(measures, cursor, currentPass);
        if (target !== null && mark.ending !== target) {
          cursor += 1;
          continue;
        }
      }

      // ── 记录本小节 ──
      const ts = resolveTimeSignature(measures, cursor);
      const beats = measureCells(ts);
      entries.push({
        measureIndex: cursor,
        playIndex: playIndex,
        startBeat,
        beats,
        timeSignature: ts,
        chordUnits: chordUnitsFor(measure, startBeat),
        chorusIndex: chorus,
      });
      playIndex += 1;
      startBeat += beats;

      // ── END 记号 / Fine：仅在「循环后的经过」停止（jump 已执行、
      //    谱内反复已发生、或已进入第 2 个以上 chorus）。
      //    iReal 的 END 语义即「最后一次反复时停在此处」；单遍直读谱上忽略。
      if (mark?.end === true) {
        const hasLooped =
          jump.dcDone || jump.dsDone || repeatEndCounts.size > 0 || chorus > 0;
        if (hasLooped) {
          aborted = true;
          break;
        }
      }

      // ── 跳转指令（本小节携带的 D.C./D.S.）──
      if (mark?.jump) {
        const jumpKind = mark.jump;
        const isDs = jumpKind.startsWith("ds");
        const alreadyDone = isDs ? jump.dsDone : jump.dcDone;
        if (!alreadyDone) {
          if (isDs) {
            jump.dsDone = true;
          } else {
            jump.dcDone = true;
          }
          const homeIndex = isDs ? segnoIndex : 0;
          if (homeIndex >= 0) {
            if (jumpKind === "ds-al-1st") currentPass = 1; // 重演 1st ending
            if (jumpKind.endsWith("al-coda")) {
              jump.codaArmed = true;
              jump.codaJumpSource = cursor;
            }
            if (jumpKind.endsWith("al-fine")) {
              // 播到 Fine（end 记号）即停——上面的 end 分支已处理
            }
            cursor = homeIndex;
            continue;
          }
          warnings.push(
            isDs
              ? "D.S.: 未找到 Segno 记号，忽略跳转"
              : "D.C.: 无可跳转目标（已在曲首），忽略跳转",
          );
        }
      }

      // ── 反复线 ──
      if (measure.barlineEnd === "repeat-end") {
        const count = (repeatEndCounts.get(cursor) ?? 0) + 1;
        repeatEndCounts.set(cursor, count);
        const playTimes = mark?.playTimes ?? 2;
        if (count < playTimes) {
          // 段内 pass 全局递增：同一 repeat 段可含多个带各自逆反复线的
          // ending 小节，每次跳回都推进一次经过计数
          currentPass += 1;
          cursor = activeRepeatStart;
          continue;
        }
        // 反复完成：下一段的逆反复线默认回到本段之后
        activeRepeatStart = cursor + 1;
        currentPass = 1;
      }

      if (measure.barlineStart === "repeat-start") {
        activeRepeatStart = cursor;
        // 不在此处重置 currentPass：正向再次经过 repeat-start 时，
        // currentPass 已由 repeat-end 处理器递增（否则 ending 第 2 遍会被重置回 1）
      }

      cursor += 1;
    }
  }

  return { entries, totalBeats: startBeat, warnings };
}

/* ── 辅助 ─────────────────────────────────────────────── */

/**
 * 计算 ending 组在第 pass 次经过时应演奏的 ending 编号。
 * ending 组 = 从 cursor 起连续的带 ending 标记的小节。
 * @returns 应演奏的编号；cursor 不在 ending 组内时返回 null
 */
function endingTargetForPass(
  measures: ChartMeasure[],
  cursor: number,
  currentPass: number,
): number | null {
  if (measures[cursor]?.repeat?.ending == null) return null;
  let max = 0;
  for (let i = cursor; i < measures.length; i += 1) {
    const e = measures[i]?.repeat?.ending;
    if (e == null) break;
    max = Math.max(max, e);
  }
  return Math.min(currentPass, max);
}

/** 小节 → unit 级拍位（起始拍位 = 小节起始 + 前序 beats 累计） */
function chordUnitsFor(m: ChartMeasure, measureStartBeat: number): TimelineChordUnit[] {
  const offsets = chordOffsets(m);
  return m.chords.map((chord, i) => ({
    chord,
    startBeat: measureStartBeat + offsets[i],
    beats: chord.beats,
  }));
}

/** 时间线内按拍定位：返回覆盖 beat 的 entry 索引（二分） */
export function findEntryIndexAtBeat(
  entries: TimelineEntry[],
  beat: number,
): number {
  let lo = 0;
  let hi = entries.length - 1;
  let result = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const e = entries[mid];
    if (beat < e.startBeat) {
      hi = mid - 1;
    } else if (beat >= e.startBeat + e.beats) {
      lo = mid + 1;
    } else {
      result = mid;
      break;
    }
  }
  return result;
}

/**
 * seek 语义：当前 playIndex 之后最近的出现 measureIndex 的 entry；
 * 停止态（fromPlayIndex = null）取首个实例。
 */
export function findSeekEntryIndex(
  entries: TimelineEntry[],
  measureIndex: number,
  fromPlayIndex: number | null,
): number {
  if (fromPlayIndex === null) {
    return entries.findIndex((e) => e.measureIndex === measureIndex);
  }
  return entries.findIndex(
    (e) => e.measureIndex === measureIndex && e.playIndex > fromPlayIndex,
  );
}
