import { Key, Note, Range } from "tonal";

export type KeySignatureConfig = {
  alteration: number;
  tonic: string;
  notes: readonly string[];
  scale: readonly string[];
};

export const NOTE_NAMES = [
  "C",
  "C#",
  "D",
  "D#",
  "E",
  "F",
  "F#",
  "G",
  "G#",
  "A",
  "A#",
  "B",
];

const REGEX_FLAT = /b/g;
const REGEX_SHARP = /#/g;

const FLAT = "♭";
const SHARP = "♯";

/**
 * 根据调号音阶生成一个八度内的音名列表，音阶内的音使用音阶音名，其余使用自然音名
 * @param scale - 调号音阶的音名列表
 * @param useSharps - 是否使用升号记法
 * @returns 一个八度（C4-B4）内的音名列表
 */
const getKeySignatureNotes = (scale: string[], useSharps = false) => {
  const scaleChromas = scale.map(Note.chroma);
  const range = Range.chromatic(["C4", "B4"], {
    sharps: useSharps,
    pitchClass: true,
  }).map((note, chroma) => {
    const noteInScale = scaleChromas.indexOf(chroma);
    return noteInScale > -1 ? scale[noteInScale] : note;
  });

  return range;
};

/**
 * 获取指定音名的大调调号信息，包括升降号数量、主音、音阶和音符列表
 * 当升降号数超出 ±7 范围时会自动规范化到等价调
 * @param note - 主音名称（如 "C"、"F#"）
 * @param useSharps - 升降号为 0 时是否优先使用升号
 * @returns 调号配置对象
 */
export const getKeySignature = (
  note: string,
  useSharps = false,
): KeySignatureConfig => {
  let majorKey = Key.majorKey(note);
  if (!majorKey.tonic) {
    majorKey = Key.majorKey("C");
  }

  if (majorKey.alteration > 7) {
    majorKey = Key.majorKey(
      Note.transposeFifths(
        majorKey.tonic,
        ~~((majorKey.alteration + 12) / 12) * -12,
      ),
    );
  }
  if (majorKey.alteration < -7) {
    majorKey = Key.majorKey(
      Note.transposeFifths(
        majorKey.tonic,
        ~~((majorKey.alteration - 12) / 12) * -12,
      ),
    );
  }

  const sharps =
    majorKey.alteration === 0 ? useSharps : majorKey.alteration > 0;
  const scale = [...majorKey.scale];
  const notes = getKeySignatureNotes(scale, sharps);

  return {
    alteration: majorKey.alteration,
    tonic: majorKey.tonic,
    notes,
    scale,
  };
};

/**
 * 将音符转换为调号中的等价音名（如 C# 在 D 大调中显示为 Db）
 * @param note - 原始音符名称
 * @param keySignatureNotes - 调号音符列表（由 getKeySignature 返回的 notes）
 * @returns 调号内的等价音名，无匹配时返回原音名
 */
export const getNoteInKeySignature = (
  note: string,
  keySignatureNotes?: readonly string[],
) => {
  const chroma = Note.chroma(note);

  if (chroma !== undefined && keySignatureNotes && keySignatureNotes[chroma]) {
    return Note.enharmonic(note, keySignatureNotes[chroma]);
  }

  return note;
};

export const formatSharpsFlats = (str: string) =>
  str ? str.replace(REGEX_FLAT, FLAT).replace(REGEX_SHARP, SHARP) : str;
