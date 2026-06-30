<template>
  <div
    v-if="enabled"
    class="fixed inset-0 z-0 pointer-events-none"
    style="width: 100vw; height: 100vh;"
  >
    <canvas ref="canvasRef" style="display: block; width: 100%; height: 100%;" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick } from "vue";
import * as PIXI from "pixi.js";
import { BlackholeRenderer } from "./engine/BlackholeRenderer";
import type { BlackholeConfig } from "./types";
import { DEFAULT_BLACKHOLE_CONFIG } from "./constants";

const STORAGE_KEY = "blackhole-config";
const GLOBAL_KEY = "blackhole-global-enabled";

const canvasRef = ref<HTMLCanvasElement>();
const enabled = ref(false);

let app: PIXI.Application | null = null;
let renderer: BlackholeRenderer | null = null;
let tickHandler: ((ticker: PIXI.Ticker) => void) | null = null;

function loadConfig(): BlackholeConfig {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      return { ...DEFAULT_BLACKHOLE_CONFIG, ...JSON.parse(saved) };
    }
  } catch {
    // ignore
  }
  return { ...DEFAULT_BLACKHOLE_CONFIG };
}

function loadEnabled(): boolean {
  try {
    return localStorage.getItem(GLOBAL_KEY) === "true";
  } catch {
    return false;
  }
}

async function initPixi() {
  if (!canvasRef.value) return;

  const config = loadConfig();

  app = new PIXI.Application();
  await app.init({
    canvas: canvasRef.value,
    background: "#000000",
    resizeTo: window,
    antialias: false,
    resolution: Math.min(window.devicePixelRatio || 1, 1.5),
    autoDensity: true,
  });

  renderer = new BlackholeRenderer(app, app.stage);
  renderer.init();
  renderer.applyConfig(config);

  if (config.background.imageUrl) {
    renderer.setBackgroundTexture(config.background.imageUrl);
  }

  tickHandler = () => {
    renderer?.update();
  };
  app.ticker.add(tickHandler);
}

// Listen for storage changes to sync enable/disable state
function onStorageChange(e: StorageEvent) {
  if (e.key === GLOBAL_KEY) {
    enabled.value = loadEnabled();
    if (enabled.value && !app) {
      nextTick(() => initPixi());
    } else if (!enabled.value && app) {
      destroyPixi();
    }
  }
  if (e.key === STORAGE_KEY && renderer) {
    renderer.applyConfig(loadConfig());
  }
}

function destroyPixi() {
  if (tickHandler && app) {
    app.ticker.remove(tickHandler);
  }
  renderer?.destroy();
  renderer = null;
  if (app) {
    app.destroy(true);
    app = null;
  }
}

onMounted(async () => {
  enabled.value = loadEnabled();
  if (enabled.value) {
    await nextTick();
    initPixi();
  }
  window.addEventListener("storage", onStorageChange);
});

onUnmounted(() => {
  window.removeEventListener("storage", onStorageChange);
  destroyPixi();
});

// Expose methods for external control
defineExpose({
  enable() {
    enabled.value = true;
    localStorage.setItem(GLOBAL_KEY, "true");
    nextTick(() => initPixi());
  },
  disable() {
    enabled.value = false;
    localStorage.setItem(GLOBAL_KEY, "false");
    destroyPixi();
  },
  toggle() {
    if (enabled.value) {
      this.disable();
    } else {
      this.enable();
    }
  },
  isEnabled: () => enabled.value,
});
</script>
