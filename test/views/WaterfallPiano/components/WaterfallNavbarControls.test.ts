/**
 * 瀑布流导航栏控制条——响应式布局契约与交互测试（ADR 0024 / 0025）
 *
 * jsdom 无布局引擎，无法断言像素级断点行为；此处锁定的是
 * Tailwind 类层面的**响应式契约**（谁收缩、谁受保护、何时隐藏），
 * 配合类的语义保证真实视口下的表现：
 * - 根节点：mx-auto（居中）+ max-w-xl（限宽）+ min-w-0（可收缩）；
 * - 所有按钮 shrink-0（永不被挤压，冲突时先收缩进度条）；
 * - 进度条 flex-1 min-w-6（第一收缩优先级）；
 * - 时间显示按断点逐级隐藏（当前时间 <sm、总时长 <md）。
 *
 * ADR 0025：资料 + 设置合并为单入口后，按钮从 5 个减到 4 个。
 */
import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import WaterfallNavbarControls from "@/views/WaterfallPiano/components/WaterfallNavbarControls.vue";
import i18n from "@/locales/i18n";

/** 挂载工厂：props 可覆盖 */
function mountControls(props: Record<string, unknown> = {}) {
  return mount(WaterfallNavbarControls, {
    props: {
      currentTime: 0,
      duration: 0,
      isPlaying: false,
      isPaused: false,
      isRecording: false,
      hasContent: true,
      panelOpen: false,
      exporting: false,
      ...props,
    },
    global: {
      plugins: [i18n],
    },
  });
}

describe("WaterfallNavbarControls 响应式布局契约", () => {
  it("根节点居中且可收缩：mx-auto + max-w-xl + min-w-0", () => {
    const w = mountControls();
    // 模板带前导注释（fragment 锚点），w.element 可能指向注释；取首个真实 div
    const root = w.find("div").element as HTMLElement;
    expect(root.className).toContain("mx-auto");
    expect(root.className).toContain("max-w-xl");
    expect(root.className).toContain("min-w-0");
  });

  it("全部按钮 shrink-0：进度收缩前按钮永不换行/挤压", () => {
    const w = mountControls({ duration: 120 });
    const buttons = w.findAll("button");
    expect(buttons.length).toBe(4); // 播放/停止/录制/合并面板（ADR 0025）
    for (const b of buttons) {
      expect(
        b.classes(),
        `按钮 ${b.attributes("aria-label")} 应 shrink-0`,
      ).toContain("shrink-0");
    }
  });

  it("进度条是第一收缩项：flex-1 弹性 + min-w-6 收缩下限", () => {
    const w = mountControls({ duration: 120 });
    const range = w.find('input[type="range"]');
    expect(range.classes()).toContain("flex-1");
    expect(range.classes()).toContain("min-w-6");
  });

  it("时间显示按断点逐级隐藏：当前时间 hidden sm:inline、总时长 hidden md:inline", () => {
    const w = mountControls({ duration: 120 });
    const spans = w.findAll("span");
    const timeSpans = spans.filter((s) => s.classes().includes("tabular-nums"));
    expect(timeSpans.length).toBe(2);
    // 窄屏（<sm）两个时间都隐藏，中屏（<md）仅总时长隐藏
    for (const s of timeSpans) {
      expect(s.classes()).toContain("hidden");
    }
    expect(timeSpans[0].classes()).toContain("sm:inline");
    expect(timeSpans[1].classes()).toContain("md:inline");
  });

  it("窄屏窄容器下不会溢出：无 min-w-max / whitespace-nowrap 类", () => {
    const w = mountControls();
    expect(w.html()).not.toContain("min-w-max");
    expect(w.html()).not.toContain("whitespace-nowrap");
  });
});

describe("WaterfallNavbarControls 交互", () => {
  it("空闲时点击播放按钮 emit play，播放中点击 emit pause", async () => {
    const idle = mountControls({ isPlaying: false });
    await idle.find("button").trigger("click");
    expect(idle.emitted("play")).toHaveLength(1);
    expect(idle.emitted("pause")).toBeUndefined();

    const playing = mountControls({ isPlaying: true });
    await playing.find("button").trigger("click");
    expect(playing.emitted("pause")).toHaveLength(1);
  });

  it("无内容时播放按钮禁用；停止按钮仅在播放/暂停时可用", () => {
    const empty = mountControls({ hasContent: false });
    const playBtn = empty.findAll("button")[0];
    expect(playBtn.attributes("disabled")).toBeDefined();

    const idle = mountControls({ isPlaying: false, isPaused: false });
    const stopBtn = idle.findAll("button")[1];
    expect(stopBtn.attributes("disabled")).toBeDefined();

    const paused = mountControls({ isPlaying: false, isPaused: true });
    expect(paused.findAll("button")[1].attributes("disabled")).toBeUndefined();
  });

  it("拖动进度条 emit seek（数值）", async () => {
    const w = mountControls({ duration: 120 });
    const range = w.find('input[type="range"]');
    (range.element as HTMLInputElement).value = "42.5";
    await range.trigger("input");
    expect(w.emitted("seek")![0]).toEqual([42.5]);
  });

  it("时长为 0 时进度条禁用", () => {
    const w = mountControls({ duration: 0 });
    expect(w.find('input[type="range"]').attributes("disabled")).toBeDefined();
  });

  it("合并面板单入口：点击 emit toggle-panel，展开态高亮并标记 aria-expanded", async () => {
    const closed = mountControls({ panelOpen: false });
    const panelBtn = closed.findAll("button")[3];
    await panelBtn.trigger("click");
    expect(closed.emitted("toggle-panel")).toHaveLength(1);
    expect(panelBtn.classes()).toContain("btn-ghost");
    expect(panelBtn.attributes("aria-expanded")).toBe("false");

    const open = mountControls({ panelOpen: true });
    const openBtn = open.findAll("button")[3];
    expect(openBtn.classes()).toContain("btn-primary");
    expect(openBtn.attributes("aria-expanded")).toBe("true");
  });

  it("导出期间禁用传输控件（播放/停止/录制/进度），面板入口保持可用（ADR 0026）", () => {
    const w = mountControls({
      duration: 120,
      isPaused: true, // 正常下停止按钮可用，用于对照
      exporting: true,
    });
    const buttons = w.findAll("button");
    for (const i of [0, 1, 2]) {
      expect(
        buttons[i].attributes("disabled"),
        `按钮 #${i} 导出期间应禁用`,
      ).toBeDefined();
    }
    // 面板入口（#3）不禁用：导出进度与取消按钮在那里
    expect(buttons[3].attributes("disabled")).toBeUndefined();
    expect(w.find('input[type="range"]').attributes("disabled")).toBeDefined();
  });

  it("未导出时传输控件不禁用（对照）", () => {
    const w = mountControls({
      duration: 120,
      isPaused: true,
      exporting: false,
    });
    const buttons = w.findAll("button");
    expect(buttons[0].attributes("disabled")).toBeUndefined();
    expect(buttons[1].attributes("disabled")).toBeUndefined();
    expect(
      w.find('input[type="range"]').attributes("disabled"),
    ).toBeUndefined();
  });
});
