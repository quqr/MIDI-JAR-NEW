// ============================================================================
// 和弦测验 — 状态机 composable
//
// 职责：管理一轮测验的完整生命周期。
//   - 设置（难度/模式/展示方式/题数）独立于全局 settings store，
//     经 localStorage（key: "chord-quiz-settings"）持久化；
//   - 出题由纯函数引擎 generateQuestion 完成；
//   - 音频播放复用全局 Sampler 引擎（useSamplerService）。
// ============================================================================

import { computed, ref, watch } from "vue";
import { useSamplerService } from "./useSamplerService";
import { useSamplerStore } from "@/stores/sampler";
import { generateQuestion } from "@/utils/chordQuiz/generator";
import type { QuizMode, QuizQuestion, QuizSettings, QuizStats } from "@/types";
import { DEFAULT_QUIZ_SETTINGS } from "@/types";

const STORAGE_KEY = "chord-quiz-settings";

function emptyStats(): QuizStats {
  return {
    total: 0,
    correct: 0,
    streak: 0,
    bestStreak: 0,
    timings: [],
    correctSequence: [],
  };
}

/** 校验 localStorage 中恢复的设置是否合法 */
function isValidCount(n: unknown): n is 5 | 10 | 20 {
  return n === 5 || n === 10 || n === 20;
}

function loadSettings(): QuizSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_QUIZ_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<QuizSettings>;
    const difficulty =
      parsed.difficulty === "easy" ||
      parsed.difficulty === "intermediate" ||
      parsed.difficulty === "expert"
        ? parsed.difficulty
        : DEFAULT_QUIZ_SETTINGS.difficulty;
    const modes = Array.isArray(parsed.modes)
      ? (parsed.modes as QuizMode[]).filter(
          (m) => m === "visual" || m === "scrambled" || m === "aural",
        )
      : DEFAULT_QUIZ_SETTINGS.modes;
    return {
      difficulty,
      modes: modes.length ? modes : DEFAULT_QUIZ_SETTINGS.modes,
      display:
        parsed.display === "keyboard" ||
        parsed.display === "notation" ||
        parsed.display === "both" ||
        parsed.display === "auto"
          ? parsed.display
          : DEFAULT_QUIZ_SETTINGS.display,
      keyboardRange:
        parsed.keyboardRange === "narrow" ||
        parsed.keyboardRange === "medium" ||
        parsed.keyboardRange === "wide"
          ? parsed.keyboardRange
          : DEFAULT_QUIZ_SETTINGS.keyboardRange,
      questionCount: isValidCount(parsed.questionCount)
        ? parsed.questionCount
        : DEFAULT_QUIZ_SETTINGS.questionCount,
    };
  } catch {
    return { ...DEFAULT_QUIZ_SETTINGS };
  }
}

export function useChordQuiz() {
  const settings = ref<QuizSettings>(loadSettings());
  const questions = ref<QuizQuestion[]>([]);
  const questionIndex = ref(0);
  /** 每题已选选项（null = 未答），与 questions 对齐 */
  const answers = ref<Array<number | null>>([]);
  /** 每题作答耗时（ms；null = 未答），按题目索引对齐（用于自由导航后仍能对应） */
  const answerTimes = ref<Array<number | null>>([]);
  const stats = ref<QuizStats>(emptyStats());
  const sessionDone = ref(false);

  /** 当前题目开始计时的时刻（ms） */
  let questionStart = 0;

  const samplerService = useSamplerService();
  const samplerStore = useSamplerStore();

  // 设置变更即持久化
  watch(
    settings,
    (value) => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
    },
    { deep: true },
  );

  /** 随机取一个参与模式（混合模式时每题独立抽取） */
  function pickMode(modes: readonly QuizMode[]): QuizMode {
    return modes[Math.floor(Math.random() * modes.length)];
  }

  /** 开始一轮测验（支持以 overrides 临时覆盖部分设置） */
  function startSession(overrides?: Partial<QuizSettings>) {
    if (overrides) {
      settings.value = { ...settings.value, ...overrides };
    }
    const count = settings.value.questionCount;
    const modes = settings.value.modes.length
      ? settings.value.modes
      : [pickMode(["visual", "scrambled", "aural"] as QuizMode[])];
    const list: QuizQuestion[] = [];
    for (let i = 0; i < count; i++) {
      list.push(
        generateQuestion(
          {
            difficulty: settings.value.difficulty,
            mode: pickMode(modes),
          },
          i,
        ),
      );
    }
    questions.value = list;
    answers.value = new Array<number | null>(count).fill(null);
    answerTimes.value = new Array<number | null>(count).fill(null);
    questionIndex.value = 0;
    stats.value = emptyStats();
    sessionDone.value = false;
    questionStart = Date.now();
  }

  /** 是否已答指定题目 */
  function isAnswered(index: number): boolean {
    return answers.value[index] !== null && answers.value[index] !== undefined;
  }

  /** 跳转到指定题目（越界自动收敛，返回是否成功） */
  function goTo(index: number): boolean {
    if (!questions.value.length) return false;
    const clamped = Math.max(0, Math.min(index, questions.value.length - 1));
    questionIndex.value = clamped;
    // 切换题目即重置计时：每题时长独立计算
    questionStart = Date.now();
    return true;
  }

  /** 上一题（首题时不生效） */
  function prev(): boolean {
    return goTo(questionIndex.value - 1);
  }

  /** 下一题；已是最后一题则结束本轮（未答也允许结束） */
  function next(): boolean {
    if (questionIndex.value + 1 >= questions.value.length) {
      sessionDone.value = true;
      return false;
    }
    questionIndex.value += 1;
    questionStart = Date.now();
    return true;
  }

  /** 选择作答选项（幂等：已答后忽略；仅记录首次作答，回看不重计） */
  function selectAnswer(index: number) {
    if (answered.value || !questions.value.length) return;
    answers.value[questionIndex.value] = index;
    stats.value.total += 1;

    const current = questions.value[questionIndex.value];
    const isCorrect = index === current.correctIndex;
    const elapsed = Date.now() - questionStart;

    answerTimes.value[questionIndex.value] = elapsed;
    if (isCorrect) {
      stats.value.correct += 1;
      stats.value.streak += 1;
      stats.value.bestStreak = Math.max(
        stats.value.bestStreak,
        stats.value.streak,
      );
    } else {
      stats.value.streak = 0;
    }
    stats.value.timings.push(elapsed);
    stats.value.correctSequence.push(isCorrect);
  }

  /** 重开一轮。sameQuestions=true 时复用已生成的题目（重做同题） */
  function restart(sameQuestions: boolean) {
    if (sameQuestions) {
      answers.value = new Array<number | null>(questions.value.length).fill(
        null,
      );
      answerTimes.value = new Array<number | null>(questions.value.length).fill(
        null,
      );
      questionIndex.value = 0;
      stats.value = emptyStats();
      sessionDone.value = false;
      questionStart = Date.now();
    } else {
      startSession();
    }
  }

  /**
   * 播放当前题的听觉音频（柱式和弦、固定时长）。
   * 前置守卫：声音开关开启且音色就绪才播放。
   * @returns 是否成功播放
   */
  function playQuestion(): boolean {
    if (!samplerStore.soundEnabled || !samplerStore.isReady) return false;
    const current = questions.value[questionIndex.value];
    if (!current) return false;
    samplerService.stopAllNotes();
    for (const midi of current.playMidi) {
      samplerService.playNote(midi, 100, 1100);
    }
    return true;
  }

  const currentQuestion = computed<QuizQuestion | null>(
    () => questions.value[questionIndex.value] ?? null,
  );
  /** 当前题是否已答 */
  const answered = computed(() => isAnswered(questionIndex.value));
  /** 当前题已选选项（-1 = 未选） */
  const selectedIndex = computed(
    () => answers.value[questionIndex.value] ?? -1,
  );
  const progress = computed(
    () => questions.value.length, // 供 UI 显示 total；当前进度用 questionIndex
  );
  const accuracy = computed(() =>
    stats.value.total > 0
      ? Math.round((stats.value.correct / stats.value.total) * 100)
      : 0,
  );
  const avgTime = computed(() => {
    const timings = stats.value.timings;
    if (!timings.length) return 0;
    return Math.round(timings.reduce((a, b) => a + b, 0) / timings.length);
  });

  return {
    settings,
    questions,
    questionIndex,
    answers,
    answerTimes,
    answered,
    selectedIndex,
    stats,
    sessionDone,
    currentQuestion,
    totalCount: progress,
    accuracy,
    avgTime,
    startSession,
    selectAnswer,
    goTo,
    prev,
    next,
    isAnswered,
    restart,
    playQuestion,
  };
}
