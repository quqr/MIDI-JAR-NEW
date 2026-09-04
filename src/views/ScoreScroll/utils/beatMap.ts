import type { ScoreNoteInfo, ScoreSystemInfo } from "../types";

/** 速度段：从某拍/某秒起以固定 BPM 演奏 */
export interface TempoSegment {
  /** 段起始拍（四分音符 = 1 拍） */
  startBeat: number;
  /** 段起始时间（秒） */
  startTime: number;
  /** 该段 BPM */
  bpm: number;
}

/** 默认 BPM（无速度标记时） */
export const DEFAULT_BPM = 120;

/**
 * 由 @tonejs/midi 的 header 构建 tempo map。
 * @param tempos - midi.header.tempos（按 ticks 升序，time 为预计算秒值）
 * @param ppq - midi.header.ppq（每四分音符 tick 数）
 */
export function buildTempoMap(
  tempos: { ticks: number; bpm: number; time: number }[],
  ppq: number,
): TempoSegment[] {
  if (tempos.length === 0) {
    return [{ startBeat: 0, startTime: 0, bpm: DEFAULT_BPM }];
  }
  return tempos.map((t) => ({
    startBeat: ppq > 0 ? t.ticks / ppq : 0,
    startTime: t.time,
    bpm: t.bpm > 0 ? t.bpm : DEFAULT_BPM,
  }));
}

/**
 * 由 MusicXML 小节速度标记构建 tempo map（乐谱自驱动播放）。
 * bpm 为 0 的小节沿用前一小节速度；首小节无标记时使用 defaultBpm。
 * startTime 按拍位分段累加计算。
 *
 * 同 startBeat 不同 bpm（部分导出器在同一拍同时写 <sound tempo> 与 <metronome>，
 * 或表达式与小节属性重复）会按拍去重，后值覆盖前值，避免出现 span=0 的速度段
 * 破坏后续 startTime 累加导致整条时间轴错乱。
 */
export function buildTempoMapFromMeasures(
  measures: { startBeat: number; bpm: number }[],
  defaultBpm = DEFAULT_BPM,
): TempoSegment[] {
  if (measures.length === 0) {
    return [{ startBeat: 0, startTime: 0, bpm: defaultBpm }];
  }
  // 按 startBeat 去重（同拍取最后一个），再按拍升序处理
  const byBeat = new Map<number, number>();
  for (const m of measures) {
    byBeat.set(m.startBeat, m.bpm);
  }
  const sorted = [...byBeat.entries()].sort((a, b) => a[0] - b[0]);

  const segments: TempoSegment[] = [];
  for (const [startBeat, bpmRaw] of sorted) {
    const prev = segments[segments.length - 1];
    // bpm 为 0 沿用前一段速度；首段无前值时回退 defaultBpm
    const bpm = bpmRaw > 0 ? bpmRaw : prev ? prev.bpm : defaultBpm;
    const startTime =
      prev === undefined
        ? 0
        : prev.startTime + ((startBeat - prev.startBeat) * 60) / prev.bpm;
    // 相邻同速小节合并为一段（不新增段，仅隐式延伸）
    if (prev && Math.abs(prev.bpm - bpm) < 1e-9) continue;
    segments.push({ startBeat, startTime, bpm });
  }
  return segments;
}

/** 查找时间/拍位所在的速度段索引 */
function findSegmentIndex(
  segments: TempoSegment[],
  value: number,
  field: "startBeat" | "startTime",
): number {
  let idx = 0;
  for (let i = 0; i < segments.length; i++) {
    if (segments[i][field] <= value) {
      idx = i;
    } else {
      break;
    }
  }
  return idx;
}

/** 秒 → 拍 */
export function secondsToBeat(
  segments: TempoSegment[],
  seconds: number,
): number {
  if (segments.length === 0) return 0;
  const s = Math.max(0, seconds);
  const idx = findSegmentIndex(segments, s, "startTime");
  const seg = segments[idx];
  return seg.startBeat + ((s - seg.startTime) * seg.bpm) / 60;
}

/** 拍 → 秒 */
export function beatToSeconds(segments: TempoSegment[], beat: number): number {
  if (segments.length === 0) return 0;
  const b = Math.max(0, beat);
  const idx = findSegmentIndex(segments, b, "startBeat");
  const seg = segments[idx];
  return seg.startTime + ((b - seg.startBeat) * 60) / seg.bpm;
}

/**
 * 找到当前拍所在的系统行。
 * 返回最后一个 startBeat <= beat 的系统行；beat 早于第一行时返回第一行；无数据返回 null。
 */
export function findCurrentSystem(
  systems: ScoreSystemInfo[],
  beat: number,
): ScoreSystemInfo | null {
  let current: ScoreSystemInfo | null = null;
  for (const sys of systems) {
    if (sys.startBeat <= beat) {
      current = sys;
    } else {
      break;
    }
  }
  return current ?? (systems.length > 0 ? systems[0] : null);
}

/**
 * 当前拍位的谱面 y 坐标（连续插值）。
 * 在相邻系统行的起始拍之间线性插值 topY → nextTopY，
 * 使谱面随播放连续平滑上移（当前行奏完时下一行恰好到达锚点）。
 * 返回 null 表示无数据。
 */
export function systemYAtBeat(
  systems: ScoreSystemInfo[],
  beat: number,
): number | null {
  if (systems.length === 0) return null;
  if (beat <= systems[0].startBeat) return systems[0].topY;
  for (let i = 0; i < systems.length - 1; i++) {
    const cur = systems[i];
    const next = systems[i + 1];
    if (beat < next.startBeat) {
      const span = next.startBeat - cur.startBeat;
      if (span <= 0) return cur.topY;
      const t = (beat - cur.startBeat) / span;
      return cur.topY + (next.topY - cur.topY) * t;
    }
  }
  // 最后一行：在其时值范围内向底部滚动，之后保持
  const last = systems[systems.length - 1];
  const span = last.endBeat - last.startBeat;
  if (span <= 0 || beat >= last.endBeat) return last.topY;
  const t = (beat - last.startBeat) / span;
  return last.topY + (last.bottomY - last.topY) * t;
}

/** 找到当前拍所在小节（同上规则），返回全局小节索引或 -1 */
export function findCurrentMeasureIndex(
  measureStarts: { index: number; startBeat: number }[],
  beat: number,
): number {
  let current = -1;
  for (const m of measureStarts) {
    if (m.startBeat <= beat) {
      current = m.index;
    } else {
      break;
    }
  }
  return current;
}

// ── 单行连续视图：拍 → 谱面 X 坐标映射 ──────────────────────────────

/** 拍 → 谱面 X 的一个采样点（音符头中心） */
export interface BeatXPoint {
  beat: number;
  x: number;
}

/**
 * 由音符列表构建「拍 → 谱面 X」分段映射。
 * 取每个起始拍对应音符头中心 x（同拍多音符取最小 x），按拍升序去重。
 * 该映射让扫描线始终贴合当前发声音符，而非按系统行起点匀速漂移。
 */
export function buildBeatXMap(notes: ScoreNoteInfo[]): BeatXPoint[] {
  if (notes.length === 0) return [];
  const sorted = [...notes].sort((a, b) => a.beat - b.beat || a.x - b.x);
  const points: BeatXPoint[] = [];
  let lastBeat = -Infinity;
  for (const n of sorted) {
    const cx = n.x + n.width / 2;
    if (n.beat === lastBeat) {
      const tail = points[points.length - 1];
      if (cx < tail.x) tail.x = cx;
      continue;
    }
    points.push({ beat: n.beat, x: cx });
    lastBeat = n.beat;
  }
  return points;
}

/**
 * 当前拍位的谱面 X 坐标（分段线性插值）。
 * 在相邻采样点之间按拍线性插值，使谱面随播放横向连续平移；
 * 早于首点/晚于末点时钳制到端点。空映射返回 0。
 */
export function xAtBeat(map: BeatXPoint[], beat: number): number {
  if (map.length === 0) return 0;
  if (beat <= map[0].beat) return map[0].x;
  for (let i = 0; i < map.length - 1; i++) {
    const cur = map[i];
    const next = map[i + 1];
    if (beat < next.beat) {
      const span = next.beat - cur.beat;
      if (span <= 0) return cur.x;
      const t = (beat - cur.beat) / span;
      return cur.x + (next.x - cur.x) * t;
    }
  }
  return map[map.length - 1].x;
}
