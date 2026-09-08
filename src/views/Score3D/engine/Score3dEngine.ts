import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { RenderLoop } from "./RenderLoop";
import type { VisualStrategy } from "./VisualStrategy";
import {
  BLOOM_RADIUS,
  BLOOM_STRENGTH,
  BLOOM_THRESHOLD,
  DEFAULT_CAMERA_OFFSET,
  DEFAULT_BACKGROUND,
  FOLLOW_TARGET_LERP,
} from "../constants";

/** 引擎所需的渲染器最小接口 */
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

/** 场景默认背景色（白，可由设置页覆盖） */
const BACKGROUND_COLOR = DEFAULT_BACKGROUND;

/**
 * 三维乐谱渲染引擎（ADR 0008 / ADR 0018）。
 *
 * 持有 scene / camera / renderer 与渲染循环；可视化内容全部委托给
 * {@link VisualStrategy}（当前为 GlyphSceneStrategy 符号实体场景）。
 *
 * 相机控制（ADR 0018）：OrbitControls 接管——用户可自由旋转/缩放/平移；
 * 播放时引擎每帧仅把控制器的注视目标平滑插值到策略给出的播放头位置，
 * 手动操作不中断跟随；recenterToPlayhead() 将目标吸回播放头并把相机
 * 归位到默认偏移。
 */
export class Score3dEngine {
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(60, 1, 0.1, 3000);
  private readonly renderer: RendererLike;
  private readonly controls: OrbitControls;
  private loop: RenderLoop;
  private strategy: VisualStrategy | null = null;
  private composer: EffectComposer | null = null;
  private bloomPass: UnrealBloomPass | null = null;
  private lastTime = 0;
  private disposed = false;
  /** 用户操作相机期间暂停目标跟随，避免与平移/旋转抢控制权；回到播放头时恢复 */
  private followSuspended = false;

  /** 每帧复用的临时对象，避免 GC 抖动 */
  private readonly tmpTarget = new THREE.Vector3();

  /** 每帧取当前播放时刻（秒）；未设置时使用上一帧时刻 */
  frameCallback: (() => number) | null = null;

  constructor(
    canvas: HTMLCanvasElement,
    rendererFactory: RendererFactory = defaultRendererFactory,
  ) {
    this.renderer = rendererFactory(canvas);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.scene.background = new THREE.Color(BACKGROUND_COLOR);
    this.camera.position.set(
      DEFAULT_CAMERA_OFFSET.x,
      DEFAULT_CAMERA_OFFSET.y,
      DEFAULT_CAMERA_OFFSET.z,
    );
    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.maxDistance = 600;
    // Blender 式映射（ADR 0019）：中键拖拽=旋转、Shift+中键=平移、
    // 右键拖拽=平移、滚轮=缩放；左键保留旋转（无中键设备的回退）。
    // Shift 修饰 OrbitControls 原生不支持，capture 阶段抢先按修饰键改写
    // MIDDLE 的功能，OrbitControls 在 pointerdown 时读取 mouseButtons。
    this.controls.mouseButtons = {
      LEFT: THREE.MOUSE.ROTATE,
      MIDDLE: THREE.MOUSE.ROTATE,
      RIGHT: THREE.MOUSE.PAN,
    };
    canvas.addEventListener(
      "pointerdown",
      (e) => {
        if (e.button === 1) {
          this.controls.mouseButtons.MIDDLE = e.shiftKey
            ? THREE.MOUSE.PAN
            : THREE.MOUSE.ROTATE;
        }
      },
      true,
    );
    // 用户上手（拖拽/滚轮）期间挂起目标跟随，避免与操作抢控制权；
    // 松手即恢复——播放中相机始终对准当前播放位置
    this.controls.addEventListener("start", () => {
      this.followSuspended = true;
    });
    this.controls.addEventListener("end", () => {
      this.followSuspended = false;
    });
    this.loop = new RenderLoop(() => this.renderOnce());

    // bloom 后期：阈值 1.0，只有 HDR 自发光体（追迹小球）溢出产生辉光，
    // 白色背景（亮度恰为 1.0）与谱面浮雕不参与。stub 渲染器（测试注入）
    // 无 composer，走直渲染路径
    if (this.renderer instanceof THREE.WebGLRenderer) {
      this.composer = new EffectComposer(this.renderer);
      this.composer.addPass(new RenderPass(this.scene, this.camera));
      this.bloomPass = new UnrealBloomPass(
        new THREE.Vector2(1, 1),
        BLOOM_STRENGTH,
        BLOOM_RADIUS,
        BLOOM_THRESHOLD,
      );
      this.composer.addPass(this.bloomPass);
    }
  }

  /** 设置场景背景色（设置页持久化值透传） */
  setBackground(color: string): void {
    this.scene.background = new THREE.Color(color);
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
    const target = this.strategy?.getFollowTarget() ?? null;
    if (target && !this.followSuspended) {
      this.tmpTarget.set(target.x, target.y, target.z);
      // 注视目标平滑跟随播放头；用户操作期间挂起，回到播放头时恢复
      this.controls.target.lerp(this.tmpTarget, FOLLOW_TARGET_LERP);
    }
    this.controls.update();
    if (this.composer) {
      this.composer.render();
    } else {
      this.renderer.render(this.scene, this.camera);
    }
  }

  /**
   * 回到播放头：注视目标立即吸回，相机归位到播放头后方的默认偏移，
   * 并恢复自动跟随。
   */
  recenterToPlayhead(): void {
    const target = this.strategy?.getFollowTarget() ?? null;
    if (!target) return;
    this.followSuspended = false;
    this.controls.target.set(target.x, target.y, target.z);
    this.camera.position.set(
      target.x + DEFAULT_CAMERA_OFFSET.x,
      target.y + DEFAULT_CAMERA_OFFSET.y,
      target.z + DEFAULT_CAMERA_OFFSET.z,
    );
    this.controls.update();
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
    this.composer?.setSize(w, h);
  }

  /** 声部轨显隐透传给当前策略 */
  setTrackVisible(trackIndex: number, visible: boolean): void {
    this.strategy?.setTrackVisible(trackIndex, visible);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.loop.stop();
    this.strategy?.dispose();
    this.strategy = null;
    this.controls.dispose();
    this.composer?.dispose();
    this.renderer.dispose();
  }
}
