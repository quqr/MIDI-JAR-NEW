// ─── FBO 创建/管理/resize + 异步纹理加载 ───
// 参考 WebGL-Fluid-Simulation by PavelDoGreat (MIT)

import type { GLExtensions } from "./GLContext";
import { Program } from "./GLUtils";

export interface FBO {
  texture: WebGLTexture;
  fbo: WebGLFramebuffer;
  width: number;
  height: number;
  texelSizeX: number;
  texelSizeY: number;
  attach(id: number): number;
}

export interface DoubleFBO {
  width: number;
  height: number;
  texelSizeX: number;
  texelSizeY: number;
  read: FBO;
  write: FBO;
  swap(): void;
}

export interface TextureObject {
  texture: WebGLTexture;
  width: number;
  height: number;
  attach(id: number): number;
}

/**
 * 创建单 FBO：分配纹理 + 帧缓冲，附带 attach 函数（便于设置 sampler uniform）
 */
export function createFBO(
  gl: WebGLRenderingContext,
  _ext: GLExtensions,
  w: number,
  h: number,
  internalFormat: number,
  format: number,
  type: number,
  param: number,
): FBO {
  gl.activeTexture(gl.TEXTURE0);
  const texture = gl.createTexture();
  if (!texture) throw new Error("Failed to create texture");
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, param);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, param);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texImage2D(gl.TEXTURE_2D, 0, internalFormat, w, h, 0, format, type, null);

  const fbo = gl.createFramebuffer();
  if (!fbo) throw new Error("Failed to create framebuffer");
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  gl.framebufferTexture2D(
    gl.FRAMEBUFFER,
    gl.COLOR_ATTACHMENT0,
    gl.TEXTURE_2D,
    texture,
    0,
  );
  gl.viewport(0, 0, w, h);
  gl.clear(gl.COLOR_BUFFER_BIT);

  const texelSizeX = 1.0 / w;
  const texelSizeY = 1.0 / h;

  return {
    texture,
    fbo,
    width: w,
    height: h,
    texelSizeX,
    texelSizeY,
    attach(id: number): number {
      gl.activeTexture(gl.TEXTURE0 + id);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      return id;
    },
  };
}

/**
 * 创建双 FBO（ping-pong）：速度场/染料场/压力场都需要双缓冲
 */
export function createDoubleFBO(
  gl: WebGLRenderingContext,
  ext: GLExtensions,
  w: number,
  h: number,
  internalFormat: number,
  format: number,
  type: number,
  param: number,
): DoubleFBO {
  let fbo1 = createFBO(gl, ext, w, h, internalFormat, format, type, param);
  let fbo2 = createFBO(gl, ext, w, h, internalFormat, format, type, param);

  return {
    width: w,
    height: h,
    texelSizeX: fbo1.texelSizeX,
    texelSizeY: fbo1.texelSizeY,
    get read(): FBO {
      return fbo1;
    },
    set read(value: FBO) {
      fbo1 = value;
    },
    get write(): FBO {
      return fbo2;
    },
    set write(value: FBO) {
      fbo2 = value;
    },
    swap(): void {
      const temp = fbo1;
      fbo1 = fbo2;
      fbo2 = temp;
    },
  };
}

/**
 * resize 单 FBO：用 copyProgram 拷贝旧纹理内容到新 FBO
 */
export function resizeFBO(
  gl: WebGLRenderingContext,
  ext: GLExtensions,
  target: FBO,
  w: number,
  h: number,
  internalFormat: number,
  format: number,
  type: number,
  param: number,
  copyProgram: Program,
  blit: (target: FBO | null, clear?: boolean) => void,
): FBO {
  const newFBO = createFBO(gl, ext, w, h, internalFormat, format, type, param);
  copyProgram.bind();
  gl.uniform1i(copyProgram.uniforms.uTexture, target.attach(0));
  blit(newFBO);
  return newFBO;
}

/**
 * resize 双 FBO：read 拷贝内容，write 重新创建
 */
export function resizeDoubleFBO(
  gl: WebGLRenderingContext,
  ext: GLExtensions,
  target: DoubleFBO,
  w: number,
  h: number,
  internalFormat: number,
  format: number,
  type: number,
  param: number,
  copyProgram: Program,
  blit: (target: FBO | null, clear?: boolean) => void,
): DoubleFBO {
  if (target.width === w && target.height === h) return target;
  target.read = resizeFBO(
    gl,
    ext,
    target.read,
    w,
    h,
    internalFormat,
    format,
    type,
    param,
    copyProgram,
    blit,
  );
  target.write = createFBO(gl, ext, w, h, internalFormat, format, type, param);
  target.width = w;
  target.height = h;
  target.texelSizeX = 1.0 / w;
  target.texelSizeY = 1.0 / h;
  return target;
}

/**
 * 根据短边分辨率和当前画布宽高比，计算实际 FBO 尺寸
 */
export function getResolution(
  gl: WebGLRenderingContext,
  resolution: number,
): { width: number; height: number } {
  let aspectRatio = gl.drawingBufferWidth / gl.drawingBufferHeight;
  if (aspectRatio < 1) aspectRatio = 1.0 / aspectRatio;

  const min = Math.round(resolution);
  const max = Math.round(resolution * aspectRatio);

  if (gl.drawingBufferWidth > gl.drawingBufferHeight)
    return { width: max, height: min };
  return { width: min, height: max };
}

/**
 * 异步加载图片纹理（dithering 噪声）
 * 在图片加载完成前用 1x1 白色纹理占位，避免阻塞渲染循环
 */
export function createTextureAsync(
  gl: WebGLRenderingContext,
  url: string,
): TextureObject {
  const texture = gl.createTexture();
  if (!texture) throw new Error("Failed to create texture");
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    gl.RGB,
    1,
    1,
    0,
    gl.RGB,
    gl.UNSIGNED_BYTE,
    new Uint8Array([255, 255, 255]),
  );

  const obj: TextureObject = {
    texture,
    width: 1,
    height: 1,
    attach(id: number): number {
      gl.activeTexture(gl.TEXTURE0 + id);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      return id;
    },
  };

  const image = new Image();
  image.onload = () => {
    obj.width = image.width;
    obj.height = image.height;
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, image);
  };
  image.src = url;

  return obj;
}
