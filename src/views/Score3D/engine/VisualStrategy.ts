import type * as THREE from "three";
import type { CameraPose } from "./PlayheadController";

/**
 * 三维乐谱可视化策略接口（可插拔，计划第 2 节补充决策 / 拟立 ADR 0009）。
 *
 * 首个实现为 {@link TrailStrategy}（发光轨迹 + 光点，ADR 0006）。
 * 接口刻意最小化：策略持有自己的根节点（root），引擎负责挂载/卸载场景，
 * build() 只负责向 root 装配几何与灯光。
 */
export interface VisualStrategy {
  /** 策略名（如 "trail"） */
  readonly name: string;
  /** 策略根节点（引擎挂载到场景；卸载/释放时由引擎移除） */
  readonly root: THREE.Object3D;
  /** 向 root 装配几何与灯光（挂载前调用一次） */
  build(): void;
  /** 每帧更新：time 为当前播放时刻（秒） */
  update(time: number): void;
  /** 当前相机位姿（无内容时返回 null，引擎保持上一帧位姿） */
  getCameraPose(): CameraPose | null;
  /** 声部轨显隐（ADR 0007 分层结构的交互面） */
  setTrackVisible(trackIndex: number, visible: boolean): void;
  /** 释放全部几何与材质 */
  dispose(): void;
}
