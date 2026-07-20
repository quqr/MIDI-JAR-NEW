import { Note } from "tonal";
import * as ChordType from "@tonaljs/chord-type";
import { Chord as TChord } from "@tonaljs/chord";
import { isSubsetOf } from "@tonaljs/pcset";

import { stringRotate } from "./string";
import { KeySignatureConfig } from "./note";

export const CHORD_NAME_REGEX =
  /^(([A-G])([b]+|[#]+)?)(.*?)(\/([A-G]([b]+|[#]+)?))?$/;

export const CHORD_TYPE_SPECIALCASE_TOKEN =
  "6/9|6/11|6/13|no[0-9]{1,2}|quartal";
export const CHORD_TYPE_QUALITY_TOKEN =
  "(min|maj|Maj|m/maj?|M|m|-|\\+|aug|dim|dom|sus|o|Δ|^|°|ø|q)(6/9|6/11|6/13|[0-9]{1,2})?";

export const CHORD_TYPE_ALTERATIONS_TOKEN = "(add)?(b|#)?[0-9]{1,2}";

export enum ALIAS_NOTATION {
  long = 0,
  short = 1,
  symbol = 2,
}

const IN_KEY_SCALE_CHROMA = "101011010101";

export const CHORD_TYPE_REGEX = new RegExp(
  `^(${CHORD_TYPE_SPECIALCASE_TOKEN}|${CHORD_TYPE_ALTERATIONS_TOKEN}|${CHORD_TYPE_QUALITY_TOKEN})`,
);
/**
 * 将和弦名称拆分为 [根音, 和弦类型, 转位根音]
 * @param chordName - 和弦名称（如 "Cm7/Eb"）
 * @returns 拆分结果数组 [根音, 类型, 转位根音]
 * @throws 和弦名称无法解析时抛出错误
 */
export const tokenizeChord = (chordName: string): string[] => {
  const match = chordName.match(CHORD_NAME_REGEX);
  if (match) {
    const key = match[1];
    const type = match[4];
    const root = match[6];

    return [key, type, root];
  }

  throw new Error(`Chord parsing error: "${chordName}"`);
};

/**
 * 将和弦类型字符串拆分为语义 token 列表（如 "m7b5" → ["m", "7", "b5"]）
 * @param chordType - 和弦类型字符串
 * @returns token 列表
 */
export const tokenizeChordType = (chordType: string): string[] => {
  let remains = chordType;
  const tokens = [];
  if (
    remains.startsWith("o") ||
    remains.startsWith("ø") ||
    remains.startsWith("add")
  ) {
    tokens.push("");
  }
  while (remains.length) {
    const match: RegExpMatchArray | null = remains.match(CHORD_TYPE_REGEX);

    if (match && match[1].length) {
      tokens.push(match[1]);
      remains = remains.substring(match[1].length);
    } else {
      tokens.push(remains.substring(0, 1));
      remains = remains.substring(1);
    }
  }

  return tokens;
};

/**
 * 将和弦品质中的连字符替换为数学减号（用于更美观的显示）
 * @param quality - 和弦品质字符串
 * @returns 替换后的品质字符串
 */
export function formatQuality(quality: string) {
  return quality ? quality.replace(/-/g, "−") : "";
}

/**
 * 获取给定 pitch class 在和弦中对应的音程度数
 * @param chord - 和弦实例
 * @param pitchClasses - pitch class 列表
 * @returns 对应的音程度数列表，不在和弦中的音返回空字符串
 */
export function getChordDegrees(
  chord: TChord,
  pitchClasses: readonly string[],
) {
  return pitchClasses.map((pc: string) => {
    const i = chord.notes.findIndex(
      (note) => Note.chroma(note) === Note.chroma(pc),
    );
    if (i < 0) return "";

    return chord.intervals[i];
  });
}

/**
 * 获取给定 pitch class 在和弦中对应的完整音名
 * @param chord - 和弦实例
 * @param pitchClasses - pitch class 列表
 * @returns 对应的音名列表，不在和弦中的音返回空字符串
 */
export function getChordNotes(chord: TChord, pitchClasses: string[]) {
  return pitchClasses.map((pc: string) => {
    const i = chord.notes.findIndex(
      (note) => Note.chroma(note) === Note.chroma(pc),
    );
    if (i < 0) return "";

    return chord.notes[i];
  });
}

/**
 * 获取指定调号中包含某音的所有自然和弦（即和弦音全部属于该调的音阶）
 * @param keySignature - 调号配置
 * @param chroma - 根音的 chroma 值
 * @returns 属于该调的和弦类型列表
 */
export function getChordsInKey(
  keySignature: KeySignatureConfig,
  chroma: number | null,
) {
  if (chroma === null) return [];

  const keyChroma = Note.chroma(keySignature.tonic) ?? 0;
  const scaleChroma = stringRotate(IN_KEY_SCALE_CHROMA, chroma - keyChroma);
  const isInKey = isSubsetOf(scaleChroma);

  return ChordType.all().filter((chord) => isInKey(chord.chroma));
}

export function containsInterval(
  chord: ChordType.ChordType | TChord,
  interval: string,
) {
  return chord.intervals.some((i: string) => i.startsWith(interval));
}

export function isSameChord(a: TChord, b: TChord) {
  return a.symbol === b.symbol;
}

export function getChordTypes() {
  return ChordType.all();
}
