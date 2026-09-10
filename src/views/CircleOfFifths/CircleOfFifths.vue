<script setup lang="ts">
/**
 * 五度循环圈页面 — 编排层。
 *
 * 状态归属：
 * - 环数据、选中调、近关系调 → 本页持有（纯派生，无需 store）；
 * - 试听状态 → 本页持有（圈要与它同步呼吸，故不能下沉到详情栏）；
 * - 音名记法 → 复用全局 `settings.notation.accidentals`，不新建偏好项；
 * - 当前调号 → 读写 `settings.notation.key`，与 QuickChangeKeyToolbar 同源。
 *
 * 明确不承担测验与记分职责（见 ADR 0020），那属于 ChordQuiz 的领域。
 */
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { animate, stagger } from "animejs";
import { Icon } from "@/components/Icon";
import { useSettingsStore } from "@/stores";
import {
  buildCircleData,
  buildRelations,
  findPosition,
  keyDisplayName,
  RELATION_ORDER,
  type AccidentalPreference,
  type KeyMode,
  type KeySelection,
  type RelationKind,
} from "./circleOfFifths";
import CircleWheel from "./components/CircleWheel.vue";
import KeyDetailPanel from "./components/KeyDetailPanel.vue";
import ProgressionTransposer from "./components/ProgressionTransposer.vue";
import { motionEnabled } from "./components/anim";
import { useCircleAudio } from "./useCircleAudio";

const { t } = useI18n();
const settingsStore = useSettingsStore();

/* ── 环数据与选中 ─────────────────────────────────────── */

/** 环上 12 格的调序与记法偏好无关（记法只影响移调结果的拼写），故只算一次 */
const circle = buildCircleData();

const accidentals = computed<AccidentalPreference>(
  () => settingsStore.settings.notation.accidentals,
);

/** 全项目当前调号（notation.key 恒为大调主音） */
const currentKey = computed<KeySelection>(() => ({
  position: findPosition(circle, settingsStore.settings.notation.key, "major"),
  mode: "major",
}));

const selected = ref<KeySelection>({
  position: currentKey.value.position,
  mode: "major",
});

const slot = computed(() => circle[selected.value.position] ?? circle[0]);

/** 选中调的主音（大调环或小调环） */
const selectedTonic = computed(() =>
  selected.value.mode === "major"
    ? slot.value.majorTonic
    : slot.value.minorTonic,
);

const relations = computed(() => buildRelations(circle, selected.value));

/* ── 与全局调号联动 ───────────────────────────────────── */

/**
 * 外部改动调号（如顶部调号快切）时，圈跟随选中；
 * 但由本页「设为当前调号」触发的改动不回写选中态——否则会把用户
 * 从小调环硬拽回大调环，丢失上下文。
 */
let selfTriggered = false;

watch(
  () => settingsStore.settings.notation.key,
  (tonic) => {
    if (selfTriggered) {
      selfTriggered = false;
      return;
    }
    selected.value = {
      position: findPosition(circle, tonic, "major"),
      mode: "major",
    };
  },
);

/**
 * 把当前**位置**的大调设为全项目调号。
 * 调号只认大调名（与 QuickChangeKeyToolbar 的调序一致），所以即使当前选中的
 * 是小调环，写入的也是同位置的大调——两者共享同一调号。
 */
function useAsCurrent(): void {
  selfTriggered = true;
  void settingsStore.updateSetting("notation.key", slot.value.majorTonic);
}

function selectPosition(position: number, mode: KeyMode): void {
  selected.value = { position, mode };
}

/* ── 试听 ─────────────────────────────────────────────── */

const audio = useCircleAudio();

/** 正在试听的调：和弦试听时归属当前选中调（顺阶和弦就是它的和弦） */
const playingKey = computed(() => {
  const playing = audio.playing.value;
  if (!playing) return null;
  if (playing.kind === "chord") {
    return { tonic: selectedTonic.value, mode: selected.value.mode };
  }
  return { tonic: playing.tonic, mode: playing.mode };
});

function playScale(tonic: string, mode: KeyMode): void {
  audio.playScale(tonic, mode);
}

function playChord(symbol: string): void {
  audio.playChord(symbol);
}

/* ── 移调 ─────────────────────────────────────────────── */

/** 已固定的源调；固定后圈上选中调即为目标调 */
const sourceTonic = ref<string | null>(null);
const sourceMode = ref<KeyMode | null>(null);

function pinSource(): void {
  sourceTonic.value = selectedTonic.value;
  sourceMode.value = selected.value.mode;
}

function clearSource(): void {
  sourceTonic.value = null;
  sourceMode.value = null;
}

/* ── 图例 ─────────────────────────────────────────────── */

const RELATION_DOT: Record<RelationKind, string> = {
  dominant: "bg-success",
  subdominant: "bg-info",
  relative: "bg-accent",
  parallel: "bg-warning",
};

const legendItems = computed(() =>
  RELATION_ORDER.map((kind) => ({
    kind,
    label: t(`circleOfFifths.relations.${kind}`),
    dot: RELATION_DOT[kind],
  })),
);

/* ── 入场动画 ─────────────────────────────────────────── */

const headerRef = ref<HTMLElement>();
const wheelRef = ref<HTMLElement>();
const sideRef = ref<HTMLElement>();
let introAnimation: { revert: () => void } | null = null;

onMounted(() => {
  if (!motionEnabled()) return;
  const sections = [headerRef.value, wheelRef.value, sideRef.value].filter(
    (el): el is HTMLElement => !!el,
  );
  introAnimation = animate(sections, {
    opacity: [0, 1],
    translateY: [-16, 0],
    duration: 480,
    delay: stagger(90),
    ease: "outExpo",
  });
});

onUnmounted(() => {
  introAnimation?.revert();
  audio.stop();
});
</script>

<template>
  <div class="h-full overflow-y-auto">
    <div
      class="w-full max-w-7xl mx-auto px-4 py-5 sm:px-6 flex flex-col gap-4 sm:gap-5"
    >
      <!-- 标题 -->
      <header ref="headerRef" class="flex flex-wrap items-center gap-3">
        <div
          class="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0"
        >
          <Icon name="circle-of-fifths" :size="22" />
        </div>
        <div class="min-w-0">
          <h1 class="text-lg font-bold leading-tight">
            {{ t("nav.circleOfFifths") }}
          </h1>
          <p class="text-xs text-base-content/50 mt-0.5">
            {{ t("circleOfFifths.subtitle") }}
          </p>
        </div>

        <!-- 当前调号 -->
        <div class="ml-auto flex items-center gap-2">
          <span class="text-xs text-base-content/50 hidden sm:inline">
            {{ t("circleOfFifths.currentKey") }}
          </span>
          <span class="badge badge-sm badge-secondary">
            {{ keyDisplayName(settingsStore.settings.notation.key, "major") }}
          </span>
        </div>
      </header>

      <div
        class="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px] gap-4 sm:gap-5 items-start"
      >
        <!-- 左：圈 + 图例 -->
        <div ref="wheelRef" class="flex flex-col gap-4">
          <CircleWheel
            :circle="circle"
            :selected="selected"
            :current-key="currentKey"
            :relations="relations"
            :playing-key="playingKey"
            :picking-target="sourceTonic !== null"
            @select="selectPosition($event.position, $event.mode)"
          />

          <div class="card bg-base-100 border border-base-300">
            <div class="card-body p-3 gap-2">
              <h3
                class="text-xs font-semibold uppercase tracking-wide text-base-content/50"
              >
                {{ t("circleOfFifths.legend.title") }}
              </h3>
              <ul class="flex flex-wrap gap-x-4 gap-y-1.5">
                <li
                  v-for="item in legendItems"
                  :key="item.kind"
                  class="flex items-center gap-1.5 text-xs text-base-content/70"
                >
                  <span
                    class="w-2 h-2 rounded-full shrink-0"
                    :class="item.dot"
                  />
                  {{ item.label }}
                </li>
                <li
                  class="flex items-center gap-1.5 text-xs text-base-content/70"
                >
                  <span class="w-2 h-2 rounded-full shrink-0 bg-primary" />
                  {{ t("circleOfFifths.legend.selected") }}
                </li>
                <li
                  class="flex items-center gap-1.5 text-xs text-base-content/70"
                >
                  <span class="w-2 h-2 rounded-full shrink-0 bg-secondary" />
                  {{ t("circleOfFifths.legend.currentBadge") }}
                </li>
              </ul>
            </div>
          </div>
        </div>

        <!-- 右：详情 + 移调 -->
        <div ref="sideRef" class="flex flex-col gap-4">
          <KeyDetailPanel
            :circle="circle"
            :selected="selected"
            :relations="relations"
            :current-position="currentKey.position"
            :accidentals="accidentals"
            :playing-key="audio.playing.value"
            :scale-note-index="audio.scaleNoteIndex.value"
            :needs-instrument="audio.needsInstrument.value"
            @play-scale="playScale"
            @play-chord="playChord"
            @stop="audio.stop"
            @use-as-current="useAsCurrent"
            @select-position="selectPosition"
          />

          <ProgressionTransposer
            :source-tonic="sourceTonic"
            :source-mode="sourceMode"
            :target-tonic="selectedTonic"
            :target-mode="selected.mode"
            :accidentals="accidentals"
            @pin-source="pinSource"
            @clear-source="clearSource"
          />
        </div>
      </div>
    </div>
  </div>
</template>
