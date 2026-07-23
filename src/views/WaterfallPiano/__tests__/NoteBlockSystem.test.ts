import { describe, it, expect, vi } from "vitest";
import { NoteBlockSystem } from "../engine/NoteBlockSystem";
import { defaultWaterfallSettings } from "../constants";
import type { ScheduledNote } from "../types";

function mockCanvas(): HTMLCanvasElement {
  const ctx = new Proxy(
    {},
    {
      get: (_t, prop) => {
        if (prop === "canvas") return null;
        return () => {};
      },
    },
  ) as unknown as CanvasRenderingContext2D;
  return {
    getContext: () => ctx,
    style: {},
    width: 0,
    height: 0,
  } as unknown as HTMLCanvasElement;
}

function initNbs(nbs: NoteBlockSystem): void {
  const s = structuredClone(defaultWaterfallSettings);
  nbs.init(mockCanvas(), s.particles, s.aura);
}

describe("NoteBlockSystem", () => {
  describe("realtime 模式", () => {
    it("playRealtimeNote 后 active count 增加", () => {
      const nbs = new NoteBlockSystem();
      initNbs(nbs);
      expect(nbs.getActiveBlockCount()).toBe(0);
      nbs.playRealtimeNote(60, 100);
      expect(nbs.getActiveBlockCount()).toBe(1);
    });

    it("重复 playRealtimeNote 同 midi 不增加（去重）", () => {
      const nbs = new NoteBlockSystem();
      initNbs(nbs);
      nbs.playRealtimeNote(60, 100);
      nbs.playRealtimeNote(60, 100);
      expect(nbs.getActiveBlockCount()).toBe(1);
    });

    it("update 后 block 仍在 active（height 增长）", () => {
      const nbs = new NoteBlockSystem();
      initNbs(nbs);
      nbs.playRealtimeNote(60, 100);
      nbs.update(0.016);
      expect(nbs.getActiveBlockCount()).toBe(1);
    });

    it("releaseRealtimeNote + update 后 block 被回收到 pool", () => {
      const nbs = new NoteBlockSystem();
      initNbs(nbs);
      nbs.playRealtimeNote(60, 100);
      nbs.update(0.016);
      expect(nbs.getPoolSize()).toBe(0);
      nbs.releaseRealtimeNote(60);
      nbs.update(0.1);
      expect(nbs.getActiveBlockCount()).toBe(0);
      expect(nbs.getPoolSize()).toBe(1);
    });

    it("releaseRealtimeNote 未播放的 midi 不报错", () => {
      const nbs = new NoteBlockSystem();
      initNbs(nbs);
      expect(() => nbs.releaseRealtimeNote(72)).not.toThrow();
    });
  });

  describe("对象池", () => {
    it("多个音符释放后 pool 增长", () => {
      const nbs = new NoteBlockSystem();
      initNbs(nbs);
      for (let m = 60; m < 72; m++) {
        nbs.playRealtimeNote(m, 100);
      }
      expect(nbs.getActiveBlockCount()).toBe(12);
      for (let m = 60; m < 72; m++) {
        nbs.releaseRealtimeNote(m);
      }
      nbs.update(0.1);
      expect(nbs.getActiveBlockCount()).toBe(0);
      expect(nbs.getPoolSize()).toBe(12);
    });
  });

  describe("synthesia 模式", () => {
    it("setMode 切换到 synthesia", () => {
      const nbs = new NoteBlockSystem();
      initNbs(nbs);
      nbs.setMode("synthesia");
      expect(nbs.getMode()).toBe("synthesia");
    });

    it("scheduleSynthesiaNotes + transportTime=0 → block 创建但未触发", () => {
      const nbs = new NoteBlockSystem();
      initNbs(nbs);
      nbs.setMode("synthesia");
      const notes: ScheduledNote[] = [
        {
          midi: 60,
          velocity: 100,
          time: 1,
          duration: 0.5,
          hand: "right",
          trackIndex: 0,
        },
      ];
      const triggerSpy = vi.fn();
      nbs.callbacks = { onNoteTrigger: triggerSpy };
      nbs.scheduleSynthesiaNotes(notes);
      nbs.setTransportTime(0);
      nbs.setTransportPlaying(true);
      nbs.update(0.016);
      expect(nbs.getActiveBlockCount()).toBe(1);
      expect(triggerSpy).not.toHaveBeenCalled();
    });

    it("推进 transportTime 到 note.time → onNoteTrigger 触发", () => {
      const nbs = new NoteBlockSystem();
      initNbs(nbs);
      nbs.setMode("synthesia");
      const notes: ScheduledNote[] = [
        {
          midi: 60,
          velocity: 100,
          time: 1,
          duration: 0.5,
          hand: "right",
          trackIndex: 0,
        },
      ];
      const triggerSpy = vi.fn();
      nbs.callbacks = { onNoteTrigger: triggerSpy };
      nbs.scheduleSynthesiaNotes(notes);
      nbs.setTransportTime(0);
      nbs.setTransportPlaying(true);
      nbs.update(0.016);
      nbs.setTransportTime(1);
      nbs.update(0.016);
      expect(triggerSpy).toHaveBeenCalledTimes(1);
      expect(triggerSpy).toHaveBeenCalledWith(60, 100, "right");
    });

    it("推进 transportTime 到 note.time+duration → onNoteEnd 触发", () => {
      const nbs = new NoteBlockSystem();
      initNbs(nbs);
      nbs.setMode("synthesia");
      const notes: ScheduledNote[] = [
        {
          midi: 60,
          velocity: 100,
          time: 1,
          duration: 0.5,
          hand: "right",
          trackIndex: 0,
        },
      ];
      const endSpy = vi.fn();
      nbs.callbacks = { onNoteEnd: endSpy };
      nbs.scheduleSynthesiaNotes(notes);
      nbs.setTransportTime(0);
      nbs.setTransportPlaying(true);
      nbs.update(0.016);
      nbs.setTransportTime(1);
      nbs.update(0.016);
      nbs.setTransportTime(1.5);
      nbs.update(0.016);
      expect(endSpy).toHaveBeenCalledTimes(1);
      expect(endSpy).toHaveBeenCalledWith(60);
    });

    it("transportPlaying=false 时不更新 synthesia", () => {
      const nbs = new NoteBlockSystem();
      initNbs(nbs);
      nbs.setMode("synthesia");
      const notes: ScheduledNote[] = [
        {
          midi: 60,
          velocity: 100,
          time: 0,
          duration: 0.5,
          hand: "right",
          trackIndex: 0,
        },
      ];
      const triggerSpy = vi.fn();
      nbs.callbacks = { onNoteTrigger: triggerSpy };
      nbs.scheduleSynthesiaNotes(notes);
      nbs.setTransportTime(0);
      nbs.setTransportPlaying(false);
      nbs.update(0.016);
      expect(triggerSpy).not.toHaveBeenCalled();
    });
  });

  describe("clearNoteBlocks", () => {
    it("清空 active 和 realtimeHeld", () => {
      const nbs = new NoteBlockSystem();
      initNbs(nbs);
      nbs.playRealtimeNote(60, 100);
      nbs.playRealtimeNote(62, 100);
      expect(nbs.getActiveBlockCount()).toBe(2);
      nbs.clearNoteBlocks();
      expect(nbs.getActiveBlockCount()).toBe(0);
      nbs.playRealtimeNote(60, 100);
      expect(nbs.getActiveBlockCount()).toBe(1);
    });
  });

  describe("setParticleConfig / setAuraConfig", () => {
    it("切换配置不报错", () => {
      const nbs = new NoteBlockSystem();
      initNbs(nbs);
      const s = structuredClone(defaultWaterfallSettings);
      s.particles.speed = 5;
      expect(() => nbs.setParticleConfig(s.particles)).not.toThrow();
      expect(() => nbs.setAuraConfig(s.aura)).not.toThrow();
    });
  });

  describe("setMode 清空", () => {
    it("setMode 切换时清空已有 blocks", () => {
      const nbs = new NoteBlockSystem();
      initNbs(nbs);
      nbs.playRealtimeNote(60, 100);
      expect(nbs.getActiveBlockCount()).toBe(1);
      nbs.setMode("synthesia");
      expect(nbs.getActiveBlockCount()).toBe(0);
    });
  });

  describe("dispose", () => {
    it("dispose 后 pool 清空", () => {
      const nbs = new NoteBlockSystem();
      initNbs(nbs);
      nbs.playRealtimeNote(60, 100);
      nbs.releaseRealtimeNote(60);
      nbs.update(0.1);
      expect(nbs.getPoolSize()).toBe(1);
      nbs.dispose();
      expect(nbs.getPoolSize()).toBe(0);
    });
  });
});
