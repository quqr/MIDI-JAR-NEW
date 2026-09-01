import { Vector3 } from "three";
import type { TrailPoint } from "../types";

/** 播放头控制器所需的曲线最小接口（THREE.CatmullRomCurve3 满足此签名） */
export interface ParamCurve {
  /** 参数 u ∈ [0,1] 处的点（参数均匀，非弧长均匀） */
  getPoint(u: number, target?: Vector3): Vector3;
  /** 弧长均匀参数 u ∈ [0,1] 处的点 */
  getPointAt(u: number, target?: Vector3): Vector3;
}

/** 播放头控制器选项 */
export interface PlayheadOptions {
  /** 时间轴缩放（与布局器一致）：每秒的世界单位 */
  unitsPerSecond: number;
  /** 曲目总时长（秒） */
  totalDuration: number;
  /** 时间↔弧长映射表的采样数 */
  samples?: number;
}

/** 播放头某时刻的状态 */
export interface PlayheadState {
  /** 弧长均匀参数 u ∈ [0,1] */
  u: number;
  /** 光点世界坐标 */
  point: TrailPoint;
}

interface TimeSample {
  time: number;
  u: number;
}

/**
 * 播放头控制器（ADR 0005：场景静止、播放头沿时间轴移动）。
 *
 * 负责时间（秒）→ 弧长均匀参数 u 的换算：
 * 曲线的 x 分量与时间成线性关系，先按参数均匀采样建立 (time, u) 表，
 * 再用二分查找 + 线性插值求任意时刻的 u，最后经 getPointAt 得到弧长匀速的光点位置。
 */
export class PlayheadController {
  private readonly samples: TimeSample[];
  private readonly totalDuration: number;

  constructor(
    private readonly curve: ParamCurve,
    options: PlayheadOptions,
  ) {
    this.totalDuration = Math.max(0, options.totalDuration);
    const count = Math.max(2, options.samples ?? 256);
    this.samples = [];
    const target = new Vector3();
    let lastTime = -Infinity;
    for (let i = 0; i <= count; i++) {
      const u = i / count;
      // getPoint：参数均匀采样，读出 x 反推时间
      const p = curve.getPoint(u, target);
      // CatmullRom 在剧烈音高跳变处 x 可能轻微过冲，钳制为非递减并限制在时长内
      const time = Math.min(
        this.totalDuration,
        Math.max(lastTime, p.x / options.unitsPerSecond),
      );
      lastTime = time;
      this.samples.push({ time, u });
    }
  }

  /** 时间（秒）→ 弧长均匀参数 u ∈ [0,1] */
  timeToU(time: number): number {
    if (time <= 0) return 0;
    if (time >= this.totalDuration) return 1;
    const table = this.samples;
    // 二分定位最后一个 time <= 输入的采样
    let lo = 0;
    let hi = table.length - 1;
    while (lo < hi - 1) {
      const mid = (lo + hi) >> 1;
      if (table[mid].time <= time) lo = mid;
      else hi = mid;
    }
    const a = table[lo];
    const b = table[hi];
    const span = b.time - a.time;
    // 钳制到 [a.u, b.u]：时间落在曲线覆盖范围之外（前奏空白、曲末静音、
    // 退化曲线）时不得外推，避免 u 越出 [0,1]
    const ratio = span > 0 ? (time - a.time) / span : 0;
    const clamped = Math.min(1, Math.max(0, ratio));
    return a.u + (b.u - a.u) * clamped;
  }

  /** 时间（秒）→ 播放头状态（弧长匀速位置） */
  positionAt(time: number): PlayheadState {
    const u = this.timeToU(time);
    const p = this.curve.getPointAt(u, new Vector3());
    return { u, point: { x: p.x, y: p.y, z: p.z } };
  }
}

/** 相机位姿选项 */
export interface CameraRigOptions {
  /** 相机相对光点的偏移（世界单位） */
  offset: TrailPoint;
  /** 观察目标相对光点的前视偏移（可选，通常沿时间轴向前） */
  lookAhead?: TrailPoint;
}

/** 相机位姿 */
export interface CameraPose {
  position: TrailPoint;
  target: TrailPoint;
}

/**
 * 相机装置（纯数学，不依赖 three）：给定光点位置输出相机位姿。
 * 相机随播放头推进（ADR 0005 的「相机沿时间轴平移」由此实现）。
 */
export class CameraRig {
  constructor(private readonly options: CameraRigOptions) {}

  poseAt(glow: TrailPoint): CameraPose {
    const { offset, lookAhead } = this.options;
    const ahead = lookAhead ?? { x: 0, y: 0, z: 0 };
    return {
      position: {
        x: glow.x + offset.x,
        y: glow.y + offset.y,
        z: glow.z + offset.z,
      },
      target: {
        x: glow.x + ahead.x,
        y: glow.y + ahead.y,
        z: glow.z + ahead.z,
      },
    };
  }
}
