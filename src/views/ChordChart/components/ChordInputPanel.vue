<script setup lang="ts">
/**
 * 和弦输入面板（iReal Pro 的 chord picker）。
 *
 * 设计（见 ADR 0023 §输入面板）：
 * - **直输优先**：顶部一个文本框，可粘贴 iReal 风格文本（`C-7` / `F#7b9/A` / `N.C.`）。
 * - **点选辅助**：根音 12 键 + 类型分组按钮 + 转位低音；点选后写回文本框，
 *   文本始终是唯一真相源（避免「面板状态」与「文本框」两套真相打架）。
 * - **时长**用 `RangeSlider`（离散几选一，遵守 ADR 0014，不用原生 select）。
 *
 * 面板自身不碰 store：只 emit `confirm(unit)`，由页面决定写在哪里。
 */
import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";

import RangeSlider from "@/components/common/RangeSlider.vue";
import { Icon } from "@/components/Icon";
import {
  CHORD_TYPE_GROUPS,
  formatChordUnit,
  isKnownChordType,
  parseChordUnit,
} from "../domain/chordText";
import { CHORD_BEATS_VALUES } from "../domain/empty";
import { transposeChordUnit } from "../domain/chordText";

import type { ChordBeats, ChordUnit } from "../domain/types";

const props = defineProps<{
  /** 编辑中的初始和弦；null = 新建 */
  modelValue: ChordUnit | null;
  /** 当前调性的主音（用于根音按钮的调内提示） */
  tonic?: string;
}>();

const emit = defineEmits<{
  (e: "confirm", unit: ChordUnit): void;
  (e: "cancel"): void;
  /** 删除当前和弦 */
  (e: "delete"): void;
}>();

const { t } = useI18n();

/** 文本框内容（唯一真相源） */
const text = ref("");
/** 当前时长 */
const beats = ref<ChordBeats>(4);
/** 输入焦点 */
const inputRef = ref<HTMLInputElement | null>(null);

/* ── 初始化 ─────────────────────────────────────── */

watch(
  () => props.modelValue,
  (unit) => {
    text.value = unit ? formatChordUnit(unit) : "";
    beats.value = unit?.beats ?? 4;
  },
  { immediate: true },
);

const parsed = computed<ChordUnit>(() =>
  parseChordUnit(text.value || "", beats.value),
);

const isValid = computed(() => {
  const unit = parsed.value;
  if (unit.noChord) return true;
  if (unit.invisibleRoot) return Boolean(unit.bass);
  if (!unit.root) return false;
  return isKnownChordType(unit.type);
});

/** 可发声性与类型合法性分开提示：类型不认识时给黄色警告而非阻断 */
const typeWarning = computed(() => {
  const unit = parsed.value;
  if (!unit.root || unit.noChord) return false;
  return !isKnownChordType(unit.type);
});

/* ── 根音 ───────────────────────────────────────── */

const ROOTS = [
  "C",
  "Db",
  "D",
  "Eb",
  "E",
  "F",
  "Gb",
  "G",
  "Ab",
  "A",
  "Bb",
  "B",
] as const;

const SHARP_ROOTS = [
  "C",
  "C#",
  "D",
  "D#",
  "E",
  "F",
  "F#",
  "G",
  "G#",
  "A",
  "A#",
  "B",
] as const;

/** 升号拼写开关（不写 settings——面板级临时偏好，提交值不受影响） */
const useSharps = ref(false);
const rootButtons = computed(() => (useSharps.value ? SHARP_ROOTS : ROOTS));

/** 当前根音（用于按钮高亮） */
const currentRoot = computed(() => parsed.value.root);

/** 根音是否与调主音同音（等音，按 chroma 比） */
function isDiatonicRoot(note: string): boolean {
  if (!props.tonic) return false;
  const a = parseChordUnit(note).root;
  const b = parseChordUnit(props.tonic).root;
  return chroma(a) === chroma(b) && chroma(a) !== -1;
}

const CHROMAS: Record<string, number> = {
  C: 0,
  "C#": 1,
  Db: 1,
  D: 2,
  "D#": 3,
  Eb: 3,
  E: 4,
  F: 5,
  "F#": 6,
  Gb: 6,
  G: 7,
  "G#": 8,
  Ab: 8,
  A: 9,
  "A#": 10,
  Bb: 10,
  B: 11,
};
function chroma(note: string): number {
  return CHROMAS[note] ?? -1;
}

/* ── 类型 ───────────────────────────────────────── */

const activeGroup = ref("triad");
const groupTypes = computed(
  () => CHORD_TYPE_GROUPS.find((g) => g.key === activeGroup.value)?.types ?? [],
);

/** 当前类型（用于按钮高亮） */
const currentType = computed(() => parsed.value.type);

/* ── 低音（转位） ────────────────────────────────── */

const bassOpen = ref(false);
const currentBass = computed(() => parsed.value.bass);

/* ── 特殊标记 ───────────────────────────────────── */

function toggleNoChord(): void {
  if (parsed.value.noChord) {
    text.value = "";
  } else {
    text.value = "N.C.";
  }
}

function toggleInvisibleRoot(): void {
  const unit = parsed.value;
  if (unit.invisibleRoot) {
    text.value = unit.bass ?? "";
  } else {
    // 转成 "/<低音>"；无低音时给个占位让用户改
    text.value = `/${unit.bass ?? "C"}`;
  }
}

/** 半音移调当前输入（面板内快速试探，不提交） */
function nudge(semitones: number): void {
  const unit = parsed.value;
  if (!unit.root && !unit.bass) return;
  text.value = formatChordUnit(transposeChordUnit(unit, semitones));
}

/* ── 编辑动作（写回文本） ───────────────────────── */

/** 点根音：保留类型与低音，只换根音 */
function pickRoot(root: string): void {
  const unit = parsed.value;
  if (unit.noChord || unit.invisibleRoot) {
    text.value = root;
    return;
  }
  text.value = `${root}${unit.type}${unit.bass ? `/${unit.bass}` : ""}`;
}

/** 点类型：保留根音与低音，只换类型 */
function pickType(type: string): void {
  const unit = parsed.value;
  const root = unit.root || "C";
  text.value = `${root}${type}${unit.bass ? `/${unit.bass}` : ""}`;
}

/** 点低音：设置/清除转位 */
function pickBass(bass: string | null): void {
  const unit = parsed.value;
  if (unit.invisibleRoot) {
    text.value = bass ? `/${bass}` : "";
    return;
  }
  const root = unit.root || "C";
  text.value = `${root}${unit.type}${bass ? `/${bass}` : ""}`;
  bassOpen.value = false;
}

/* ── 时长 ───────────────────────────────────────── */

const beatLabels = computed(() =>
  CHORD_BEATS_VALUES.map((b) => t(`chordChart.beats.${b}`)),
);

const beatIndex = computed(() => {
  const i = CHORD_BEATS_VALUES.indexOf(beats.value);
  return i >= 0 ? i : CHORD_BEATS_VALUES.length - 1;
});

function onBeats(value: number | number[]): void {
  const raw = Number(Array.isArray(value) ? value[0] : value);
  const picked = CHORD_BEATS_VALUES[raw];
  if (picked !== undefined) beats.value = picked;
}

/* ── 提交 ───────────────────────────────────────── */

function confirm(): void {
  if (!isValid.value) return;
  emit("confirm", { ...parsed.value, beats: beats.value });
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === "Enter") {
    event.preventDefault();
    confirm();
  } else if (event.key === "Escape") {
    event.preventDefault();
    emit("cancel");
  }
}

function focusInput(): void {
  inputRef.value?.focus();
  inputRef.value?.select();
}

defineExpose({ focusInput });
</script>

<template>
  <div
    class="w-80 max-w-[92vw] rounded-2xl border border-base-content/10 bg-base-100 shadow-xl p-3 flex flex-col gap-3"
    role="dialog"
    :aria-label="$t('chordChart.input.title')"
  >
    <!-- ── 文本输入 ── -->
    <div class="flex items-center gap-2">
      <input
        ref="inputRef"
        v-model="text"
        type="text"
        class="input input-sm input-bordered flex-1 font-mono"
        :class="{ 'input-error': !isValid }"
        :placeholder="$t('chordChart.input.placeholder')"
        :aria-label="$t('chordChart.input.textAria')"
        @keydown="onKeydown"
      />
      <button
        type="button"
        class="btn btn-ghost btn-xs btn-square"
        :title="$t('chordChart.input.downSemitone')"
        @click="nudge(-1)"
      >
        <Icon name="minus" :size="13" />
      </button>
      <button
        type="button"
        class="btn btn-ghost btn-xs btn-square"
        :title="$t('chordChart.input.upSemitone')"
        @click="nudge(1)"
      >
        <Icon name="plus" :size="13" />
      </button>
    </div>

    <!-- 预览 + 警告 -->
    <div class="flex items-center gap-2 min-h-5">
      <span class="text-[11px] text-base-content/45">
        {{ $t("chordChart.input.preview") }}
      </span>
      <span class="font-mono text-sm font-semibold">
        {{ isValid ? formatChordUnit(parsed) || "—" : "—" }}
      </span>
      <span
        v-if="typeWarning"
        class="ml-auto flex items-center gap-1 text-[10px] text-warning"
      >
        <Icon name="warning" :size="11" />
        {{ $t("chordChart.input.unknownType") }}
      </span>
    </div>

    <!-- ── 根音 ── -->
    <div>
      <div class="flex items-center gap-1 mb-1.5">
        <span class="text-[11px] text-base-content/50">
          {{ $t("chordChart.input.root") }}
        </span>
        <button
          type="button"
          class="btn btn-ghost btn-xs ml-auto"
          :title="$t('chordChart.input.toggleAccidental')"
          @click="useSharps = !useSharps"
        >
          {{ useSharps ? "#" : "b" }}
        </button>
      </div>
      <div class="grid grid-cols-6 gap-1">
        <button
          v-for="root in rootButtons"
          :key="root"
          type="button"
          class="btn btn-xs"
          :class="{
            'btn-primary': currentRoot === root,
            'btn-ghost': currentRoot !== root,
            'ring-1 ring-primary/30':
              currentRoot !== root && isDiatonicRoot(root),
          }"
          @click="pickRoot(root)"
        >
          {{ root }}
        </button>
      </div>
    </div>

    <!-- ── 类型 ── -->
    <div>
      <div class="flex items-center gap-1 mb-1.5">
        <span class="text-[11px] text-base-content/50">
          {{ $t("chordChart.input.quality") }}
        </span>
      </div>
      <!-- 分组切页：离散几选一 → RangeSlider（ADR 0014） -->
      <RangeSlider
        :model-value="CHORD_TYPE_GROUPS.findIndex((g) => g.key === activeGroup)"
        :min="0"
        :max="CHORD_TYPE_GROUPS.length - 1"
        :step="1"
        size="xs"
        :tick-labels="
          CHORD_TYPE_GROUPS.map((g) => $t(`chordChart.typeGroup.${g.key}`))
        "
        :aria-label="$t('chordChart.input.typeGroupAria')"
        @update:model-value="
          (v) =>
            (activeGroup =
              CHORD_TYPE_GROUPS[Number(Array.isArray(v) ? v[0] : v)]?.key ??
              activeGroup)
        "
      />
      <div class="grid grid-cols-4 gap-1 mt-2 max-h-32 overflow-y-auto">
        <button
          v-for="type in groupTypes"
          :key="type || 'major'"
          type="button"
          class="btn btn-xs"
          :class="currentType === type ? 'btn-primary' : 'btn-ghost'"
          @click="pickType(type)"
        >
          {{ type || $t("chordChart.type.major") }}
        </button>
      </div>
    </div>

    <!-- ── 低音（转位） ── -->
    <div>
      <button
        type="button"
        class="flex items-center gap-1 w-full text-[11px] text-base-content/50 hover:text-base-content/80"
        @click="bassOpen = !bassOpen"
      >
        <Icon :name="bassOpen ? 'chevron-up' : 'chevron-down'" :size="11" />
        {{ $t("chordChart.input.bass") }}
        <span v-if="currentBass" class="font-mono text-primary ml-1">
          /{{ currentBass }}
        </span>
      </button>
      <div v-if="bassOpen" class="grid grid-cols-7 gap-1 mt-1.5">
        <button
          type="button"
          class="btn btn-xs btn-ghost"
          :class="{ 'btn-primary': !currentBass }"
          @click="pickBass(null)"
        >
          {{ $t("chordChart.input.noBass") }}
        </button>
        <button
          v-for="root in ROOTS"
          :key="`bass-${root}`"
          type="button"
          class="btn btn-xs"
          :class="currentBass === root ? 'btn-primary' : 'btn-ghost'"
          @click="pickBass(root)"
        >
          {{ root }}
        </button>
      </div>
    </div>

    <!-- ── 时长 ── -->
    <div>
      <div class="flex items-center gap-1 mb-1.5">
        <span class="text-[11px] text-base-content/50">
          {{ $t("chordChart.input.beats") }}
        </span>
      </div>
      <RangeSlider
        :model-value="beatIndex"
        :min="0"
        :max="CHORD_BEATS_VALUES.length - 1"
        :step="1"
        size="xs"
        :tick-labels="beatLabels"
        :aria-label="$t('chordChart.input.beatsAria')"
        @update:model-value="onBeats"
      />
    </div>

    <!-- ── 特殊标记 + 提交 ── -->
    <div
      class="flex flex-wrap items-center gap-1 pt-1 border-t border-base-content/10"
    >
      <button
        type="button"
        class="btn btn-xs"
        :class="parsed.noChord ? 'btn-primary' : 'btn-ghost'"
        @click="toggleNoChord"
      >
        N.C.
      </button>
      <button
        type="button"
        class="btn btn-xs"
        :class="parsed.invisibleRoot ? 'btn-primary' : 'btn-ghost'"
        @click="toggleInvisibleRoot"
      >
        {{ $t("chordChart.input.invisibleRoot") }}
      </button>

      <span class="flex-1" />

      <button
        type="button"
        class="btn btn-ghost btn-xs text-error"
        :title="$t('chordChart.input.delete')"
        @click="emit('delete')"
      >
        <Icon name="trash" :size="13" />
      </button>
      <button
        type="button"
        class="btn btn-ghost btn-xs"
        @click="emit('cancel')"
      >
        {{ $t("common.cancel") }}
      </button>
      <button
        type="button"
        class="btn btn-primary btn-xs"
        :disabled="!isValid"
        @click="confirm"
      >
        {{ $t("chordChart.input.apply") }}
      </button>
    </div>
  </div>
</template>
