import { getKeySignature } from "@/helpers/note";
import { useSamplerService } from "./useSamplerService";

export interface ScalePlayerOptions {
  /** 当前调式（如 "C", "G", "F#"） */
  key?: string;
  /** 起始八度（默认 4） */
  startOctave?: number;
  /** 每音符时长（毫秒，默认 500） */
  duration?: number;
  /** 播放方向：up（上行）、down（下行）、both（上下行） */
  direction?: "up" | "down" | "both";
}

/**
 * 音阶播放器 composable
 *
 * 用于播放当前调式的大调音阶。支持上行、下行、上行+下行三种模式。
 */
export function useScalePlayer() {
  const samplerService = useSamplerService();

  /**
   * 播放音阶
   */
  async function playScale(options: ScalePlayerOptions = {}): Promise<void> {
    const {
      key = "C",
      startOctave = 4,
      duration = 500,
      direction = "both",
    } = options;

    // 获取音阶音符（如 ["C", "D", "E", "F", "G", "A", "B"]）
    const keySignature = getKeySignature(key);
    const scaleNotes = [...keySignature.scale];

    // 构建上行音符列表
    const upNotes = scaleNotes.map((note) => `${note}${startOctave}`);
    // 添加高八度的主音
    const tonicUp = `${scaleNotes[0]}${startOctave + 1}`;

    // 构建下行音符列表
    const downNotes = [...upNotes.slice().reverse().slice(1), tonicUp].reverse();

    let notesToPlay: string[];

    switch (direction) {
      case "up":
        notesToPlay = [...upNotes, tonicUp];
        break;
      case "down":
        notesToPlay = [tonicUp, ...downNotes];
        break;
      case "both":
      default:
        notesToPlay = [...upNotes, tonicUp, ...downNotes.slice(1)];
        break;
    }

    // 顺序播放音符
    for (const note of notesToPlay) {
      samplerService.playNote(note, 80, duration / 1000);
      await sleep(duration);
    }
  }

  /**
   * 停止所有音符
   */
  function stopScale(): void {
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