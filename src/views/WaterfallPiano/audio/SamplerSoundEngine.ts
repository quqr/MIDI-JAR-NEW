import { useSamplerStore } from "@/stores/sampler";
import { useSamplerService } from "@/composables/useSamplerService";
import type { ISoundEngine } from "./ISoundEngine";

/**
 * 采样器音源引擎适配器 — 将 WaterfallEngine 的音频接口委托给全局 SamplerService。
 *
 * 音频参数（音色/混响/音量等）由采样器设置页与 useSamplerService 统一管理。
 * 当采样器未加载乐器或全局声音关闭时，所有操作静默忽略。
 */
export class SamplerSoundEngine implements ISoundEngine {
  private sustain = false;
  private sustainedNotes = new Set<number>();
  /** 引用计数：同一音高可被多个音符同时按住，只有计数归零才释放 */
  private heldNotes = new Map<number, number>();
  private initialized = false;

  /**
   * 初始化（空操作）— 采样器的 AudioContext 由 useSamplerService 管理，
   * 通过 ensureInitialized() 懒启动，无需外部传入配置。
   */
  async init(): Promise<void> {
    this.initialized = true;
  }

  /**
   * 触发 MIDI 音符发声，同一音高多次触发会累加引用计数。
   * @param midi - MIDI 音符编号 (0-127)
   * @param velocity - 力度值 (0-127)
   */
  noteOn(midi: number, velocity: number): void {
    if (!this.initialized) return;

    const store = useSamplerStore();
    if (!store.soundEnabled || !store.isReady) return;

    const count = this.heldNotes.get(midi) ?? 0;
    this.heldNotes.set(midi, count + 1);

    const service = useSamplerService();
    // smplr velocity 范围 0-100，MIDI velocity 范围 0-127
    service.noteOn(midi, Math.round((velocity / 127) * 100));
  }

  /**
   * 释放 MIDI 音符，引用计数归零时才真正停止发声；
   * 若延音踏板开启，音符会暂存到 sustainedNotes 中待踏板释放时统一释放。
   * @param midi - MIDI 音符编号 (0-127)
   */
  noteOff(midi: number): void {
    if (!this.initialized) return;

    const count = this.heldNotes.get(midi) ?? 0;
    if (count <= 1) {
      this.heldNotes.delete(midi);
      if (!this.sustain) {
        const service = useSamplerService();
        service.noteOff(midi);
      } else {
        this.sustainedNotes.add(midi);
      }
    } else {
      this.heldNotes.set(midi, count - 1);
    }
  }

  /**
   * 设置延音踏板状态。关闭踏板时释放所有暂存的延音音符。
   */
  setSustain(enabled: boolean): void {
    this.sustain = enabled;
    if (!enabled) {
      const service = useSamplerService();
      for (const midi of this.sustainedNotes) {
        if (!this.heldNotes.has(midi)) {
          service.noteOff(midi);
        }
      }
      this.sustainedNotes.clear();
    }
  }

  /** 释放所有正在发声的音符 */
  allNotesOff(): void {
    const service = useSamplerService();
    service.stopAllNotes();
    this.heldNotes.clear();
    this.sustainedNotes.clear();
  }

  /** 释放资源 */
  dispose(): void {
    this.allNotesOff();
    this.initialized = false;
  }

  // ─── 以下方法为接口兼容而保留，采样器模式下无实际作用 ───

  /** 设置音量（采样器模式忽略） */
  setVolume(_v: number): void {
    // no-op: 采样器音量由 useSamplerService 管理
  }

  /** 设置力度灵敏度（采样器模式忽略） */
  setVelocitySensitivity(_enabled: boolean): void {
    // no-op: 采样器始终使用力度
  }
}
