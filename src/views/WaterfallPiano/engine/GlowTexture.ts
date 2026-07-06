import * as PIXI from "pixi.js";

// ─── 预渲染发光圆形纹理（高斯模糊） ───
// 使用一次创建多次复用，避免运行时开销

let glowTextureCache: PIXI.Texture | null = null;
let starTextureCache: PIXI.Texture | null = null;

export function getGlowTexture(): PIXI.Texture {
  if (glowTextureCache) return glowTextureCache;
  const size = 64;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const gradient = ctx.createRadialGradient(
    size / 2,
    size / 2,
    0,
    size / 2,
    size / 2,
    size / 2,
  );
  gradient.addColorStop(0, "rgba(255,255,255,1)");
  gradient.addColorStop(0.3, "rgba(255,255,255,0.7)");
  gradient.addColorStop(0.7, "rgba(255,255,255,0.2)");
  gradient.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);

  glowTextureCache = PIXI.Texture.from(canvas);
  return glowTextureCache;
}

export function getStarTexture(): PIXI.Texture {
  if (starTextureCache) return starTextureCache;
  const size = 32;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  // 4 角星：通过十字光晕 + 中心圆
  const cx = size / 2;
  const cy = size / 2;
  // 中心实心
  const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, size / 4);
  gradient.addColorStop(0, "rgba(255,255,255,1)");
  gradient.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(cx, cy, size / 4, 0, Math.PI * 2);
  ctx.fill();
  // 十字光晕
  ctx.strokeStyle = "rgba(255,255,255,0.4)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cx, 0);
  ctx.lineTo(cx, size);
  ctx.moveTo(0, cy);
  ctx.lineTo(size, cy);
  ctx.stroke();

  starTextureCache = PIXI.Texture.from(canvas);
  return starTextureCache;
}

export function clearGlowTextureCache() {
  glowTextureCache?.destroy(true);
  starTextureCache?.destroy(true);
  glowTextureCache = null;
  starTextureCache = null;
}

// ─── 生命周期曲线（Particular 风格） ───
// 使用 smoothstep / sine 曲线让粒子大小和不透明度从 0 → 峰值 → 0
export function lifecycleCurve(lifeRatio: number): number {
  // lifeRatio: 0 (诞生) → 1 (消亡)
  // 使用 sin(π * x)：0→1→0
  return Math.sin(Math.PI * Math.max(0, Math.min(1, lifeRatio)));
}

// 双峰曲线：快速上升到峰值，缓慢衰减
export function lifecyclePeaked(lifeRatio: number, peak = 0.3): number {
  const x = Math.max(0, Math.min(1, lifeRatio));
  if (x < peak) {
    // 0 → 1 在 peak 之前
    return x / peak;
  }
  // 1 → 0 在 peak 之后
  return 1 - (x - peak) / (1 - peak);
}
