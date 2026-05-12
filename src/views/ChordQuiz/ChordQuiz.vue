<template>
  <div
    id="ChordQuiz"
    class="relative w-full min-h-screen flex flex-col justify-center items-center overflow-hidden p-4 gap-3"
    style="
      --font-size-main: clamp(2rem, 15vh, 10vw);
      --font-size-intervals: clamp(0.75rem, 2vw, 3vh);
      --font-size-badge-counter: clamp(0.75rem, 2vh, 2vw);
      --font-size-badge-score: 20px;
      --chord-font-size: clamp(2rem, 15vh, 10vw);
    "
  >
    <div class="relative w-full flex-basis-0 flex-grow-0 flex-shrink-0">
      <div
        v-if="quizSettings.displayReaction"
        class="absolute inset-0 flex items-center justify-center"
      >
        <Reaction :gameState="gameState as any" />
      </div>
      <GameList
        v-if="quizSettings.gamification"
        class="absolute top-0 left-0 w-auto"
        :games="games as unknown as Game[]"
        :gameIndex="gameState.gameIndex"
      />
    </div>

    <div
      class="relative w-full overflow-hidden flex-shrink-0 flex flex-col justify-end items-center p-3"
      style="height: min(20vw, 50vh)"
    >
      <div
        v-for="c in chordElements"
        :key="c?.index"
        v-show="c?.type"
        class="absolute top-0 bottom-0 flex items-center justify-center transition-all duration-500 ease-in-out"
        style="
          transition-property: color, transform;
          font-size: var(--chord-font-size);
          text-shadow: 0 0.05em 0.1em rgba(0, 0, 0, 0.6);
        "
        :style="chordElementStyle(c as { type: string })"
      >
        <ChordName
          :chord="c?.chord as any"
          :notation="quizSettings.chordNotation"
        />
      </div>
    </div>

    <div
      v-if="quizSettings.displayName"
      class="text-base font-semibold px-0 py-1 tracking-wide"
    >
      {{ games[gameState.gameIndex]?.chords[gameState.index]?.name }}
    </div>

    <div
      v-if="quizSettings.displayIntervals"
      class="text-sm font-medium"
      style="letter-spacing: 0.05em; font-size: var(--font-size-intervals)"
    >
      <ChordIntervals
        :targets="
          (games as unknown as Game[])[gameState.gameIndex]?.chords[
            gameState.index
          ]?.intervals as unknown as string[]
        "
        :intervals="
          (gameState.status > STATUSES.none
            ? gameState.chord?.intervals
            : []) as unknown as string[]
        "
        :pitchClasses="pitchClasses as unknown as string[]"
        :tonic="
          (games as unknown as Game[])[gameState.gameIndex]?.chords[
            gameState.index
          ]?.tonic
        "
        quizMode
      />
    </div>

    <div
      class="flex flex-col items-center justify-center gap-3 p-3 flex-basis-0 flex-grow flex-shrink"
    >
      <span
        class="badge badge-lg font-bold px-2 py-1 bg-base-200 text-base-content"
        style="font-size: var(--font-size-badge-counter)"
      >
        {{ gameState.index + 1 }} /
        {{ games[gameState.gameIndex]?.chords.length }}
      </span>
      <span
        v-if="quizSettings.gamification"
        class="badge badge-lg badge-primary font-bold px-2 py-1"
        style="font-size: var(--font-size-badge-score)"
      >
        {{ gameState.score }} {{ $t("chordQuiz.pts") }}
      </span>
      <div
        class="flex overflow-hidden text-sm items-center justify-center font-medium"
        style="text-shadow: 0 0.05em 0.1em rgba(0, 0, 0, 0.6)"
      >
        <ChordName
          :chord="gameState.chord as any"
          :notation="quizSettings.chordNotation"
        />
      </div>
    </div>
    <div class="absolute top-4 right-4 z-10">
      <SettingsButton
        :aria-label="t('chordQuiz.openSettings')"
        @click="settingsOpen = true"
      />
    </div>
    <div
      class="absolute bottom-4 right-4 z-10 opacity-60 hover:opacity-100 transition-opacity"
    >
      <RouterLink
        to="/home"
        class="btn btn-sm btn-ghost btn-circle"
        :title="$t('nav.home')"
      >
        <Icon name="home" size="20" />
      </RouterLink>
    </div>

    <SettingsModal v-model="settingsOpen" :title="t('chordQuiz.settings')">
      <ChordQuizSettings />
    </SettingsModal>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from "vue";
import { RouterLink } from "vue-router";
import Icon from "@/components/Icon/Icon.vue";
import { useI18n } from "vue-i18n";
import { ChordIntervals } from "@/components/ChordIntervals/";
import { ChordName } from "@/components/ChordName/";
import { SettingsButton } from "@/components/SettingsButton/";
import { SettingsModal } from "@/components/SettingsModal/";
import { useQuiz, useNotes, STATUSES } from "@/composables/";
import { useSettingsStore } from "@/stores";
import ChordQuizSettings from "@/views/Settings/ChordQuizSettings/ChordQuizSettings.vue";
import type { Game } from "@/composables/useQuiz/utils";
import Reaction from "./Reaction/Reaction.vue";
import GameList from "./GameList/GameList.vue";

const { t } = useI18n();
const settingsOpen = ref(false);

const settingsStore = useSettingsStore();
const quizSettings = computed(() => settingsStore.settings.chordQuiz);
const { chords, pitchClasses, clearNotes } = useNotes({
  key: () => settingsStore.settings.notation.key,
  accidentals: () => settingsStore.settings.notation.accidentals,
  namespace: "chord-quiz",
});
const { games, gameState } = useQuiz(
  pitchClasses as any,
  chords as any,
);

const statusColors: Record<string, string> = {
  none: "text-base-content",
  different: "text-error",
  subset: "text-warning",
  equal: "text-success",
  superset: "text-orange-500",
};

interface ChordElement {
  index: number;
  chord: NonNullable<Game["chords"][number]>;
  type: string;
}

const chordElements = computed<ChordElement[]>(() => {
  const gamesArr = games as unknown as Game[];
  const currentGame = gamesArr[gameState.value.gameIndex];
  const nextGame = gamesArr[gameState.value.gameIndex + 1];
  const allChords = [
    ...(currentGame ? currentGame.chords : []),
    ...(nextGame ? nextGame.chords : []),
  ];
  const result: ChordElement[] = [];
  for (let index = 0; index < allChords.length; index++) {
    const chord = allChords[index];
    if (!chord) continue;
    let type: string | null = null;
    if (index === gameState.value.index - 1) type = "prevChord";
    if (index === gameState.value.index) type = "targetChord";
    if (index === gameState.value.index + 1) type = "nextChord";
    if (type)
      result.push({
        index: currentGame ? index % currentGame.chords.length : index,
        chord,
        type,
      });
  }
  return result;
});

const chordElementStyle = (c: { type: string }) => {
  if (c.type === "targetChord") {
    return {
      width: "100%",
      right: "0",
      "--chord-font-size": "min(20vh, 10vw)",
      opacity: "1",
      fontWeight: "bold",
      letterSpacing: "0.02em",
      transform: "perspective(3em) rotateY(0deg)",
      color: getStatusColor(),
    };
  }
  if (c.type === "nextChord") {
    return {
      width: "15%",
      right: "5%",
      "--chord-font-size": "min(3vw, 3vh)",
      opacity: "0.8",
      transform: "perspective(3em) rotateY(-36deg)",
      animation: "swipe 0.3s ease 1",
    };
  }
  if (c.type === "prevChord") {
    return {
      width: "15%",
      left: "0",
      right: "auto",
      "--chord-font-size": "min(2vw, 2vh)",
      opacity: "0",
      transform: "perspective(3em) rotateY(36deg)",
      transitionDelay: "100ms",
    };
  }
  return {};
};

const getStatusColor = () => {
  const statusKey = STATUSES[gameState.value.status];
  return statusColors[statusKey] || "var(--fallback-color, #999)";
};

const handleKeyboard = (e: KeyboardEvent) => {
  if (e.code === "Space") {
    e.preventDefault();
    clearNotes();
  }
};

onMounted(() => {
  window.addEventListener("keydown", handleKeyboard);
});

onUnmounted(() => {
  window.removeEventListener("keydown", handleKeyboard);
});
</script>

<style scoped>
@keyframes swipe {
  from {
    transform: perspective(3em) rotateY(-50deg);
    opacity: 0;
  }
  to {
    transform: perspective(3em) rotateY(-36deg);
    opacity: 0.8;
  }
}
</style>
