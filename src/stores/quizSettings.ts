import { ref } from "vue";
import { defineStore } from "pinia";

import type { ChordQuizSettings, NotationSettings } from "@/types/settings";

export const defaultChordQuizSettings: ChordQuizSettings = {
  mode: "random",
  difficulty: 0,
  gameLength: 10,
  gamification: true,
  chordNotation: "long",
  displayName: true,
  displayReaction: true,
  displayIntervals: false,
};

export const defaultNotationSettings: NotationSettings = {
  key: "C",
  accidentals: "flat",
  staffClef: "both",
  staffTranspose: 0,
};

export const useQuizSettingsStore = defineStore("quizSettings", () => {
  const chordQuiz = ref<ChordQuizSettings>({ ...defaultChordQuizSettings });
  const notation = ref<NotationSettings>({ ...defaultNotationSettings });

  function updateChordQuizSettings(settings: Partial<ChordQuizSettings>) {
    chordQuiz.value = { ...chordQuiz.value, ...settings };
  }

  function updateNotationSettings(settings: Partial<NotationSettings>) {
    notation.value = { ...notation.value, ...settings };
  }

  function resetChordQuizSettings() {
    chordQuiz.value = { ...defaultChordQuizSettings };
  }

  function resetNotationSettings() {
    notation.value = { ...defaultNotationSettings };
  }

  return {
    chordQuiz,
    notation,
    updateChordQuizSettings,
    updateNotationSettings,
    resetChordQuizSettings,
    resetNotationSettings,
  };
});
