import type * as THREE from "three";
import type { TrailPoint } from "../types";

/**
 * 三维乐谱可视化策略接口。
 *
 * 当前实现为 {@link GlyphSceneStrategy}（符号实体场景，ADR 0018）。
 * 接口刻意最小化：策略持有自己的根节点（root），引擎负责挂载/卸载场景，
 * build() 只负责启动几何装配（可异步，进度经 ready 暴露）。
 */
export interface VisualStrategy {
  /** 策略名（如 "glyph"） */
  readonly name: string;
  /** 策略根节点（引擎挂载到场景；卸载/释放时由引擎移除） */
  readonly root: THREE.Object3D;
  /** 启动几何装配（挂载前调用一次；异步构建的完成态见 ready） */
  build(): void;
  /** 几何装配完成信号（同步构建时为已解决的 Promise） */
  readonly ready: Promise<void>;
  /** 每帧更新：time 为当前播放时刻（秒） */
  update(time: number): void;
  /** 相机注视目标（播放头位置）；无内容时返回 null，引擎保持上一帧目标 */
  getFollowTarget(): TrailPoint | null;
  /** 声部轨显隐 */
  setTrackVisible(trackIndex: number, visible: boolean): void;
  /** 释放全部几何与材质 */
  dispose(): void;
}
