// ─── WebGL 工具：Program/Material 封装、Shader 编译、Blit、像素比缩放 ───
// 参考 WebGL-Fluid-Simulation by PavelDoGreat (MIT)

import type { FBO } from "./FramebufferManager";

export type UniformMap = Record<string, WebGLUniformLocation | null>;

/**
 * Shader 程序封装：固定 vertex+fragment，提供 uniforms 查询
 */
export class Program {
  uniforms: UniformMap = {};
  program: WebGLProgram;
  private gl: WebGLRenderingContext;

  constructor(
    gl: WebGLRenderingContext,
    vertexShader: WebGLShader,
    fragmentShader: WebGLShader,
  ) {
    this.gl = gl;
    this.program = createProgram(gl, vertexShader, fragmentShader);
    this.uniforms = getUniforms(gl, this.program);
  }

  bind() {
    this.gl.useProgram(this.program);
  }
}

/**
 * 材质：可按 keywords 切换编译产物的 fragment shader（条件编译）
 */
export class Material {
  vertexShader: WebGLShader;
  fragmentShaderSource: string;
  programs: Record<number, WebGLProgram> = {};
  activeProgram: WebGLProgram | null = null;
  uniforms: UniformMap = {};
  private gl: WebGLRenderingContext;

  constructor(
    gl: WebGLRenderingContext,
    vertexShader: WebGLShader,
    fragmentShaderSource: string,
  ) {
    this.gl = gl;
    this.vertexShader = vertexShader;
    this.fragmentShaderSource = fragmentShaderSource;
  }

  setKeywords(keywords: string[]) {
    let hash = 0;
    for (let i = 0; i < keywords.length; i++) hash += hashCode(keywords[i]);

    let program = this.programs[hash];
    if (program == null) {
      const fragmentShader = compileShader(
        this.gl,
        this.gl.FRAGMENT_SHADER,
        this.fragmentShaderSource,
        keywords,
      );
      program = createProgram(this.gl, this.vertexShader, fragmentShader);
      this.programs[hash] = program;
    }

    if (program === this.activeProgram) return;

    this.uniforms = getUniforms(this.gl, program);
    this.activeProgram = program;
  }

  bind() {
    if (this.activeProgram) {
      this.gl.useProgram(this.activeProgram);
    }
  }
}

export function createProgram(
  gl: WebGLRenderingContext,
  vertexShader: WebGLShader,
  fragmentShader: WebGLShader,
): WebGLProgram {
  const program = gl.createProgram();
  if (!program) throw new Error("Failed to create WebGLProgram");
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.trace(gl.getProgramInfoLog(program));
  }
  return program;
}

export function getUniforms(
  gl: WebGLRenderingContext,
  program: WebGLProgram,
): UniformMap {
  const uniforms: UniformMap = {};
  const uniformCount = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < uniformCount; i++) {
    const info = gl.getActiveUniform(program, i);
    if (info) {
      uniforms[info.name] = gl.getUniformLocation(program, info.name);
    }
  }
  return uniforms;
}

export function compileShader(
  gl: WebGLRenderingContext,
  type: number,
  source: string,
  keywords?: string[] | null,
): WebGLShader {
  source = addKeywords(source, keywords);
  const shader = gl.createShader(type);
  if (!shader) throw new Error("Failed to create WebGLShader");
  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.trace(gl.getShaderInfoLog(shader));
  }
  return shader;
}

function addKeywords(
  source: string,
  keywords?: string[] | null,
): string {
  if (keywords == null) return source;
  let keywordsString = "";
  keywords.forEach((keyword) => {
    keywordsString += "#define " + keyword + "\n";
  });
  return keywordsString + source;
}

/**
 * 创建全屏 quad blit 函数：在初始化时设置 VBO/EBO，调用时绑定 FBO 并 drawElements
 */
export function createBlit(gl: WebGLRenderingContext): (target: FBO | null, clear?: boolean) => void {
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, -1, 1, 1, 1, 1, -1]),
    gl.STATIC_DRAW,
  );
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(
    gl.ELEMENT_ARRAY_BUFFER,
    new Uint16Array([0, 1, 2, 0, 2, 3]),
    gl.STATIC_DRAW,
  );
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(0);

  return (target: FBO | null, clear = false) => {
    if (target == null) {
      gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    } else {
      gl.viewport(0, 0, target.width, target.height);
      gl.bindFramebuffer(gl.FRAMEBUFFER, target.fbo);
    }
    if (clear) {
      gl.clearColor(0.0, 0.0, 0.0, 1.0);
      gl.clear(gl.COLOR_BUFFER_BIT);
    }
    gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
  };
}

export function scaleByPixelRatio(input: number): number {
  const pixelRatio = window.devicePixelRatio || 1;
  return Math.floor(input * pixelRatio);
}

function hashCode(s: string): number {
  if (s.length === 0) return 0;
  let hash = 0;
  for (let i = 0; i < s.length; i++) {
    hash = (hash << 5) - hash + s.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}
