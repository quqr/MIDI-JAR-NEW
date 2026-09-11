/**
 * 伴奏事件生成器（纯函数）。
 *
 * 输入演奏时间线（timeline.ts 输出，unit 级拍位由其下发，本模块**不自行累计 beats**）、
 * 风格模板（grooves.ts），输出三轨伴奏事件（beat 域，tempo 无关——换算在调度层）。
 *
 * 语义约定（见计划 Assumptions）：
 * - alternate 忽略备选，播主和弦；invisibleRoot 播真实根音；
 * - slash 和弦（chord.bass）→ bass 轨弹该音，piano voicing 已排除；
 * - noChord 小节：和声与贝斯停奏，只留鼓；
 * - fermata 忽略；变调由调度层作用于输出（本模块按记谱音高输出）。
 */

import { Note } from "tonal";

import type { DrumPiece } from "./grooves";
import type { Groove } from "./grooves";
import type { PerformanceTimeline, TimelineEntry } from "./timeline";
import { voiceChord } from "./voicing";
import type { ChordUnit, ChordChart } from "../domain/types";

/* ── 类型 ─────────────────────────────────────────────── */

export type AccompanimentTrack = "piano" | "bass" | "drums";

export interface AccompanimentEvent {
  track: AccompanimentTrack;
  /** MIDI 号；drums 轨填 0（真实音高见 drumMidi 映射，调度层负责） */
  midi: number;
  /** 时间线绝对拍位（等分域，swing 由调度层映射） */
  startBeat: number;
  /** 时值（拍） */
  durationBeats: number;
  /** 0–1 */
  velocity: number;
  /** drums 专有：鼓件名（midi 忽略） */
  piece?: DrumPiece;
}

/* ── 鼓件 → MIDI ──────────────────────────────────────── */

/** 鼓件 MIDI 映射（GM 打击乐；smplr DrumMachine 按 GM 打击乐音符取样） */
export function drumMidi(piece: DrumPiece, _kit: Groove["drumKit"]): number {
  switch (piece) {
    case "kick":
      return 36; // GM Bass Drum 1
    case "snare":
      return 38; // GM Acoustic Snare
    case "hihat":
      return 42; // GM Closed Hi-Hat
    case "ride":
      return 51; // GM Ride Cymbal 1
  }
}

/* ── 音高工具 ─────────────────────────────────────────── */

/** bass 音域：E1–A3 */
const BASS_LOW = 28;
const BASS_HIGH = 57;

/** 音高类 → [low, high] 内离 center 最近的 MIDI */
function nearestMidiWithPc(pc: number, low: number, high: number, center: number): number {
  const base = pc + 12 * Math.round((center - pc) / 12);
  const candidates = [base - 12, base, base + 12].filter((m) => m >= low && m <= high);
  if (candidates.length === 0) return Math.min(high, Math.max(low, base));
  return candidates.reduce((best, m) =>
    Math.abs(m - center) < Math.abs(best - center) ? m : best,
  );
}

/** 和弦的 bass 轨根音音高类（slash 时用 bass 音；N.C. → null） */
function bassPitchClass(chord: ChordUnit): number | null {
  if (chord.noChord) return null;
  const name = chord.bass || chord.root;
  if (!name) return null;
  return Note.chroma(name);
}

/** 纯五度上的音高类 */
function fifthOf(pc: number): number {
  return (pc + 7) % 12;
}

/* ── 轨道生成 ─────────────────────────────────────────── */

/** 鼓：模板按小节循环，beat ≥ 小节拍数的 hit 截断丢弃 */
function generateDrums(entry: TimelineEntry, groove: Groove, out: AccompanimentEvent[]): void {
  for (const hit of groove.drums) {
    if (hit.beat >= entry.beats) continue;
    out.push({
      track: "drums",
      midi: 0,
      startBeat: entry.startBeat + hit.beat,
      durationBeats: 0.25,
      velocity: hit.velocity,
      piece: hit.piece,
    });
  }
}

/** Piano：每个 unit 内重放模板 hits（换和弦即重起节奏），voicing 由规则生成 */
function generatePiano(
  entry: TimelineEntry,
  groove: Groove,
  previousVoicing: number[] | null,
  out: AccompanimentEvent[],
): number[] | null {
  let voicing = previousVoicing;
  for (const unit of entry.chordUnits) {
    const next = voiceChord(unit.chord, voicing);
    if (next.length > 0) voicing = next;
    if (next.length === 0 || unit.chord.noChord) continue;

    for (const hit of groove.piano) {
      if (hit.beat >= unit.beats) continue;
      const duration = Math.min(hit.durationBeats, unit.beats - hit.beat);
      for (const midi of next) {
        out.push({
          track: "piano",
          midi,
          startBeat: unit.startBeat + hit.beat,
          durationBeats: duration,
          velocity: hit.velocity,
        });
      }
    }
  }
  return voicing;
}

/**
 * Bass：按 bassStyle 生成。
 * - two-feel：小节 1、3 拍落根音（/五音）
 * - walking：逐拍级进，朝下一和弦导音，音域钳制 + 跳进 ≤ 纯四度（偶尔五度）
 * - bossa / root-fifth：根音-五音音型
 */
function generateBass(entry: TimelineEntry, groove: Groove, out: AccompanimentEvent[]): void {
  const units = entry.chordUnits.filter((u) => !u.chord.noChord);
  if (units.length === 0) return;

  const pcsOf = (u: (typeof units)[number]): { root: number; fifth: number } | null => {
    const root = bassPitchClass(u.chord);
    if (root === null) return null;
    return { root, fifth: fifthOf(root) };
  };

  const pushNote = (pc: number, beat: number, duration: number, velocity = 0.7): void => {
    out.push({
      track: "bass",
      midi: nearestMidiWithPc(pc, BASS_LOW, BASS_HIGH, 45),
      startBeat: beat,
      durationBeats: duration,
      velocity,
    });
  };

  switch (groove.bassStyle) {
    case "two-feel": {
      for (const beat of [0, 2]) {
        if (beat >= entry.beats) continue;
        const unit = units.find(
          (u) => u.startBeat <= entry.startBeat + beat && entry.startBeat + beat < u.startBeat + u.beats,
        );
        if (!unit) continue;
        const pcs = pcsOf(unit);
        if (!pcs) continue;
        const pc = beat === 2 && unit.beats >= 2 ? pcs.fifth : pcs.root;
        pushNote(pc, entry.startBeat + beat, Math.min(1.5, entry.beats - beat));
      }
      break;
    }

    case "walking": {
      let prevMidi: number | null = null;
      for (let beat = 0; beat < entry.beats; beat += 1) {
        const abs = entry.startBeat + beat;
        const unit = units.find((u) => u.startBeat <= abs && abs < u.startBeat + u.beats);
        if (!unit) continue; // 空拍：walking 留白
        const pcs = pcsOf(unit);
        if (!pcs) continue;

        const isFirstOfUnit = abs === unit.startBeat;
        if (isFirstOfUnit) {
          const midi = nearestMidiWithPc(pcs.root, BASS_LOW, BASS_HIGH, 45);
          out.push({ track: "bass", midi, startBeat: abs, durationBeats: 1, velocity: 0.75 });
          prevMidi = midi;
          continue;
        }

        // 非首拍：朝下一和弦根音级进导音；无下一和弦时五音-根音交替
        const nextUnit = units[units.indexOf(unit) + 1];
        const nextPc = nextUnit ? bassPitchClass(nextUnit.chord) : null;
        const target = nextPc !== null ? nearestMidiWithPc(nextPc, BASS_LOW, BASS_HIGH, 45) : null;

        let midi: number;
        if (target !== null && prevMidi !== null) {
          // 候选：target ± 1/2 半音（导音），按离 prevMidi 最近排序，限跳进 ≤ 5 半音（纯四度）
          const candidates = [target - 1, target + 1, target - 2, target + 2]
            .filter((m) => m >= BASS_LOW && m <= BASS_HIGH)
            .filter((m) => prevMidi === null || Math.abs(m - prevMidi) <= 5);
          midi =
            candidates.length > 0
              ? candidates.reduce((best, m) =>
                  Math.abs(m - (prevMidi ?? m)) < Math.abs(best - (prevMidi ?? best)) ? m : best,
                )
              : Math.min(BASS_HIGH, Math.max(BASS_LOW, target - 5)); // 允许偶尔五度跳
        } else {
          // 曲尾/无目标：五音
          midi = nearestMidiWithPc(pcs.fifth, BASS_LOW, BASS_HIGH, prevMidi ?? 45);
          if (midi === prevMidi) midi = nearestMidiWithPc(pcs.root, BASS_LOW, BASS_HIGH, (prevMidi ?? 45) + 2);
        }
        out.push({ track: "bass", midi, startBeat: abs, durationBeats: 1, velocity: 0.65 });
        prevMidi = midi;
      }
      break;
    }

    case "bossa": {
      // root(0, 1.5) fifth(1.5, 0.5) root(2, 1.5) fifth(3.5, 0.5)，按 unit 截断
      const pattern: Array<{ beat: number; dur: number; fifth: boolean }> = [
        { beat: 0, dur: 1.5, fifth: false },
        { beat: 1.5, dur: 0.5, fifth: true },
        { beat: 2, dur: 1.5, fifth: false },
        { beat: 3.5, dur: 0.5, fifth: true },
      ];
      for (const unit of units) {
        const pcs = pcsOf(unit);
        if (!pcs) continue;
        for (const p of pattern) {
          if (p.beat >= unit.beats) continue;
          pushNote(p.fifth ? pcs.fifth : pcs.root, unit.startBeat + p.beat, Math.min(p.dur, unit.beats - p.beat), 0.75);
        }
      }
      break;
    }

    case "root-fifth": {
      for (const unit of units) {
        const pcs = pcsOf(unit);
        if (!pcs) continue;
        for (let beat = 0; beat < unit.beats; beat += 1) {
          const useFifth = beat % 2 === 1;
          pushNote(useFifth ? pcs.fifth : pcs.root, unit.startBeat + beat, 1, 0.7);
        }
      }
      break;
    }
  }
}

/* ── 主入口 ───────────────────────────────────────────── */

/**
 * 生成整曲伴奏事件（按时间线顺序，beat 域，已排序）。
 * @param chart - 源曲目（当前未直接消费，保留以支持后续 per-chart 扩展）
 */
export function generateAccompaniment(
  chart: ChordChart,
  timeline: PerformanceTimeline,
  groove: Groove,
): AccompanimentEvent[] {
  void chart;
  const out: AccompanimentEvent[] = [];
  let previousVoicing: number[] | null = null;

  for (const entry of timeline.entries) {
    generateDrums(entry, groove, out);
    previousVoicing = generatePiano(entry, groove, previousVoicing, out);
    generateBass(entry, groove, out);
  }

  out.sort((a, b) => a.startBeat - b.startBeat || a.track.localeCompare(b.track));
  return out;
}
