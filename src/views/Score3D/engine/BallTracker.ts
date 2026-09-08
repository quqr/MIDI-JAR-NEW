import * as THREE from "three";
import type { VoiceEvent } from "../types";
import {
  BALL_EMISSIVE_INTENSITY,
  BALL_HOP_HEIGHT,
  BALL_HOP_SECONDS,
  BALL_IDLE_BOUNCE,
  BALL_MAX_HOPS,
  BALL_MERGE_FADE,
  BALL_RADIUS,
  BALL_TRAIL_OPACITY,
  BALL_TRAIL_POINTS,
  GLYPH_WORLD_SCALE,
  GLOW_Z,
  trackColor,
} from "../constants";

/**
 * 追迹小球（ADR 0019）：每声部轨一组小球随播放逐音符弹跳。
 *
 * 语义（用户裁决）：
 * - 球数 = 当前发声音符数（单音 1、三和弦 3、七和弦 4）；
 * - 按音符起点时刻，各球沿抛物线从上一符头弹跳到下一符头；
 * - 和弦变大：多出的符头由「最新球」分裂——从相邻球出发飞向新符头；
 * - 和弦变小：多出的球中选离目标最远的一颗，飞向下一组最近音符位置，到达后融入消失；
 * - 休止/无事件：原地呼吸缩放等待。
 *
 * 坐标：输入谱面 px（y 向下），内部换算为世界坐标（GLYPH_WORLD_SCALE + y 翻转）。
 */

interface BallFlight {
  from: THREE.Vector3;
  to: THREE.Vector3;
  t0: number;
  t1: number;
  /** 到达后融入消失 */
  merging: boolean;
  /** 弹跳段数（长间隙拆分为连续多跳） */
  hops: number;
}

interface Ball {
  mesh: THREE.Mesh;
  material: THREE.MeshStandardMaterial;
  /** 在当前事件符头序列中的槽位（y 升序稳定配对） */
  slot: number;
  flight: BallFlight | null;
  /** 移动轨迹（渐隐尾迹）：历史位置环形队列 */
  trail: THREE.Line;
  trailGeo: THREE.BufferGeometry;
  trailMaterial: THREE.LineBasicMaterial;
  trailPts: THREE.Vector3[];
}

interface TrackState {
  trackIndex: number;
  events: VoiceEvent[];
  balls: Ball[];
  /** 当前所处事件下标（-1 = 未开始） */
  k: number;
}

/** 末事件后的默认停留时长（秒），供弹跳动画的 t1 参考 */
const LAST_HOLD_SECONDS = 1;

function toWorld(x: number, y: number): THREE.Vector3 {
  return new THREE.Vector3(
    x * GLYPH_WORLD_SCALE,
    -y * GLYPH_WORLD_SCALE,
    GLOW_Z,
  );
}

export class BallTracker {
  readonly root: THREE.Group = new THREE.Group();

  private readonly tracks: TrackState[] = [];
  private readonly geometry: THREE.SphereGeometry;
  private readonly disposables: (THREE.BufferGeometry | THREE.Material)[] = [];

  constructor(events: readonly VoiceEvent[]) {
    this.geometry = new THREE.SphereGeometry(BALL_RADIUS, 20, 14);
    this.disposables.push(this.geometry);

    const byTrack = new Map<number, VoiceEvent[]>();
    for (const e of events) {
      let list = byTrack.get(e.trackIndex);
      if (!list) {
        list = [];
        byTrack.set(e.trackIndex, list);
      }
      list.push(e);
    }
    for (const [trackIndex, list] of byTrack) {
      list.sort((a, b) => a.t - b.t);
      this.tracks.push({ trackIndex, events: list, balls: [], k: -1 });
    }
    this.tracks.sort((a, b) => a.trackIndex - b.trackIndex);
  }

  update(time: number): void {
    for (const track of this.tracks) {
      const k = this.eventIndexAt(track, time);
      if (k !== track.k) {
        this.transition(track, k);
        track.k = k;
      }
      this.animate(track, time);
    }
  }

  /**
   * 主球位置（第一声部槽位 0 的球），供相机目标跟随。
   * 小球尚未出现时返回 false，调用方保持上一帧目标。
   */
  getMainBallPoint(out: { x: number; y: number; z: number }): boolean {
    const track = this.tracks[0];
    const ball = track?.balls.find((b) => !b.flight?.merging);
    if (!ball || track.k < 0) return false;
    const p = ball.mesh.position;
    out.x = p.x;
    out.y = p.y;
    out.z = p.z;
    return true;
  }

  dispose(): void {
    for (const track of this.tracks) {
      for (const ball of track.balls) {
        ball.material.dispose();
      }
      track.balls.length = 0;
    }
    for (const d of this.disposables) d.dispose();
    this.disposables.length = 0;
    this.root.clear();
  }

  // ── 内部 ──

  private eventIndexAt(track: TrackState, time: number): number {
    const events = track.events;
    let lo = 0;
    let hi = events.length - 1;
    let found = -1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (events[mid].t <= time) {
        found = mid;
        lo = mid + 1;
      } else {
        hi = mid - 1;
      }
    }
    return found;
  }

  /** 事件切换：按「目标球数 vs 现有球数」重排/分裂/合并 */
  private transition(track: TrackState, k: number): void {
    if (k < 0) {
      // 播放头回到起点之前：全部回收
      for (const ball of track.balls) this.removeBall(track, ball);
      track.balls.length = 0;
      return;
    }
    const cur = track.events[k];
    const targets = cur.notes.map((n) => toWorld(n.x, n.y));
    const segEnd = this.segmentEnd(track, k);

    // 前一事件的遗留球处理：融合中的球到点即移除；普通飞行定格在终点
    for (let i = track.balls.length - 1; i >= 0; i--) {
      const ball = track.balls[i];
      if (ball.flight?.merging) {
        this.removeBall(track, ball);
        continue;
      }
      if (ball.flight) {
        ball.mesh.position.copy(ball.flight.to);
        this.clearFlight(ball);
      }
    }

    if (track.balls.length === 0) {
      // 初始出现：直接落在各自符头，无弹跳
      for (let i = 0; i < targets.length; i++) {
        const ball = this.createBall(track, i);
        ball.mesh.position.copy(targets[i]);
        ball.slot = i;
        this.resetTrail(ball);
        track.balls.push(ball);
      }
      return;
    }

    // 参与槽位分配的只有非融合球；融合球保留在列表中由 animate 移除
    const active = track.balls.filter((b) => !b.flight?.merging);
    active.sort((a, b) => a.slot - b.slot);
    const keep = Math.min(active.length, targets.length);

    // 保留球稳定配对（按槽位序）→ 弹跳到对应符头
    for (let i = 0; i < keep; i++) {
      const ball = active[i];
      ball.slot = i;
      this.startFlight(ball, targets[i], cur.t, segEnd, false);
    }

    if (targets.length > active.length) {
      // 和弦变大：从相邻球分裂出新球飞向多出的符头
      const extras = targets.slice(active.length);
      for (let i = 0; i < extras.length; i++) {
        const donor = active[active.length - 1];
        const ball = this.createBall(track, active.length + i);
        ball.mesh.position.copy(donor.mesh.position);
        ball.slot = active.length + i;
        this.resetTrail(ball);
        this.startFlight(ball, extras[i], cur.t, segEnd, false);
        track.balls.push(ball);
        active.push(ball);
      }
    } else if (active.length > targets.length) {
      // 和弦变小：多出的球按「离目标最远优先」逐个飞向最近音符后融入消失
      // （融合球不从 track.balls 移除，仍在列表中随 animate 完成消失）
      const pool = active.slice(targets.length);
      while (pool.length > 0) {
        // 每轮选「到最近目标距离」最大的球
        let farIdx = 0;
        let farDist = -1;
        let farTarget = targets[0];
        for (let i = 0; i < pool.length; i++) {
          const pos = pool[i].mesh.position;
          let best = Infinity;
          let bestTarget = targets[0];
          for (const t of targets) {
            const d = pos.distanceToSquared(t);
            if (d < best) {
              best = d;
              bestTarget = t;
            }
          }
          if (best > farDist) {
            farDist = best;
            farIdx = i;
            farTarget = bestTarget;
          }
        }
        const ball = pool.splice(farIdx, 1)[0];
        this.startFlight(ball, farTarget, cur.t, segEnd, true);
      }
    }
  }

  private animate(track: TrackState, time: number): void {
    for (const ball of [...track.balls]) {
      if (ball.flight) {
        const f = ball.flight;
        const span = f.t1 - f.t0;
        const p =
          span > 1e-6 ? Math.min(1, Math.max(0, (time - f.t0) / span)) : 1;
        // 长间隙拆分为多次连续小弹跳：整体前进 + 每段独立弧线，
        // 保证整个播放过程小球持续运动而非一段滑行
        const hops = f.hops;
        const q = p * hops;
        const seg = Math.min(hops - 1, Math.floor(q));
        const local = q - seg;
        const segFrom = f.from.clone().lerp(f.to, seg / hops);
        const segTo = f.from.clone().lerp(f.to, (seg + 1) / hops);
        const eased = local * local * (3 - 2 * local);
        const arc = Math.sin(Math.PI * local) * BALL_HOP_HEIGHT;
        ball.mesh.position.lerpVectors(segFrom, segTo, eased);
        ball.mesh.position.z += arc;
        this.pushTrail(ball, ball.mesh.position);
        if (f.merging) {
          // 末段融入消失
          const fadeStart =
            1 - BALL_MERGE_FADE / Math.max(span, BALL_MERGE_FADE);
          ball.material.opacity =
            p >= fadeStart ? 1 - (p - fadeStart) / (1 - fadeStart) : 1;
          if (p >= 1) {
            this.removeBall(track, ball);
            track.balls.splice(track.balls.indexOf(ball), 1);
            continue;
          }
        } else if (p >= 1) {
          ball.mesh.position.copy(f.to);
          this.clearFlight(ball);
        }
      } else {
        // 待机：原地小幅弹跳（法向），保持"活着"的观感
        const bounce = Math.abs(Math.sin(time * 3 + ball.slot * 1.7));
        ball.mesh.position.z = GLOW_Z + bounce * BALL_IDLE_BOUNCE;
        this.pushTrail(ball, ball.mesh.position);
      }
    }
  }

  /** 记录轨迹点并重写尾迹几何（历史队列首=球当前位置） */
  private pushTrail(ball: Ball, pos: THREE.Vector3): void {
    const pts = ball.trailPts;
    pts.unshift(pos.clone());
    if (pts.length > BALL_TRAIL_POINTS) pts.length = BALL_TRAIL_POINTS;
    // 队列未满时尾部塌缩到最旧点，避免线段从原点拉出
    const attr = ball.trailGeo.getAttribute(
      "position",
    ) as THREE.BufferAttribute;
    for (let i = 0; i < BALL_TRAIL_POINTS; i++) {
      const v = pts[Math.min(i, pts.length - 1)];
      attr.setXYZ(i, v.x, v.y, v.z);
    }
    attr.needsUpdate = true;
  }

  private startFlight(
    ball: Ball,
    to: THREE.Vector3,
    t0: number,
    t1: number,
    merging: boolean,
  ): void {
    const span = Math.max(t1, t0 + 0.05) - t0;
    ball.flight = {
      from: ball.mesh.position.clone(),
      to,
      t0,
      t1: t0 + span,
      merging,
      // 长间隙拆分为多次连续弹跳（每段约 BALL_HOP_SECONDS）
      hops: Math.max(
        1,
        Math.min(BALL_MAX_HOPS, Math.round(span / BALL_HOP_SECONDS)),
      ),
    };
    ball.mesh.scale.setScalar(1);
    if (merging) ball.material.transparent = true;
  }

  private clearFlight(ball: Ball): void {
    ball.flight = null;
    if (ball.material.transparent) {
      ball.material.transparent = false;
      ball.material.opacity = 1;
    }
  }

  private segmentEnd(track: TrackState, k: number): number {
    const next = track.events[k + 1];
    return next ? next.t : track.events[k].t + LAST_HOLD_SECONDS;
  }

  private createBall(track: TrackState, slot: number): Ball {
    const color = trackColor(track.trackIndex);
    const material = new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: BALL_EMISSIVE_INTENSITY,
      roughness: 0.3,
      metalness: 0.1,
      transparent: false,
      opacity: 1,
    });
    const mesh = new THREE.Mesh(this.geometry, material);
    mesh.userData.trackIndex = track.trackIndex;
    mesh.userData.slot = slot;

    // 渐隐尾迹：固定长度线带，历史队列未满时尾部塌缩在球位
    const trailGeo = new THREE.BufferGeometry();
    trailGeo.setAttribute(
      "position",
      new THREE.BufferAttribute(new Float32Array(BALL_TRAIL_POINTS * 3), 3),
    );
    const trailMaterial = new THREE.LineBasicMaterial({
      color,
      transparent: true,
      opacity: BALL_TRAIL_OPACITY,
      depthWrite: false,
    });
    const trail = new THREE.Line(trailGeo, trailMaterial);
    trail.frustumCulled = false;
    this.root.add(mesh, trail);

    const ball: Ball = {
      mesh,
      material,
      slot,
      flight: null,
      trail,
      trailGeo,
      trailMaterial,
      trailPts: [],
    };
    // 初始化队列：全部点置于球位（线不可见）
    for (let i = 0; i < BALL_TRAIL_POINTS; i++) {
      ball.trailPts.push(mesh.position.clone());
    }
    return ball;
  }

  /** 轨迹队列整体重置到球当前位置（新球出现时防从原点拉线） */
  private resetTrail(ball: Ball): void {
    ball.trailPts.length = 0;
    for (let i = 0; i < BALL_TRAIL_POINTS; i++) {
      ball.trailPts.push(ball.mesh.position.clone());
    }
    this.pushTrail(ball, ball.mesh.position);
  }

  private removeBall(track: TrackState, ball: Ball): void {
    this.root.remove(ball.mesh, ball.trail);
    ball.material.dispose();
    ball.trailGeo.dispose();
    ball.trailMaterial.dispose();
    const idx = track.balls.indexOf(ball);
    if (idx >= 0) track.balls.splice(idx, 1);
  }
}
