import { Key, Note } from "tonal";
import { getKeySignature } from "@/helpers/note";
import { useSamplerService } from "./useSamplerService";

/** 音阶类型 */
export type ScaleMode = "major" | "minor";

export interface ScalePlayerOptions {
  /** 当前调式（如 "C", "G", "F#"）。小调传**主音字母**（如 "A"），不含 "m" */
  key?: string;
  /** 起始八度（默认 4） */
  startOctave?: number;
  /** 每音符时长（毫秒，默认 500） */
  duration?: number;
  /** 播放方向：up（上行）、down（下行）、both（上下行） */
  direction?: "up" | "down" | "both";
  /** 音阶类型（默认 major）；小调取自然小调 */
  mode?: ScaleMode;
  /** 每个音符发声前回调，用于与可视化同步 */
  onNote?: (info: { note: string; index: number; total: number }) => void;
}

/**
 * 音阶播放器 composable
 *
 * 播放指定调式的大调 / 自然小调音阶，支持上行、下行、上行+下行三种模式。
 * 带运行令牌：新的播放会作废旧的一次，`stopScale` 也能真正掐断在途循环。
 */
export function useScalePlayer() {
  const samplerService = useSamplerService();

  /** 运行令牌——每次播放自增，用于作废在途的旧循环 */
  let runToken = 0;

  /**
   * 取音阶音名。
   * 小调走 `Key.minorKey(...).natural`——注意该 API 只接受**主音字母**，
   * 传 "Am" 会静默返回空音阶。
   */
  function scaleNotesOf(key: string, mode: ScaleMode): string[] {
    if (mode === "minor") {
      const natural = Key.minorKey(key).natural.scale;
      if (natural.length) return [...natural];
      // 非法主音时退回大调解析，至少不静默无声
      return [...getKeySignature(key).scale];
    }
    return [...getKeySignature(key).scale];
  }

  /**
   * 播放音阶
   */
  async function playScale(options: ScalePlayerOptions = {}): Promise<void> {
    const {
      key = "C",
      startOctave = 4,
      duration = 500,
      direction = "both",
      mode = "major",
      onNote,
    } = options;

    // 作废上一次仍在循环中的播放，避免连续点击叠加成多条音阶
    const token = ++runToken;
    samplerService.stopAllNotes();

    const scaleNotes = scaleNotesOf(key, mode);
    if (!scaleNotes.length) return;

    const octave = (note: string) => `${note}${startOctave}`;

    // 上行：音阶七音 + 高八度主音
    const upNotes = scaleNotes.map(octave);
    const tonicUp = `${scaleNotes[0]}${startOctave + 1}`;
    const ascending = [...upNotes, tonicUp];
    const descending = ascending.slice().reverse();

    let notesToPlay: string[];
    switch (direction) {
      case "up":
        notesToPlay = ascending;
        break;
      case "down":
        notesToPlay = descending;
        break;
      case "both":
      default:
        // 上行到顶后原路下行（去掉重复的顶端音）
        notesToPlay = [...ascending, ...descending.slice(1)];
        break;
    }

    const total = notesToPlay.length;

    for (let index = 0; index < total; index++) {
      if (token !== runToken) return;
      const note = notesToPlay[index];

      onNote?.({ note, index, total });

      // 统一转 MIDI 数字：音阶里可能出现 E# / B#（F# 大调、C# 大调），
      // 采样器未必认这种拼写。
      const midi = Note.midi(note);
      samplerService.playNote(midi ?? note, 80, duration / 1000);

      await sleep(duration);
    }
  }

  /**
   * 停止播放（含掐断在途循环）
   */
  function stopScale(): void {
    runToken += 1;
    samplerService.stopAllNotes();
  }

  return {
    playScale,
    stopScale,
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
