import * as THREE from "three";
import { RenderLoop } from "./RenderLoop";
import type { VisualStrategy } from "./VisualStrategy";

/** 引擎所需的渲染器最小接口（便于测试注入 stub，规避 jsdom 无 WebGL） */
export interface RendererLike {
  setPixelRatio(ratio: number): void;
  setSize(width: number, height: number): void;
  render(scene: THREE.Scene, camera: THREE.Camera): void;
  dispose(): void;
}

export type RendererFactory = (canvas: HTMLCanvasElement) => RendererLike;

/** 默认工厂：THREE.WebGLRenderer */
export const defaultRendererFactory: RendererFactory = (canvas) =>
  new THREE.WebGLRenderer({ canvas, antialias: true });

/** 场景背景色（深空蓝黑，主题适配留待切片 7+） */
const BACKGROUND_COLOR = 0x0f172a;

/** 用户视角调节的范围钳制 */
const ORBIT_PITCH_LIMIT = 1.2;
const ORBIT_ZOOM_MIN = 0.3;
const ORBIT_ZOOM_MAX = 4;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * 三维乐谱渲染引擎（ADR 0008）。
 *
 * 持有 scene / camera / renderer 与渲染循环；可视化内容全部委托给
 * {@link VisualStrategy}（首实现 TrailStrategy）。每帧流程：
 * frameCallback() 取当前播放时刻 → strategy.update(t) → 相机对准策略位姿 → 渲染。
 */
export class Score3dEngine {
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(60, 1, 0.1, 3000);
  private readonly renderer: RendererLike;
  private readonly loop: RenderLoop;
  private strategy: VisualStrategy | null = null;
  private lastTime = 0;

  /** 用户视角调节：绕播放头的球面偏移（拖拽旋转 + 滚轮缩放） */
  private orbitYaw = 0;
  private orbitPitch = 0;
  private orbitZoom = 1;

  /** 每帧复用的临时对象，避免 GC 抖动 */
  private readonly tmpTarget = new THREE.Vector3();
  private readonly tmpOffset = new THREE.Vector3();
  private readonly tmpSpherical = new THREE.Spherical();

  /** 每帧取当前播放时刻（秒）；未设置时使用上一帧时刻 */
  frameCallback: (() => number) | null = null;

  constructor(
    canvas: HTMLCanvasElement,
    rendererFactory: RendererFactory = defaultRendererFactory,
  ) {
    this.renderer = rendererFactory(canvas);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.scene.background = new THREE.Color(BACKGROUND_COLOR);
    this.loop = new RenderLoop(() => this.renderOnce());
  }

  /** 替换可视化策略（旧策略立即从场景卸载并释放） */
  setStrategy(strategy: VisualStrategy | null): void {
    if (this.strategy) {
      this.scene.remove(this.strategy.root);
      this.strategy.dispose();
    }
    this.strategy = strategy;
    if (strategy) {
      strategy.build();
      this.scene.add(strategy.root);
    }
  }

  /** 单帧推进（渲染循环与测试共用） */
  renderOnce(): void {
    if (this.frameCallback) {
      this.lastTime = this.frameCallback();
    }
    this.strategy?.update(this.lastTime);
    const pose = this.strategy?.getCameraPose() ?? null;
    if (pose) {
      this.tmpTarget.set(pose.target.x, pose.target.y, pose.target.z);
      // 相机偏移向量经用户视角调节（球面旋转 + 缩放）后回填
      this.tmpOffset.set(
        pose.position.x - pose.target.x,
        pose.position.y - pose.target.y,
        pose.position.z - pose.target.z,
      );
      this.tmpSpherical.setFromVector3(this.tmpOffset);
      this.tmpSpherical.theta += this.orbitYaw;
      this.tmpSpherical.phi = clamp(
        this.tmpSpherical.phi + this.orbitPitch,
        0.1,
        Math.PI - 0.1,
      );
      this.tmpSpherical.radius = Math.max(
        0.1,
        this.tmpSpherical.radius * this.orbitZoom,
      );
      this.tmpOffset.setFromSpherical(this.tmpSpherical).add(this.tmpTarget);
      this.camera.position.copy(this.tmpOffset);
      this.camera.lookAt(this.tmpTarget);
    }
    this.renderer.render(this.scene, this.camera);
  }

  /**
   * 调整视角：绕播放头旋转。
   * @param deltaYaw - 水平角增量（弧度），向右拖拽为正
   * @param deltaPitch - 俯仰角增量（弧度），向上拖拽为正
   */
  adjustOrbit(deltaYaw: number, deltaPitch: number): void {
    this.orbitYaw += deltaYaw;
    this.orbitPitch = clamp(
      this.orbitPitch + deltaPitch,
      -ORBIT_PITCH_LIMIT,
      ORBIT_PITCH_LIMIT,
    );
  }

  /**
   * 缩放视角：倍率作用于相机与播放头的距离。
   * @param factor - 大于 1 拉远，小于 1 拉近
   */
  adjustZoom(factor: number): void {
    this.orbitZoom = clamp(
      this.orbitZoom * factor,
      ORBIT_ZOOM_MIN,
      ORBIT_ZOOM_MAX,
    );
  }

  /** 视角复位（双击） */
  resetView(): void {
    this.orbitYaw = 0;
    this.orbitPitch = 0;
    this.orbitZoom = 1;
  }

  start(): void {
    this.loop.start();
  }

  stop(): void {
    this.loop.stop();
  }

  resize(width: number, height: number): void {
    const w = Math.max(1, width);
    const h = Math.max(1, height);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  /** 声部轨显隐透传给当前策略 */
  setTrackVisible(trackIndex: number, visible: boolean): void {
    this.strategy?.setTrackVisible(trackIndex, visible);
  }

  dispose(): void {
    this.loop.stop();
    this.strategy?.dispose();
    this.strategy = null;
    this.renderer.dispose();
  }
}
