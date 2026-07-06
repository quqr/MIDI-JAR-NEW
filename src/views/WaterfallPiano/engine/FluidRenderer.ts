import * as PIXI from "pixi.js";

// ─── 流体模拟：使用轻量化 2D shader 实现薄雾/极光效果 ───
// 在 fragment shader 中完成所有计算，避免 CPU 开销
// 性能监控：低帧率时自动降低分辨率或关闭

const FLUID_FRAG = `
in vec2 vTextureCoord;
out vec4 finalColor;
uniform float uTime;
uniform vec2 uResolution;
uniform float uIntensity; // 演奏强度 0-1
uniform vec3 uColor1;
uniform vec3 uColor2;
uniform vec3 uColor3;

// 简化的 2D 噪声
float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
        mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
        mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x),
        f.y
    );
}

float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 4; i++) {
        v += a * noise(p);
        p *= 2.0;
        a *= 0.5;
    }
    return v;
}

void main() {
    vec2 uv = vTextureCoord;
    vec2 p = uv * 3.0;
    
    // 流动效果
    float t = uTime * 0.05;
    vec2 q = vec2(fbm(p + t), fbm(p + vec2(5.2, 1.3) + t));
    vec2 r = vec2(fbm(p + 4.0 * q + vec2(1.7, 9.2) + t * 0.5), 
                  fbm(p + 4.0 * q + vec2(8.3, 2.8) + t * 0.5));
    float f = fbm(p + 4.0 * r);
    
    // 颜色混合
    vec3 color = mix(uColor1, uColor2, f);
    color = mix(color, uColor3, length(q) * 0.5);
    
    // 演奏强度影响亮度
    float alpha = (0.3 + 0.4 * f) * (0.5 + uIntensity * 0.5);
    
    // 边缘衰减
    float edge = smoothstep(0.0, 0.3, uv.x) * smoothstep(1.0, 0.7, uv.x);
    alpha *= edge * 0.7;
    
    finalColor = vec4(color, alpha);
}
`;

export class FluidRenderer {
  private container: PIXI.Container;
  private sprite: PIXI.Sprite | null = null;
  private filter: PIXI.Filter | null = null;
  private renderTexture: PIXI.RenderTexture | null = null;
  private width = 0;
  private height = 0;
  private enabled = false;
  private resolution = 0.5;
  private degradeMode = false;
  private time = 0;
  private color1: [number, number, number] = [0.1, 0.1, 0.3];
  private color2: [number, number, number] = [0.3, 0.2, 0.6];
  private color3: [number, number, number] = [0.5, 0.4, 0.9];
  private app: PIXI.Application | null = null;

  constructor(container: PIXI.Container, app: PIXI.Application) {
    this.container = container;
    this.app = app;
  }

  setEnabled(enabled: boolean) {
    this.enabled = enabled;
    if (!enabled) {
      this.clear();
    } else {
      this.rebuild();
    }
  }

  setResolution(resolution: number) {
    this.resolution = resolution;
    if (this.enabled) this.rebuild();
  }

  setColors(
    c1: [number, number, number],
    c2: [number, number, number],
    c3: [number, number, number],
  ) {
    this.color1 = c1;
    this.color2 = c2;
    this.color3 = c3;
    this.updateUniforms();
  }

  setDegradeMode(enabled: boolean) {
    this.degradeMode = enabled;
    if (enabled) {
      this.resolution = Math.max(0.25, this.resolution * 0.5);
    }
    if (this.enabled) this.rebuild();
  }

  resize(width: number, height: number) {
    this.width = width;
    this.height = height;
    if (this.enabled) this.rebuild();
  }

  private rebuild() {
    if (!this.enabled || !this.app || this.width === 0 || this.height === 0)
      return;
    this.clear();

    const rtWidth = Math.max(64, Math.floor(this.width * this.resolution));
    const rtHeight = Math.max(64, Math.floor(this.height * this.resolution));

    this.renderTexture = PIXI.RenderTexture.create({
      width: rtWidth,
      height: rtHeight,
    });

    this.sprite = new PIXI.Sprite(this.renderTexture);
    this.sprite.width = this.width;
    this.sprite.height = this.height;
    this.container.addChild(this.sprite);

    this.filter = new PIXI.Filter({
      glProgram: PIXI.GlProgram.from({
        vertex: PIXI.defaultFilterVert,
        fragment: FLUID_FRAG,
        name: "fluid-filter",
      }),
      resources: {
        fluidUniforms: new PIXI.UniformGroup({
          uTime: { value: 0, type: "f32" },
          uResolution: { value: [rtWidth, rtHeight], type: "vec2<f32>" },
          uIntensity: { value: 0, type: "f32" },
          uColor1: { value: this.color1, type: "vec3<f32>" },
          uColor2: { value: this.color2, type: "vec3<f32>" },
          uColor3: { value: this.color3, type: "vec3<f32>" },
        }),
      },
    });

    this.sprite.filters = [this.filter];
  }

  private updateUniforms() {
    if (!this.filter) return;
    const res = (this.filter as any).resources;
    if (res?.fluidUniforms) {
      res.fluidUniforms.uniforms.uColor1 = this.color1;
      res.fluidUniforms.uniforms.uColor2 = this.color2;
      res.fluidUniforms.uniforms.uColor3 = this.color3;
    }
  }

  update(deltaSeconds: number, activeNoteCount: number, _fps: number) {
    if (!this.enabled || !this.filter) return;
    // 降级时冻结时间更新，减少 GPU 开销
    if (!this.degradeMode) {
      this.time += deltaSeconds;
    }
    const intensity = Math.min(1, activeNoteCount / 10);
    const res = (this.filter as any).resources;
    if (res?.fluidUniforms) {
      res.fluidUniforms.uniforms.uTime = this.time;
      res.fluidUniforms.uniforms.uIntensity = intensity;
    }
  }

  clear() {
    if (this.sprite) {
      this.container.removeChild(this.sprite);
      this.sprite.destroy({ children: true });
      this.sprite = null;
    }
    if (this.renderTexture) {
      this.renderTexture.destroy(true);
      this.renderTexture = null;
    }
    if (this.filter) {
      this.filter.destroy();
      this.filter = null;
    }
  }

  destroy() {
    this.clear();
  }
}
