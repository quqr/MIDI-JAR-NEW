import {
  secondsToBeat,
  type TempoSegment,
} from "@/views/ScoreScroll/utils/beatMap";
import type { Score3dNote, TrackInfo } from "../types";

/**
 * 音符映射器输入轨：@tonejs/midi 解析结果的最小结构。
 * 只声明用到的字段，便于测试构造 fixture 与未来替换解析来源。
 */
export interface MapperTrackInput {
  /** MIDI 通道号（@tonejs/midi Track.channel） */
  channel: number;
  notes: {
    midi: number;
    velocity: number;
    /** 起始时刻（秒） */
    time: number;
    /** 音长（秒） */
    duration: number;
  }[];
}

/** 音符映射器选项 */
export interface MapperOptions {
  /**
   * 分组键：
   * - "track"：按 MIDI 轨分组（格式 1 推荐，ADR 0007 默认）
   * - "channel"：按通道分组（格式 0 单轨多通道的回退，同通道多轨合并）
   */
  groupBy: "track" | "channel";
  /** tempo map（拍位换算），由调用方经 buildTempoMap 构建 */
  tempoMap: TempoSegment[];
}

/** 音符映射结果 */
export interface MapperResult {
  /** 全部音符，按 timeOn 升序 */
  notes: Score3dNote[];
  /** 声部轨摘要（trackIndex 连续，跳过空轨） */
  tracks: TrackInfo[];
  /** 总时长（秒，最后一个 timeOff）；无音符时为 0 */
  duration: number;
}

function clamp01(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

/** 解析分组键：返回 输入轨索引 → 声部轨索引 的映射 */
function resolveGroupMap(
  tracks: MapperTrackInput[],
  groupBy: "track" | "channel",
): Map<number, number> {
  const groupMap = new Map<number, number>();
  if (groupBy === "track") {
    let next = 0;
    tracks.forEach((track, index) => {
      if (track.notes.length === 0) return;
      groupMap.set(index, next);
      next += 1;
    });
    return groupMap;
  }
  // channel 模式：按通道号升序分配，同通道多条输入轨合并
  const channels = [...new Set(tracks.map((t) => t.channel))].sort(
    (a, b) => a - b,
  );
  const channelToIndex = new Map(channels.map((ch, idx) => [ch, idx]));
  tracks.forEach((track, index) => {
    if (track.notes.length === 0) return;
    const group = channelToIndex.get(track.channel);
    if (group !== undefined) groupMap.set(index, group);
  });
  return groupMap;
}

/**
 * 将 @tonejs/midi 的解析结果映射为三维乐谱音符。
 *
 * - 空轨剔除，非空轨获得连续 trackIndex
 * - 输出按 timeOn 升序
 * - duration 非正数时钳制为瞬时音符（timeOff = timeOn）
 * - velocity 钳制到 [0, 1]
 */
export function toScore3dNotes(
  tracks: MapperTrackInput[],
  options: MapperOptions,
): MapperResult {
  const { groupBy, tempoMap } = options;
  const groupMap = resolveGroupMap(tracks, groupBy);

  const notes: Score3dNote[] = [];
  for (const [trackIndex, group] of groupMap) {
    const track = tracks[trackIndex];
    for (const note of track.notes) {
      const timeOn = Math.max(0, note.time);
      notes.push({
        midi: note.midi,
        velocity: clamp01(note.velocity),
        timeOn,
        timeOff: Math.max(timeOn, timeOn + note.duration),
        beatOn: secondsToBeat(tempoMap, timeOn),
        trackIndex: group,
      });
    }
  }
  notes.sort((a, b) => a.timeOn - b.timeOn || a.midi - b.midi);

  const trackInfos: TrackInfo[] = [...new Set(groupMap.values())]
    .map((group) => {
      const groupNotes = notes.filter((n) => n.trackIndex === group);
      const midis = groupNotes.map((n) => n.midi);
      return {
        trackIndex: group,
        noteCount: groupNotes.length,
        minMidi: Math.min(...midis),
        maxMidi: Math.max(...midis),
      };
    })
    .filter((info) => info.noteCount > 0)
    .sort((a, b) => a.trackIndex - b.trackIndex);

  const duration = notes.reduce((max, n) => Math.max(max, n.timeOff), 0);
  return { notes, tracks: trackInfos, duration };
}

/** 从已映射的音符中提取声部轨摘要（与 toScore3dNotes 的 tracks 字段一致，供独立复用） */
export function extractTrackInfo(
  tracks: MapperTrackInput[],
  groupBy: "track" | "channel",
): TrackInfo[] {
  return toScore3dNotes(tracks, {
    groupBy,
    tempoMap: [{ startBeat: 0, startTime: 0, bpm: 120 }],
  }).tracks;
}
