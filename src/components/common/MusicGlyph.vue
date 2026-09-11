<script setup lang="ts">
/**
 * 音乐符号字形：用 Bravura（SMuFL 参考字体）渲染单个记谱符号。
 *
 * - 码位集中在 `musicGlyphs.ts`（全部经双重验证），组件只做渲染；
 * - CSS 侧复用全局 `.music-glyph`（tailwind.css），保证所有模块的
 *   音乐字形共享同一套字体加载与基线校正；
 * - 无 `label` 时按装饰元素处理（aria-hidden）；给了 label 则暴露给读屏。
 */
import { computed } from "vue";

import { SMUFL_GLYPHS } from "./musicGlyphs";

import type { MusicGlyphName } from "./musicGlyphs";

const props = withDefaults(
  defineProps<{
    /** 字形语义名（见 musicGlyphs.ts） */
    name: MusicGlyphName;
    /** 字号（px）。SMuFL 以 staff 空间设计，1em ≈ 一行五线谱高度 */
    size?: number;
    /** 无障碍标签；不传则按装饰处理 */
    label?: string;
  }>(),
  { size: 16, label: undefined },
);

const char = computed(() => SMUFL_GLYPHS[props.name]);
const style = computed(() => ({ fontSize: `${props.size}px` }));
</script>

<template>
  <span
    class="music-glyph"
    :style="style"
    :role="label ? 'img' : undefined"
    :aria-label="label"
    :aria-hidden="label ? undefined : 'true'"
    >{{ char }}</span
  >
</template>
