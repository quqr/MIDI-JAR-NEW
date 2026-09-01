import * as THREE from "three";
import {
  buildGlowMesh,
  buildTrailMeshes,
  createTrailCurve,
} from "./TrailGeometryBuilder";
import { CameraRig, PlayheadController } from "./PlayheadController";
import type { CameraPose } from "./PlayheadController";
import { evaluateEnvelope, evaluateGlowSine } from "./envelope";
import type { VisualStrategy } from "./VisualStrategy";
import type {
  EnvelopeParams,
  GlowParams,
  Score3dNote,
  TrailLayoutOptions,
  TrailPoint,
  TrailTrack,
} from "../types";
import {
  TRACK_COLORS,
  DEFAULT_TRAIL_RADIUS,
  CURVE_SAMPLES_PER_UNIT,
} from "../constants";

/** TrailStrategy 装配选项 */
export interface TrailStrategyOptions {
  layout: TrailLayoutOptions;
  glow: GlowParams;
  envelope: EnvelopeParams;
  /** 光点掠过锚点时的点亮窗口（秒） */
  anchorWindow: number;
  /** 相机相对光点的偏移 */
  cameraOffset: TrailPoint;
}

/** 单条声部轨的运行时对象 */
interface TrackRuntime {
  trackIndex: number;
  playhead: PlayheadController;
  glow: THREE.Mesh;
  glowMaterial: THREE.MeshStandardMaterial;
  anchors: { time: number; mesh: THREE.Mesh }[];
  anchorMaterial: THREE.MeshStandardMaterial;
  notes: Score3dNote[];
  objects: THREE.Object3D[];
}

/**
 * 发光轨迹 + 光点策略（ADR 0006 / ADR 0007）。
 *
 * - 每条声部轨一条连续管状能量带 + 一个沿曲线推进的光点
 * - 光点亮度 = 包络（当前音符）× 力度正弦映射（ADR 0006 的力度视觉通道）
 * - 光点掠过和弦锚点时点亮锚点小球
 * - 相机跟随第一条声部轨的光点（惯例上为旋律轨）
 */
export class TrailStrategy implements VisualStrategy {
  readonly name = "trail";
  readonly root: THREE.Group = new THREE.Group();

  private readonly runtimes: TrackRuntime[] = [];
  private readonly cameraRig: CameraRig;
  private readonly group = this.root;
  private readonly colors: string[];

  constructor(
    tracks: TrailTrack[],
    notes: Score3dNote[],
    private readonly options: TrailStrategyOptions,
  ) {
    this.colors = [...TRACK_COLORS];
    const { unitsPerSecond } = options.layout;

    for (const track of tracks) {
      const trackNotes = notes
        .filter((n) => n.trackIndex === track.trackIndex)
        .sort((a, b) => a.timeOn - b.timeOn);
      const curve = createTrailCurve(track.points);
      const playhead = new PlayheadController(curve, {
        unitsPerSecond,
        totalDuration:
          trackNotes.length > 0 ? trackNotes[trackNotes.length - 1].timeOff : 0,
        samples: Math.max(
          64,
          Math.ceil(track.points.length * CURVE_SAMPLES_PER_UNIT),
        ),
      });
      const { trailMeshes, anchorMeshes } = buildTrailMeshes([track], {
        radius: DEFAULT_TRAIL_RADIUS,
        colors: this.colors,
      });
      const glow = buildGlowMesh(options.glow);
      const glowMaterial = glow.material as THREE.MeshStandardMaterial;

      // anchorMeshes 的顺序 = chordAnchors × otherPoints 的展开顺序，直接按序配对
      const anchors: { time: number; mesh: THREE.Mesh }[] = [];
      let meshCursor = 0;
      for (const anchor of track.chordAnchors) {
        const time = track.points[anchor.pointIndex].x / unitsPerSecond;
        for (let i = 0; i < anchor.otherPoints.length; i++) {
          const mesh = anchorMeshes[meshCursor++];
          if (mesh) anchors.push({ time, mesh });
        }
      }

      this.runtimes.push({
        trackIndex: track.trackIndex,
        playhead,
        glow,
        glowMaterial,
        anchors,
        anchorMaterial:
          (anchorMeshes[0]?.material as THREE.MeshStandardMaterial) ??
          glowMaterial,
        notes: trackNotes,
        objects: [...trailMeshes, ...anchorMeshes, glow],
      });
      const runtime = this.runtimes[this.runtimes.length - 1];
      for (const object of runtime.objects) {
        object.userData.trackIndex = track.trackIndex;
      }
    }

    this.cameraRig = new CameraRig({ offset: options.cameraOffset });
  }

  build(): void {
    for (const runtime of this.runtimes) {
      this.group.add(...runtime.objects);
    }
    const ambient = new THREE.AmbientLight(0xffffff, 0.5);
    const directional = new THREE.DirectionalLight(0xffffff, 1.2);
    directional.position.set(10, 30, 20);
    this.group.add(ambient, directional);
  }

  update(time: number): void {
    for (const runtime of this.runtimes) {
      const { point } = runtime.playhead.positionAt(time);
      runtime.glow.position.set(point.x, point.y, point.z);

      const note = this.findActiveNote(runtime.notes, time);
      if (note) {
        const env = evaluateEnvelope(time, note, this.options.envelope);
        const glowSine = evaluateGlowSine(note.velocity);
        const { baseIntensity, peakIntensity } = this.options.glow;
        runtime.glowMaterial.emissiveIntensity =
          baseIntensity + (peakIntensity - baseIntensity) * env * glowSine;
      } else {
        runtime.glowMaterial.emissiveIntensity =
          this.options.glow.baseIntensity * 0.4;
      }

      for (const anchor of runtime.anchors) {
        const material = anchor.mesh.material as THREE.MeshStandardMaterial;
        material.emissiveIntensity =
          Math.abs(anchor.time - time) <= this.options.anchorWindow ? 2.2 : 0.1;
      }
    }
  }

  getCameraPose(): CameraPose | null {
    const first = this.runtimes[0];
    if (!first) return null;
    const p = first.glow.position;
    return this.cameraRig.poseAt({ x: p.x, y: p.y, z: p.z });
  }

  setTrackVisible(trackIndex: number, visible: boolean): void {
    const runtime = this.runtimes.find((r) => r.trackIndex === trackIndex);
    if (!runtime) return;
    for (const object of runtime.objects) object.visible = visible;
  }

  dispose(): void {
    for (const runtime of this.runtimes) {
      for (const object of runtime.objects) {
        const mesh = object as THREE.Mesh;
        if (mesh.geometry) mesh.geometry.dispose();
        const material = mesh.material as THREE.MeshStandardMaterial;
        if (material) material.dispose();
      }
    }
    this.runtimes.length = 0;
    this.group.clear();
  }

  /** 找到 timeOn <= time 的最近一个音符（供包络求值） */
  private findActiveNote(
    notes: Score3dNote[],
    time: number,
  ): Score3dNote | null {
    if (notes.length === 0) return null;
    let lo = 0;
    let hi = notes.length - 1;
    let found = -1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (notes[mid].timeOn <= time) {
        found = mid;
        lo = mid + 1;
      } else {
        hi = mid - 1;
      }
    }
    return found >= 0 ? notes[found] : null;
  }
}
