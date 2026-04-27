<template>
  <ul :class="[className || '', 'flex flex-col gap-2 mb-0 p-2 list-none']">
    <li
      v-if="displayedGames.length > maxCount"
      class="flex items-center w-full transition-all duration-200 ease-in-out relative h-8 leading-8 bg-[#5c5c5c]"
    >
      <span class="z-10 p-2 flex-grow-0 relative bg-[#424242] min-w-fit">
        {{ $t("chordQuiz.best") }}
      </span>
      <span class="flex-grow bg-[#303030] p-2 relative">
        {{ best }}
      </span>
    </li>
    <li
      v-for="(game, index) in displayedGames"
      :key="game.index"
      :class="[
        'flex items-center w-full transition-all duration-200 ease-in-out relative h-8 leading-8',
        { 'pointer-events-none opacity-0': isHidden(index) },
      ]"
      :style="{
        backgroundColor: isCurrent(game.index) ? 'hsl(var(--p))' : '#5c5c5c',
        marginTop: isHidden(index) ? '-40px' : '0',
        transform: isCurrent(game.index) ? 'scale(1.25)' : 'scale(1)',
        transformOrigin: isCurrent(game.index) ? 'left center' : 'center',
      }"
    >
      <span
        :style="{
          backgroundColor: isCurrent(game.index) ? 'hsl(var(--p))' : '#5c5c5c',
        }"
        class="z-10 p-2 flex-grow-0 relative"
      >
        {{ $t("chordQuiz.game", { n: game.index + 1 }) }}
      </span>
      <span
        :style="{
          backgroundColor: isCurrent(game.index)
            ? 'hsl(var(--pf, 48 98% 48%))'
            : '#303030',
        }"
        class="flex-grow p-2 relative"
      >
        {{ game.score }}
      </span>
    </li>
  </ul>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { Game } from "@/composables/useQuiz/utils";

export interface GameListProps {
  className?: string;
  games: Game[];
  gameIndex: number;
  maxCount?: number;
}

const props = withDefaults(defineProps<GameListProps>(), {
  className: undefined,
  maxCount: 4,
});

const displayedGames = computed(() => {
  return props.games
    .map((game, index) => ({ ...game, index }))
    .filter(
      ({ index }) =>
        index >= props.gameIndex - props.maxCount && index <= props.gameIndex,
    );
});

const best = computed(() => {
  let b: number | null = null;
  for (let i = 0; i <= props.gameIndex; i++) {
    const game = props.games[i];
    if (!game) continue;
    if (b === null || game.score > b) {
      b = game.score;
    }
  }
  return b;
});

const isHidden = (index: number) => {
  return displayedGames.value.length > props.maxCount && index === 0;
};

const isCurrent = (gameIndex: number) => {
  return gameIndex === props.gameIndex;
};
</script>
