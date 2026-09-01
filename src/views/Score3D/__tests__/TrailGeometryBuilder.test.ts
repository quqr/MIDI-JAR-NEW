import { describe, expect, it } from "vitest";
import * as THREE from "three";
import {
  buildGlowMesh,
  buildTrailMeshes,
} from "../engine/TrailGeometryBuilder";
import { layoutTrail } from "../engine/layoutTrail";
import type { Score3dNote } from "../types";
import { DEFAULT_LAYOUT_OPTIONS } from "../constants";

const OPT = DEFAULT_LAYOUT_OPTIONS;

function note(midi: number, timeOn: number, trackIndex = 0): Score3dNote {
  return {
    midi,
    timeOn,
    timeOff: timeOn + 1,
    trackIndex,
    velocity: 0.8,
    beatOn: timeOn * 2,
  };
}

describe("buildTrailMeshes", () => {
  it("多点声部轨生成一条管状网格", () => {
    const tracks = layoutTrail([note(60, 0), note(64, 1), note(67, 2)], OPT);
    const { trailMeshes, anchorMeshes } = buildTrailMeshes(tracks, {
      radius: 0.12,
      colors: ["#00e5ff"],
    });
    expect(trailMeshes).toHaveLength(1);
    const geometry = trailMeshes[0].geometry as THREE.TubeGeometry;
    expect(geometry.attributes.position.count).toBeGreaterThan(0);
    expect(anchorMeshes).toHaveLength(0);
  });

  it("双声部轨生成两条网格，z 轴分层保持", () => {
    const tracks = layoutTrail(
      [note(60, 0, 0), note(64, 1, 0), note(48, 0, 1), note(52, 1, 1)],
      OPT,
    );
    const { trailMeshes } = buildTrailMeshes(tracks, {
      radius: 0.12,
      colors: ["#00e5ff", "#ff5c8a"],
    });
    expect(trailMeshes).toHaveLength(2);
    const box = new THREE.Box3().setFromObject(trailMeshes[1]);
    // 第二轨整体位于 z = staffGap
    expect(box.min.z).toBeGreaterThan(2);
  });

  it("和弦锚点生成对应数量的小球，y 指向其余音高", () => {
    const tracks = layoutTrail(
      [note(60, 0), note(64, 0), note(67, 0), note(72, 0)],
      OPT,
    );
    const { trailMeshes, anchorMeshes } = buildTrailMeshes(tracks, {
      radius: 0.12,
      colors: ["#00e5ff"],
    });
    expect(trailMeshes).toHaveLength(1);
    expect(anchorMeshes).toHaveLength(3);
    const ys = anchorMeshes.map((m) => m.position.y).sort((a, b) => a - b);
    expect(ys[0]).toBeCloseTo(0, 6);
    expect(ys[2]).toBeCloseTo(3.5, 6);
  });

  it("单点声部轨退化为球体而非管状", () => {
    const tracks = layoutTrail([note(60, 5)], OPT);
    const { trailMeshes } = buildTrailMeshes(tracks, {
      radius: 0.12,
      colors: ["#00e5ff"],
    });
    expect(trailMeshes).toHaveLength(1);
    expect(trailMeshes[0].geometry).toBeInstanceOf(THREE.SphereGeometry);
  });

  it("材质 emissive 按轨色着色", () => {
    const tracks = layoutTrail([note(60, 0), note(64, 1)], OPT);
    const { trailMeshes } = buildTrailMeshes(tracks, {
      radius: 0.12,
      colors: ["#00e5ff", "#ff5c8a"],
    });
    const material = trailMeshes[0].material as THREE.MeshStandardMaterial;
    expect(material.emissive.getHexString()).toBe("00e5ff");
  });
});

describe("buildGlowMesh", () => {
  it("光点为球体，位置可设置", () => {
    const glow = buildGlowMesh({
      radius: 0.35,
      baseIntensity: 0.6,
      peakIntensity: 3.2,
    });
    expect(glow.geometry).toBeInstanceOf(THREE.SphereGeometry);
    glow.position.set(1, 2, 3);
    expect(glow.position.toArray()).toEqual([1, 2, 3]);
  });
});
