<template>
  <div ref="containerRef" class="w-full h-full overflow-hidden bg-black">
    <canvas ref="canvasRef" style="display: block; width: 100%; height: 100%;" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, nextTick } from "vue";
import * as PIXI from "pixi.js";
import { BlackholeRenderer } from "./engine/BlackholeRenderer";
import type { BlackholeConfig } from "./types";
import { DEFAULT_BLACKHOLE_CONFIG } from "./constants";

const props = withDefaults(
  defineProps<{
    config?: BlackholeConfig;
  }>(),
  {
    config: () => ({ ...DEFAULT_BLACKHOLE_CONFIG }),
  }
);

const containerRef = ref<HTMLDivElement>();
const canvasRef = ref<HTMLCanvasElement>();

let app: PIXI.Application | null = null;
let renderer: BlackholeRenderer | null = null;
let tickHandler: ((ticker: PIXI.Ticker) => void) | null = null;
let resizeObserver: ResizeObserver | null = null;

async function initPixi() {
  if (!canvasRef.value || !containerRef.value) return;

  const parent = containerRef.value;

  app = new PIXI.Application();
  await app.init({
    canvas: canvasRef.value,
    background: "#000000",
    resizeTo: parent,
    antialias: true,
    resolution: window.devicePixelRatio || 1,
    autoDensity: true,
  });

  renderer = new BlackholeRenderer(app, app.stage);
  renderer.init();
  renderer.applyConfig(props.config);

  // Load background texture if configured
  if (props.config.background.imageUrl) {
    renderer.setBackgroundTexture(props.config.background.imageUrl);
  }

  tickHandler = () => {
    renderer?.update();
  };
  app.ticker.add(tickHandler);

  // Resize observer
  resizeObserver = new ResizeObserver(() => {
    if (!app || !containerRef.value) return;
    const nw = containerRef.value.clientWidth;
    const nh = containerRef.value.clientHeight;
    app.renderer.resize(nw, nh);
    renderer?.resize(nw, nh);
  });
  resizeObserver.observe(parent);
}

watch(
  () => props.config,
  (cfg) => {
    renderer?.applyConfig(cfg);
  },
  { deep: true }
);

watch(
  () => props.config.background.imageUrl,
  (url) => {
    if (renderer) {
      renderer.setBackgroundTexture(url || "");
    }
  }
);

onMounted(async () => {
  await nextTick();
  initPixi();
});

onUnmounted(() => {
  if (tickHandler && app) {
    app.ticker.remove(tickHandler);
  }
  resizeObserver?.disconnect();
  renderer?.destroy();
  renderer = null;
  if (app) {
    app.destroy(true);
    app = null;
  }
});
</script>
