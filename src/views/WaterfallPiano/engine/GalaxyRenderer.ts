import { Geometry, GlProgram, Mesh, Shader, UniformGroup } from "pixi.js";
import type { Container } from "pixi.js";
import { colord } from "colord";
import { getDaisyUIColor } from "@/helpers/color";
import type { GalaxyConfig } from "../types";

/**
 * Galaxy 星系背景渲染器（按 reactbits Galaxy 原始 ogl 实现移植到 PixiJS v8）
 *
 * 本质：一个**全屏三角形** + 单 fragment shader 星场（多层视差星星、闪烁、辉光、
 * 色相偏移）。绝不是 3D 粒子网格。
 *
 * - 全屏三角形 3 顶点（position/uv 直接输出裁剪空间 `gl_Position = vec4(position,0,1)`），
 *   不依赖任何 transform，恒覆盖整个画布。
 * - ogl 的 GLSL ES 1.00 源码（attribute/varying/gl_FragColor）在不带 `#version 300 es`
 *   头时，Pixi v8 的 GlProgram 会按 ES 1.00 原样编译，因此 shader 几乎逐字移植。
 * - bool 型 uniform（uMouseRepulsion / uTransparent）经 Pixi UniformGroup 类型兼容性考虑
 *   改为 float 0/1，shader 内条件判 `> 0.5`。
 * - Pixi v8 输出为**预乘 alpha**：transparent 分支输出 `vec4(col * alpha, alpha)`，
 *   配 blendMode "normal"（等价 SRC_ALPHA / ONE_MINUS_SRC_ALPHA），galaxy 以透明方式合成，
 *   流体 canvas（位于其下）可穿透显示，互不遮挡。
 *
 * 本需求鼠标交互全部关闭：uMouseRepulsion=0、uAutoCenterRepulsion=0、uMouseActiveFactor=0、
 * uMouse=[0.5,0.5]；uTwinkleIntensity=0.3、uLightMode=0、uTransparent=1。
 */

const VERT = /* glsl */ `
attribute vec2 uv;
attribute vec2 position;
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

const FRAG = /* glsl */ `
precision highp float;

uniform float uTime;
uniform vec3 uResolution;
uniform vec2 uFocal;
uniform vec2 uRotation;
uniform float uStarSpeed;
uniform float uDensity;
uniform float uHueShift;
uniform float uSpeed;
uniform vec2 uMouse;
uniform float uGlowIntensity;
uniform float uSaturation;
uniform float uMouseRepulsion;
uniform float uTwinkleIntensity;
uniform float uRotationSpeed;
uniform float uRepulsionStrength;
uniform float uMouseActiveFactor;
uniform float uAutoCenterRepulsion;
uniform float uTransparent;
uniform float uLightMode;

varying vec2 vUv;

#define NUM_LAYER 4.0
#define STAR_COLOR_CUTOFF 0.2
#define MAT45 mat2(0.7071, -0.7071, 0.7071, 0.7071)
#define PERIOD 3.0

float Hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float tri(float x) {
  return abs(fract(x) * 2.0 - 1.0);
}

float tris(float x) {
  float t = fract(x);
  return 1.0 - smoothstep(0.0, 1.0, abs(2.0 * t - 1.0));
}

float trisn(float x) {
  float t = fract(x);
  return 2.0 * (1.0 - smoothstep(0.0, 1.0, abs(2.0 * t - 1.0))) - 1.0;
}

vec3 hsv2rgb(vec3 c) {
  vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
  vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
  return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

float Star(vec2 uv, float flare) {
  float d = length(uv);
  float m = (0.05 * uGlowIntensity) / d;
  float rays = smoothstep(0.0, 1.0, 1.0 - abs(uv.x * uv.y * 1000.0));
  m += rays * flare * uGlowIntensity;
  uv *= MAT45;
  rays = smoothstep(0.0, 1.0, 1.0 - abs(uv.x * uv.y * 1000.0));
  m += rays * 0.3 * flare * uGlowIntensity;
  m *= smoothstep(1.0, 0.2, d);
  return m;
}

vec3 StarLayer(vec2 uv) {
  vec3 col = vec3(0.0);

  vec2 gv = fract(uv) - 0.5;
  vec2 id = floor(uv);

  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec2 offset = vec2(float(x), float(y));
      vec2 si = id + vec2(float(x), float(y));
      float seed = Hash21(si);
      float size = fract(seed * 345.32);
      float glossLocal = tri(uStarSpeed / (PERIOD * seed + 1.0));
      float flareSize = smoothstep(0.9, 1.0, size) * glossLocal;

      float red = smoothstep(STAR_COLOR_CUTOFF, 1.0, Hash21(si + 1.0)) + STAR_COLOR_CUTOFF;
      float blu = smoothstep(STAR_COLOR_CUTOFF, 1.0, Hash21(si + 3.0)) + STAR_COLOR_CUTOFF;
      float grn = min(red, blu) * seed;
      vec3 base = vec3(red, grn, blu);

      float hue = atan(base.g - base.r, base.b - base.r) / (2.0 * 3.14159) + 0.5;
      hue = fract(hue + uHueShift / 360.0);
      float sat = length(base - vec3(dot(base, vec3(0.299, 0.587, 0.114)))) * uSaturation;
      float val = max(max(base.r, base.g), base.b);
      base = hsv2rgb(vec3(hue, sat, val));

      vec2 pad = vec2(tris(seed * 34.0 + uTime * uSpeed / 10.0), tris(seed * 38.0 + uTime * uSpeed / 30.0)) - 0.5;

      float star = Star(gv - offset - pad, flareSize);
      vec3 color = base;

      float twinkle = trisn(uTime * uSpeed + seed * 6.2831) * 0.5 + 1.0;
      twinkle = mix(1.0, twinkle, uTwinkleIntensity);
      star *= twinkle;

      col += star * size * color;
    }
  }

  return col;
}

void main() {
  vec2 focalPx = uFocal * uResolution.xy;
  vec2 uv = (vUv * uResolution.xy - focalPx) / uResolution.y;

  vec2 mouseNorm = uMouse - vec2(0.5);

  if (uAutoCenterRepulsion > 0.5) {
    vec2 centerUV = vec2(0.0, 0.0);
    float centerDist = length(uv - centerUV);
    vec2 repulsion = normalize(uv - centerUV) * (uAutoCenterRepulsion / (centerDist + 0.1));
    uv += repulsion * 0.05;
  } else if (uMouseRepulsion > 0.5) {
    vec2 mousePosUV = (uMouse * uResolution.xy - focalPx) / uResolution.y;
    float mouseDist = length(uv - mousePosUV);
    vec2 repulsion = normalize(uv - mousePosUV) * (uRepulsionStrength / (mouseDist + 0.1));
    uv += repulsion * 0.05 * uMouseActiveFactor;
  } else {
    vec2 mouseOffset = mouseNorm * 0.1 * uMouseActiveFactor;
    uv += mouseOffset;
  }

  float autoRotAngle = uTime * uRotationSpeed;
  mat2 autoRot = mat2(cos(autoRotAngle), -sin(autoRotAngle), sin(autoRotAngle), cos(autoRotAngle));
  uv = autoRot * uv;

  uv = mat2(uRotation.x, -uRotation.y, uRotation.y, uRotation.x) * uv;

  vec3 col = vec3(0.0);

  for (float i = 0.0; i < 1.0; i += 1.0 / NUM_LAYER) {
    float depth = fract(i + uStarSpeed * uSpeed);
    float scale = mix(20.0 * uDensity, 0.5 * uDensity, depth);
    float fade = depth * smoothstep(1.0, 0.9, depth);
    col += StarLayer(uv * scale + i * 453.32) * fade;
  }

  if (uLightMode > 0.5) {
    float energy = max(max(col.r, col.g), col.b);
    float coverage = clamp(smoothstep(0.0, 0.42, energy) * 0.92, 0.0, 0.92);
    vec3 ink = clamp(col * 0.48, 0.0, 0.82);
    gl_FragColor = vec4(mix(vec3(1.0), ink, coverage), 1.0);
  } else if (uTransparent > 0.5) {
    // Pixi v8 使用预乘 alpha 帧缓冲：col 先乘 alpha 再输出，配 blendMode "normal" 等价
    // SRC_ALPHA / ONE_MINUS_SRC_ALPHA，使星场以透明方式合成，不遮挡下层流体 canvas。
    float alpha = length(col);
    alpha = smoothstep(0.0, 0.3, alpha);
    alpha = min(alpha, 1.0);
    gl_FragColor = vec4(col * alpha, alpha);
  } else {
    gl_FragColor = vec4(col, 1.0);
  }
}
`;

export class GalaxyRenderer {
  private mesh: Mesh<Geometry, Shader> | null = null;
  private geometry: Geometry | null = null;
  private uniforms: UniformGroup | null = null;
  private config: GalaxyConfig | null = null;

  private width = 0;
  private height = 0;
  /** 累计时间（秒），render 时按 dt × 1 推进（等价 reference 的 t*0.001） */
  private time = 0;
  /** 星星滚动累计值 = time × starSpeed / 10（等价 reference 直接写入的 uStarSpeed） */
  private starSpeedAcc = 0;
  private lastTime: number | null = null;

  /** 主题色相缓存：useThemeColors=true 时定期刷新（getComputedStyle 较贵） */
  private themeHue: number | null = null;
  private themeHueFrame = 0;
  private frameCount = 0;

  init(container: Container, config: GalaxyConfig): void {
    this.config = config;
    this.uniforms = new UniformGroup({
      uTime: { value: 0, type: "f32" },
      uResolution: { value: [1, 1, 1], type: "vec3<f32>" },
      uFocal: { value: [0.5, 0.5], type: "vec2<f32>" },
      uRotation: { value: [1, 0], type: "vec2<f32>" },
      uStarSpeed: { value: 0, type: "f32" },
      uDensity: { value: config.density, type: "f32" },
      uHueShift: {
        value: this.resolveHueShift(config),
        type: "f32",
      },
      uSpeed: { value: config.speed, type: "f32" },
      uMouse: { value: [0.5, 0.5], type: "vec2<f32>" },
      uGlowIntensity: { value: config.glowIntensity, type: "f32" },
      uSaturation: { value: config.saturation, type: "f32" },
      // 鼠标交互全部关闭
      uMouseRepulsion: { value: 0, type: "f32" },
      uTwinkleIntensity: { value: 0.3, type: "f32" },
      uRotationSpeed: { value: config.rotationSpeed, type: "f32" },
      uRepulsionStrength: { value: 0, type: "f32" },
      uMouseActiveFactor: { value: 0, type: "f32" },
      uAutoCenterRepulsion: { value: 0, type: "f32" },
      uTransparent: { value: 1, type: "f32" },
      uLightMode: { value: 0, type: "f32" },
    });

    this.geometry = this.buildFullscreenTriangle();
    const shader = new Shader({
      glProgram: GlProgram.from({ vertex: VERT, fragment: FRAG }),
      resources: { uniforms: this.uniforms },
    });
    const mesh = new Mesh({ geometry: this.geometry, shader });
    this.mesh = mesh;
    // 预乘 alpha 帧缓冲：normal 混合即 SRC_ALPHA / ONE_MINUS_SRC_ALPHA 语义
    mesh.blendMode = "normal";
    mesh.renderable = config.enabled;
    container.addChild(mesh);
  }

  resize(width: number, height: number, dpr = 1): void {
    this.width = Math.max(1, width);
    this.height = Math.max(1, height);
    if (!this.uniforms) return;
    const pxW = this.width * dpr;
    const pxH = this.height * dpr;
    (this.uniforms.uniforms as Record<string, number[]>).uResolution = [
      pxW,
      pxH,
      pxW / pxH,
    ];
  }

  setConfig(config: GalaxyConfig): void {
    this.config = config;
    if (!this.uniforms) return;
    const u = this.uniforms.uniforms as Record<string, number | number[]>;
    u.uDensity = config.density;
    u.uGlowIntensity = config.glowIntensity;
    u.uSaturation = config.saturation;
    u.uSpeed = config.speed;
    u.uRotationSpeed = config.rotationSpeed;
    u.uHueShift = this.resolveHueShift(config);
    if (this.mesh) this.mesh.renderable = config.enabled;
  }

  /**
   * 推进动画并标记 mesh 可渲染（实际 GPU 绘制随场景 renderFrame 提交）
   * @param nowMs - performance.now() 时间戳（由 BackgroundRenderer 透传）
   */
  render(nowMs: number): void {
    if (!this.uniforms || !this.config || !this.config.enabled) {
      this.lastTime = null;
      return;
    }
    // 首帧或暂停恢复后重置 lastTime，避免超大 dt
    const last = this.lastTime ?? nowMs;
    this.lastTime = nowMs;
    const dtSec = Math.min(0.1, Math.max(0, (nowMs - last) / 1000));
    this.time += dtSec;
    this.starSpeedAcc = (this.time * this.config.starSpeed) / 10.0;

    // 主题色相每 ~60 帧刷新一次
    this.frameCount++;
    if (
      this.config.useThemeColors &&
      this.frameCount - this.themeHueFrame >= 60
    ) {
      this.themeHueFrame = this.frameCount;
      const hue = this.readThemeHue();
      if (hue !== null && hue !== this.themeHue) {
        this.themeHue = hue;
        (this.uniforms.uniforms as Record<string, number>).uHueShift = hue;
      }
    }

    const u = this.uniforms.uniforms as Record<string, number>;
    u.uTime = this.time;
    u.uStarSpeed = this.starSpeedAcc;
  }

  dispose(): void {
    this.mesh?.destroy();
    this.mesh = null;
    // Mesh.destroy 默认不销毁 geometry，需显式释放
    this.geometry?.destroy();
    this.geometry = null;
    this.uniforms = null;
    this.config = null;
  }

  // ── 内部实现 ──

  /** 全屏三角形：3 顶点覆盖整个裁剪空间，uv 映射 [0,1]² 到可见屏幕 */
  private buildFullscreenTriangle(): Geometry {
    // 裁剪空间顶点：(-1,-1) (3,-1) (-1,3) 覆盖整屏
    const position = new Float32Array([-1, -1, 3, -1, -1, 3]);
    // 对应 uv：(0,0) (2,0) (0,2)，可见区域插值到 [0,1]²
    const uv = new Float32Array([0, 0, 2, 0, 0, 2]);
    return new Geometry({
      attributes: {
        position: { buffer: position, format: "float32x2" },
        uv: { buffer: uv, format: "float32x2" },
      },
      indexBuffer: new Uint32Array([0, 1, 2]),
    });
  }

  /** 解析最终色相（度）：useThemeColors 时用主题色派生（缓存），否则用配置值 */
  private resolveHueShift(config: GalaxyConfig): number {
    if (config.useThemeColors) {
      if (this.themeHue === null) this.themeHue = this.readThemeHue();
      return this.themeHue ?? config.hueShift;
    }
    return config.hueShift;
  }

  /** 从 daisyUI --color-primary 读取色相（度），失败返回 null 由调用方回退 */
  private readThemeHue(): number | null {
    try {
      const hex = getDaisyUIColor("primary");
      const hue = colord(hex).hue();
      return Number.isFinite(hue) ? hue : null;
    } catch {
      return null;
    }
  }
}
