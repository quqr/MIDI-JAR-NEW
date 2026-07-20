<script setup lang="ts">
import { ref } from "vue";
import type { Chord } from "@tonaljs/chord";

import { getContrastColor, getKeySignature } from "@/helpers";

import type {
  KeyboardSettings,
  KeySignatureConfig,
} from "./types";

import ClassicBoard from "./classic/Board.vue";
import ClassicLabels from "./classic/Labels.vue";
import FlatBoard from "./flat/Board.vue";
import FlatLabels from "./flat/Labels.vue";

import { useKeyLayout } from "./composables/useKeyLayout";
import { useKeyRendering } from "./composables/useKeyRendering";

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

const { classicKeys, flatKeys } = useKeyLayout(() => props.keyboard);

const pianoRef = ref<HTMLDivElement | null>(null);
const { style } = useKeyRendering(props, pianoRef);
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
