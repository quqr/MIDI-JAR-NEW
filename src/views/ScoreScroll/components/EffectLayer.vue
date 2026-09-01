<template>
  <div
    ref="layerEl"
    class="pointer-events-none absolute inset-0 z-10 overflow-visible"
    aria-hidden="true"
  ></div>
</template>

<script setup lang="ts">
/**
 * 特效覆盖层：与 OSMD 内容同坐标系（置于滚动内容内）。
 * 音符命中时在高光框 + 粒子爆散，全部用 animejs JS 动画（无 CSS transition），
 * 动画结束即移除 DOM，颜色使用 daisyUI CSS 变量。
 */
import { ref } from "vue";
import { animate } from "animejs";
import { mapEffectParams, type MappedEffectParams } from "../utils/effects";
import type { ScoreEffectSettings, ScoreNoteInfo } from "../types";

const layerEl = ref<HTMLElement>();

/** 同屏并发特效元素上限，超出时跳过新特效以保护性能 */
const MAX_LIVE_ELEMENTS = 400;

function countLive(): number {
  return layerEl.value?.childElementCount ?? 0;
}

/**
 * 触发一组音符命中的特效
 * @param notes - 命中的音符（含谱面坐标）
 * @param effectSettings - 当前特效参数
 */
function playHit(
  notes: ScoreNoteInfo[],
  effectSettings: ScoreEffectSettings,
): void {
  const layer = layerEl.value;
  if (!layer || notes.length === 0) return;
  if (countLive() > MAX_LIVE_ELEMENTS) return;
  const params = mapEffectParams(effectSettings);
  for (const note of notes) {
    spawnHighlight(layer, note, params);
    spawnFragments(layer, note, params);
  }
}

/** 高光框：放大 + 淡出 */
function spawnHighlight(
  layer: HTMLElement,
  note: ScoreNoteInfo,
  params: MappedEffectParams,
): void {
  const scale = params.highlightScale;
  const w = note.width * scale + params.highlightExpand * 2;
  const h = Math.max(note.height * scale, 12) + params.highlightExpand * 2;
  const cx = note.x + note.width / 2;
  const cy = note.y + note.height / 2;

  const el = document.createElement("div");
  el.style.cssText = [
    "position:absolute",
    `left:${cx - w / 2}px`,
    `top:${cy - h / 2}px`,
    `width:${w}px`,
    `height:${h}px`,
    "border-radius:6px",
    "background:var(--color-primary)",
    `opacity:${params.highlightIntensity * 0.35}`,
    "box-shadow:0 0 12px var(--color-primary)",
  ].join(";");
  layer.appendChild(el);

  animate(el, {
    scale: [1, 1.25],
    opacity: [params.highlightIntensity * 0.35, 0],
    duration: 450,
    easing: "easeOutQuad",
    complete: () => el.remove(),
  });
}

/** 粒子爆散：从音符中心向随机方向飞散 */
function spawnFragments(
  layer: HTMLElement,
  note: ScoreNoteInfo,
  params: MappedEffectParams,
): void {
  const cx = note.x + note.width / 2;
  const cy = note.y + note.height / 2;

  for (let i = 0; i < params.fragmentCount; i++) {
    const el = document.createElement("div");
    const size = 3 + Math.random() * 4;
    el.style.cssText = [
      "position:absolute",
      `left:${cx - size / 2}px`,
      `top:${cy - size / 2}px`,
      `width:${size}px`,
      `height:${size}px`,
      "border-radius:50%",
      "background:var(--color-secondary)",
      "box-shadow:0 0 6px var(--color-secondary)",
      "opacity:1",
    ].join(";");
    layer.appendChild(el);

    const angle = Math.random() * Math.PI * 2;
    const dist = params.scatterDistance * (0.4 + Math.random() * 0.6);
    animate(el, {
      translateX: Math.cos(angle) * dist,
      translateY: Math.sin(angle) * dist,
      scale: [1, 0.2],
      opacity: [1, 0],
      duration: 500 + Math.random() * 250,
      delay: i * params.fragmentStagger,
      easing: "easeOutQuad",
      complete: () => el.remove(),
    });
  }
}

/**
 * 谱面飘入动画（加载完成时调用）
 * @param target - 谱面容器元素
 * @param effectSettings - 当前特效参数
 */
function playDriftIn(
  target: HTMLElement,
  effectSettings: ScoreEffectSettings,
): void {
  const { driftInDistance } = mapEffectParams(effectSettings);
  animate(target, {
    translateY: [-driftInDistance, 0],
    opacity: [0, 1],
    duration: 600,
    easing: "easeOutCubic",
  });
}

defineExpose({ playHit, playDriftIn });
</script>
