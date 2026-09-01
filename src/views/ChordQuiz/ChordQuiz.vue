<template>
  <div class="h-full overflow-y-auto">
    <div class="max-w-2xl mx-auto px-4 py-6 sm:px-6 flex flex-col gap-6">
      <!-- ===== 标题行 ===== -->
      <header class="flex items-center gap-3">
        <div
          class="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0"
        >
          <svg
            class="w-5 h-5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="10" />
            <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        </div>
        <div class="min-w-0">
          <h1 class="text-lg font-bold leading-tight">
            {{ $t("nav.chordQuiz") }}
          </h1>
          <p class="text-xs text-base-content/50 mt-0.5">
            {{ $t("quiz.subtitle") }}
          </p>
        </div>
      </header>

      <!-- ===== 设置面板 ===== -->
      <section
        class="bg-base-200/40 rounded-2xl border border-base-content/5 p-4 sm:p-5"
      >
        <div class="flex flex-wrap items-end gap-x-5 gap-y-3">
          <fieldset class="fieldset">
            <legend class="fieldset-legend text-xs">
              {{ $t("quiz.difficultyLabel") }}
            </legend>
            <select
              class="select select-sm select-bordered w-28"
              v-model="difficulty"
              :disabled="sessionActive"
            >
              <option value="easy">{{ $t("quiz.difficulty.easy") }}</option>
              <option value="intermediate">
                {{ $t("quiz.difficulty.intermediate") }}
              </option>
              <option value="expert">{{ $t("quiz.difficulty.expert") }}</option>
            </select>
          </fieldset>

          <fieldset class="fieldset">
            <legend class="fieldset-legend text-xs">
              {{ $t("quiz.modeLabel") }}
            </legend>
            <select
              class="select select-sm select-bordered w-28"
              v-model="mode"
              :disabled="sessionActive"
            >
              <option value="visual">{{ $t("quiz.mode.visual") }}</option>
              <option value="scrambled">{{ $t("quiz.mode.scrambled") }}</option>
              <option value="aural">{{ $t("quiz.mode.aural") }}</option>
              <option value="mix">{{ $t("quiz.mode.mix") }}</option>
            </select>
          </fieldset>

          <fieldset class="fieldset">
            <legend class="fieldset-legend text-xs">
              {{ $t("quiz.displayLabel") }}
            </legend>
            <select
              class="select select-sm select-bordered w-24"
              v-model="display"
              :disabled="sessionActive"
            >
              <option value="auto">{{ $t("quiz.display.auto") }}</option>
              <option value="keyboard">
                {{ $t("quiz.display.keyboard") }}
              </option>
              <option value="notation">
                {{ $t("quiz.display.notation") }}
              </option>
              <option value="both">{{ $t("quiz.display.both") }}</option>
            </select>
          </fieldset>

          <fieldset class="fieldset">
            <legend class="fieldset-legend text-xs">
              {{ $t("quiz.countLabel") }}
            </legend>
            <select
              class="select select-sm select-bordered w-20"
              v-model="questionCount"
              :disabled="sessionActive"
            >
              <option :value="5">5</option>
              <option :value="10">10</option>
              <option :value="20">20</option>
            </select>
          </fieldset>
        </div>

        <!-- 键盘音域：分段按钮，答题中始终可实时调整 -->
        <div
          class="mt-4 pt-4 border-t border-base-content/10 flex flex-wrap items-center justify-between gap-3"
        >
          <div>
            <div class="flex items-center gap-1.5">
              <span class="text-xs font-medium text-base-content/70">
                {{ $t("quiz.keyboardRange.label") }}
              </span>
              <span class="badge badge-ghost badge-xs">
                {{ $t("quiz.keyboardRange.hint") }}
              </span>
            </div>
            <div class="join mt-1.5" role="group">
              <button
                v-for="range in RANGE_OPTIONS"
                :key="range"
                type="button"
                class="btn btn-sm join-item w-16"
                :class="
                  keyboardRange === range ? 'btn-primary' : 'btn-ghost'
                "
                :aria-pressed="keyboardRange === range"
                @click="keyboardRange = range"
              >
                {{ $t(`quiz.keyboardRange.${range}Short`) }}
              </button>
            </div>
          </div>

          <button
            v-if="!sessionActive"
            type="button"
            class="btn btn-primary btn-sm rounded-full px-6"
            @click="start"
          >
            <svg
              class="w-4 h-4"
              viewBox="0 0 24 24"
              fill="currentColor"
              aria-hidden="true"
            >
              <polygon points="6 3 20 12 6 21 6 3" />
            </svg>
            {{ $t("quiz.start") }}
          </button>
        </div>
      </section>

      <!-- ===== 结算成绩单 ===== -->
      <section
        v-if="sessionDone"
        class="card bg-base-100 shadow-sm border border-base-content/10 p-6 sm:p-8 space-y-6"
      >
        <h2
          class="text-lg font-bold text-center flex items-center justify-center gap-2"
        >
          <svg
            class="w-5 h-5 text-primary"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <circle cx="12" cy="8" r="6" />
            <path d="M15.477 12.89L17 22l-5-3-5 3 1.523-9.11" />
          </svg>
          {{ $t("quiz.sessionDone") }}
        </h2>

        <!-- 正确率环形 + 关键指标 -->
        <div class="flex flex-wrap items-center justify-center gap-6">
          <div
            class="radial-progress text-primary"
            style="--size: 7rem; --thickness: 0.5rem"
            role="progressbar"
            :aria-valuenow="accuracy"
            :style="{ '--value': accuracy }"
          >
            <span class="text-xl font-bold tabular-nums">{{ accuracy }}%</span>
          </div>
          <div class="flex flex-col gap-2 min-w-40">
            <div
              class="flex items-center justify-between gap-6 bg-base-200/50 rounded-xl px-4 py-2"
            >
              <span class="text-sm text-base-content/60">
                {{ $t("quiz.score") }}
              </span>
              <span class="font-bold tabular-nums">
                {{ stats.correct }}/{{ totalCount }}
              </span>
            </div>
            <div
              class="flex items-center justify-between gap-6 bg-base-200/50 rounded-xl px-4 py-2"
            >
              <span class="text-sm text-base-content/60">
                {{ $t("quiz.bestStreak") }}
              </span>
              <span class="font-bold tabular-nums text-secondary">
                {{ stats.bestStreak }}
              </span>
            </div>
            <div
              class="flex items-center justify-between gap-6 bg-base-200/50 rounded-xl px-4 py-2"
            >
              <span class="text-sm text-base-content/60">
                {{ $t("quiz.avgTime") }}
              </span>
              <span class="font-bold tabular-nums">
                {{ avgTime }}ms
              </span>
            </div>
          </div>
        </div>

        <!-- 逐题结果小条 -->
        <div
          v-if="perQuestion.length"
          class="flex items-end justify-center gap-1 h-14"
          role="img"
          :aria-label="$t('quiz.perQuestionResult')"
        >
          <div
            v-for="item in perQuestion"
            :key="item.index"
            class="w-5 rounded-t-sm"
            :class="
              item.correct === null
                ? 'bg-base-content/15'
                : item.correct
                  ? 'bg-success/70'
                  : 'bg-error/70'
            "
            :style="{
              height: item.time !== null ? barHeight(item.time) : '12px',
            }"
            :title="quizItemTip(item)"
          />
        </div>

        <div class="flex justify-center gap-3 flex-wrap">
          <button
            type="button"
            class="btn btn-primary rounded-full px-6"
            @click="restart(false)"
          >
            {{ $t("quiz.again") }}
          </button>
          <button
            type="button"
            class="btn btn-outline rounded-full"
            @click="restart(true)"
          >
            {{ $t("quiz.redo") }}
          </button>
          <button
            type="button"
            class="btn btn-ghost rounded-full"
            @click="goHome"
          >
            {{ $t("quiz.backHome") }}
          </button>
        </div>
      </section>

      <!-- ===== 核心答题卡 ===== -->
      <section
        v-if="!sessionDone && currentQuestion"
        class="card bg-base-100 shadow-sm border border-base-content/10 p-4 sm:p-6 space-y-5"
      >
        <!-- 进度行 -->
        <div class="flex items-center gap-3">
          <span class="badge badge-soft badge-sm whitespace-nowrap">
            {{ $t(`quiz.mode.${currentQuestion.mode}`) }}
          </span>
          <span
            class="text-sm font-semibold tabular-nums whitespace-nowrap"
          >
            {{ questionIndex + 1 }} / {{ totalCount }}
          </span>
          <progress
            class="progress progress-primary flex-1 min-w-0 h-1.5"
            :value="answeredCount"
            :max="totalCount"
          ></progress>
          <div class="flex items-center gap-1.5 whitespace-nowrap">
            <span class="badge badge-primary badge-sm gap-1">
              {{ $t("quiz.score") }} {{ stats.correct }}
            </span>
            <span class="badge badge-ghost badge-sm gap-1">
              {{ $t("quiz.streak") }} {{ stats.streak }}
            </span>
          </div>
        </div>

        <QuestionDisplay
          :question="currentQuestion"
          :display-mode="settingsDisplay"
          :keyboard-range="keyboardRange"
          :sound-enabled="soundEnabled"
          :sound-ready="soundReady"
          @play="handlePlay"
        />

        <div class="divider my-0.5" role="presentation"></div>

        <AnswerOptions
          :options="currentQuestion.options"
          :correct-index="currentQuestion.correctIndex"
          :answered="answered"
          :selected-index="selectedIndex"
          @select="handleSelect"
        />

        <div
          v-if="answered"
          class="flex items-center justify-center gap-2 text-sm"
          role="status"
        >
          <span
            class="badge gap-1 border py-2"
            :class="
              selectedIndex === currentQuestion.correctIndex
                ? 'badge-soft bg-success/15 border-success/30 text-success'
                : 'badge-soft bg-error/15 border-error/30 text-error'
            "
          >
            <svg
              class="w-3.5 h-3.5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.5"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            >
              <polyline
                v-if="selectedIndex === currentQuestion.correctIndex"
                points="20 6 9 17 4 12"
              />
              <path v-else d="M18 6l-12 12M6 6l12 12" />
            </svg>
            {{ $t("quiz.correctAnswer") }}:
            <span class="font-mono font-bold">{{
              currentQuestion.symbol
            }}</span>
          </span>
        </div>

        <!-- 底部导航 -->
        <div class="flex items-center justify-between gap-3 pt-1">
          <button
            type="button"
            class="btn btn-outline btn-md min-w-28 rounded-full"
            :disabled="questionIndex === 0"
            @click="handlePrev"
          >
            {{ $t("quiz.prev") }}
          </button>
          <button
            type="button"
            class="btn btn-primary btn-md min-w-28 rounded-full"
            @click="handleNext"
          >
            <template v-if="isLast">
              {{ $t("quiz.showResult") }}
            </template>
            <template v-else>
              {{ $t("quiz.next") }}
            </template>
          </button>
        </div>
      </section>

      <!-- ===== 未开始 ===== -->
      <section
        v-if="!sessionDone && !currentQuestion"
        class="card bg-base-100 shadow-sm border border-base-content/10 py-14 flex flex-col items-center gap-3 text-center"
      >
        <div
          class="w-12 h-12 rounded-full bg-base-200 flex items-center justify-center"
        >
          <svg
            class="w-6 h-6 text-base-content/40"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="10" />
            <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        </div>
        <p class="text-sm text-base-content/60">{{ $t("quiz.startHint") }}</p>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
// 和弦测验主页面：设置面板（键盘音域随时可调）+ 核心答题卡 + 上下题导航 + 结算
import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";
import { useChordQuiz } from "@/composables/useChordQuiz";
import { useSamplerStore } from "@/stores/sampler";
import type {
  DisplayMode,
  KeyboardRange,
  QuizDifficulty,
  QuizMode,
} from "@/types";
import QuestionDisplay from "./components/QuestionDisplay.vue";
import AnswerOptions from "./components/AnswerOptions.vue";

const router = useRouter();
const samplerStore = useSamplerStore();
const { t } = useI18n();

const quiz = useChordQuiz();
const {
  settings,
  currentQuestion,
  questionIndex,
  answers,
  answered,
  selectedIndex,
  stats,
  sessionDone,
  totalCount,
  accuracy,
  avgTime,
} = quiz;

// ── 设置面板本地状态（难度/模式/展示/题数开始前可编辑，进行中锁定；键盘音域始终可调） ──
const difficulty = ref<QuizDifficulty>(settings.value.difficulty);
const mode = ref<QuizMode | "mix">(
  settings.value.modes.length > 1
    ? "mix"
    : (settings.value.modes[0] ?? "visual"),
);
const display = ref<DisplayMode>(settings.value.display);
const questionCount = ref<5 | 10 | 20>(settings.value.questionCount);
const keyboardRange = ref<KeyboardRange>(
  settings.value.keyboardRange ?? "medium",
);

/** 键盘音域分段按钮选项 */
const RANGE_OPTIONS: readonly KeyboardRange[] = [
  "narrow",
  "medium",
  "wide",
] as const;

// 一轮结束后，将本地设置面板与最近一轮的生效设置对齐
watch(settings, (value) => {
  difficulty.value = value.difficulty;
  mode.value = value.modes.length > 1 ? "mix" : (value.modes[0] ?? "visual");
  display.value = value.display;
  keyboardRange.value = value.keyboardRange ?? "medium";
  questionCount.value = value.questionCount;
});

/** 会话进行中（有题且未结束） — 期间锁定难度/模式/展示/题数 */
const sessionActive = computed(
  () => currentQuestion.value !== null && !sessionDone.value,
);
const isLast = computed(() => questionIndex.value >= totalCount.value - 1);

/** 已作答题数（进度条按作答进度而非题目序号推进） */
const answeredCount = computed(
  () => answers.value.filter((a) => a !== null).length,
);

/** 生效的展示设置（aural 时由 QuestionDisplay 强制隐藏视觉） */
const settingsDisplay = computed(() =>
  sessionActive.value ? settings.value.display : display.value,
);
const soundEnabled = computed(() => samplerStore.soundEnabled);
const soundReady = computed(() => samplerStore.isReady);

/** 逐题结果（含耗时与正误），供结算条渲染 */
const perQuestion = computed(() => {
  const questions = quiz.questions.value;
  const answerTimes = quiz.answerTimes.value;
  return questions.map((q, i) => {
    const selected = answers.value[i] ?? null;
    return {
      index: i,
      correct: selected === null ? null : selected === q.correctIndex,
      time: answerTimes[i] ?? null,
    };
  });
});

/** 根据模式选择解析出题模式集合 */
function resolveModes(selected: QuizMode | "mix"): QuizMode[] {
  if (selected === "mix") return ["visual", "scrambled", "aural"];
  return [selected];
}

function start() {
  quiz.startSession({
    difficulty: difficulty.value,
    modes: resolveModes(mode.value),
    display: display.value,
    keyboardRange: keyboardRange.value,
    questionCount: questionCount.value,
  });
}

function handleSelect(index: number) {
  quiz.selectAnswer(index);
}

function handlePrev() {
  quiz.prev();
}

function handleNext() {
  quiz.next();
}

function handlePlay() {
  quiz.playQuestion();
}

function restart(sameQuestions: boolean) {
  quiz.restart(sameQuestions);
}

function goHome() {
  router.push("/home");
}

/** 逐题耗时条高度（映射到 12–48px） */
function barHeight(timing: number): string {
  const max = 5000;
  const ratio = Math.min(1, timing / max);
  return `${Math.round(12 + ratio * 36)}px`;
}

/** 逐题条的 tooltip 文案 */
function quizItemTip(item: {
  index: number;
  correct: boolean | null;
  time: number | null;
}) {
  const no = item.correct === null;
  const ok = item.correct === true;
  return `#${item.index + 1} · ${no ? t("quiz.unanswered") : ok ? t("quiz.correct") : t("quiz.wrong")}${item.time !== null ? ` · ${item.time}ms` : ""}`;
}
</script>
