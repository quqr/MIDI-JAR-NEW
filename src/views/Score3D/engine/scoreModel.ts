import type { ScoreNoteInfo } from "@/views/ScoreScroll/types";
import { beatToSeconds, type TempoSegment } from "@/views/ScoreScroll/utils/beatMap";
import type { Score3dNote, Score3dTimeRange } from "../types";

/**
 * 把乐谱音符转换为三维乐谱音符记录：补出秒级时间与谱表归属。
 *
 * 时间轴完全由乐谱决定——拍位经小节速度标记构建的 tempo map 换算为秒，
 * 音长取自 OSMD 音符时值。不依赖配对 MIDI。
 */
export function buildScore3dNotes(
  notes: readonly ScoreNoteInfo[],
  tempoMap: readonly TempoSegment[],
): Score3dNote[] {
  const out: Score3dNote[] = [];
  for (const n of notes) {
    const beatOff = n.beat + Math.max(0, n.durationBeats);
    out.push({
      midi: n.midi,
      beatOn: n.beat,
      beatOff,
      timeOn: beatToSeconds(tempoMap as TempoSegment[], n.beat),
      timeOff: beatToSeconds(tempoMap as TempoSegment[], beatOff),
      staffIndex: n.staffIndex ?? 0,
      measureIndex: n.measureIndex,
    });
  }
  out.sort((a, b) => a.timeOn - b.timeOn || a.midi - b.midi);
  return out;
}

/** 计算整首曲子的时间范围（秒） */
export function computeTimeRange(notes: readonly Score3dNote[]): Score3dTimeRange {
  let end = 0;
  for (const n of notes) {
    if (n.timeOff > end) end = n.timeOff;
  }
  return { start: 0, end };
}
