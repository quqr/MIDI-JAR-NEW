/**
 * Worklet 代码加载器
 *
 * 用 ?raw 导入 worklet JS 源码，通过 Blob URL 加载到 AudioContext。
 * 完全绕开 Tauri 自定义协议的 CORS 问题。
 */
import code from "../../../../public/audio-worklets/physical-piano-processor.js?raw";

export function getPhysicalPianoWorkletUrl(): string {
  const blob = new Blob([code], { type: "application/javascript" });
  return URL.createObjectURL(blob);
}

export function revokePhysicalPianoWorkletUrl(url: string): void {
  URL.revokeObjectURL(url);
}
