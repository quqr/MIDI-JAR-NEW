<script setup lang="ts">
/**
 * 五度循环圈 — 右侧详情栏。
 *
 * 展示选中调的调号、音阶、7 个顺阶和弦（带罗马数字级数与和弦性质）与近关系调；
 * 提供试听、设为当前调号、跳和弦词典三个动作。
 *
 * 只做呈现与事件上抛：试听状态由页面持有（圈要与它同步呼吸），故经 props 传入。
 */
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { RouterLink } from "vue-router";
import { Chord } from "tonal";
import { Icon } from "@/components/Icon";
import {
  keyDisplayName,
  signatureText,
  getDiatonicChords,
  getScaleNotes,
  type AccidentalPreference,
  type CircleKey,
  type DiatonicChord,
  type KeyMode,
  type KeyRelation,
  type KeySelection,
  type RelationKind,
} from "../circleOfFifths";
import type { PlayingTarget } from "../useCircleAudio";

const props = defineProps<{
  circle: CircleKey[];
  selected: KeySelection;
  relations: KeyRelation[];
  /** 全项目当前调号所在的环上位置 */
  currentPosition: number;
  /** 音名记法偏好（复用 settings.notation.accidentals） */
  accidentals: AccidentalPreference;
  /** 正在试听的对象（音阶或某个和弦） */
  playingKey: PlayingTarget | null;
  /** 音阶播放中当前音的序号（-1 表示未在播音阶） */
  scaleNoteIndex: number;
  /** 音源未加载（试听过但无声） */
  needsInstrument: boolean;
}>();

const emit = defineEmits<{
  (e: "play-scale", tonic: string, mode: KeyMode): void;
  (e: "play-chord", symbol: string): void;
  (e: "stop"): void;
  (e: "use-as-current"): void;
  (e: "select-position", position: number, mode: KeyMode): void;
}>();

const { t } = useI18n();

const slotKey = computed(
  () => props.circle[props.selected.position] ?? props.circle[0],
);

const tonic = computed(() =>
  props.selected.mode === "major"
    ? slotKey.value.majorTonic
    : slotKey.value.minorTonic,
);

const displayName = computed(() =>
  keyDisplayName(tonic.value, props.selected.mode),
);

const scaleNotes = computed(() =>
  getScaleNotes(tonic.value, props.selected.mode),
);

const chords = computed(() =>
  getDiatonicChords(tonic.value, props.selected.mode),
);

/** 该位置是否就是全项目当前调号 */
const isCurrent = computed(
  () => props.selected.position === props.currentPosition,
);

/** 若选中的是小调，设为当前调号会落到同调号的大调上——需要提示用户 */
const currentKeyName = computed(() => slotKey.value.majorTonic);

const signatureLabel = computed(() => {
  const key = slotKey.value;
  if (key.signatureCount === 0) return t("circleOfFifths.signature.none");
  const names = key.signatureAccidentals === "sharp" ? "sharps" : "flats";
  return t(`circleOfFifths.signature.${names}`, { count: key.signatureCount });
});

/** 音阶是否正在播这个调 */
const scalePlaying = computed(
  () =>
    props.playingKey?.kind === "scale" &&
    props.playingKey.tonic === tonic.value &&
    props.playingKey.mode === props.selected.mode,
);

/**
 * 播放序号 → 音阶音级序号。
 * 播放序列为「上行七音 + 高八度主音 + 下行七音」，共 15 个：
 * 0..6 → 音级 0..6；7 → 音级 0；8..14 → 音级 6..0。
 */
function degreeIndexFor(playIndex: number): number {
  if (playIndex < 0) return -1;
  if (playIndex <= 6) return playIndex;
  if (playIndex === 7) return 0;
  return 14 - playIndex;
}

const activeDegree = computed(() => degreeIndexFor(props.scaleNoteIndex));

/* ── 和弦性质 ─────────────────────────────────────────── */

const QUALITY_CLASS: Record<string, string> = {
  Major: "badge-ghost",
  Minor: "badge-info badge-soft",
  Diminished: "badge-warning badge-soft",
  Augmented: "badge-error badge-soft",
};

const QUALITY_KEY: Record<string, string> = {
  Major: "major",
  Minor: "minor",
  Diminished: "diminished",
  Augmented: "augmented",
};

function qualityClass(chord: DiatonicChord): string {
  return QUALITY_CLASS[chord.quality] ?? "badge-ghost";
}

function qualityLabel(chord: DiatonicChord): string {
  const key = QUALITY_KEY[chord.quality];
  return key ? t(`circleOfFifths.quality.${key}`) : chord.quality;
}

/** 和弦词典路由所需的记号（与 ChordNameLink 同样的按记号取名） */
function dictionaryTo(symbol: string): string {
  return `/chord-dictionary/${encodeURIComponent(symbol)}`;
}

/** 供 ChordNameLink 之外的地方判断和弦是否可解析 */
function chordExists(symbol: string): boolean {
  return !Chord.get(symbol).empty;
}

function isChordPlaying(symbol: string): boolean {
  return (
    props.playingKey?.kind === "chord" && props.playingKey.symbol === symbol
  );
}

/* ── 近关系调 ─────────────────────────────────────────── */

const RELATION_CLASS: Record<RelationKind, string> = {
  dominant: "text-success",
  subdominant: "text-info",
  relative: "text-accent",
  parallel: "text-warning",
};

function relationName(kind: RelationKind): string {
  return t(`circleOfFifths.relations.${kind}`);
}

function relationLabel(relation: KeyRelation): string {
  return keyDisplayName(relation.tonic, relation.mode);
}
</script>

<template>
  <aside class="card bg-base-100 border border-base-300 h-full">
    <div class="card-body p-4 gap-5">
      <!-- 调名与调号 -->
      <header>
        <div class="flex items-start justify-between gap-2">
          <div class="min-w-0">
            <div class="flex items-center gap-2 flex-wrap">
              <h2 class="text-3xl font-bold leading-none">{{ displayName }}</h2>
              <span class="badge badge-sm badge-outline">
                {{ t(`circleOfFifths.mode.${selected.mode}`) }}
              </span>
              <span
                v-if="isCurrent"
                class="badge badge-sm badge-secondary"
                :title="t('circleOfFifths.panel.isCurrentHint')"
              >
                {{ t("circleOfFifths.panel.isCurrent") }}
              </span>
            </div>
            <p class="text-sm text-base-content/60 mt-2">
              {{ signatureLabel }}
              <span class="mx-1 text-base-content/30">·</span>
              <span class="font-mono">{{ signatureText(slotKey) }}</span>
            </p>
          </div>

          <button
            type="button"
            class="btn btn-sm shrink-0"
            :class="isCurrent ? 'btn-ghost' : 'btn-outline'"
            :disabled="isCurrent"
            @click="emit('use-as-current')"
          >
            <Icon name="pin" :size="14" />
            {{
              isCurrent
                ? t("circleOfFifths.panel.isCurrent")
                : t("circleOfFifths.panel.useAsCurrent")
            }}
          </button>
        </div>

        <p
          v-if="selected.mode === 'minor' && !isCurrent"
          class="text-xs text-base-content/50 mt-2"
        >
          {{
            t("circleOfFifths.panel.minorKeySignatureHint", {
              major: currentKeyName,
            })
          }}
        </p>
      </header>

      <!-- 音阶 -->
      <section>
        <div class="flex items-center justify-between gap-2 mb-2">
          <h3
            class="text-xs font-semibold uppercase tracking-wide text-base-content/50"
          >
            {{ t("circleOfFifths.panel.scale") }}
          </h3>
          <button
            type="button"
            class="btn btn-xs"
            :class="scalePlaying ? 'btn-ghost' : 'btn-soft'"
            @click="
              scalePlaying
                ? emit('stop')
                : emit('play-scale', tonic, selected.mode)
            "
          >
            <Icon :name="scalePlaying ? 'stop' : 'play'" :size="12" />
            {{
              scalePlaying
                ? t("circleOfFifths.actions.stop")
                : t("circleOfFifths.actions.play")
            }}
          </button>
        </div>

        <div class="flex flex-wrap gap-1.5">
          <span
            v-for="(note, index) in scaleNotes"
            :key="`${note}-${index}`"
            class="badge badge-sm transition-colors duration-150"
            :class="
              scalePlaying && activeDegree === index
                ? 'badge-primary'
                : 'badge-ghost'
            "
          >
            {{ note }}
          </span>
        </div>
      </section>

      <!-- 顺阶和弦 -->
      <section>
        <h3
          class="text-xs font-semibold uppercase tracking-wide text-base-content/50 mb-2"
        >
          {{ t("circleOfFifths.panel.diatonicChords") }}
        </h3>

        <ul class="flex flex-col gap-1">
          <li
            v-for="chord in chords"
            :key="chord.symbol"
            class="flex items-center gap-2 rounded-field px-2 py-1.5 transition-colors duration-150"
            :class="
              isChordPlaying(chord.symbol)
                ? 'bg-primary/10'
                : 'hover:bg-base-200'
            "
          >
            <span
              class="w-9 shrink-0 text-center font-mono text-xs text-base-content/60"
            >
              {{ chord.roman }}
            </span>

            <button
              type="button"
              class="btn btn-ghost btn-xs btn-circle shrink-0"
              :aria-label="
                t('circleOfFifths.actions.playChord', { chord: chord.symbol })
              "
              @click="emit('play-chord', chord.symbol)"
            >
              <Icon
                :name="isChordPlaying(chord.symbol) ? 'speaker' : 'play'"
                :size="12"
              />
            </button>

            <span class="font-semibold text-sm min-w-0 truncate">
              {{ chord.symbol }}
            </span>

            <span class="badge badge-xs shrink-0" :class="qualityClass(chord)">
              {{ qualityLabel(chord) }}
            </span>

            <RouterLink
              v-if="chordExists(chord.symbol)"
              :to="dictionaryTo(chord.symbol)"
              class="btn btn-ghost btn-xs btn-circle ml-auto shrink-0 tooltip tooltip-left"
              :data-tip="t('circleOfFifths.actions.openInDictionary')"
              :aria-label="t('circleOfFifths.actions.openInDictionary')"
            >
              <Icon name="book" :size="12" />
            </RouterLink>
          </li>
        </ul>
      </section>

      <!-- 近关系调 -->
      <section>
        <h3
          class="text-xs font-semibold uppercase tracking-wide text-base-content/50 mb-2"
        >
          {{ t("circleOfFifths.panel.relations") }}
        </h3>

        <ul class="grid grid-cols-2 gap-1.5">
          <li v-for="relation in relations" :key="relation.kind">
            <button
              type="button"
              class="btn btn-sm w-full justify-start gap-2 btn-ghost hover:bg-base-200"
              @click="emit('select-position', relation.position, relation.mode)"
            >
              <span
                class="w-1.5 h-1.5 rounded-full shrink-0 bg-current"
                :class="RELATION_CLASS[relation.kind]"
              />
              <span class="text-xs text-base-content/60 shrink-0">
                {{ relationName(relation.kind) }}
              </span>
              <span class="font-semibold ml-auto truncate">
                {{ relationLabel(relation) }}
              </span>
            </button>
          </li>
        </ul>
      </section>

      <!-- 音源未加载提示 -->
      <div
        v-if="needsInstrument"
        role="alert"
        class="alert alert-warning alert-soft py-2"
      >
        <Icon name="warning" :size="16" />
        <span class="text-xs">{{
          t("circleOfFifths.audio.needsInstrument")
        }}</span>
        <RouterLink to="/sampler" class="btn btn-xs btn-warning">
          {{ t("circleOfFifths.audio.openSampler") }}
        </RouterLink>
      </div>
    </div>
  </aside>
</template>
