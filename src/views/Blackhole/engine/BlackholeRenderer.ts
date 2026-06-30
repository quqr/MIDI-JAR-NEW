import * as PIXI from "pixi.js";
import type { BlackholeConfig } from "../types";
import { DEFAULT_BLACKHOLE_CONFIG } from "../constants";

// ─── Fragment Shader (inline) ───

const BLACKHOLE_FRAG = `
in vec2 vTextureCoord;
out vec4 finalColor;

uniform sampler2D uTexture;
uniform vec2 uResolution;
uniform float uTime;

uniform float uHoleRadius;
uniform float uLensDepth;
uniform float uStarGain;
uniform float uDiskInner;
uniform float uDiskOuter;
uniform float uDiskIncl;
uniform float uDiskRoll;
uniform float uDiskGain;
uniform float uDiskOpacity;
uniform float uDiskTemp;
uniform float uDopplerMix;
uniform float uDiskBeam;
uniform float uDiskSpeed;
uniform float uDiskWind;
uniform float uDiskContrast;
uniform float uExposure;
uniform float uDriftSpeed;
uniform float uIntensity;

uniform sampler2D uBackground;
uniform float uBackgroundOpacity;
uniform float uHasBackground;

#define N_STEPS 48
#define B_CRIT 2.5980762
#define PI 3.1415927

float hash21(vec2 p) {
    p = fract(p * vec2(234.34, 435.345));
    p += dot(p, p + 34.23);
    return fract(p.x * p.y);
}

float vnoiseWrapY(vec2 p, float perY) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float y0 = mod(i.y, perY), y1 = mod(i.y + 1.0, perY);
    return mix(mix(hash21(vec2(i.x, y0)),       hash21(vec2(i.x + 1.0, y0)), f.x),
               mix(hash21(vec2(i.x, y1)),       hash21(vec2(i.x + 1.0, y1)), f.x),
               f.y);
}

vec2 rot(vec2 v, float a) {
    float c = cos(a), s = sin(a);
    return vec2(c * v.x - s * v.y, s * v.x + c * v.y);
}

vec3 blackbody(float T) {
    float t = clamp(T, 1500.0, 40000.0) / 100.0;
    float r = t <= 66.0 ? 1.0
                        : clamp(1.292936 * pow(t - 60.0, -0.1332047), 0.0, 1.0);
    float g = t <= 66.0 ? clamp(0.3900816 * log(t) - 0.6318414, 0.0, 1.0)
                        : clamp(1.1298909 * pow(t - 60.0, -0.0755148), 0.0, 1.0);
    float b = t >= 66.0 ? 1.0
                        : (t <= 19.0 ? 0.0
                                     : clamp(0.5432068 * log(t - 10.0) - 1.1962540, 0.0, 1.0));
    return vec3(r, g, b);
}

vec3 stars(vec3 d, float time) {
    vec2 sph = vec2(atan(d.x, -d.z), asin(clamp(d.y, -1.0, 1.0)));
    vec2 g   = sph * 40.0;
    vec2 id  = floor(g);
    float h  = hash21(id);
    if (h < 0.92) return vec3(0.0);
    vec2 f   = fract(g) - 0.5;
    vec2 off = (vec2(hash21(id + 17.3), hash21(id + 31.7)) - 0.5) * 0.7;
    float spark = smoothstep(0.15, 0.0, length(f - off));
    float tw    = 0.7 + 0.3 * sin(time * (0.5 + 2.0 * hash21(id + 5.1)) + 40.0 * h);
    vec3 tint   = mix(vec3(1.0, 0.82, 0.60), vec3(0.75, 0.85, 1.0), hash21(id + 2.9));
    return tint * spark * tw * ((h - 0.92) / 0.08);
}

vec3 getBackground(vec3 d, float time, vec2 uv) {
    vec3 starColor = stars(d, time) * uStarGain * 2.0;
    if (uHasBackground > 0.5) {
        vec3 bgImage = texture(uBackground, uv).rgb;
        return mix(starColor, bgImage, uBackgroundOpacity);
    }
    return starColor;
}

void main() {
    vec2  res    = uResolution;
    vec2  uv     = vTextureCoord;
    float aspect = res.x / res.y;
    float t = uTime * uDriftSpeed;

    float rin  = max(uDiskInner, 1.6);
    float rout = max(uDiskOuter, rin + 0.5);

    float I = uIntensity;
    float vis = smoothstep(0.0, 0.10, I);

    // Always show stars/background as baseline
    vec3 skyDir = normalize(vec3((uv - 0.5) * vec2(aspect, 1.0) * 2.0, -1.0));
    vec3 sky = getBackground(skyDir, t, uv);

    if (vis <= 0.0) {
        finalColor = vec4(sky, 1.0);
        return;
    }

    float sz = mix(0.22, 1.0, I);
    float rh = uHoleRadius * sz;

    vec2 center = vec2(
        0.5 + (0.24 * sin(t * 0.21) + 0.05 * sin(t * 0.083)),
        0.5 + (0.42 * sin(t * 0.157 + 2.0) + 0.08 * sin(t * 0.117)));
    center += I * vec2(0.040 * sin(t * 0.83) + 0.020 * sin(t * 1.31),
                       0.030 * sin(t * 1.03 + 1.0));

    float dil = mix(1.0, 0.2, I);

    vec2  p    = (uv - center) * vec2(aspect, 1.0);
    float plen = length(p);
    float W  = B_CRIT / max(rh, 1e-4);
    vec2  pr = rot(vec2(p.x, -p.y), uDiskRoll) * W;
    float b  = length(pr);
    float window = exp(-pow(plen / (7.0 * rh), 2.0));

    float bmax = rout + 3.0;
    float Z0   = max(14.0, rout + 5.0);

    if (b >= bmax) {
        float u_   = Z0 * inversesqrt(Z0 * Z0 + b * b);
        float defl = (2.0 / (W * W)) / max(plen, 1e-4)
                   * (1.29 * u_ + 0.07) * max(uLensDepth - 2.14 * u_ + 0.75, 0.0)
                   * window * vis;
        vec2  dir  = p / max(plen, 1e-5);
        float ab = 0.035 * smoothstep(1.0, 2.0, b / bmax);
        vec3 term = vec3(0.0);
        for (int i = 0; i < 3; i++) {
            float k   = 1.0 + (float(i) - 1.0) * ab;
            vec2  sp  = p - dir * defl * k;
            vec2  suv = 1.0 - abs(1.0 - mod(center + sp / vec2(aspect, 1.0), 2.0));
            vec3 rd = normalize(vec3((suv - 0.5) * vec2(aspect, 1.0) * 2.0, -1.0));
            term[i] = getBackground(rd, uTime, suv)[i];
        }
        vec3 d = normalize(vec3(-(pr / b) * (2.0 / b), -1.0));
        finalColor = vec4(term + getBackground(d, uTime, uv) * window * vis, 1.0);
        return;
    }

    vec3  x  = vec3(pr, Z0);
    vec3  v  = vec3(0.0, 0.0, -1.0);
    float h2 = dot(pr, pr);
    float ci = cos(uDiskIncl), si = sin(uDiskIncl);
    vec3  n  = vec3(0.0, si, ci);
    vec3  e2 = vec3(0.0, ci, -si);
    float sdir = uDiskSpeed < 0.0 ? -1.0 : 1.0;
    float spd  = abs(uDiskSpeed);

    vec3  emitc = vec3(0.0);
    float trans = 1.0;
    float captured = 0.0;
    float sPrev = dot(x, n);
    vec3  xPrev = x;

    for (int i = 0; i < N_STEPS; i++) {
        float r2 = dot(x, x);
        if (r2 < 1.0) { captured = 1.0; break; }
        if (x.z < -Z0 && v.z < 0.0) break;
        if (r2 > 4.0 * Z0 * Z0) break;
        float r  = sqrt(r2);
        float dt = clamp(0.16 * r, 0.03, 1.5);
        vec3 a = -1.5 * h2 * x / (r2 * r2 * r);
        v += a * (0.5 * dt);
        x += v * dt;
        r2 = dot(x, x);
        r  = sqrt(r2);
        a  = -1.5 * h2 * x / (r2 * r2 * r);
        v += a * (0.5 * dt);

        float s = dot(x, n);
        if (s * sPrev < 0.0 && trans > 0.02) {
            float tc = sPrev / (sPrev - s);
            vec3  xc = mix(xPrev, x, tc);
            float rc = length(xc);
            if (rc > rin && rc < rout) {
                float band = smoothstep(rin, rin * 1.25, rc)
                           * (1.0 - smoothstep(rout * 0.70, rout, rc));
                float phi   = atan(dot(xc, e2), xc.x);
                float turns = phi / 6.2831853;
                float kep   = pow(rin / rc, 1.5);
                float gloc  = sqrt(max(1.0 - 1.5 / rc, 0.02));
                float swirl = rc * uDiskWind * 0.12 - t * kep * spd * gloc * dil * sdir;
                float streaks = vnoiseWrapY(vec2(rc * 2.8, turns * 19.0 + swirl * 3.0), 19.0) * 0.65 +
                                vnoiseWrapY(vec2(rc * 1.0, turns * 9.0  + swirl * 1.5 + 7.0), 9.0) * 0.35;
                streaks = 0.35 + uDiskContrast * streaks * streaks;
                vec3  gasdir = normalize(cross(n, xc)) * sdir;
                float beta   = clamp(inversesqrt(max(2.0 * (rc - 1.0), 0.2)), 0.0, 0.99);
                float g      = gloc / max(1.0 + beta * dot(gasdir, normalize(v)), 0.05);
                g = mix(1.0, g, uDopplerMix);
                float xpr   = max(1.0 - sqrt(rin / rc), 0.0);
                float tprof = pow(rin / rc, 0.75) * pow(xpr, 0.25) / 0.488;
                vec3  cbb   = blackbody(uDiskTemp * tprof * g);
                float boost = pow(g, uDiskBeam);
                float density = band * streaks;
                emitc += trans * cbb * (uDiskGain * 2.2 * density * tprof * tprof * boost);
                trans *= 1.0 - clamp(uDiskOpacity * density, 0.0, 1.0);
            }
        }
        sPrev = s;
        xPrev = x;
    }
    if (captured < 0.5 && dot(x, x) < 4.0) captured = 1.0;

    vec3 bg = sky * window;
    if (captured < 0.5) {
        vec3 d = normalize(v);
        bg += getBackground(d, uTime, uv) * window * vis;
        if (d.z < -0.05) {
            float tpl = (-uLensDepth - x.z) / d.z;
            vec3  hp  = x + d * tpl;
            vec2  q   = rot(hp.xy, -uDiskRoll) / W;
            vec2  sp  = vec2(q.x, -q.y);
            vec2  suv = 1.0 - abs(1.0 - mod(center + (p + (sp - p) * window * vis) / vec2(aspect, 1.0), 2.0));
            float toward = smoothstep(0.05, 0.35, -d.z);
            vec3 rd = normalize(vec3((suv - 0.5) * vec2(aspect, 1.0) * 2.0, -1.0));
            bg += getBackground(rd, uTime, suv) * toward;
        }
    }

    vec3 col = bg * trans + (vec3(1.0) - exp(-emitc * uExposure));
    finalColor = vec4(col, 1.0);
}
`;

export class BlackholeRenderer {
  private app: PIXI.Application;
  private container: PIXI.Container;
  private quad: PIXI.Graphics | null = null;
  private filter: PIXI.Filter | null = null;
  private startTime: number = 0;
  private currentConfig: BlackholeConfig;
  private backgroundTexture: PIXI.Texture | null = null;

  constructor(app: PIXI.Application, container: PIXI.Container) {
    this.app = app;
    this.container = container;
    this.currentConfig = { ...DEFAULT_BLACKHOLE_CONFIG };
    this.startTime = performance.now() / 1000;
  }

  init() {
    const { width, height } = this.app.screen;

    // Create a full-screen white quad for the filter to process
    this.quad = new PIXI.Graphics();
    this.quad.rect(0, 0, width, height);
    this.quad.fill(0xffffff);

    // Create the blackhole filter
    this.filter = new PIXI.Filter({
      glProgram: PIXI.GlProgram.from({
        vertex: PIXI.defaultFilterVert,
        fragment: BLACKHOLE_FRAG,
        name: "blackhole-filter",
      }),
      resources: {
        blackholeUniforms: new PIXI.UniformGroup({
          uResolution: { value: [width, height], type: "vec2<f32>" },
          uTime: { value: 0.0, type: "f32" },
          uHoleRadius: { value: this.currentConfig.holeRadius, type: "f32" },
          uLensDepth: { value: this.currentConfig.lensDepth, type: "f32" },
          uStarGain: { value: this.currentConfig.starGain, type: "f32" },
          uDiskInner: { value: this.currentConfig.diskInner, type: "f32" },
          uDiskOuter: { value: this.currentConfig.diskOuter, type: "f32" },
          uDiskIncl: { value: this.currentConfig.diskIncl, type: "f32" },
          uDiskRoll: { value: this.currentConfig.diskRoll, type: "f32" },
          uDiskGain: { value: this.currentConfig.diskGain, type: "f32" },
          uDiskOpacity: { value: this.currentConfig.diskOpacity, type: "f32" },
          uDiskTemp: { value: this.currentConfig.diskTemp, type: "f32" },
          uDopplerMix: { value: this.currentConfig.dopplerMix, type: "f32" },
          uDiskBeam: { value: this.currentConfig.diskBeam, type: "f32" },
          uDiskSpeed: { value: this.currentConfig.diskSpeed, type: "f32" },
          uDiskWind: { value: this.currentConfig.diskWind, type: "f32" },
          uDiskContrast: { value: this.currentConfig.diskContrast, type: "f32" },
          uExposure: { value: this.currentConfig.exposure, type: "f32" },
          uDriftSpeed: { value: this.currentConfig.driftSpeed, type: "f32" },
          uIntensity: { value: this.currentConfig.intensity, type: "f32" },
          uBackgroundOpacity: { value: this.currentConfig.background.opacity, type: "f32" },
          uHasBackground: { value: 0.0, type: "f32" },
        }),
      },
    });

    this.container.addChild(this.quad);
    this.container.filters = [this.filter];
  }

  applyConfig(config: BlackholeConfig) {
    this.currentConfig = { ...config };
    if (!this.filter) return;

    const res = (this.filter as any).resources;
    const u = res?.blackholeUniforms?.uniforms;
    if (!u) return;

    u.uHoleRadius = config.holeRadius;
    u.uLensDepth = config.lensDepth;
    u.uStarGain = config.starGain;
    u.uDiskInner = config.diskInner;
    u.uDiskOuter = config.diskOuter;
    u.uDiskIncl = config.diskIncl;
    u.uDiskRoll = config.diskRoll;
    u.uDiskGain = config.diskGain;
    u.uDiskOpacity = config.diskOpacity;
    u.uDiskTemp = config.diskTemp;
    u.uDopplerMix = config.dopplerMix;
    u.uDiskBeam = config.diskBeam;
    u.uDiskSpeed = config.diskSpeed;
    u.uDiskWind = config.diskWind;
    u.uDiskContrast = config.diskContrast;
    u.uExposure = config.exposure;
    u.uDriftSpeed = config.driftSpeed;
    u.uIntensity = config.intensity;
    u.uBackgroundOpacity = config.background.opacity;
  }

  async setBackgroundTexture(imageUrl: string) {
    if (!this.filter) return;
    const res = (this.filter as any).resources;
    const u = res?.blackholeUniforms?.uniforms;
    if (!u) return;

    if (!imageUrl) {
      this.backgroundTexture?.destroy();
      this.backgroundTexture = null;
      u.uHasBackground = 0.0;
      return;
    }

    try {
      const texture = await PIXI.Assets.load(imageUrl);
      this.backgroundTexture?.destroy();
      this.backgroundTexture = texture;
      this.filter.resources.uBackground = texture;
      u.uHasBackground = 1.0;
    } catch (e) {
      console.warn("Failed to load background texture:", e);
      u.uHasBackground = 0.0;
    }
  }

  update() {
    if (!this.filter) return;
    const res = (this.filter as any).resources;
    const u = res?.blackholeUniforms?.uniforms;
    if (!u) return;

    u.uTime = performance.now() / 1000 - this.startTime;
  }

  resize(width: number, height: number) {
    if (!this.filter) return;
    const res = (this.filter as any).resources;
    const u = res?.blackholeUniforms?.uniforms;
    if (!u) return;

    u.uResolution = [width, height];

    if (this.quad) {
      this.quad.clear();
      this.quad.rect(0, 0, width, height);
      this.quad.fill(0xffffff);
    }
  }

  destroy() {
    this.container.filters = [];
    if (this.quad) {
      this.container.removeChild(this.quad);
      this.quad.destroy();
      this.quad = null;
    }
    this.backgroundTexture?.destroy();
    this.backgroundTexture = null;
    this.filter?.destroy();
    this.filter = null;
  }
}
