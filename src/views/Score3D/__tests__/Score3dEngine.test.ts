import { describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import { Score3dEngine, type RendererLike } from "../engine/Score3dEngine";
import { TrailStrategy } from "../engine/TrailStrategy";
import { layoutTrail } from "../engine/layoutTrail";
import { toScore3dNotes } from "../engine/noteMapper";
import {
  DEFAULT_ENVELOPE_PARAMS,
  DEFAULT_GLOW_PARAMS,
  DEFAULT_LAYOUT_OPTIONS,
} from "../constants";
import type { Score3dNote, TrailTrack } from "../types";
import { buildTempoMap } from "@/views/ScoreScroll/utils/beatMap";

/** 记录调用的渲染器 stub（jsdom 无 WebGL） */
function createStubRenderer() {
  const render = vi.fn();
  const setSize = vi.fn();
  const dispose = vi.fn();
  const stub: RendererLike = {
    setPixelRatio: vi.fn(),
    setSize,
    render,
    dispose,
  };
  return { stub, render, setSize, dispose };
}

const TEMPO_120 = buildTempoMap([{ ticks: 0, bpm: 120, time: 0 }], 480);

function buildSample(): {
  tracks: TrailTrack[];
  notes: Score3dNote[];
  duration: number;
} {
  const { notes, tracks: infos, duration } = toScore3dNotes(
    [
      {
        channel: 0,
        notes: [
          { midi: 72, velocity: 0.9, time: 0, duration: 1 },
          { midi: 74, velocity: 0.8, time: 1, duration: 1 },
          { midi: 76, velocity: 0.7, time: 2, duration: 1 },
        ],
      },
      {
        channel: 1,
        notes: [{ midi: 48, velocity: 0.6, time: 0, duration: 3 }],
      },
    ],
    { groupBy: "track", tempoMap: TEMPO_120 },
  );
  return {
    notes,
    tracks: layoutTrail(notes, DEFAULT_LAYOUT_OPTIONS),
    duration,
  };
}

/** 构造一条双轨策略 */
function buildStrategy() {
  const { notes, tracks, duration } = buildSample();
  const strategy = new TrailStrategy(tracks, notes, {
    layout: DEFAULT_LAYOUT_OPTIONS,
    glow: DEFAULT_GLOW_PARAMS,
    envelope: DEFAULT_ENVELOPE_PARAMS,
    anchorWindow: 0.15,
    cameraOffset: { x: -6, y: 4, z: 10 },
  });
  void duration;
  return strategy;
}

describe("Score3dEngine 装配（stub renderer）", () => {
  it("setStrategy 后场景挂载策略根节点", () => {
    const { stub } = createStubRenderer();
    const canvas = document.createElement("canvas");
    const engine = new Score3dEngine(canvas, () => stub);
    const strategy = buildStrategy();
    engine.setStrategy(strategy);
    expect(engine["scene"].children).toContain(strategy.root);
    engine.dispose();
  });

  it("替换策略时旧策略被卸载并释放", () => {
    const { stub } = createStubRenderer();
    const canvas = document.createElement("canvas");
    const engine = new Score3dEngine(canvas, () => stub);
    const first = buildStrategy();
    const disposeSpy = vi.spyOn(first, "dispose");
    const second = buildStrategy();
    engine.setStrategy(first);
    engine.setStrategy(second);
    expect(engine["scene"].children).not.toContain(first.root);
    expect(engine["scene"].children).toContain(second.root);
    expect(disposeSpy).toHaveBeenCalledTimes(1);
    engine.dispose();
  });

  it("renderOnce：以 frameCallback 的时刻更新并渲染", () => {
    const { stub, render } = createStubRenderer();
    const canvas = document.createElement("canvas");
    const engine = new Score3dEngine(canvas, () => stub);
    const strategy = buildStrategy();
    engine.setStrategy(strategy);
    let fakeTime = 0;
    engine.frameCallback = () => fakeTime;
    fakeTime = 1.5;
    engine.renderOnce();
    expect(render).toHaveBeenCalledTimes(1);
    expect(strategy.getCameraPose()).not.toBeNull();
    engine.dispose();
  });

  it("无策略时 renderOnce 不抛错", () => {
    const { stub, render } = createStubRenderer();
    const canvas = document.createElement("canvas");
    const engine = new Score3dEngine(canvas, () => stub);
    expect(() => engine.renderOnce()).not.toThrow();
    expect(render).toHaveBeenCalledTimes(1);
    engine.dispose();
  });

  it("resize 同步宽高与相机纵横比", () => {
    const { stub, setSize } = createStubRenderer();
    const canvas = document.createElement("canvas");
    const engine = new Score3dEngine(canvas, () => stub);
    engine.resize(800, 600);
    expect(setSize).toHaveBeenCalledWith(800, 600);
    expect(engine["camera"].aspect).toBeCloseTo(800 / 600, 10);
    engine.dispose();
  });

  it("dispose 释放渲染器并停止循环", () => {
    const { stub, dispose } = createStubRenderer();
    const canvas = document.createElement("canvas");
    const engine = new Score3dEngine(canvas, () => stub);
    engine.start();
    engine.dispose();
    expect(dispose).toHaveBeenCalledTimes(1);
  });
});

describe("TrailStrategy 行为", () => {
  it("build 后根节点包含网格与灯光", () => {
    const strategy = buildStrategy();
    strategy.build();
    const lights = strategy.root.children.filter(
      (c) => c instanceof THREE.Light,
    );
    expect(strategy.root.children.length).toBeGreaterThan(2);
    expect(lights.length).toBe(2);
    strategy.dispose();
  });

  it("update 推进光点：相机位姿随时间前移", () => {
    const strategy = buildStrategy();
    strategy.build();
    strategy.update(0);
    const atStart = strategy.getCameraPose()!.position.x;
    strategy.update(2);
    const atEnd = strategy.getCameraPose()!.position.x;
    expect(atEnd).toBeGreaterThan(atStart);
    strategy.dispose();
  });

  it("setTrackVisible 隐藏对应声部轨的全部对象", () => {
    const strategy = buildStrategy();
    strategy.build();
    strategy.setTrackVisible(0, false);
    const track0 = strategy.root.children.filter(
      (c) => c.userData.trackIndex === 0,
    );
    expect(track0.length).toBeGreaterThan(0);
    expect(track0.every((c) => !c.visible)).toBe(true);
    strategy.setTrackVisible(0, true);
    expect(track0.every((c) => c.visible)).toBe(true);
    strategy.dispose();
  });

  it("dispose 后策略失效：更新与位姿查询安全返回", () => {
    const strategy = buildStrategy();
    strategy.build();
    const meshes = strategy.root.children.filter(
      (c): c is THREE.Mesh => c instanceof THREE.Mesh,
    );
    expect(meshes.length).toBeGreaterThan(0);
    strategy.dispose();
    expect(() => strategy.update(1)).not.toThrow();
    expect(strategy.getCameraPose()).toBeNull();
  });
});
