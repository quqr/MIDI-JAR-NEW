import type { WaterfallPianoSettings } from "../types";
import type { NoteBlock, NoteBlockPool } from "./NoteBlockPool";
import type { SynthesiaModeController } from "./SynthesiaModeController";
import type { NoteBlockMode } from "./NoteBlockSystem";
import type { NoteKeyFn } from "./SynthesiaModeController";
import { createLogger } from "@/utils/logger";

const logger = createLogger("NoteBlockStateSync");

/**
 * 状态重建器：在暂停恢复或 seek 后，根据给定时间重建所有方块的
 * Y 坐标、触发/结束状态，并清理已离开屏幕的方块。
 *
 * 用于确保方块显示与当前播放进度一致，避免视觉撕裂。
 */
export class NoteBlockStateSync {
  constructor(
    private readonly pool: NoteBlockPool,
    private readonly getActive: () => NoteBlock[],
    private readonly synthesia: SynthesiaModeController,
    private readonly getHeight: () => number,
    private readonly getSettings: () => WaterfallPianoSettings | null,
    private readonly getMode: () => NoteBlockMode,
    private readonly getPixelsPerSecond: () => number,
    private readonly noteKey: NoteKeyFn,
  ) {}

  /**
   * 完整状态同步：根据给定时间重建所有方块的 Y 坐标、触发状态、结束状态和活跃状态
   * @param time - 当前播放时间（秒）
   */
  syncToTime(time: number): void {
    if (this.getMode() !== "synthesia") return;

    const pps = this.getPixelsPerSecond();
    const lookAhead = this.settings?.particles.lookAhead ?? 3;
    const height = this.getHeight();
    const active = this.getActive();
    const triggeredNoteKeys = this.synthesia.getTriggeredNoteKeys();
    const endedNoteKeys = this.synthesia.getEndedNoteKeys();
    const synthesiaBlockMap = this.synthesia.getSynthesiaBlockMap();

    // 同步所有方块状态
    for (const block of active) {
      if (block.trackIndex < 0) continue; // 跳过 realtime 方块
      const timeUntilHit = block.startTime - time;
      block.y = height - timeUntilHit * pps;
      block.height = block.duration * pps;
      const key = this.noteKey({
        trackIndex: block.trackIndex,
        midi: block.midi,
        time: block.startTime,
      });
      block.triggered = triggeredNoteKeys.has(key);
      block.ended = endedNoteKeys.has(key);
    }

    // 清理已离开屏幕的方块
    const recycleThreshold = height * 0.5;
    for (let i = active.length - 1; i >= 0; i--) {
      const b = active[i];
      if (b.trackIndex < 0) continue;
      const blockTop = b.y - b.height;
      if (
        blockTop > height + recycleThreshold ||
        time - (b.startTime + b.duration) > lookAhead + b.duration + 1
      ) {
        const key = `${b.trackIndex}-${b.midi}-${b.startTime}`;
        synthesiaBlockMap.delete(key);
        active.splice(i, 1);
        this.pool.release(b);
      }
    }

    // 重建 triggeredNoteKeys 和 endedNoteKeys
    this.synthesia.rebuildTriggeredState(time);

    logger.debug(
      `syncToTime: t=${time.toFixed(2)}s, active=${active.length}, triggeredKeys=${triggeredNoteKeys.size}`,
    );
  }

  private get settings(): WaterfallPianoSettings | null {
    return this.getSettings();
  }
}
