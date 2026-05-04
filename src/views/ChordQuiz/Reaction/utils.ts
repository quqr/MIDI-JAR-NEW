import { GameState, STATUSES } from "@/composables/useQuiz/utils";

export type Reaction = {
  id: string;
  status: STATUSES;
  index: number;
  score: number;
  text: string;
  visible: boolean;
};

export const getReactions = (
  t: (
    key: string,
    named?: Record<string, unknown>,
    options?: { returnObjects?: boolean },
  ) => string,
): { [key in STATUSES]?: string[] } => {
  return {
    [STATUSES.different]: t(
      "chordQuiz.reactions.different",
      {},
      { returnObjects: true },
    ) as unknown as string[],
    [STATUSES.subset]: t(
      "chordQuiz.reactions.subset",
      {},
      { returnObjects: true },
    ) as unknown as string[],
    [STATUSES.equal]: t(
      "chordQuiz.reactions.equal",
      {},
      { returnObjects: true },
    ) as unknown as string[],
    [STATUSES.superset]: t(
      "chordQuiz.reactions.superset",
      {},
      { returnObjects: true },
    ) as unknown as string[],
  };
};

export const shouldTriggerNewReaction = (
  gameState: GameState,
  reaction?: Reaction | null,
) => {
  return (
    gameState.status >= STATUSES.different &&
    (!reaction ||
      reaction.index !== gameState.index ||
      reaction.status < gameState.status ||
      (reaction.status === gameState.status &&
        reaction.score < gameState.score))
  );
};
