/**
 * 导出让路钩子测试（ADR 0026）
 *
 * 导出期间要停掉前台渲染与播放，把 CPU/GPU 让给离屏导出引擎 + 编码器。
 * 这段逻辑的风险不在「暂停」，而在「恢复」——少恢复一次，前台就永久冻结。
 * 因此本测试锁定三条不变量：
 * 1. suspend / resume 成对：一次 suspend 恰好触发一次前台 suspend；
 * 2. 幂等：重复 suspend / resume 不叠加副作用；
 * 3. 解绑 / 换绑安全：若此刻仍在暂停态，先恢复旧钩子再换绑。
 */
import { describe, it, expect, vi } from "vitest";
import { ExportSuspension } from "@/utils/video/exportSuspension";

function makeSuspender() {
  return {
    suspend: vi.fn(),
    resume: vi.fn(),
  };
}

describe("ExportSuspension", () => {
  it("suspend 触发前台暂停，resume 触发前台恢复", () => {
    const s = makeSuspender();
    const suspension = new ExportSuspension();
    suspension.bind(s);

    suspension.suspend();
    expect(s.suspend).toHaveBeenCalledTimes(1);
    expect(s.resume).not.toHaveBeenCalled();
    expect(suspension.isSuspended).toBe(true);

    suspension.resume();
    expect(s.resume).toHaveBeenCalledTimes(1);
    expect(suspension.isSuspended).toBe(false);
  });

  it("重复 suspend / resume 幂等，不叠加副作用", () => {
    const s = makeSuspender();
    const suspension = new ExportSuspension();
    suspension.bind(s);

    suspension.suspend();
    suspension.suspend();
    suspension.suspend();
    expect(s.suspend).toHaveBeenCalledTimes(1);

    suspension.resume();
    suspension.resume();
    expect(s.resume).toHaveBeenCalledTimes(1);
  });

  it("未 suspend 时 resume 不触发前台恢复", () => {
    const s = makeSuspender();
    const suspension = new ExportSuspension();
    suspension.bind(s);
    suspension.resume();
    expect(s.resume).not.toHaveBeenCalled();
  });

  it("暂停态下解绑会先恢复旧钩子，不留下冻结的前台", () => {
    const s = makeSuspender();
    const suspension = new ExportSuspension();
    suspension.bind(s);
    suspension.suspend();

    suspension.bind(null);
    expect(s.resume).toHaveBeenCalledTimes(1);
    expect(suspension.isSuspended).toBe(false);
  });

  it("暂停态下换绑会先恢复旧钩子，且新钩子保持未暂停", () => {
    const oldSuspender = makeSuspender();
    const newSuspender = makeSuspender();
    const suspension = new ExportSuspension();
    suspension.bind(oldSuspender);
    suspension.suspend();

    suspension.bind(newSuspender);
    expect(oldSuspender.resume).toHaveBeenCalledTimes(1);
    expect(newSuspender.suspend).not.toHaveBeenCalled();
    expect(suspension.isSuspended).toBe(false);
  });

  it("前台 suspend 抛错不影响导出流程，且仍标记为暂停（交给 finally 恢复）", () => {
    const s = makeSuspender();
    s.suspend.mockImplementation(() => {
      throw new Error("boom");
    });
    const suspension = new ExportSuspension();
    suspension.bind(s);

    expect(() => suspension.suspend()).not.toThrow();
    expect(suspension.isSuspended).toBe(true);

    suspension.resume();
    expect(s.resume).toHaveBeenCalledTimes(1);
  });

  it("无绑定时的 suspend / resume 是安全空操作", () => {
    const suspension = new ExportSuspension();
    expect(() => suspension.suspend()).not.toThrow();
    expect(() => suspension.resume()).not.toThrow();
    expect(suspension.isSuspended).toBe(false);
  });
});
