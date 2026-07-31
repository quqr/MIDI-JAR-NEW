<template>
  <div
    v-if="displaySymbol"
    class="inline-flex items-end text-accent"
    style="line-height: 1.2; vertical-align: baseline"
  >
    <!-- 根音 -->
    <span :class="[sizeClass.root, 'font-bold']">
      {{ latinSharpsFlats ? tonicPart : formatSharpsFlats(tonicPart) }}
    </span>

    <!-- 质量 + 上标扩展 -->
    <span :class="[sizeClass.quality, 'font-bold italic']" style="line-height: inherit">
      <span
        :class="{ 'rounded bg-error/20': highlightAlterations }"
        style="margin: 0 0.05em"
      >
        {{ formatQuality(firstToken) }}
      </span>

      <template v-for="(part, index) in restTokens" :key="`${part}_${index}`">
        <sup
          :class="[sizeClass.sup, 'italic', { 'rounded bg-info/20': highlightAlterations }]"
          style="margin: 0 0.05em; font-weight: inherit"
        >
          {{ latinSharpsFlats ? part : formatSharpsFlats(part) }}
        </sup>
      </template>
    </span>

    <!-- 低音（可选） -->
    <span
      v-if="!hideRoot && chord?.root"
      :class="[sizeClass.bass]"
      style="line-height: inherit; opacity: 0.5; margin-left: 0.25em"
    >
      /{{ latinSharpsFlats ? chord.root : formatSharpsFlats(chord.root) }}
    </span>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { Chord } from "@tonaljs/chord";
import {
  formatSharpsFlats,
  tokenizeChord,
  tokenizeChordType,
  formatQuality,
  ALIAS_NOTATION,
} from "@/helpers";

export interface ChordNameProps {
  chord: Chord | null;
  className?: string;
  notation?: "long" | "short" | "symbol" | "preferred" | number;
  hideRoot?: boolean;
  highlightAlterations?: boolean;
  latinSharpsFlats?: boolean;
  size?: 'xl' | '6xl';
}

const props = withDefaults(defineProps<ChordNameProps>(), {
  className: "",
  notation: "preferred",
  hideRoot: false,
  highlightAlterations: false,
  latinSharpsFlats: undefined,
  chord: null,
  size: 'xl',
});

type SizeClass = { root: string; quality: string; sup: string; bass: string };
const FONT_SIZE_MAP: Record<string, SizeClass> = {
  xl: { root: 'text-xl', quality: 'text-lg', sup: 'text-sm', bass: 'text-sm' },
  '6xl': { root: 'text-6xl', quality: 'text-4xl', sup: 'text-2xl', bass: 'text-2xl' },
};

const sizeClass = computed<SizeClass>(() => {
  return FONT_SIZE_MAP[props.size] ?? FONT_SIZE_MAP.xl;
});

const defaultNotation = ALIAS_NOTATION.short;

function getChordSymbol(
  chord: Chord,
  notation: "long" | "short" | "symbol" | number,
): string {
  if (!chord) return "";

  if (typeof notation === "string") {
    const aliasKey = ALIAS_NOTATION[notation as keyof typeof ALIAS_NOTATION];
    if (aliasKey !== undefined && chord.aliases[aliasKey] !== undefined) {
      return chord.tonic + chord.aliases[aliasKey];
    }
  } else if (
    typeof notation === "number" &&
    chord.aliases[notation] !== undefined
  ) {
    return chord.tonic + chord.aliases[notation];
  }

  const shortAliasKey = ALIAS_NOTATION.short;
  if (chord.aliases[shortAliasKey] !== undefined) {
    return chord.tonic + chord.aliases[shortAliasKey];
  }
  return chord.symbol;
}

const displaySymbol = computed(() => {
  const chord = props.chord;
  if (!chord) return "";

  if (props.notation === "preferred") {
    const firstAlias = chord.aliases[0];
    if (firstAlias !== undefined) {
      return chord.tonic + firstAlias;
    }
    return getChordSymbol(chord, defaultNotation);
  }

  return getChordSymbol(chord, props.notation);
});

const tonicPart = computed(() => {
  if (!displaySymbol.value) return "";
  const [tonic] = tokenizeChord(displaySymbol.value);
  return tonic;
});

const chordTokens = computed(() => {
  if (!displaySymbol.value) return [];
  const [, type] = tokenizeChord(displaySymbol.value);
  return tokenizeChordType(type);
});

const firstToken = computed(() => chordTokens.value[0] || "");
const restTokens = computed(() => chordTokens.value.slice(1));
</script>
