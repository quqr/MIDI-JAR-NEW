import type {
  ChordAnchor,
  Score3dNote,
  TrailLayoutOptions,
  TrailPoint,
  TrailTrack,
} from "../types";

/** 同一时刻同时发声的音符组（和弦） */
interface ChordGroup {
  timeOn: number;
  midis: number[];
}

/** 将音符按 timeOn 精确相等分组（要求输入已按 timeOn 升序） */
function groupChords(
  sortedMidis: { midi: number; timeOn: number }[],
): ChordGroup[] {
  const groups: ChordGroup[] = [];
  for (const { midi, timeOn } of sortedMidis) {
    const last = groups[groups.length - 1];
    if (last && last.timeOn === timeOn) {
      last.midis.push(midi);
    } else {
      groups.push({ timeOn, midis: [midi] });
    }
  }
  return groups;
}

function pickMainMidi(midis: number[], policy: "top" | "bottom"): number {
  return policy === "top" ? Math.max(...midis) : Math.min(...midis);
}

/**
 * 能量轨迹布局器（纯函数）。
 *
 * - x = timeOn × unitsPerSecond（时间轴）
 * - y = (midi − 全曲最低音) × unitsPerSemitone（音高轴，跨轨统一归一化）
 * - z = trackIndex × staffGap（声部轴分层，ADR 0007）
 * - 同一时刻的复音折叠为一条主音控制点，其余音高进入和弦锚点
 *   （光点在锚点处同时点亮多个音高；主音策略由 chordPolicy 决定）
 */
export function layoutTrail(
  notes: Score3dNote[],
  options: TrailLayoutOptions,
): TrailTrack[] {
  if (notes.length === 0) return [];

  const globalMinMidi = Math.min(...notes.map((n) => n.midi));
  const trackIndexes = [...new Set(notes.map((n) => n.trackIndex))].sort(
    (a, b) => a - b,
  );

  const tracks: TrailTrack[] = [];
  for (const trackIndex of trackIndexes) {
    const trackNotes = notes
      .filter((n) => n.trackIndex === trackIndex)
      .sort((a, b) => a.timeOn - b.timeOn || a.midi - b.midi);

    const chords = groupChords(
      trackNotes.map(({ midi, timeOn }) => ({ midi, timeOn })),
    );

    const points: TrailPoint[] = [];
    const chordAnchors: ChordAnchor[] = [];

    chords.forEach((chord) => {
      const main = pickMainMidi(chord.midis, options.chordPolicy);
      const pointIndex = points.length;
      points.push({
        x: chord.timeOn * options.unitsPerSecond,
        y: (main - globalMinMidi) * options.unitsPerSemitone,
        z: trackIndex * options.staffGap,
      });
      const others = [...new Set(chord.midis.filter((m) => m !== main))].sort(
        (a, b) => a - b,
      );
      if (others.length > 0) {
        chordAnchors.push({
          pointIndex,
          otherMidis: others,
          otherPoints: others.map((midi) => ({
            x: chord.timeOn * options.unitsPerSecond,
            y: (midi - globalMinMidi) * options.unitsPerSemitone,
            z: trackIndex * options.staffGap,
          })),
        });
      }
    });

    tracks.push({ trackIndex, points, chordAnchors });
  }

  return tracks;
}
