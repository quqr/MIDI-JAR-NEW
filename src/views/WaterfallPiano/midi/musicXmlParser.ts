/**
 * MusicXML → ScheduledNote[] 解析器（复用 OSMD 的乐谱模型，ADR 0024）
 *
 * 与 ScoreScroll 的 useOsmd 不同：本模块只做**解析**不做图元提取——
 * OSMD 渲染到游离容器一次，从 GraphicSheet 收集音符（midi/拍位/时值/谱表）
 * 与速度标记，再按分段 tempo map 换算为秒，交给 MidiFilePlayer.loadExternalNotes
 * 走标准 MIDI 播放链路（速度/循环/跳转/流体联动/视频导出全部免费复用）。
 */

import type {
  OpenSheetMusicDisplay,
  GraphicalMeasure,
} from "opensheetmusicdisplay";
import { createLogger } from "@/utils/logger";
import type { ScheduledNote, MidiTrackInfo } from "../types";

const logger = createLogger("MusicXmlParser");

/** 音符速度（MusicXML 无力度信息，使用与滚动乐谱一致的默认值） */
const DEFAULT_VELOCITY = 80;
/** 乐谱未标注速度时的兜底 BPM */
const FALLBACK_BPM = 120;

/** 解析结果：可直接交给 MidiFilePlayer 的调度音符与总时长 */
export interface MusicXmlParseResult {
  notes: ScheduledNote[];
  /** 总时长（秒，含最后一段音符时值） */
  durationSec: number;
  /** 曲名（无标题时为空串） */
  title: string;
  /** 声部（part）列表，按乐谱出现顺序；notes 的 trackIndex 即此 index */
  parts: MidiTrackInfo[];
}

/** 分段速度：从 beat 起 bpm 生效（升序） */
interface TempoSegment {
  beat: number;
  bpm: number;
}

/** 拍 → 秒（分段线性：每段内按 bpm 匀速累加） */
function beatToSeconds(beat: number, segments: TempoSegment[]): number {
  let t = 0;
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    const segEnd =
      i + 1 < segments.length ? segments[i + 1].beat : Number.POSITIVE_INFINITY;
    const clamped = Math.min(beat, segEnd);
    if (clamped > seg.beat) {
      t += ((clamped - seg.beat) * 60) / seg.bpm;
    }
    if (beat <= segEnd) break;
  }
  return t;
}

/** 提取速度标记（与 ScoreScroll useOsmd.extractTempo 同源逻辑） */
function extractTempo(instance: OpenSheetMusicDisplay): {
  segments: TempoSegment[];
  defaultBpm: number;
} {
  const byBeat = new Map<number, number>();
  const round = (v: number): number => Math.round(v * 1e6) / 1e6;

  for (const mte of instance.Sheet.TimestampSortedTempoExpressionsList) {
    const bpm = mte.InstantaneousTempo?.TempoInBpm ?? 0;
    if (bpm > 0) byBeat.set(round(mte.Timestamp.RealValue * 4), bpm);
  }
  for (const sm of instance.Sheet.SourceMeasures) {
    const bpm = sm.TempoInBPM;
    if (Number.isFinite(bpm) && bpm > 0) {
      const beat = round(sm.AbsoluteTimestamp.RealValue * 4);
      if (!byBeat.has(beat)) byBeat.set(beat, bpm);
    }
  }

  const defaultBpmRaw = instance.Sheet.DefaultStartTempoInBpm;
  const defaultBpm =
    Number.isFinite(defaultBpmRaw) && defaultBpmRaw > 0
      ? defaultBpmRaw
      : FALLBACK_BPM;
  const segments = [...byBeat.entries()]
    .map(([beat, bpm]) => ({ beat, bpm }))
    .sort((a, b) => a.beat - b.beat);
  if (segments.length === 0 || segments[0].beat > 0) {
    segments.unshift({ beat: 0, bpm: defaultBpm });
  }
  return { segments, defaultBpm };
}

/** 遍历图形模型收集音符（midi/拍位/时值/谱表/所属声部） */
function collectNotes(instance: OpenSheetMusicDisplay): Array<{
  midi: number;
  beat: number;
  durationBeats: number;
  staffIndex: number;
  partId: string;
  partLabel: string;
}> {
  const out: Array<{
    midi: number;
    beat: number;
    durationBeats: number;
    staffIndex: number;
    partId: string;
    partLabel: string;
  }> = [];
  for (const page of instance.GraphicSheet.MusicPages) {
    for (const system of page.MusicSystems) {
      system.GraphicalMeasures.forEach(
        (staffMeasures: GraphicalMeasure[], staffIndex: number) => {
          for (const measure of staffMeasures) {
            // 声部归属取自源小节所属 Part（钢琴类乐谱一个 Part 含双谱表）；
            // OSMD 2.1.2 类型未导出 SourceMeasure.Part，经 unknown 收窄访问
            interface PartLike {
              PartId?: string;
              Label?: string;
              GetLabel?: () => string;
            }
            const srcMeasure = measure.parentSourceMeasure as unknown as {
              Part?: PartLike;
            };
            const part = srcMeasure?.Part;
            const partId = part?.PartId ?? `staff-${staffIndex}`;
            const partLabel = part?.GetLabel?.() ?? part?.Label ?? "";
            for (const staffEntry of measure.staffEntries) {
              for (const gve of staffEntry.graphicalVoiceEntries) {
                for (const gn of gve.notes) {
                  const src = gn.sourceNote;
                  if (!src || src.isRest() || !src.PrintObject) continue;
                  const pitch = src.Pitch;
                  if (!pitch) continue;
                  const midi =
                    (pitch.Octave + 1) * 12 +
                    pitch.FundamentalNote +
                    pitch.AccidentalHalfTones;
                  out.push({
                    midi,
                    beat: src.getAbsoluteTimestamp().RealValue * 4,
                    durationBeats: Math.max(0, src.Length.RealValue * 4),
                    staffIndex,
                    partId,
                    partLabel,
                  });
                }
              }
            }
          }
        },
      );
    }
  }
  out.sort((a, b) => a.beat - b.beat || a.midi - b.midi);
  return out;
}

/**
 * 解析 MusicXML（.musicxml/.xml/.mxl，OSMD 按 Blob 内容自动识别压缩格式）。
 * 渲染在游离容器中完成一次，仅用于生成图形模型；完成后立即销毁。
 */
export async function parseMusicXml(
  data: ArrayBuffer,
): Promise<MusicXmlParseResult> {
  const { OpenSheetMusicDisplay: OSMD } = await import("opensheetmusicdisplay");

  const holder = document.createElement("div");
  holder.style.cssText =
    "position:fixed;left:-99999px;top:0;width:1024px;height:240px;overflow:hidden;pointer-events:none;";
  document.body.appendChild(holder);

  let instance: OpenSheetMusicDisplay | null = null;
  try {
    instance = new OSMD(holder, {
      backend: "svg",
      autoResize: false,
      followCursor: false,
      pageFormat: "Endless",
      renderSingleHorizontalStaffline: true,
    });
    instance.setLogLevel("warn");
    instance.EngravingRules.RenderTitle = false;
    instance.EngravingRules.RenderSubtitle = false;
    instance.EngravingRules.RenderLyricist = false;
    instance.EngravingRules.RenderComposer = false;

    const blob = new Blob([data], { type: "application/xml" });
    await instance.load(blob);
    instance.render();

    const { segments } = extractTempo(instance);
    const raw = collectNotes(instance);
    if (raw.length === 0) {
      throw new Error("乐谱中不含可演奏音符");
    }

    // 声部去重（按出现顺序编号），notes 的 trackIndex 即声部索引
    const partIdToIndex = new Map<string, number>();
    const partCounts = new Map<number, number>();
    for (const n of raw) {
      if (!partIdToIndex.has(n.partId)) {
        partIdToIndex.set(n.partId, partIdToIndex.size);
      }
      const idx = partIdToIndex.get(n.partId)!;
      partCounts.set(idx, (partCounts.get(idx) ?? 0) + 1);
    }
    const parts: MidiTrackInfo[] = [...partIdToIndex.entries()].map(
      ([partId, index]) => {
        const label = raw.find((n) => n.partId === partId)?.partLabel ?? "";
        return {
          index,
          name: label,
          noteCount: partCounts.get(index) ?? 0,
          instrument: "MusicXML",
        };
      },
    );

    const notes: ScheduledNote[] = raw.map((n) => ({
      midi: n.midi,
      velocity: DEFAULT_VELOCITY,
      time: beatToSeconds(n.beat, segments),
      duration: Math.max(
        0.05,
        beatToSeconds(n.beat + n.durationBeats, segments) -
          beatToSeconds(n.beat, segments),
      ),
      // 高音谱表 → 右手，低音谱表 → 左手，其余未知
      hand:
        n.staffIndex === 0 ? "right" : n.staffIndex === 1 ? "left" : "unknown",
      trackIndex: partIdToIndex.get(n.partId)!,
      key: `${n.partId}-${n.midi}-${n.beat}`,
    }));

    const last = raw[raw.length - 1];
    const endBeat = last.beat + last.durationBeats;
    const durationSec = beatToSeconds(endBeat, segments);
    const title = instance.Sheet.TitleString || "";

    logger.info(
      `MusicXML 解析完成: ${notes.length} 音符, ${durationSec.toFixed(1)}s, ${segments.length} 段速度`,
    );
    return { notes, durationSec, title, parts };
  } finally {
    try {
      instance?.clear();
    } catch {
      // ignore
    }
    holder.remove();
  }
}
