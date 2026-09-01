import { describe, expect, it } from "vitest";
import { createTrailCurve } from "../engine/TrailGeometryBuilder";
import { CameraRig, PlayheadController } from "../engine/PlayheadController";
import type { TrailPoint } from "../types";

const UPS = 6;

/** 直线轨迹（等音高）：弧长与时间严格成正比 */
const LINE: TrailPoint[] = [
  { x: 0, y: 6, z: 0 },
  { x: 6, y: 6, z: 0 },
  { x: 12, y: 6, z: 0 },
];

/** 波动轨迹：模拟旋律起伏 */
const MELODY: TrailPoint[] = [
  { x: 0, y: 6, z: 0 },
  { x: 3, y: 8, z: 0 },
  { x: 6, y: 5, z: 0 },
  { x: 9, y: 9, z: 0 },
  { x: 12, y: 6, z: 0 },
];

function makeController(points: TrailPoint[], totalDuration: number) {
  const curve = createTrailCurve(points);
  return new PlayheadController(curve, {
    unitsPerSecond: UPS,
    totalDuration,
    samples: 200,
  });
}

describe("PlayheadController — 时间↔曲线参数映射", () => {
  it("直线轨迹：u ≈ t / totalDuration（匀速）", () => {
    const controller = makeController(LINE, 2);
    expect(controller.timeToU(0)).toBeCloseTo(0, 3);
    expect(controller.timeToU(1)).toBeCloseTo(0.5, 2);
    expect(controller.timeToU(2)).toBeCloseTo(1, 3);
  });

  it("u 随时间单调不减", () => {
    const controller = makeController(MELODY, 2);
    let prev = -1;
    for (let t = 0; t <= 2.0001; t += 0.02) {
      const u = controller.timeToU(Math.min(t, 2));
      expect(u).toBeGreaterThanOrEqual(prev - 1e-9);
      prev = u;
    }
  });

  it("边界钳制：t<0 → 0，t>总长 → 1", () => {
    const controller = makeController(MELODY, 2);
    expect(controller.timeToU(-5)).toBe(0);
    expect(controller.timeToU(100)).toBe(1);
  });

  it("positionAt：t=0 位于首点附近，t=总长位于末点附近", () => {
    const controller = makeController(MELODY, 2);
    const start = controller.positionAt(0);
    expect(start.point.x).toBeLessThan(0.5);
    const end = controller.positionAt(2);
    expect(end.point.x).toBeGreaterThan(11.5);
  });

  it("positionAt 返回的 u 与 timeToU 一致", () => {
    const controller = makeController(MELODY, 2);
    const { u } = controller.positionAt(1.3);
    expect(u).toBeCloseTo(controller.timeToU(1.3), 10);
  });

  it("positionAt 全程有限（无 NaN）", () => {
    const controller = makeController(MELODY, 2);
    for (let t = 0; t <= 2.0001; t += 0.05) {
      const { point } = controller.positionAt(Math.min(t, 2));
      expect(Number.isFinite(point.x)).toBe(true);
      expect(Number.isFinite(point.y)).toBe(true);
      expect(Number.isFinite(point.z)).toBe(true);
    }
  });
});

describe("CameraRig", () => {
  it("相机位置 = 光点位置 + 偏移", () => {
    const rig = new CameraRig({ offset: { x: -6, y: 4, z: 10 } });
    const pose = rig.poseAt({ x: 12, y: 6, z: 3 });
    expect(pose.position).toEqual({ x: 6, y: 10, z: 13 });
    expect(pose.target).toEqual({ x: 12, y: 6, z: 3 });
  });

  it("目标点支持沿时间轴前视", () => {
    const rig = new CameraRig({
      offset: { x: 0, y: 0, z: 10 },
      lookAhead: { x: 3, y: 0, z: 0 },
    });
    const pose = rig.poseAt({ x: 12, y: 6, z: 3 });
    expect(pose.target).toEqual({ x: 15, y: 6, z: 3 });
  });
});
