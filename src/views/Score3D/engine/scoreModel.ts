import type { ScoreNoteInfo } from "@/views/ScoreScroll/types";
import {
  beatToSeconds,
  buildTempoMapFromMeasures,
  type TempoSegment,
} from "@/views/ScoreScroll/utils/beatMap";
import { DEFAULT_VELOCITY } from "../constants";
import type { Score3dNote, Score3dTimeRange } from "../types";

/**
 * 由乐谱速度标记构建 tempo map。
 *
 * 时间轴完全由乐谱决定（不依赖配对 MIDI）：速度标记来自 <metronome>，
 * 或由 OSMD 从小节属性回退读取的 <sound tempo>（见 useOsmd.extractTempo）。
 * 无任何速度标记时回退到 defaultBpm。
 */
export function buildScoreTempoMap(
  tempoMarks: readonly { beat: number; bpm: number }[],
  defaultBpm = 0,
): TempoSegment[] {
  return buildTempoMapFromMeasures(
    tempoMarks.map((m) => ({ startBeat: m.beat, bpm: m.bpm })),
    defaultBpm > 0 ? defaultBpm : 120,
  );
}

/**
 * 乐谱音符 → 三维乐谱音符。
 *
 * - 谱表索引（ScoreNoteInfo.staffIndex）压缩为连续的声部轨索引，
 *   保证空谱表不占位（ADR 0007：每个谱表一条能量轨迹）
 * - 秒级时间由拍位经 tempo map 换算，音长取自乐谱音符时值
 * - MusicXML 无逐音符力度，统一取 DEFAULT_VELOCITY 兜底
 */
export function toScore3dNotesFromScore(
  notes: readonly ScoreNoteInfo[],
  tempoMap: readonly TempoSegment[],
): Score3dNote[] {
  const trackOf = buildStaffToTrackMap(notes);
  const out: Score3dNote[] = [];
  for (const n of notes) {
    const beatOff = n.beat + Math.max(0, n.durationBeats);
    out.push({
      midi: n.midi,
      velocity: DEFAULT_VELOCITY,
      timeOn: beatToSeconds(tempoMap as TempoSegment[], n.beat),
      timeOff: beatToSeconds(tempoMap as TempoSegment[], beatOff),
      beatOn: n.beat,
      trackIndex: trackOf.get(n.staffIndex ?? 0) ?? 0,
    });
  }
  out.sort((a, b) => a.timeOn - b.timeOn || a.midi - b.midi);
  return out;
}

/** 谱表索引 → 连续声部轨索引（只为有音符的谱表分配） */
function buildStaffToTrackMap(
  notes: readonly ScoreNoteInfo[],
): Map<number, number> {
  const staffs = [...new Set(notes.map((n) => n.staffIndex ?? 0))].sort(
    (a, b) => a - b,
  );
  return new Map(staffs.map((staff, index) => [staff, index]));
}

/** 整首曲子的时间范围（秒） */
export function computeTimeRange(
  notes: readonly Score3dNote[],
): Score3dTimeRange {
  let end = 0;
  for (const n of notes) {
    if (n.timeOff > end) end = n.timeOff;
  }
  return { start: 0, end };
}
