import { Chord, Interval } from "tonal";
import { getNoteInKeySignature } from "@/helpers";
import { detect } from "@/helpers/chord-detect";
import { tokenizeChord } from "@/helpers";

interface ChordInfo extends ReturnType<typeof Chord.getChord> {
  symbol: string;
  root: string;
  rootInterval: string;
  rootDegree: number;
}

/**
 * 将和弦符号转换为包含详细信息的 ChordInfo 对象。
 * 解析和弦根音、类型、转位，并在当前调号下计算转位音程与度数。
 *
 * @param chord - 和弦符号，如 "Cmaj7/D"
 * @param keySignatureNotes - 当前调号的音名列表，用于升降号映射
 * @returns 和弦信息对象，解析失败返回 null
 */
function getChordInfo(
  chord: string,
  keySignatureNotes: readonly string[],
): ChordInfo | null {
  const [tonic, type, root] = tokenizeChord(chord);
  if (tonic) {
    const tonicInKey = getNoteInKeySignature(tonic, keySignatureNotes);
    const rootInKey = getNoteInKeySignature(root, keySignatureNotes);
    // Use "M" (major) as default chord type when type is empty
    // (e.g., Chord.detect returns "C" for C major)
    const chordType = type || "M";
    const c = Chord.getChord(chordType, tonicInKey);
    const rootInterval = Interval.distance(tonicInKey, rootInKey);
    const rootDegree = c.intervals.indexOf(rootInterval) + 1;
    return { ...c, symbol: chord, root, rootInterval, rootDegree };
  }
  return null;
}

/**
 * 根据当前演奏的音名列表检测可能的和弦。
 *
 * @param notes - 当前活跃的音名列表
 * @param keySignatureNotes - 当前调号的音名列表，用于升降号映射
 * @param disabledChords - 需要排除的和弦名称列表
 * @returns 检测到的和弦信息数组（可能包含 null 项）
 */
export function getChords(
  notes: string[],
  keySignatureNotes: readonly string[],
  disabledChords: string[] = [],
) {
  return detect(notes, { disabledChords }).map((n) =>
    getChordInfo(n, keySignatureNotes),
  );
}
