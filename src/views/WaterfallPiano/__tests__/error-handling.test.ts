/**
 * 异常注入测试 - 验证错误处理路径和资源清理机制
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { PlayerStateMachine } from "../state/PlayerStateMachine";

describe("Error handling and recovery", () => {
  let sm: PlayerStateMachine;

  beforeEach(() => {
    sm = new PlayerStateMachine();
  });

  describe("MIDI 文件加载失败", () => {
    it("加载失败时应进入 error 状态", () => {
      sm.setState("loading");
      // 模拟加载失败
      sm.setState("error");
      expect(sm.getState()).toBe("error");
      expect(sm.isError).toBe(true);
    });

    it("加载失败后可以重试", () => {
      sm.setState("loading");
      sm.setState("error");
      // 用户点击重试
      expect(sm.setState("idle")).toBe(true);
      expect(sm.getState()).toBe("idle");
      // 重新开始加载
      expect(sm.setState("loading")).toBe(true);
      expect(sm.getState()).toBe("loading");
    });

    it("加载失败后不能直接播放", () => {
      sm.setState("loading");
      sm.setState("error");
      expect(sm.setState("playing")).toBe(false);
      expect(sm.getState()).toBe("error");
    });
  });

  describe("播放中音频崩溃", () => {
    it("播放中崩溃应进入 error 状态", () => {
      sm.setState("loading");
      sm.setState("ready");
      sm.setState("playing");
      sm.setState("error");
      expect(sm.getState()).toBe("error");
    });

    it("崩溃后重试应回到 idle 再重新加载", () => {
      sm.setState("loading");
      sm.setState("ready");
      sm.setState("playing");
      sm.setState("error");
      // 恢复
      sm.setState("idle");
      sm.setState("loading");
      sm.setState("ready");
      sm.setState("playing");
      expect(sm.getState()).toBe("playing");
    });
  });

  describe("暂停中音频崩溃", () => {
    it("暂停中崩溃应进入 error 状态", () => {
      sm.setState("loading");
      sm.setState("ready");
      sm.setState("playing");
      sm.setState("paused");
      sm.setState("error");
      expect(sm.getState()).toBe("error");
    });
  });

  describe("录制中错误", () => {
    it("录制中错误应进入 error 状态", () => {
      sm.setState("recording");
      sm.setState("error");
      expect(sm.getState()).toBe("error");
    });

    it("录制错误恢复后可以重新录制", () => {
      sm.setState("recording");
      sm.setState("error");
      sm.setState("idle");
      expect(sm.setState("recording")).toBe(true);
      expect(sm.getState()).toBe("recording");
    });
  });

  describe("WaterfallEngine 资源清理", () => {
    // 此测试需要 mock pino-logger
    vi.mock("@/utils/pino-logger", () => ({
      createLogger: () => ({
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      }),
    }));

    // 此测试需要 mock FluidSimulation
    vi.mock("@/engine/fluid", () => ({
      FluidSimulation: class MockFluidSimulation {
        start = vi.fn();
        splat = vi.fn();
        resize = vi.fn();
        destroy = vi.fn();
        updateConfig = vi.fn();
      },
      resolveConfig: () => ({}),
    }));

    it("dispose 后 isDisposed 应为 true", async () => {
      const { WaterfallEngine } = await import("../engine/WaterfallEngine");
      const engine = new WaterfallEngine();

      // 创建 mock canvases
      const mockCtx = new Proxy(
        {},
        {
          get: (_t, prop) => {
            if (prop === "canvas") return null;
            return () => {};
          },
        },
      ) as unknown as CanvasRenderingContext2D;

      const mockCanvas = {
        getContext: () => mockCtx,
        style: { touchAction: "" },
        width: 0,
        height: 0,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      } as unknown as HTMLCanvasElement;

      const canvases = {
        background: mockCanvas,
        fluid: mockCanvas,
        waterfall: mockCanvas,
        keyboard: mockCanvas,
      };

      const { defaultWaterfallSettings } = await import("../constants");
      const settings = structuredClone(defaultWaterfallSettings);

      engine.init(canvases, settings);
      expect(engine.isDisposed()).toBe(false);

      await engine.dispose();
      expect(engine.isDisposed()).toBe(true);
    });

    it("重复调用 dispose 应安全", async () => {
      const { WaterfallEngine } = await import("../engine/WaterfallEngine");
      const engine = new WaterfallEngine();
      await engine.dispose();
      await engine.dispose(); // 不应抛出异常
      expect(engine.isDisposed()).toBe(true);
    });
  });
});
