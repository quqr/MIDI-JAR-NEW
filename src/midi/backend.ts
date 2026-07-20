/**
 * MIDI 后端工厂
 *
 * 根据运行环境自动选择 TauriMidiBackend 或 WebMidiBackend。
 * 整个应用通过此模块获取唯一的 backend 实例。
 */

import type { IMidiBackend } from "./IMidiBackend";
import { TauriMidiBackend } from "./TauriMidiBackend";
import { WebMidiBackend } from "./WebMidiBackend";
import { isTauri } from "@/utils/tauri";
import { createLogger } from "@/utils/logger";

const logger = createLogger("MidiBackend");

let backend: IMidiBackend | null = null;

/**
 * 创建并返回 MIDI 后端实例（单例）
 *
 * Tauri 环境返回 TauriMidiBackend，
 * 浏览器环境返回 WebMidiBackend。
 */
export function createMidiBackend(): IMidiBackend {
  if (backend) return backend;

  if (isTauri()) {
    logger.info("Using TauriMidiBackend");
    backend = new TauriMidiBackend();
  } else {
    logger.info("Using WebMidiBackend");
    backend = new WebMidiBackend();
  }

  return backend;
}

/**
 * 获取已创建的 MIDI 后端实例
 * @throws 如果 backend 尚未创建
 */
export function getMidiBackend(): IMidiBackend {
  if (!backend) {
    throw new Error("MidiBackend not initialized. Call createMidiBackend() first.");
  }
  return backend;
}

/**
 * 重置 backend 实例（仅用于测试）
 */
export function resetMidiBackend(): void {
  if (backend) {
    backend.dispose();
    backend = null;
  }
}
