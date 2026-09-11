/**
 * NoteBlockRenderer 触发高亮回归测试
 *
 * Bug：钢琴播放时，尚未接触命中线（piano line）的 note block 也被高亮。
 *
 * 根因：渲染器用「全局按音高（midi）索引的已触发集合」判断高亮，
 * 于是一旦某个音高 X 的音符触发了，屏幕上所有同音高 X 的方块（包括
 * 还在上方下落的未来方块）都会一起被点亮。
 *
 * 正确的判定依据是方块自身的 triggered 状态：只有真正压在命中线上
 * 的方块（triggered && !ended）才高亮。本测试在两个同音高方块上验证。
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { Graphics } from "pixi.js";
import { NoteBlockRenderer } from "@/views/WaterfallPiano/engine/NoteBlockRenderer";
import { noteToColor } from "@/views/WaterfallPiano/engine/NoteColorMapper";
import { defaultWaterfallSettings } from "@/views/WaterfallPiano/constants";
import type { NoteBlock } from "@/views/WaterfallPiano/engine/NoteBlockPool";
import type { KeyboardRenderer } from "@/views/WaterfallPiano/engine/KeyboardRenderer";
import type { AuraConfig, ParticleConfig } from "@/views/WaterfallPiano/types";

const HEIGHT = 400;
const WIDTH = 800;
const MIDI = 60;
/** 命中线 = 键盘顶部 = 瀑布底部（y = height） */
const HIT_LINE_Y = HEIGHT;

function makeBlock(overrides: Partial<NoteBlock>): NoteBlock {
  return {
    midi: MIDI,
    velocity: 100,
    hand: "right",
    trackIndex: 0,
    startTime: 0,
    duration: 1,
    y: 0,
    height: 20,
    triggered: false,
    ended: false,
    releasing: false,
    fadeTime: 0,
    active: true,
    ...overrides,
  };
}

/** 只保留实体方块绘制，屏蔽 aura / 粒子 / 命中线，让 fill 调用与方块一一对应 */
function buildParticleConfig(): ParticleConfig {
  const p = structuredClone(defaultWaterfallSettings.particles);
  p.cornerRadius = 0;
  p.hitLine = { visible: false, color: "#ffffff", thickness: 1 };
  p.blockParticle = { ...p.blockParticle, enabled: false };
  return p;
}

function buildAuraConfig(): AuraConfig {
  return { ...defaultWaterfallSettings.aura, enabled: false };
}

/** 极简假键盘渲染器：只需提供方块宽度与 midi→x 映射 */
const fakeKeyboard = {
  getWhiteKeyWidth: (): number => 20,
  midiToX: (midi: number): number => midi * 20 + 10,
} as unknown as KeyboardRenderer;

/** 记录每帧 blocksGraphics.fill 的颜色（同一绘制顺序即 active 数组顺序） */
function captureFillColors(): string[] {
  const colors: string[] = [];
  vi.spyOn(Graphics.prototype, "fill").mockImplementation(function (
    this: Graphics,
    style?: unknown,
  ) {
    const c = (style as { color?: unknown } | undefined)?.color;
    if (typeof c === "string") colors.push(c);
    return this;
  } as never);
  return colors;
}

/** 构造只渲染给定方块列表的渲染器；triggeredSet 为全局「已触发音高」集合 */
function renderBlocks(blocks: NoteBlock[], triggeredMidis: number[]): string[] {
  const colors = captureFillColors();
  const renderer = new NoteBlockRenderer(
    buildParticleConfig as unknown as () => ParticleConfig,
    buildAuraConfig as unknown as () => AuraConfig,
    () => fakeKeyboard,
    () => WIDTH,
    () => HEIGHT,
    () => blocks,
    () => new Set<number>(triggeredMidis),
  );
  renderer.render();
  return colors;
}

function baseColorOf(): string {
  const p = buildParticleConfig();
  return noteToColor(MIDI, p.colorScheme, "right", p.customColors);
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("NoteBlockRenderer 触发高亮", () => {
  it("未接触命中线的同音高方块不应被高亮", () => {
    const touching = makeBlock({
      y: HIT_LINE_Y,
      triggered: true,
      ended: false,
    });
    const future = makeBlock({
      y: HIT_LINE_Y * 0.4,
      triggered: false,
      ended: false,
    });

    // 音符 60 已触发 —— 全局集合里存在 60（bug 的触发条件）
    const colors = renderBlocks([touching, future], [MIDI]);
    const baseColor = baseColorOf();

    expect(colors).toHaveLength(2);
    // 接触命中线的方块：高亮（颜色被提亮，≠ 基础色）
    expect(colors[0]).not.toBe(baseColor);
    // 尚未接触命中线的同音高方块：保持基础色
    expect(colors[1]).toBe(baseColor);
  });

  it("同音高的已结束方块（已越过命中线）不再高亮", () => {
    const ended = makeBlock({
      y: HIT_LINE_Y * 0.5,
      triggered: true,
      ended: true,
    });

    const colors = renderBlocks([ended], [MIDI]);
    expect(colors).toHaveLength(1);
    expect(colors[0]).toBe(baseColorOf());
  });

  it("realtime 方块（trackIndex < 0）仍按全局已触发集合高亮", () => {
    const realtime = makeBlock({
      trackIndex: -1,
      y: HIT_LINE_Y,
      triggered: true,
      ended: false,
    });

    const colors = renderBlocks([realtime], [MIDI]);
    expect(colors).toHaveLength(1);
    expect(colors[0]).not.toBe(baseColorOf());
  });

  it("realtime 方块未在全局集合中时不高亮", () => {
    const realtime = makeBlock({
      trackIndex: -1,
      y: HIT_LINE_Y,
      triggered: true,
      ended: false,
    });

    const colors = renderBlocks([realtime], []);
    expect(colors).toHaveLength(1);
    expect(colors[0]).toBe(baseColorOf());
  });
});
