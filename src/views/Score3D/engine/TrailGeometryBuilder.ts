import * as THREE from "three";
import type { GlowParams, TrailPoint, TrailTrack } from "../types";

/** 轨迹构建选项 */
export interface TrailBuildOptions {
  /** 轨迹管半径（世界单位） */
  radius: string | number;
  /** 声部轨配色（按 trackIndex 取模循环） */
  colors: string[];
}

/** 构建结果：主线网格 + 和弦锚点网格 */
export interface TrailMeshSet {
  /** 每条声部轨一个网格（多点为管状，单点退化为球体） */
  trailMeshes: THREE.Mesh[];
  /** 和弦锚点小球（光点经过时点亮） */
  anchorMeshes: THREE.Mesh[];
}

function createTrailMaterial(colorHex: string): THREE.MeshStandardMaterial {
  const color = new THREE.Color(colorHex);
  return new THREE.MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: 0.35,
    roughness: 0.4,
    metalness: 0.1,
  });
}

function createAnchorMaterial(colorHex: string): THREE.MeshStandardMaterial {
  const color = new THREE.Color(colorHex);
  return new THREE.MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: 0.1,
    roughness: 0.6,
  });
}

/** 单点轨迹的退化几何：小球 */
function createPointMesh(
  x: number,
  y: number,
  z: number,
  radius: number,
  material: THREE.Material,
): THREE.Mesh {
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(radius, 16, 12),
    material,
  );
  mesh.position.set(x, y, z);
  return mesh;
}

/**
 * 由控制点构造声部轨曲线（centripetal 参数化，抑制音高跳变处的过冲）。
 * 几何构建与播放头时间映射必须共用此函数，保证同一条曲线。
 */
export function createTrailCurve(points: TrailPoint[]): THREE.CatmullRomCurve3 {
  if (points.length === 1) {
    // 退化：单控制点补成三点微移副本，保证 centripetal 公式可采样
    const p = points[0];
    return new THREE.CatmullRomCurve3(
      [
        new THREE.Vector3(p.x, p.y, p.z),
        new THREE.Vector3(p.x + 0.001, p.y, p.z),
        new THREE.Vector3(p.x + 0.002, p.y, p.z),
      ],
      false,
      "centripetal",
    );
  }
  return new THREE.CatmullRomCurve3(
    points.map((p) => new THREE.Vector3(p.x, p.y, p.z)),
    false,
    "centripetal",
  );
}

/**
 * 能量轨迹几何构建器（ADR 0006）。
 *
 * - 每条声部轨一条连续管状几何（CatmullRomCurve3 + TubeGeometry），
 *   「音符间插值」形成不间断的能量带
 * - 仅一个控制点的轨退化为球体
 * - 和弦锚点生成小球，坐标来自布局器的 otherPoints
 */
export function buildTrailMeshes(
  tracks: TrailTrack[],
  options: TrailBuildOptions,
): TrailMeshSet {
  const radius =
    typeof options.radius === "string"
      ? Number(options.radius)
      : options.radius;
  const trailMeshes: THREE.Mesh[] = [];
  const anchorMeshes: THREE.Mesh[] = [];

  for (const track of tracks) {
    const colorHex = options.colors[track.trackIndex % options.colors.length];
    const material = createTrailMaterial(colorHex);

    if (track.points.length === 1) {
      const p = track.points[0];
      trailMeshes.push(createPointMesh(p.x, p.y, p.z, radius * 2, material));
    } else {
      const curve = createTrailCurve(track.points);
      const tubularSegments = Math.max(8, track.points.length * 8);
      const geometry = new THREE.TubeGeometry(
        curve,
        tubularSegments,
        radius,
        8,
        false,
      );
      trailMeshes.push(new THREE.Mesh(geometry, material));
    }

    for (const anchor of track.chordAnchors) {
      const anchorMaterial = createAnchorMaterial(colorHex);
      for (const point of anchor.otherPoints) {
        anchorMeshes.push(
          createPointMesh(
            point.x,
            point.y,
            point.z,
            radius * 1.6,
            anchorMaterial,
          ),
        );
      }
    }
  }

  return { trailMeshes, anchorMeshes };
}

/**
 * 光点（播放头的视觉载体）。
 * 使用 emissive 白色材质；辉光强度由策略在每帧按包络值调整。
 */
export function buildGlowMesh(params: GlowParams): THREE.Mesh {
  const material = new THREE.MeshStandardMaterial({
    color: new THREE.Color("#ffffff"),
    emissive: new THREE.Color("#ffffff"),
    emissiveIntensity: params.baseIntensity,
    roughness: 0.2,
  });
  return new THREE.Mesh(
    new THREE.SphereGeometry(params.radius, 24, 18),
    material,
  );
}
