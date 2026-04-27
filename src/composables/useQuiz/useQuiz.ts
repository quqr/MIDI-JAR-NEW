import { ref, readonly, watch } from "vue";
import { Chord as TChord } from "@tonaljs/chord";

import { useQuizSettingsStore } from "@/stores/quizSettings";
import {
  getGameState,
  GameState,
  Parameters,
  Game,
  STATUSES,
  generateGame,
} from "./utils";

export function useQuiz(pitchClasses: string[], chords: (TChord | null)[]) {
  const quizSettingsStore = useQuizSettingsStore();

  const parameters = ref<Parameters>({
    mode: quizSettingsStore.chordQuiz.mode,
    difficulty: quizSettingsStore.chordQuiz.difficulty,
    gameLength: quizSettingsStore.chordQuiz.gameLength,
    key: quizSettingsStore.notation.key,
    accidentals: quizSettingsStore.notation.accidentals,
  });

  const games = ref<Game[]>([]);
  const gameState = ref<GameState>({
    gameIndex: 0,
    index: 0,
    status: STATUSES.none,
    chord: null,
    score: 0,
  });

  function initializeGame() {
    const game = generateGame(parameters.value);
    if (!game) return;

    games.value = [game];
    gameState.value = {
      gameIndex: 0,
      index: 0,
      status: STATUSES.none,
      chord: null,
      score: 0,
    };
  }

  function handleChordPlayed() {
    const newState = chords.reduce<GameState>((best, chord) => {
      const currentGame = games.value[gameState.value.gameIndex];
      if (!currentGame) return best;

      const c = getGameState(
        gameState.value.gameIndex,
        gameState.value.index,
        currentGame.chords[gameState.value.index],
        chord,
        pitchClasses,
      );

      if (
        !best.chord ||
        best.status < c.status ||
        (best.status === c.status && best.score <= c.score)
      ) {
        return c;
      }

      return best;
    }, gameState.value);

    gameState.value = newState;
  }

  function handleChordRelease() {
    const gameStateStatus = gameState.value.status;

    if (gameStateStatus > -1) {
      const newGames = [...games.value];
      const currentGame = newGames[gameState.value.gameIndex];

      if (gameStateStatus > 1) {
        currentGame.succeeded += 1;
      }
      currentGame.score += gameState.value.score;
      currentGame.played.push(gameState.value.chord);

      if (gameState.value.index + 2 >= currentGame.chords.length) {
        const game = generateGame(parameters.value);
        if (game) {
          newGames.push(game);
        }
      }

      const isNextGame =
        gameState.value.index + 1 === currentGame.chords.length;

      gameState.value = {
        gameIndex: isNextGame
          ? gameState.value.gameIndex + 1
          : gameState.value.gameIndex,
        index: isNextGame ? 0 : gameState.value.index + 1,
        status: STATUSES.none,
        chord: null,
        score: 0,
      };
      games.value = newGames;
    } else {
      gameState.value = {
        gameIndex: gameState.value.gameIndex,
        index: gameState.value.index,
        status: STATUSES.none,
        chord: null,
        score: 0,
      };
    }
  }

  watch(
    [() => quizSettingsStore.chordQuiz, () => quizSettingsStore.notation],
    () => {
      parameters.value = {
        mode: quizSettingsStore.chordQuiz.mode,
        difficulty: quizSettingsStore.chordQuiz.difficulty,
        gameLength: quizSettingsStore.chordQuiz.gameLength,
        key: quizSettingsStore.notation.key,
        accidentals: quizSettingsStore.notation.accidentals,
      };
      initializeGame();
    },
    { deep: true },
  );

  watch([() => pitchClasses.length, () => chords], () => {
    if (pitchClasses.length === 0) {
      handleChordRelease();
    } else {
      handleChordPlayed();
    }
  });

  initializeGame();

  return {
    games: readonly(games),
    gameState: readonly(gameState),
    parameters: readonly(parameters),
  };
}

export default useQuiz;
