<script setup lang="ts">
import { ref, watch, computed, onMounted } from "vue";
import type { Chord } from "@tonaljs/chord";
import { Note } from "tonal";

import { getContrastColor, getKeySignature } from "@/helpers";

import type {
  KeyboardSettings,
  KeySignatureConfig,
  ClassicKeyboardKeys,
  ClassicNoteDef,
  FlatKeyboardKeys,
  FlatNoteDef,
} from "./types";

import {
  fadeAllHighlights,
  applyHighlightStrategy,
  highlightTargets,
  highlightLabels,
  highlightWrapLabels,
  fadeInfo,
  highlightInfo,
} from "./utils";
import type { HighlightStrategy } from "./utils";

import ClassicBoard from "./classic/Board.vue";
import ClassicLabels from "./classic/Labels.vue";
import FlatBoard from "./flat/Board.vue";
import FlatLabels from "./flat/Labels.vue";
import {
  getKeyboardSizes as getClassicSizes,
  getChromaNoteOffset,
} from "./classic/constants";
import { getKeyboardSizes as getFlatSizes } from "./flat/constants";

import "./classic/classic.css";
import "./flat/flat.css";

interface Props {
  id?: string;
  className?: string;
  keyboard?: KeyboardSettings;
  keySignature?: KeySignatureConfig;
  played?: number[];
  sustained?: number[];
  midi?: number[];
  targets?: number[] | null;
  exactTargets?: boolean;
  chord?: Chord;
  clickable?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  id: undefined,
  className: undefined,
  keyboard: () => ({
    skin: "classic",
    from: "C3",
    to: "B5",
    label: "none",
    keyName: "none",
    keyInfo: "none",
    fadeOutDuration: 0,
    textOpacity: 0.5,
    displaySustained: false,
    wrap: false,
    sizes: {
      radius: 1,
      height: 5,
      ratio: 0.6,
      bevel: true,
    },
    colors: {
      white: "#ffffff",
      black: "#000000",
      played: "#ff0000",
      wrapped: "#800000",
      sustained: "#777777",
    },
  }),
  keySignature: () => getKeySignature("C"),
  played: () => [],
  sustained: () => [],
  midi: () => [],
  targets: null,
  exactTargets: false,
  chord: undefined,
  clickable: false,
});

const emit = defineEmits<{ noteClick: [midi: number] }>();

const pianoRef = ref<HTMLDivElement | null>(null);

const noteStrategies = computed<HighlightStrategy[]>(() => [
  {
    getNotes: () => props.targets ?? undefined,
    className: "exactTarget",
    wrapClassName: "wrapExactTarget",
    shouldApply: () => !!props.targets,
    getLabelNotes: () => props.targets ?? undefined,
  },
  {
    getNotes: () => props.played,
    className: "played",
    wrapClassName: "wrapPlayed",
    shouldApply: () => !!props.played?.length,
  },
  {
    getNotes: () => props.sustained,
    className: "sustained",
    wrapClassName: "wrapSustained",
    shouldApply: (kb) => !!props.sustained?.length && kb.displaySustained,
  },
]);

function applyHighlights() {
  const el = pianoRef.value;
  if (!el) return;

  fadeAllHighlights(el);

  if (props.targets && !props.exactTargets) {
    highlightTargets(el, props.targets);
  }

  // 标准策略：音符高亮 + 可选标签高亮
  for (const strategy of noteStrategies.value) {
    if (strategy.shouldApply(props.keyboard)) {
      applyHighlightStrategy(
        el,
        strategy,
        props.keyboard,
        props.keySignature,
        props.chord,
      );
    }
  }

  // midi 标签高亮：标签数据源取决于 displaySustained，与 wrapLabels 独立
  if (props.midi?.length) {
    const labelMidi = props.keyboard.displaySustained
      ? props.midi
      : props.played;
    if (labelMidi?.length) {
      highlightLabels(
        el,
        props.keySignature,
        props.keyboard,
        labelMidi,
        props.chord,
      );
    }
    if (props.keyboard.wrap) {
      highlightWrapLabels(
        el,
        props.keySignature,
        props.keyboard,
        props.midi,
        props.chord,
      );
    }
  }
}

function applyInfo() {
  const el = pianoRef.value;
  if (!el) return;

  fadeInfo(el);
  highlightInfo(el, props.keyboard.keyInfo, props.chord);
}

const playedKey = computed(() => (props.played ?? []).join(","));
const sustainedKey = computed(() => (props.sustained ?? []).join(","));
const midiKey = computed(() => (props.midi ?? []).join(","));
const targetsKey = computed(() => (props.targets ?? []).join(","));
const chordKey = computed(() =>
  props.chord ? `${props.chord.tonic}-${props.chord.aliases?.[0]}` : "",
);
const keyboardKey = computed(() =>
  props.keyboard ? `${props.keyboard.skin}-${props.keyboard.label}` : "",
);

watch(
  [
    playedKey,
    sustainedKey,
    midiKey,
    targetsKey,
    chordKey,
    keyboardKey,
    () => props.keySignature?.tonic,
    () => props.exactTargets,
  ],
  () => {
    applyHighlights();
  },
);

watch([chordKey, keyboardKey], () => {
  applyInfo();
});

onMounted(() => {
  applyHighlights();
  applyInfo();
});

const style = computed(
  (): Record<string, string | undefined> => ({
    "--PianoKeyboard-white_background":
      props.keyboard.colors.white ?? undefined,
    "--PianoKeyboard-white_color": getContrastColor(
      props.keyboard.colors.white ?? "#ffffff",
    ),
    "--PianoKeyboard-black_background":
      props.keyboard.colors.black ?? undefined,
    "--PianoKeyboard-black_color": getContrastColor(
      props.keyboard.colors.black ?? "#000000",
    ),
    "--PianoKeyboard--played_background":
      props.keyboard.colors.played ?? undefined,
    "--PianoKeyboard--played_color": getContrastColor(
      props.keyboard.colors.played ?? "#ff0000",
    ),
    "--PianoKeyboard--sustained_background":
      props.keyboard.colors.sustained ?? undefined,
    "--PianoKeyboard--sustained_color": getContrastColor(
      props.keyboard.colors.sustained ?? "#777777",
    ),
    "--PianoKeyboard--wrapPlayed_background":
      props.keyboard.colors.wrapped ?? "#800000",
    "--PianoKeyboard--wrapPlayed_color": getContrastColor(
      props.keyboard.colors.wrapped ?? "#800000",
    ),
    "--PianoKeyboard--wrapSustained_background":
      props.keyboard.colors.sustained ?? "#777777",
    "--PianoKeyboard--wrapSustained_color": getContrastColor(
      props.keyboard.colors.sustained ?? "#777777",
    ),
    "--PianoKeyboard-fadeOut_duration": `${props.keyboard.fadeOutDuration}s`,
    "--PianoKeyboard-text_opacity": `${props.keyboard.textOpacity}`,
  }),
);

function buildClassicKeys() {
  const sizes = getClassicSizes(props.keyboard);
  const fromNote = Note.get(Note.simplify(props.keyboard.from) || "C3");
  const toNote = Note.get(Note.simplify(props.keyboard.to) || "B5");

  const noteStart = fromNote.alt
    ? (fromNote.midi ?? 0) - 1
    : (fromNote.midi ?? 0);
  const noteEnd = toNote.alt ? (toNote.midi ?? 0) + 1 : (toNote.midi ?? 0);
  const start = Math.min(noteStart, noteEnd);
  const end = Math.max(noteStart, noteEnd);

  const keys: ClassicKeyboardKeys = {
    width: 0,
    height: sizes.WHITE_HEIGHT,
    whites: [],
    blacks: [],
    labels: [],
  };

  for (let midi = start; midi <= end; midi++) {
    const note = Note.fromMidi(midi);
    const noteDef = Note.get(note);

    let displayName = "";

    switch (props.keyboard.keyName) {
      case "note":
        displayName = note;
        break;
      case "pitchClass":
        displayName = Note.pitchClass(note);
        break;
      case "octave":
        displayName = noteDef.chroma === 0 ? note : "";
        break;
    }

    const noteDefData = {
      displayName,
      name: noteDef.name,
      chroma: noteDef.chroma ?? 0,
      midi: noteDef.midi ?? 0,
    };

    if (noteDef.alt) {
      const offsetX = getChromaNoteOffset(noteDef.chroma) * sizes.BLACK_OFFSET;

      const def: ClassicNoteDef = {
        ...noteDefData,
        offset: keys.width - sizes.BLACK_WIDTH / 2 + offsetX,
        labelOffset: keys.width + offsetX,
      };

      keys.blacks.push(def);
      keys.labels.push(def);
    } else {
      const offsetX =
        (getChromaNoteOffset(noteDef.chroma) *
          (sizes.WHITE_WIDTH - sizes.BLACK_WIDTH)) /
        2;

      const def: ClassicNoteDef = {
        ...noteDefData,
        offset: keys.width,
        labelOffset: keys.width + sizes.WHITE_WIDTH / 2 + offsetX,
      };

      keys.width += sizes.WHITE_WIDTH;
      keys.whites.push(def);
      keys.labels.push(def);
    }
  }

  return { keys, sizes };
}

function buildFlatKeys() {
  const sizes = getFlatSizes(props.keyboard);
  const fromNote = Note.get(Note.simplify(props.keyboard.from) || "C3");
  const toNote = Note.get(Note.simplify(props.keyboard.to) || "B5");

  const noteStart = fromNote.midi ?? 0;
  const noteEnd = toNote.midi ?? 0;
  const start = Math.min(noteStart, noteEnd);
  const end = Math.max(noteStart, noteEnd);

  const keys: FlatKeyboardKeys = {
    width: 0,
    height: sizes.HEIGHT,
    notes: [],
  };

  for (let midi = start; midi <= end; midi++) {
    const note = Note.fromMidi(midi);
    const noteDef = Note.get(note);

    let displayName = "";

    switch (props.keyboard.keyName) {
      case "note":
        displayName = note;
        break;
      case "pitchClass":
        displayName = Note.pitchClass(note);
        break;
      case "octave":
        displayName = noteDef.chroma === 0 ? note : "";
        break;
    }

    const def: FlatNoteDef = {
      displayName,
      name: noteDef.name,
      chroma: noteDef.chroma ?? 0,
      midi: noteDef.midi ?? 0,
      offset: keys.width,
      labelOffset: keys.width + sizes.WIDTH / 2,
      isBlack: !!noteDef.alt,
    };

    keys.width += sizes.WIDTH;
    keys.notes.push(def);
  }

  return { keys, sizes };
}

const classicKeys = computed(() => buildClassicKeys());
const flatKeys = computed(() => buildFlatKeys());
</script>

<template>
  <div
    ref="pianoRef"
    :id="props.id"
    :class="props.className"
    :style="style"
    role="img"
    :aria-label="$t('pianoKeyboard.ariaLabel')"
  >
    <template v-if="props.keyboard.skin === 'classic'">
      <svg
        class="keyboard"
        :class="{ '--withTargets': !!props.targets }"
        :viewBox="`0 0 ${classicKeys.keys.width} ${
          props.keyboard.label !== 'none'
            ? classicKeys.keys.height + classicKeys.sizes.LABEL_HEIGHT
            : classicKeys.keys.height
        }`"
        aria-hidden="true"
        focusable="false"
      >
        <defs>
          <linearGradient id="whiteKey" gradientTransform="rotate(90)">
            <stop offset="0%" stop-color="#000000" stop-opacity="0.2" />
            <stop
              :offset="`${((classicKeys.sizes.WHITE_HEIGHT - classicKeys.sizes.WHITE_BEVEL - 2) / classicKeys.sizes.WHITE_HEIGHT) * 100}%`"
              :stop-color="
                getContrastColor(props.keyboard.colors.white ?? '#ffffff')
              "
              stop-opacity="0"
            />
            <stop
              :offset="`${((classicKeys.sizes.WHITE_HEIGHT - classicKeys.sizes.WHITE_BEVEL) / classicKeys.sizes.WHITE_HEIGHT) * 100}%`"
              :stop-color="
                getContrastColor(props.keyboard.colors.white ?? '#ffffff')
              "
              stop-opacity="0.1"
            />
          </linearGradient>
          <linearGradient id="blackKey" gradientTransform="rotate(90)">
            <stop
              offset="0%"
              :stop-color="
                getContrastColor(props.keyboard.colors.black ?? '#000000')
              "
              stop-opacity="0"
            />
            <stop
              :offset="`${((classicKeys.sizes.BLACK_HEIGHT - classicKeys.sizes.BLACK_BEVEL) / classicKeys.sizes.BLACK_HEIGHT) * 100}%`"
              :stop-color="
                getContrastColor(props.keyboard.colors.black ?? '#000000')
              "
              stop-opacity="0.2"
            />
            <stop
              :offset="`${((classicKeys.sizes.BLACK_HEIGHT - classicKeys.sizes.BLACK_BEVEL) / classicKeys.sizes.BLACK_HEIGHT) * 100}%`"
              stop-color="#ffffff"
              stop-opacity="0.5"
            />
            <stop
              :offset="`${((classicKeys.sizes.BLACK_HEIGHT - classicKeys.sizes.BLACK_BEVEL + 4) / classicKeys.sizes.BLACK_HEIGHT) * 100}%`"
              :stop-color="
                getContrastColor(props.keyboard.colors.black ?? '#000000')
              "
              stop-opacity="0.1"
            />
            <stop
              offset="100%"
              :stop-color="
                getContrastColor(props.keyboard.colors.black ?? '#000000')
              "
              stop-opacity="0"
            />
          </linearGradient>
          <mask id="boardMask">
            <rect
              x="0"
              y="0"
              :width="classicKeys.keys.width"
              :height="classicKeys.keys.height"
              fill="#ffffff"
            />
          </mask>
        </defs>
        <ClassicLabels
          v-if="props.keyboard.label !== 'none'"
          :keys="classicKeys.keys"
          :sizes="classicKeys.sizes"
        />
        <ClassicBoard
          :keys="classicKeys.keys"
          :sizes="classicKeys.sizes"
          :keyboard="props.keyboard"
          :clickable="props.clickable"
          @click="emit('noteClick', $event)"
        />
      </svg>
    </template>
    <template v-if="props.keyboard.skin === 'flat'">
      <svg
        class="keyboard"
        :class="{ '--withTargets': !!props.targets }"
        :viewBox="`0 0 ${flatKeys.keys.width} ${
          props.keyboard.label !== 'none'
            ? flatKeys.keys.height + flatKeys.sizes.LABEL_HEIGHT
            : flatKeys.keys.height
        }`"
        aria-hidden="true"
        focusable="false"
      >
        <FlatLabels
          v-if="props.keyboard.label !== 'none'"
          :keys="flatKeys.keys"
          :sizes="flatKeys.sizes"
        />
        <FlatBoard
          :notes="flatKeys.keys.notes"
          :sizes="flatKeys.sizes"
          :keyboard="props.keyboard"
          :clickable="props.clickable"
          @click="emit('noteClick', $event)"
        />
      </svg>
    </template>
  </div>
</template>
