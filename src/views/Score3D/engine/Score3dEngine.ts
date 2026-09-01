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
      this.camera.position.set(
        pose.position.x,
        pose.position.y,
        pose.position.z,
      );
      this.camera.lookAt(pose.target.x, pose.target.y, pose.target.z);
    }
    this.renderer.render(this.scene, this.camera);
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
