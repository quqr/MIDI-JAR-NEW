import { ref, shallowRef } from "vue";
import { getChords } from "./useChordDetection";

const midiSortCompareFn = (a: number, b: number) => a - b;

/**
 * 管理 MIDI 音符的响应式状态，包括演奏中、延音中、点击的音符及派生数据。
 *
 * @returns 音符相关的所有响应式状态及更新方法
 */
export function useNoteState() {
  const sustainedMidiNotes = ref<number[]>([]);
  const playedMidiNotes = ref<number[]>([]);
  const clickedMidiNotes = ref<number[]>([]);
  const midiNotes = ref<number[]>([]);
  const notes = ref<string[]>([]);
  const pitchClasses = ref<string[]>([]);
  const chords = shallowRef<ReturnType<typeof getChords>>([]);
  const sustained = ref(false);

  /** 批量更新所有派生状态（MIDI 音符、音名、音级、和弦） */
  function updateDerived(
    newMidiNotes: number[],
    newNotes: string[],
    newPitchClasses: string[],
    newChords: ReturnType<typeof getChords>,
  ) {
    midiNotes.value = newMidiNotes;
    notes.value = newNotes;
    pitchClasses.value = newPitchClasses;
    chords.value = newChords;
  }

  function clearAll() {
    sustainedMidiNotes.value = [];
    playedMidiNotes.value = [];
    clickedMidiNotes.value = [];
    midiNotes.value = [];
    notes.value = [];
    pitchClasses.value = [];
    chords.value = [];
    sustained.value = false;
  }

  /**
   * 合并所有来源的活跃 MIDI 音符（延音 + 演奏中 + 点击），去重并排序。
   *
   * @returns 排序后的 MIDI 音符编号数组
   */
  function aggregateMidiNotes(): number[] {
    const combined = [
      ...sustainedMidiNotes.value,
      ...playedMidiNotes.value,
      ...clickedMidiNotes.value,
    ];
    combined.sort(midiSortCompareFn);
    return combined;
  }

  return {
    sustainedMidiNotes,
    playedMidiNotes,
    clickedMidiNotes,
    midiNotes,
    notes,
    pitchClasses,
    chords,
    sustained,
    updateDerived,
    clearAll,
    aggregateMidiNotes,
  };
}
