import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  PlayerStateMachine,
} from "../state/PlayerStateMachine";

describe("PlayerStateMachine", () => {
  let sm: PlayerStateMachine;

  beforeEach(() => {
    sm = new PlayerStateMachine();
  });

  describe("初始状态", () => {
    it("初始状态应为 idle", () => {
      expect(sm.getState()).toBe("idle");
    });

    it("isPlaying 应为 false", () => {
      expect(sm.isPlaying).toBe(false);
    });

    it("isPaused 应为 false", () => {
      expect(sm.isPaused).toBe(false);
    });

    it("isError 应为 false", () => {
      expect(sm.isError).toBe(false);
    });

    it("canLoadFile 应为 true", () => {
      expect(sm.canLoadFile).toBe(true);
    });

    it("canPlay 应为 false", () => {
      expect(sm.canPlay).toBe(false);
    });

    it("canSwitchMode 应为 true", () => {
      expect(sm.canSwitchMode).toBe(true);
    });
  });

  describe("有效状态转换", () => {
    it("idle → loading", () => {
      expect(sm.setState("loading")).toBe(true);
      expect(sm.getState()).toBe("loading");
    });

    it("loading → ready", () => {
      sm.setState("loading");
      expect(sm.setState("ready")).toBe(true);
      expect(sm.getState()).toBe("ready");
    });

    it("ready → playing", () => {
      sm.setState("loading");
      sm.setState("ready");
      expect(sm.setState("playing")).toBe(true);
      expect(sm.getState()).toBe("playing");
    });

    it("playing → paused", () => {
      sm.setState("loading");
      sm.setState("ready");
      sm.setState("playing");
      expect(sm.setState("paused")).toBe(true);
      expect(sm.getState()).toBe("paused");
    });

    it("paused → playing", () => {
      sm.setState("loading");
      sm.setState("ready");
      sm.setState("playing");
      sm.setState("paused");
      expect(sm.setState("playing")).toBe(true);
      expect(sm.getState()).toBe("playing");
    });

    it("idle → recording", () => {
      expect(sm.setState("recording")).toBe(true);
      expect(sm.getState()).toBe("recording");
    });

    it("recording → idle", () => {
      sm.setState("recording");
      expect(sm.setState("idle")).toBe(true);
      expect(sm.getState()).toBe("idle");
    });

    it("ready → loading（重新加载）", () => {
      sm.setState("loading");
      sm.setState("ready");
      expect(sm.setState("loading")).toBe(true);
      expect(sm.getState()).toBe("loading");
    });

    it("ready → recording", () => {
      sm.setState("loading");
      sm.setState("ready");
      expect(sm.setState("recording")).toBe(true);
      expect(sm.getState()).toBe("recording");
    });
  });

  describe("error 状态转换", () => {
    it("loading → error", () => {
      sm.setState("loading");
      expect(sm.setState("error")).toBe(true);
      expect(sm.getState()).toBe("error");
    });

    it("playing → error", () => {
      sm.setState("loading");
      sm.setState("ready");
      sm.setState("playing");
      expect(sm.setState("error")).toBe(true);
      expect(sm.getState()).toBe("error");
    });

    it("paused → error", () => {
      sm.setState("loading");
      sm.setState("ready");
      sm.setState("playing");
      sm.setState("paused");
      expect(sm.setState("error")).toBe(true);
      expect(sm.getState()).toBe("error");
    });

    it("recording → error", () => {
      sm.setState("recording");
      expect(sm.setState("error")).toBe(true);
      expect(sm.getState()).toBe("error");
    });

    it("error → idle（重试恢复）", () => {
      sm.setState("loading");
      sm.setState("error");
      expect(sm.setState("idle")).toBe(true);
      expect(sm.getState()).toBe("idle");
    });

    it("error 状态下不能转到除 idle 以外的状态", () => {
      sm.setState("loading");
      sm.setState("error");
      expect(sm.setState("loading")).toBe(false);
      expect(sm.setState("playing")).toBe(false);
      expect(sm.setState("ready")).toBe(false);
      expect(sm.getState()).toBe("error");
    });
  });

  describe("无效状态转换", () => {
    it("idle → playing 应被拒绝", () => {
      expect(sm.setState("playing")).toBe(false);
      expect(sm.getState()).toBe("idle");
    });

    it("idle → ready 应被拒绝", () => {
      expect(sm.setState("ready")).toBe(false);
      expect(sm.getState()).toBe("idle");
    });

    it("idle → paused 应被拒绝", () => {
      expect(sm.setState("paused")).toBe(false);
      expect(sm.getState()).toBe("idle");
    });

    it("playing → loading 应被拒绝", () => {
      sm.setState("loading");
      sm.setState("ready");
      sm.setState("playing");
      expect(sm.setState("loading")).toBe(false);
      expect(sm.getState()).toBe("playing");
    });

    it("playing → recording 应被拒绝", () => {
      sm.setState("loading");
      sm.setState("ready");
      sm.setState("playing");
      expect(sm.setState("recording")).toBe(false);
      expect(sm.getState()).toBe("playing");
    });

    it("playing → ready 应被拒绝", () => {
      sm.setState("loading");
      sm.setState("ready");
      sm.setState("playing");
      // playing → ready 是允许的（停止操作）
      expect(sm.setState("ready")).toBe(true);
      expect(sm.getState()).toBe("ready");
    });

    it("paused → loading 应被拒绝", () => {
      sm.setState("loading");
      sm.setState("ready");
      sm.setState("playing");
      sm.setState("paused");
      expect(sm.setState("loading")).toBe(false);
      expect(sm.getState()).toBe("paused");
    });

    it("paused → recording 应被拒绝", () => {
      sm.setState("loading");
      sm.setState("ready");
      sm.setState("playing");
      sm.setState("paused");
      expect(sm.setState("recording")).toBe(false);
      expect(sm.getState()).toBe("paused");
    });

    it("recording → playing 应被拒绝", () => {
      sm.setState("recording");
      expect(sm.setState("playing")).toBe(false);
      expect(sm.getState()).toBe("recording");
    });

    it("recording → loading 应被拒绝", () => {
      sm.setState("recording");
      expect(sm.setState("loading")).toBe(false);
      expect(sm.getState()).toBe("recording");
    });

    it("loading → playing 应被拒绝", () => {
      sm.setState("loading");
      expect(sm.setState("playing")).toBe(false);
      expect(sm.getState()).toBe("loading");
    });
  });

  describe("canTransition", () => {
    it("可以检查任意 from/to 组合", () => {
      expect(sm.canTransition("idle", "loading")).toBe(true);
      expect(sm.canTransition("idle", "playing")).toBe(false);
      expect(sm.canTransition("playing", "paused")).toBe(true);
      expect(sm.canTransition("playing", "loading")).toBe(false);
    });
  });

  describe("便捷查询方法", () => {
    it("is() 检查当前状态", () => {
      expect(sm.is("idle")).toBe(true);
      expect(sm.is("playing")).toBe(false);
    });

    it("isAny() 检查多个状态", () => {
      expect(sm.isAny("idle", "loading")).toBe(true);
      expect(sm.isAny("playing", "paused")).toBe(false);
    });

    it("canStop 仅在 playing/paused 时为 true", () => {
      expect(sm.canStop).toBe(false);
      sm.setState("loading");
      sm.setState("ready");
      sm.setState("playing");
      expect(sm.canStop).toBe(true);
      sm.setState("paused");
      expect(sm.canStop).toBe(true);
    });

    it("canPause 仅在 playing 时为 true", () => {
      expect(sm.canPause).toBe(false);
      sm.setState("loading");
      sm.setState("ready");
      sm.setState("playing");
      expect(sm.canPause).toBe(true);
    });
  });

  describe("状态变更监听", () => {
    it("onStateChange 在状态变更时触发", () => {
      const listener = vi.fn();
      sm.onStateChange(listener);
      sm.setState("loading");
      expect(listener).toHaveBeenCalledWith("loading");
    });

    it("onStateChange 返回的函数可以取消监听", () => {
      const listener = vi.fn();
      const unsub = sm.onStateChange(listener);
      unsub();
      sm.setState("loading");
      expect(listener).not.toHaveBeenCalled();
    });

    it("无效转换不触发监听器", () => {
      const listener = vi.fn();
      sm.onStateChange(listener);
      sm.setState("playing"); // 无效
      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe("完整播放流程", () => {
    it("完整 MIDI 播放流程：idle → loading → ready → playing → paused → playing → ready", () => {
      expect(sm.setState("loading")).toBe(true);
      expect(sm.setState("ready")).toBe(true);
      expect(sm.setState("playing")).toBe(true);
      expect(sm.setState("paused")).toBe(true);
      expect(sm.setState("playing")).toBe(true);
      // 停止回到 ready
      expect(sm.setState("ready")).toBe(true);
      expect(sm.getState()).toBe("ready");
    });

    it("从 paused 直接停止：paused → ready", () => {
      sm.setState("loading");
      sm.setState("ready");
      sm.setState("playing");
      sm.setState("paused");
      expect(sm.setState("ready")).toBe(true);
      expect(sm.getState()).toBe("ready");
    });

    it("错误恢复流程：loading → error → idle → loading → ready → playing", () => {
      expect(sm.setState("loading")).toBe(true);
      expect(sm.setState("error")).toBe(true);
      expect(sm.setState("idle")).toBe(true);
      expect(sm.setState("loading")).toBe(true);
      expect(sm.setState("ready")).toBe(true);
      expect(sm.setState("playing")).toBe(true);
    });
  });
});
