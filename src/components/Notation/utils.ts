import { Voice, StaveNote } from "vexflow";
import { Note } from "tonal";
import { getNoteInKeySignature } from "@/helpers";
import type {
  NotationDisplayConfig,
  NotationLayoutConfig,
  NotationStyleConfig,
} from "./types";
import {
  defaultDisplayConfig,
  defaultLayoutConfig,
  defaultStyleConfig,
} from "./types";

const NOTE_REGEX = /([a-g])(b|#)?(\d+)/i;
const NOTE_C4_MIDI = Note.midi("C4") as number;

/** VexFlow 音符表示，包含音名键、变音记号、谱号和 MIDI 编号 */
type VexNote = {
  key: string;
  accidental: string | null;
  clef: "treble" | "bass";
  midi: number;
};

/**
 * 将音符字符串转换为 VexFlow 内部表示
 * @param note - 音符字符串（如 "C#4"、"Bb3"）
 * @returns VexNote 对象，解析失败返回 null
 */
export const noteToVex = (note: string): VexNote | null => {
  const match = note.match(NOTE_REGEX);
  const midi = Note.midi(note);

  if (match && midi) {
    return {
      key: `${match[1]}${match[2] || ""}/${match[3]}`.toLowerCase(),
      accidental: match[2] || null,
      clef: midi >= NOTE_C4_MIDI ? "treble" : "bass",
      midi,
    };
  }
  return null;
};

/**
 * 将音符列表构建为 VexFlow Voice 对象，按谱号过滤、去重并排序
 * @param notes - 音符字符串列表
 * @param clef - 目标谱号
 * @param filterClef - 是否按谱号过滤音符，默认为 true
 * @param duration - VexFlow 音符时值（"1"=全音符, "2"=二分音符, "4"=四分音符等），默认为 "1"
 * @returns 包含音符的 Voice 对象，无有效音符时返回 null
 */
export const getVoice = (
  notes: string[],
  clef: "treble" | "bass",
  filterClef = true,
  duration: string = "1",
) => {
  const voice = new Voice();

  let voiceNotes = notes
    .map(noteToVex)
    .filter(
      (vn): vn is VexNote => vn !== null && (!filterClef || vn.clef === clef),
    );

  voiceNotes = deduplicateVexNotes(voiceNotes);
  voiceNotes = sortVexNotes(voiceNotes);

  if (voiceNotes.length) {
    const staveNote = new StaveNote({
      keys: voiceNotes.map((vn) => vn.key),
      duration,
      clef,
    });

    voice.addTickables([staveNote]);

    return voice;
  }

  return null;
};

function deduplicateVexNotes(notes: VexNote[]): VexNote[] {
  const seen = new Set<string>();
  return notes.filter((vn) => {
    if (seen.has(vn.key)) return false;
    seen.add(vn.key);
    return true;
  });
}

function sortVexNotes(notes: VexNote[]): VexNote[] {
  return [...notes].sort((a, b) => a.midi - b.midi);
}

/**
 * 对 MIDI 音符列表进行移调，并根据调号格式化音符名称
 * @param midiNotes - 原始 MIDI 音符列表
 * @param keySignatureNotes - 调号音符列表，用于确定升降号
 * @param transpose - 移调半音数，默认为 0
 * @returns 移调后的音符名称列表
 */
export const getTransposedNotes = (
  midiNotes: number[],
  keySignatureNotes: readonly string[],
  transpose = 0,
) => {
  return midiNotes
    .map((m) => Note.fromMidi(m + transpose))
    .filter((m) => typeof m === "string")
    .map((n) => getNoteInKeySignature(n, keySignatureNotes));
};

export function mergeDisplayConfig(
  partial?: Partial<NotationDisplayConfig>,
): NotationDisplayConfig {
  return { ...defaultDisplayConfig, ...partial };
}

export function mergeLayoutConfig(
  partial?: Partial<NotationLayoutConfig>,
): NotationLayoutConfig {
  return { ...defaultLayoutConfig, ...partial };
}

export function mergeStyleConfig(
  partial?: Partial<NotationStyleConfig>,
): NotationStyleConfig {
  return { ...defaultStyleConfig, ...partial };
}
