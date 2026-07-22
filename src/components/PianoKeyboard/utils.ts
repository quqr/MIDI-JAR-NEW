import { Chord } from "@tonaljs/chord";
import { Note } from "tonal";
import {
  KeySignatureConfig,
  formatSharpsFlats,
  getChordDegrees,
  getChordNotes,
  getNoteInKeySignature,
} from "@/helpers";

import type { KeyboardSettings } from "./types";
import type { PianoSettings } from "@/types";

/**
 * 将 PianoSettings 映射为 KeyboardSettings 的颜色配置
 * @param piano - PianoSettings 对象
 * @returns KeyboardSettings 的 colors 对象
 */
export function mapPianoSettingsToKeyboardColors(
  piano: PianoSettings,
): KeyboardSettings["colors"] {
  return {
    white: piano.whiteKeyColor ?? null,
    black: piano.blackKeyColor ?? null,
    played: piano.pressedKeyColor ?? null,
    wrapped: null,
    sustained: null,
  };
}

/**
 * 从 PianoSettings 创建完整的 KeyboardSettings
 * @param piano - PianoSettings 对象
 * @param overrides - 可选的部分 KeyboardSettings 覆盖项
 * @returns 完整的 KeyboardSettings 对象
 */
export function createKeyboardSettingsFromPiano(
  piano: PianoSettings,
  overrides?: Partial<KeyboardSettings>,
): KeyboardSettings {
  return {
    skin: "classic",
    from: piano.from,
    to: piano.to,
    label:
      piano.label === "none"
        ? "none"
        : piano.label === "pitchClass"
          ? "pitchClass"
          : piano.label === "note"
            ? "note"
            : piano.label === "chordNote"
              ? "chordNote"
              : "interval",
    keyName:
      piano.keyName === "none"
        ? "none"
        : piano.keyName === "octave"
          ? "octave"
          : piano.keyName === "pitchClass"
            ? "pitchClass"
            : "note",
    keyInfo: "none",
    fadeOutDuration: 0,
    textOpacity: 1,
    displaySustained: false,
    wrap: false,
    sizes: {
      radius: piano.keyCornerRadius ?? 0,
      height: 5,
      ratio: 0.6,
      bevel: true,
    },
    colors: mapPianoSettingsToKeyboardColors(piano),
    ...overrides,
  };
}

// ── Strategy interface for highlight logic ──────────────────────────

/**
 * 键盘高亮策略接口，定义了如何获取高亮音符、判断是否应用策略等行为
 */
export interface HighlightStrategy {
  getNotes: () => number[] | undefined;
  className: string;
  wrapClassName?: string;
  shouldApply: (keyboard: KeyboardSettings) => boolean;
  getLabelNotes?: (keyboard: KeyboardSettings) => number[] | undefined;
}

export const FADE_CLASSES = [
  "played",
  "sustained",
  "wrapPlayed",
  "wrapSustained",
  "exactTarget",
  "wrapExactTarget",
] as const;

/**
 * 移除所有高亮效果（包括演奏态、目标态和标签）
 * @param el - 钢琴键盘容器元素
 */
export function fadeAllHighlights(el: HTMLElement) {
  for (const cls of FADE_CLASSES) {
    fadeNotes(el, cls);
  }
  fadeTargets(el);
  fadeLabels(el);
}

/**
 * 根据策略对键盘应用高亮效果，包括音符高亮、wrap 高亮和标签
 * @param el - 钢琴键盘容器元素
 * @param strategy - 高亮策略
 * @param keyboard - 键盘配置
 * @param keySignature - 调号配置
 * @param chord - 当前和弦（可选）
 */
export function applyHighlightStrategy(
  el: HTMLElement,
  strategy: HighlightStrategy,
  keyboard: KeyboardSettings,
  keySignature: KeySignatureConfig,
  chord?: Chord,
) {
  const notes = strategy.getNotes();
  if (!notes || notes.length === 0) return;

  highlightNotes(el, notes, strategy.className);

  if (keyboard.wrap && strategy.wrapClassName) {
    highlightWrapNotes(
      el,
      keyboard.from,
      keyboard.to,
      notes,
      strategy.wrapClassName,
    );
  }

  const labelNotes = strategy.getLabelNotes?.(keyboard);
  if (labelNotes) {
    highlightLabels(el, keySignature, keyboard, labelNotes, chord);

    if (keyboard.wrap) {
      highlightWrapLabels(el, keySignature, keyboard, labelNotes, chord);
    }
  }
}

// ── Original utilities ─────────────────────────────────────────────

/**
 * 将超出键盘范围的 MIDI 音符按八度折回到范围内
 * 超出范围的音符会找到最近的同音名替代位置
 * @param from - 键盘起始音名
 * @param to - 键盘结束音名
 * @param midiNotes - 原始 MIDI 音符列表
 * @returns 折回后的 MIDI 音符，无需折回的位置返回 null
 */
function wrapMidiNotes(
  from: string,
  to: string,
  midiNotes: number[],
): (number | null)[] {
  const start = Note.midi(Note.simplify(from)) ?? 0;
  const end = Note.midi(Note.simplify(to)) ?? 127;

  return midiNotes.map((midi) => {
    if (midi < start) {
      const diff = 12 - ((start - midi) % 12);
      return diff === 12 ? start : start + diff;
    }

    if (midi > end) {
      const diff = 12 - ((midi - end) % 12);
      return diff === 12 ? end : end - diff;
    }

    return null;
  });
}

export const highlight = (
  containerEl: HTMLElement,
  type: "midi" | "chroma" | "name",
  value: number | string,
  className: string,
) => {
  const elements = containerEl.querySelectorAll(`.${type}-${value}`);
  if (elements && elements.length) {
    for (let i = 0; i < elements.length; i += 1) {
      elements[i].classList.add(className);
    }
  }
};

export const fade = (containerEl: HTMLElement, className: string) => {
  const elements = containerEl.querySelectorAll(`.${className}`);

  if (elements && elements.length) {
    for (let i = 0; i < elements.length; i += 1) {
      elements[i].classList.remove(className);
    }
  }
};

export const highlightNotes = (
  containerEl: HTMLElement,
  midi: number[],
  className = "active",
) => {
  for (let i = 0; i < midi.length; i += 1) {
    highlight(containerEl, "midi", midi[i], className);
  }
};

/**
 * 对超出键盘范围的 MIDI 音符进行 wrap 高亮（八度折回）
 * @param containerEl - 钢琴键盘容器元素
 * @param from - 键盘起始音名
 * @param to - 键盘结束音名
 * @param midi - 需要高亮的 MIDI 音符列表
 * @param className - 高亮 CSS 类名
 */
export const highlightWrapNotes = (
  containerEl: HTMLElement,
  from: string,
  to: string,
  midi: number[],
  className = "wrapped",
) => {
  const wrappedMidiNotes = wrapMidiNotes(from, to, midi);

  for (let i = 0; i < wrappedMidiNotes.length; i += 1) {
    const wrappedMidi = wrappedMidiNotes[i];
    if (wrappedMidi !== null) {
      highlight(containerEl, "midi", wrappedMidi, className);
    }
  }
};

export const fadeNotes = (containerEl: HTMLElement, className = "active") => {
  fade(containerEl, className);
};

/**
 * 在键盘上显示和弦信息（根音标记为 tonic，其他音标记音程）
 * @param containerEl - 钢琴键盘容器元素
 * @param keyInfo - 信息显示模式："none" | "tonic" | "interval" | "tonicAndInterval"
 * @param chord - 当前和弦
 */
export const highlightInfo = (
  containerEl: HTMLElement,
  keyInfo: KeyboardSettings["keyInfo"],
  chord?: Chord,
) => {
  if (keyInfo === "none") return;

  if (!chord) return;

  for (let n = 0; n < chord.notes.length; n += 1) {
    const chroma = Note.chroma(chord.notes[n]);
    const interval = chord.intervals[n];

    const elements = containerEl.querySelectorAll(`.chroma-${chroma}`);
    if (elements && elements.length) {
      for (let i = 0; i < elements.length; i += 1) {
        if (
          interval === "1P" &&
          (keyInfo === "tonic" || keyInfo === "tonicAndInterval")
        ) {
          elements[i].classList.add("tonic");
        } else if (keyInfo === "interval" || keyInfo === "tonicAndInterval") {
          elements[i].classList.add("info");
          const intervalEl = elements[i].querySelector(".pianoInfo");
          if (intervalEl) {
            intervalEl.textContent = interval;
          }
        }
      }
    }
  }
};

export const fadeInfo = (containerEl: HTMLElement) => {
  fade(containerEl, "tonic");
  const elements = containerEl.querySelectorAll(`.info`);

  if (elements && elements.length) {
    for (let i = 0; i < elements.length; i += 1) {
      elements[i].classList.remove("info");

      const intervalEl = elements[i].querySelector(".pianoInfo");
      if (intervalEl) {
        intervalEl.textContent = "";
      }
    }
  }
};

const highlightLabel = (
  containerEl: HTMLElement,
  midi: number,
  text: string,
) => {
  const elements = containerEl.querySelectorAll(`.label-${midi}`);

  if (elements && elements.length) {
    for (let i = 0; i < elements.length; i += 1) {
      elements[i].classList.add("labelled");

      elements[i].textContent = text;
    }
  }
};

/**
 * 根据标签模式在键盘上显示音符标签（音名、音级或和弦音名）
 * @param containerEl - 钢琴键盘容器元素
 * @param keySignature - 调号配置
 * @param keyboard - 键盘配置
 * @param midi - 需要标记的 MIDI 音符列表
 * @param chord - 当前和弦（音程/和弦音名模式下需要）
 */
export const highlightLabels = (
  containerEl: HTMLElement,
  keySignature: KeySignatureConfig,
  keyboard: KeyboardSettings,
  midi?: number[],
  chord?: Chord,
) => {
  if (!midi) return;

  if (keyboard.label === "interval") {
    if (chord) {
      const intervals = getChordDegrees(
        chord,
        midi.map((midiNote) => Note.pitchClass(Note.fromMidi(midiNote))),
      );

      for (let i = 0; i < midi.length; i += 1) {
        highlightLabel(containerEl, midi[i], intervals[i]);
      }
    }
  } else if (keyboard.label === "chordNote") {
    if (chord) {
      const notes = getChordNotes(
        chord,
        midi.map((midiNote) => Note.pitchClass(Note.fromMidi(midiNote))),
      );

      for (let i = 0; i < midi.length; i += 1) {
        highlightLabel(containerEl, midi[i], formatSharpsFlats(notes[i]));
      }
    }
  } else {
    for (let i = 0; i < midi.length; i += 1) {
      const note = Note.get(Note.fromMidi(midi[i]));

      if (keyboard.label === "note") {
        const displayName = formatSharpsFlats(
          getNoteInKeySignature(note.name, keySignature.notes),
        );

        highlightLabel(containerEl, midi[i], displayName);
      } else if (keyboard.label === "pitchClass") {
        const displayName = formatSharpsFlats(
          getNoteInKeySignature(Note.pitchClass(note), keySignature.notes),
        );

        highlightLabel(containerEl, midi[i], displayName);
      }
    }
  }
};

/**
 * 对 wrap 折回后的音符显示标签
 * @param containerEl - 钢琴键盘容器元素
 * @param keySignature - 调号配置
 * @param keyboard - 键盘配置
 * @param midi - 原始 MIDI 音符列表
 * @param chord - 当前和弦（可选）
 */
export const highlightWrapLabels = (
  containerEl: HTMLElement,
  keySignature: KeySignatureConfig,
  keyboard: KeyboardSettings,
  midi?: number[],
  chord?: Chord,
) => {
  if (!midi) return;

  const wrappedMidiNotes = wrapMidiNotes(keyboard.from, keyboard.to, midi);

  if (keyboard.label === "interval") {
    if (chord) {
      const intervals = getChordDegrees(
        chord,
        wrappedMidiNotes.map((midiNote) =>
          midiNote ? Note.pitchClass(Note.fromMidi(midiNote)) : "",
        ),
      );

      for (let i = 0; i < midi.length; i += 1) {
        const wrappedMidiNote = wrappedMidiNotes[i];
        if (wrappedMidiNote !== null) {
          highlightLabel(containerEl, wrappedMidiNote, intervals[i]);
        }
      }
    }
  } else {
    for (let i = 0; i < midi.length; i += 1) {
      const wrappedMidiNote = wrappedMidiNotes[i];
      if (wrappedMidiNote !== null) {
        const note = Note.get(Note.fromMidi(midi[i]));

        if (keyboard.label === "note") {
          const displayName = formatSharpsFlats(
            getNoteInKeySignature(note.name, keySignature.notes),
          );

          highlightLabel(containerEl, wrappedMidiNote, displayName);
        } else if (keyboard.label === "pitchClass") {
          const displayName = formatSharpsFlats(
            getNoteInKeySignature(Note.pitchClass(note), keySignature.notes),
          );

          highlightLabel(containerEl, wrappedMidiNote, displayName);
        }
      }
    }
  }
};

export const fadeLabels = (containerEl: HTMLElement) => {
  fade(containerEl, "labelled");
};

/**
 * 在键盘上高亮所有同音名的目标音（按 chroma 匹配）
 * @param containerEl - 钢琴键盘容器元素
 * @param targets - 目标 MIDI 音符列表
 */
export const highlightTargets = (
  containerEl: HTMLElement,
  targets: number[],
) => {
  if (!targets) return;

  for (let n = 0; n < targets.length; n += 1) {
    const chroma = Note.chroma(Note.fromMidi(targets[n]));

    const elements = containerEl.querySelectorAll(`.chroma-${chroma}`);
    if (elements && elements.length) {
      for (let i = 0; i < elements.length; i += 1) {
        elements[i].classList.add("target");
      }
    }
  }
};

export const fadeTargets = (containerEl: HTMLElement) => {
  fade(containerEl, "target");
};
