<template>
  <div
    v-if="reaction"
    id="ChordQuizReaction"
    :class="[
      'relative font-bold font-rocher text-h4',
      statusClasses,
      className || '',
    ]"
    :key="reaction.id"
  >
    {{ reaction.text }}
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onBeforeUnmount } from "vue";
import { useI18n } from "vue-i18n";
import { randomPick } from "@/helpers/array";
import { STATUSES, GameState } from "@/composables/useQuiz/utils";
import { Reaction, getReactions, shouldTriggerNewReaction } from "./utils";

const props = withDefaults(
  defineProps<{
    className?: string;
    gameState: GameState;
  }>(),
  {
    className: undefined,
  },
);

const { t } = useI18n();
const reaction = ref<Reaction | null>(null);
let reactionTimeout: ReturnType<typeof setTimeout> | null = null;

const reactions = getReactions(t);

watch(
  [() => props.gameState, reaction],
  ([gameState, currentReaction]) => {
    if (shouldTriggerNewReaction(gameState, currentReaction)) {
      if (reactionTimeout) {
        clearTimeout(reactionTimeout);
      }

      reaction.value = {
        id: `${gameState.index}-${gameState.status}-${gameState.score}`,
        index: gameState.index,
        status: gameState.status,
        score: gameState.score,
        text: randomPick(reactions[gameState.status] ?? []),
        visible: true,
      };

      reactionTimeout = setTimeout(() => {
        if (reaction.value) {
          reaction.value = { ...reaction.value, visible: false };
        }
      }, 3000);
    }
  },
  { deep: true },
);

const statusClasses = computed(() => {
  if (!reaction.value || !reaction.value.visible) {
    return "animate-disappear opacity-0";
  }

  switch (reaction.value.status) {
    case STATUSES.different:
      return "animate-inflate animate-bump animate-nope text-rocher-danger";
    case STATUSES.subset:
      return "animate-inflate animate-almost-bump text-rocher-warning";
    case STATUSES.equal:
      return "animate-inflate animate-bump animate-yes text-rocher-success";
    case STATUSES.superset:
      return "animate-inflate-slow animate-bump-wow text-rocher-primary";
    default:
      return "";
  }
});

onBeforeUnmount(() => {
  if (reactionTimeout) {
    clearTimeout(reactionTimeout);
  }
});
</script>

<style scoped>
.font-rocher {
  font-family: "Rocher", serif;
}

.text-rocher-danger {
  color: var(--rocher-danger, #ac2426);
}

.text-rocher-warning {
  color: var(--rocher-warning, #d89845);
}

.text-rocher-success {
  color: var(--rocher-success, #19a86c);
}

.text-rocher-primary {
  color: var(--rocher-primary, #3567f0);
}

@keyframes disappear {
  from {
    opacity: 1;
    transform: scale(1);
  }
  to {
    opacity: 0;
    transform: scale(0.8);
  }
}

@keyframes inflate {
  0% {
    transform: scale(0);
    opacity: 0;
  }
  60% {
    transform: scale(1.2);
    opacity: 1;
  }
  100% {
    transform: scale(1);
    opacity: 1;
  }
}

@keyframes bump {
  0% {
    transform: scale(1);
  }
  30% {
    transform: scale(1.15);
  }
  100% {
    transform: scale(1);
  }
}

@keyframes nope {
  0% {
    transform: rotate(0deg);
  }
  25% {
    transform: rotate(-5deg);
  }
  50% {
    transform: rotate(5deg);
  }
  75% {
    transform: rotate(-3deg);
  }
  100% {
    transform: rotate(0deg);
  }
}

@keyframes yes {
  0% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.1);
  }
  100% {
    transform: scale(1);
  }
}

@keyframes almost-bump {
  0% {
    transform: scale(1);
  }
  20% {
    transform: scale(1.05);
  }
  40% {
    transform: scale(1.02);
  }
  60% {
    transform: scale(1.08);
  }
  80% {
    transform: scale(1.02);
  }
  100% {
    transform: scale(1);
  }
}

@keyframes bump-wow {
  0% {
    transform: scale(1);
  }
  20% {
    transform: scale(1.1);
  }
  40% {
    transform: scale(1.2);
  }
  60% {
    transform: scale(1.1);
  }
  80% {
    transform: scale(1.15);
  }
  100% {
    transform: scale(1);
  }
}

.animate-disappear {
  animation: disappear 0.3s forwards;
}

.animate-inflate {
  animation: inflate 0.6s forwards;
}

.animate-bump {
  animation: bump 0.3s ease 1 0.2s forwards;
}

.animate-nope {
  animation: nope 0.3s ease 1 0.2s forwards;
}

.animate-yes {
  animation: yes 0.5s ease 1 0.2s forwards;
}

.animate-almost-bump {
  animation: almost-bump 0.5s linear forwards;
}

.animate-inflate-slow {
  animation: inflate 2s forwards;
}

.animate-bump-wow {
  animation: bump-wow 0.6s ease-out forwards;
}
</style>
