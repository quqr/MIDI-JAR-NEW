/**
 * 瀑布流合并面板契约测试（ADR 0025）
 *
 * 锁定「资料 + 设置收进同一个右侧抽屉」这一结构决策的关键行为：
 * - 展开时恰好一个右侧抽屉（不再有左右两个面板）；
 * - 头部两个页签，当前页签对应的内容可见、另一个 display:none；
 * - 关闭按钮 / Esc / 载入文件三路都会请求收起面板；
 * - 载入文件时同时把加载事件透传给外部（收起 + 上报）。
 */
import { describe, it, expect, afterEach, beforeEach } from "vitest";
import { mount, type VueWrapper } from "@vue/test-utils";
import { nextTick } from "vue";
import { createPinia } from "pinia";
import WaterfallSidePanel from "@/views/WaterfallPiano/components/WaterfallSidePanel.vue";
import WaterfallLibraryContent from "@/views/WaterfallPiano/components/WaterfallLibraryContent.vue";
import i18n from "@/locales/i18n";

let wrapper: VueWrapper | null = null;

function mountPanel(props: Record<string, unknown> = {}) {
  wrapper = mount(WaterfallSidePanel, {
    props: {
      modelValue: true,
      tab: "library",
      mode: "synthesia",
      fileName: "",
      tracks: [],
      selectedTracks: [],
      playbackSpeed: 1,
      loop: false,
      ...props,
    },
    global: { plugins: [createPinia(), i18n] },
  });
  return wrapper;
}

/** 页签内容 wrapper 的显示状态（v-show → display） */
function panelDisplay(id: string): string {
  const el = document.getElementById(id);
  return el ? getComputedStyle(el).display : "missing";
}

beforeEach(() => {
  document.body.innerHTML = "";
});

afterEach(() => {
  wrapper?.unmount();
  wrapper = null;
  document.body.innerHTML = "";
});

describe("WaterfallSidePanel 结构与页签", () => {
  it("展开时只有一个右侧抽屉，且头部恰好两个页签", () => {
    mountPanel();
    const asides = document.querySelectorAll('aside[role="dialog"]');
    expect(asides).toHaveLength(1);
    const tabs = [...document.querySelectorAll('[role="tab"]')].map((t) =>
      t.textContent.trim(),
    );
    expect(tabs).toHaveLength(2);
  });

  it("未展开时不渲染抽屉与遮罩", () => {
    mountPanel({ modelValue: false });
    expect(document.querySelectorAll('aside[role="dialog"]')).toHaveLength(0);
    expect(document.querySelector(".fixed.inset-0")).toBeNull();
  });

  it("tab=library：资料可见、设置隐藏", () => {
    mountPanel({ tab: "library" });
    expect(panelDisplay("waterfall-panel-library")).not.toBe("none");
    expect(panelDisplay("waterfall-panel-settings")).toBe("none");
  });

  it("tab=settings：设置可见、资料隐藏", () => {
    mountPanel({ tab: "settings" });
    expect(panelDisplay("waterfall-panel-library")).toBe("none");
    expect(panelDisplay("waterfall-panel-settings")).not.toBe("none");
  });

  it("点击页签 emit update:tab，当前页签标记 aria-selected", async () => {
    const w = mountPanel({ tab: "library" });
    const tabs = [...document.querySelectorAll('[role="tab"]')];
    expect(tabs[0].getAttribute("aria-selected")).toBe("true");
    expect(tabs[1].getAttribute("aria-selected")).toBe("false");

    (tabs[1] as HTMLElement).click();
    await nextTick();
    expect(w.emitted("update:tab")).toEqual([["settings"]]);
  });
});

describe("WaterfallSidePanel 收起路径", () => {
  it("点击关闭按钮 emit update:modelValue(false)", async () => {
    const w = mountPanel();
    const closeBtn = document.querySelector(
      'aside[role="dialog"] button[aria-label]',
    ) as HTMLButtonElement;
    // 头部第一个带 aria-label 的按钮即关闭按钮（页签是 role=tab）
    closeBtn.click();
    await nextTick();
    expect(w.emitted("update:modelValue")).toEqual([[false]]);
  });

  it("按 Esc emit update:modelValue(false)", async () => {
    const w = mountPanel();
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    await nextTick();
    expect(w.emitted("update:modelValue")).toEqual([[false]]);
  });

  it("载入 MIDI 时透传文件并收起面板", async () => {
    const w = mountPanel();
    const file = new File(["x"], "a.mid");
    w.findComponent(WaterfallLibraryContent).vm.$emit("load-midi", file);
    await nextTick();
    expect(w.emitted("load-midi")![0]).toEqual([file]);
    expect(w.emitted("update:modelValue")).toEqual([[false]]);
  });

  it("载入 MusicXML 时透传文件并收起面板", async () => {
    const w = mountPanel();
    const file = new File(["x"], "a.musicxml");
    w.findComponent(WaterfallLibraryContent).vm.$emit("load-music-xml", file);
    await nextTick();
    expect(w.emitted("load-music-xml")![0]).toEqual([file]);
    expect(w.emitted("update:modelValue")).toEqual([[false]]);
  });
});
