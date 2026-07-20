import { computed } from "vue";
import type { ComputedRef } from "vue";
import { Note } from "tonal";

import type {
  KeyboardSettings,
  ClassicKeyboardKeys,
  ClassicNoteDef,
  FlatKeyboardKeys,
  FlatNoteDef,
} from "../types";
import {
  getKeyboardSizes as getClassicSizes,
  getChromaNoteOffset,
} from "../classic/constants";
import type { ClassicKeyboardSizes } from "../classic/constants";
import { getKeyboardSizes as getFlatSizes } from "../flat/constants";
import type { FlatKeyboardSizes } from "../flat/constants";

export interface ClassicKeyLayout {
  keys: ClassicKeyboardKeys;
  sizes: ClassicKeyboardSizes;
}

export interface FlatKeyLayout {
  keys: FlatKeyboardKeys;
  sizes: FlatKeyboardSizes;
}

export interface UseKeyLayoutReturn {
  classicKeys: ComputedRef<ClassicKeyLayout>;
  flatKeys: ComputedRef<FlatKeyLayout>;
}

/**
 * 键盘布局计算 composable
 *
 * 根据 KeyboardSettings 计算 classic / flat 两种皮肤的键盘布局：
 * 键位偏移、白黑键尺寸、音名显示、标签偏移等。
 *
 * @param keyboard - 返回当前键盘配置的 getter（保持响应式追踪）
 */
export function useKeyLayout(
  keyboard: () => KeyboardSettings,
): UseKeyLayoutReturn {
  function buildClassicKeys(): ClassicKeyLayout {
    const kb = keyboard();
    const sizes = getClassicSizes(kb);
    const fromNote = Note.get(Note.simplify(kb.from) || "C3");
    const toNote = Note.get(Note.simplify(kb.to) || "B5");

    const noteStart = fromNote.alt
      ? (fromNote.midi ?? 0) - 1
      : (fromNote.midi ?? 0);
    const noteEnd = toNote.alt ? (toNote.midi ?? 0) + 1 : (toNote.midi ?? 0);
    const start = Math.min(noteStart, noteEnd);
    const end = Math.max(noteStart, noteEnd);

    const keys: ClassicKeyboardKeys = {
      width: 0,
      height: sizes.WHITE_HEIGHT,
      whites: [],
      blacks: [],
      labels: [],
    };

    for (let midi = start; midi <= end; midi++) {
      const note = Note.fromMidi(midi);
      const noteDef = Note.get(note);

      let displayName = "";

      switch (kb.keyName) {
        case "note":
          displayName = note;
          break;
        case "pitchClass":
          displayName = Note.pitchClass(note);
          break;
        case "octave":
          displayName = noteDef.chroma === 0 ? note : "";
          break;
      }

      const noteDefData = {
        displayName,
        name: noteDef.name,
        chroma: noteDef.chroma ?? 0,
        midi: noteDef.midi ?? 0,
      };

      if (noteDef.alt) {
        const offsetX = getChromaNoteOffset(noteDef.chroma) * sizes.BLACK_OFFSET;

        const def: ClassicNoteDef = {
          ...noteDefData,
          offset: keys.width - sizes.BLACK_WIDTH / 2 + offsetX,
          labelOffset: keys.width + offsetX,
        };

        keys.blacks.push(def);
        keys.labels.push(def);
      } else {
        const offsetX =
          (getChromaNoteOffset(noteDef.chroma) *
            (sizes.WHITE_WIDTH - sizes.BLACK_WIDTH)) /
          2;

        const def: ClassicNoteDef = {
          ...noteDefData,
          offset: keys.width,
          labelOffset: keys.width + sizes.WHITE_WIDTH / 2 + offsetX,
        };

        keys.width += sizes.WHITE_WIDTH;
        keys.whites.push(def);
        keys.labels.push(def);
      }
    }

    return { keys, sizes };
  }

  function buildFlatKeys(): FlatKeyLayout {
    const kb = keyboard();
    const sizes = getFlatSizes(kb);
    const fromNote = Note.get(Note.simplify(kb.from) || "C3");
    const toNote = Note.get(Note.simplify(kb.to) || "B5");

    const noteStart = fromNote.midi ?? 0;
    const noteEnd = toNote.midi ?? 0;
    const start = Math.min(noteStart, noteEnd);
    const end = Math.max(noteStart, noteEnd);

    const keys: FlatKeyboardKeys = {
      width: 0,
      height: sizes.HEIGHT,
      notes: [],
    };

    for (let midi = start; midi <= end; midi++) {
      const note = Note.fromMidi(midi);
      const noteDef = Note.get(note);

      let displayName = "";

      switch (kb.keyName) {
        case "note":
          displayName = note;
          break;
        case "pitchClass":
          displayName = Note.pitchClass(note);
          break;
        case "octave":
          displayName = noteDef.chroma === 0 ? note : "";
          break;
      }

      const def: FlatNoteDef = {
        displayName,
        name: noteDef.name,
        chroma: noteDef.chroma ?? 0,
        midi: noteDef.midi ?? 0,
        offset: keys.width,
        labelOffset: keys.width + sizes.WIDTH / 2,
        isBlack: !!noteDef.alt,
      };

      keys.width += sizes.WIDTH;
      keys.notes.push(def);
    }

    return { keys, sizes };
  }

  const classicKeys = computed(() => buildClassicKeys());
  const flatKeys = computed(() => buildFlatKeys());

  return { classicKeys, flatKeys };
}
