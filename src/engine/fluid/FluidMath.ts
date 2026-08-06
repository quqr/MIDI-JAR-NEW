// ─── 流体纯数学工具：splat 半径校正、HSV→RGB、随机色生成 ───
// 从 FluidSolver.ts 提取的纯函数，无副作用、无 WebGL 依赖

import type { RGBColor } from "./types";

/**
 * 校正 splat 半径：非正方形画布（宽>高）时按宽高比放大半径，避免形变
 */
export function correctRadius(radius: number, aspectRatio: number): number {
  if (aspectRatio > 1) radius *= aspectRatio;
  return radius;
}

/** 随机 HSV → RGB 颜色（参考原项目 generateColor） */
export function generateColor(): RGBColor {
  const c = HSVtoRGB(Math.random(), 1.0, 1.0);
  c.r *= 0.15;
  c.g *= 0.15;
  c.b *= 0.15;
  return c;
}

export function HSVtoRGB(h: number, s: number, v: number): RGBColor {
  let r = 0;
  let g = 0;
  let b = 0;
  const i = Math.floor(h * 6);
  const f = h * 6 - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);

  switch (i % 6) {
    case 0:
      r = v;
      g = t;
      b = p;
      break;
    case 1:
      r = q;
      g = v;
      b = p;
      break;
    case 2:
      r = p;
      g = v;
      b = t;
      break;
    case 3:
      r = p;
      g = q;
      b = v;
      break;
    case 4:
      r = t;
      g = p;
      b = v;
      break;
    case 5:
      r = v;
      g = p;
      b = q;
      break;
  }
  return { r, g, b };
}
