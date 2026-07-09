// ─── WebGL 上下文初始化 + 扩展检测 ───
// 参考 WebGL-Fluid-Simulation by PavelDoGreat (MIT)

export interface GLFormat {
  internalFormat: number;
  format: number;
}

export interface GLExtensions {
  formatRGBA: GLFormat | null;
  formatRG: GLFormat | null;
  formatR: GLFormat | null;
  halfFloatTexType: number;
  supportLinearFiltering: boolean;
}

export interface GLContextResult {
  gl: WebGLRenderingContext;
  ext: GLExtensions;
}

/**
 * 初始化 WebGL 上下文并检测扩展支持
 * 优先尝试 WebGL2，回退到 WebGL1
 */
export function getWebGLContext(canvas: HTMLCanvasElement): GLContextResult {
  const params: WebGLContextAttributes = {
    alpha: true,
    depth: false,
    stencil: false,
    antialias: false,
    preserveDrawingBuffer: false,
  };

  let gl: WebGLRenderingContext | null =
    canvas.getContext("webgl2", params) as WebGL2RenderingContext | null;
  const isWebGL2 = !!gl;
  if (!isWebGL2) {
    gl =
      (canvas.getContext("webgl", params) as WebGLRenderingContext | null) ||
      (canvas.getContext("experimental-webgl", params) as WebGLRenderingContext | null);
  }
  if (!gl) {
    throw new Error("WebGL not supported");
  }

  let halfFloat: OES_texture_half_float | undefined;
  let supportLinearFiltering: boolean;
  if (isWebGL2) {
    gl.getExtension("EXT_color_buffer_float");
    supportLinearFiltering = !!gl.getExtension("OES_texture_float_linear");
  } else {
    halfFloat = gl.getExtension("OES_texture_half_float") ?? undefined;
    supportLinearFiltering = !!gl.getExtension("OES_texture_half_float_linear");
  }

  gl.clearColor(0.0, 0.0, 0.0, 1.0);

  const halfFloatTexType = isWebGL2
    ? (gl as WebGL2RenderingContext).HALF_FLOAT
    : halfFloat?.HALF_FLOAT_OES ?? 0;

  let formatRGBA: GLFormat | null;
  let formatRG: GLFormat | null;
  let formatR: GLFormat | null;

  if (isWebGL2) {
    const wgl2 = gl as WebGL2RenderingContext;
    formatRGBA = getSupportedFormat(
      gl,
      wgl2.RGBA16F,
      wgl2.RGBA,
      halfFloatTexType,
    );
    formatRG = getSupportedFormat(gl, wgl2.RG16F, wgl2.RG, halfFloatTexType);
    formatR = getSupportedFormat(gl, wgl2.R16F, wgl2.RED, halfFloatTexType);
  } else {
    formatRGBA = getSupportedFormat(gl, gl.RGBA, gl.RGBA, halfFloatTexType);
    formatRG = getSupportedFormat(gl, gl.RGBA, gl.RGBA, halfFloatTexType);
    formatR = getSupportedFormat(gl, gl.RGBA, gl.RGBA, halfFloatTexType);
  }

  return {
    gl,
    ext: {
      formatRGBA,
      formatRG,
      formatR,
      halfFloatTexType,
      supportLinearFiltering,
    },
  };
}

function supportRenderTextureFormat(
  gl: WebGLRenderingContext,
  internalFormat: number,
  format: number,
  type: number,
): boolean {
  const texture = gl.createTexture();
  if (!texture) return false;
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    internalFormat,
    4,
    4,
    0,
    format,
    type,
    null,
  );

  const fbo = gl.createFramebuffer();
  if (!fbo) return false;
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  gl.framebufferTexture2D(
    gl.FRAMEBUFFER,
    gl.COLOR_ATTACHMENT0,
    gl.TEXTURE_2D,
    texture,
    0,
  );

  const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
  return status === gl.FRAMEBUFFER_COMPLETE;
}

/**
 * 递归查找可渲染纹理格式：若目标格式不支持则降级到更小通道数的格式
 */
export function getSupportedFormat(
  gl: WebGLRenderingContext,
  internalFormat: number,
  format: number,
  type: number,
): GLFormat | null {
  if (!supportRenderTextureFormat(gl, internalFormat, format, type)) {
    switch (internalFormat) {
      case (gl as WebGL2RenderingContext).R16F:
        return getSupportedFormat(
          gl,
          (gl as WebGL2RenderingContext).RG16F,
          (gl as WebGL2RenderingContext).RG,
          type,
        );
      case (gl as WebGL2RenderingContext).RG16F:
        return getSupportedFormat(
          gl,
          (gl as WebGL2RenderingContext).RGBA16F,
          (gl as WebGL2RenderingContext).RGBA,
          type,
        );
      default:
        return null;
    }
  }
  return { internalFormat, format };
}
