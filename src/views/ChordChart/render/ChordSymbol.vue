<script setup lang="ts">
/**
 * 和弦符号排版（iReal 观感）：根音大字、后缀小字微升、斜线低音小字。
 *
 * 显示层职责：
 * - symbol 记法查 `SYMBOL_SUFFIX` 表（仅显示，不回写数据）；
 * - alternate（上方小和弦）小一号叠在主和弦上方；
 * - N.C. / 不可见根音（只显示 "/B"）；
 * - 升降号用 ♭♯ 字形（显示层）。
 */
import { computed } from "vue";

import { suffixForDisplay } from "../domain/chordText";

import type { ChordNotation, ChordUnit } from "../domain/types";

const props = defineProps<{
  unit: ChordUnit;
  /** 谱面显示记法偏好（meta.notation） */
  notation?: ChordNotation;
}>();

/** 音名显示：b→♭、#→♯ */
function pretty(name: string): string {
  return name.replace(/b/g, "♭").replace(/#/g, "♯");
}

const rootLabel = computed(() =>
  props.unit.noChord ? "" : pretty(props.unit.root),
);
const suffixLabel = computed(() =>
  suffixForDisplay(props.unit.type, props.notation ?? "symbol"),
);
const bassLabel = computed(() =>
  props.unit.bass ? `/${pretty(props.unit.bass)}` : "",
);
</script>

<template>
  <!-- N.C. -->
  <span v-if="unit.noChord" class="font-bold text-[13px] text-base-content/70">
    N.C.
  </span>

  <!-- 不可见根音：只显示斜线低音 -->
  <span
    v-else-if="unit.invisibleRoot"
    class="font-bold text-[13px] leading-none"
  >
    {{ bassLabel }}
  </span>

  <!-- 常规和弦 -->
  <span
    v-else
    class="inline-flex flex-col items-center justify-center leading-none"
  >
    <!-- 上方小和弦 -->
    <span
      v-if="unit.alternate"
      class="text-[9px] font-semibold text-base-content/60 leading-tight"
    >
      <template v-if="unit.alternate.noChord">N.C.</template>
      <template v-else>
        {{ pretty(unit.alternate.root)
        }}{{ suffixForDisplay(unit.alternate.type, notation ?? "symbol")
        }}{{ unit.alternate.bass ? `/${pretty(unit.alternate.bass)}` : "" }}
      </template>
    </span>
    <span class="whitespace-nowrap">
      <span class="font-bold text-[15px]">{{ rootLabel }}</span
      ><span class="font-semibold text-[10px] relative -top-[0.28em]">{{
        suffixLabel
      }}</span
      ><span v-if="bassLabel" class="font-semibold text-[11px]">{{
        bassLabel
      }}</span>
    </span>
  </span>
</template>
