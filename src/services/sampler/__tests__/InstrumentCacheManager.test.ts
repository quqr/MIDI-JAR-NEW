import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { InstrumentInfo } from "@/stores/sampler";
import type { CacheManagerDeps, SmplrInstance } from "../types";
import { InstrumentCacheManager } from "../InstrumentCacheManager";

// ─── 测试夹具 ───

function makeMockInstance(opts: {
  ready?: Promise<void>;
  loadProgress?: { loaded: number; total: number };
  dispose?: ReturnType<typeof vi.fn>;
}): SmplrInstance {
  // 默认 loaded=0 / total=10 → computeFromCache 返回 false（loaded !== total），
  // 避免 {0,0} 时 0===0 误判为缓存命中。
  return {
    ready: opts.ready ?? Promise.resolve(),
    start: vi.fn(() => vi.fn()) as unknown as SmplrInstance["start"],
    stop: vi.fn(() => {}) as unknown as SmplrInstance["stop"],
    output: {
      volume: 100,
      disconnect: vi.fn(() => {}) as unknown as () => void,
    },
    loadProgress: opts.loadProgress ?? { loaded: 0, total: 10 },
    dispose: (opts.dispose ?? vi.fn(() => {})) as unknown as () => void,
  };
}

function makeInfo(id: string): InstrumentInfo {
  return {
    id,
    name: `Test ${id}`,
    category: "Piano",
    factory: "soundfont",
  };
}

function makeDeps(overrides: Partial<CacheManagerDeps> = {}): {
  deps: CacheManagerDeps;
  createContext: ReturnType<typeof vi.fn>;
  createInstrument: ReturnType<typeof vi.fn>;
} {
  const fakeCtx = { sampleRate: 44100 } as unknown as BaseAudioContext;
  const createContext = vi.fn(async () => fakeCtx);
  const createInstrument = vi.fn((_info: InstrumentInfo) =>
    makeMockInstance({}),
  );
  return {
    deps: { createContext, createInstrument, ...overrides },
    createContext,
    createInstrument,
  };
}

describe("InstrumentCacheManager", () => {
  let manager: InstrumentCacheManager;

  beforeEach(() => {
    const { deps } = makeDeps();
    manager = new InstrumentCacheManager(deps);
  });

  describe("load — 首次加载", () => {
    it("creates context + instrument, returns {fromCache:false}, sets active", async () => {
      const { deps, createContext, createInstrument } = makeDeps();
      manager = new InstrumentCacheManager(deps);

      const info = makeInfo("piano");
      const result = await manager.load("piano", info);

      expect(createContext).toHaveBeenCalledTimes(1);
      expect(createInstrument).toHaveBeenCalledTimes(1);
      expect(result.fromCache).toBe(false);
      expect(result.instance).toBe(manager.getActive());
      expect(manager.getLastSuccessfulId()).toBe("piano");
    });
  });

  describe("load — 命中 ready 缓存", () => {
    it("returns {fromCache:true} and does not call createInstrument again", async () => {
      const { deps, createInstrument } = makeDeps();
      manager = new InstrumentCacheManager(deps);

      const info = makeInfo("piano");
      const first = await manager.load("piano", info);
      const firstActive = manager.getActive();

      const second = await manager.load("piano", info);

      expect(createInstrument).toHaveBeenCalledTimes(1);
      expect(second.fromCache).toBe(true);
      expect(second.instance).toBe(first.instance);
      expect(manager.getActive()).toBe(firstActive);
    });
  });

  describe("load — 在途去重", () => {
    it("reuses the in-flight promise (createInstrument called once)", async () => {
      let resolveReady: () => void = () => {};
      const slowReady = new Promise<void>((r) => {
        resolveReady = r;
      });
      const slowInstance = makeMockInstance({ ready: slowReady });
      const createInstrument = vi.fn(() => slowInstance);
      const createContext = vi.fn(async () => ({}) as BaseAudioContext);
      manager = new InstrumentCacheManager({ createContext, createInstrument });

      const info = makeInfo("piano");
      const p1 = manager.load("piano", info);
      const p2 = manager.load("piano", info);

      // 同步阶段：第二次调用时第一次尚未 ready，应返回同一 Promise
      expect(p1).toBe(p2);

      resolveReady();
      await p1;
      // p2 复用了 p1 的 Promise → doLoad 只跑一次 → createInstrument 只调用一次
      expect(createInstrument).toHaveBeenCalledTimes(1);
    });
  });

  describe("load — 失败与重试", () => {
    it("sets state=error, increments retryCount, throws", async () => {
      const failingInstance = makeMockInstance({
        ready: Promise.reject(new Error("network")),
      });
      const createInstrument = vi.fn(() => failingInstance);
      const createContext = vi.fn(async () => ({}) as BaseAudioContext);
      manager = new InstrumentCacheManager({ createContext, createInstrument });

      const info = makeInfo("piano");
      await expect(manager.load("piano", info)).rejects.toThrow("network");

      const entry = manager.getEntry("piano");
      expect(entry?.state).toBe("error");
      expect(entry?.retryCount).toBe(1);
      expect(entry?.error?.message).toBe("network");
      // 上次成功 ID 仍为 null（之前没有成功的）
      expect(manager.getLastSuccessfulId()).toBeNull();
    });

    it("preserves lastSuccessfulId when a later load fails", async () => {
      // 第一次成功加载 piano
      const goodInstance = makeMockInstance({});
      const failingInstance = makeMockInstance({
        ready: Promise.reject(new Error("boom")),
      });
      const createInstrument = vi.fn((_info: InstrumentInfo) => {
        return _info.id === "piano" ? goodInstance : failingInstance;
      });
      const createContext = vi.fn(async () => ({}) as BaseAudioContext);
      manager = new InstrumentCacheManager({ createContext, createInstrument });

      await manager.load("piano", makeInfo("piano"));
      expect(manager.getLastSuccessfulId()).toBe("piano");
      const activeAfterSuccess = manager.getActive();

      await expect(
        manager.load("marimba", makeInfo("marimba")),
      ).rejects.toThrow("boom");

      // 上次成功 ID 不变，活跃实例回退到 piano
      expect(manager.getLastSuccessfulId()).toBe("piano");
      expect(manager.getActive()).toBe(activeAfterSuccess);
    });

    it("throws after MAX_RETRY_COUNT (3) failures", async () => {
      // 每次调用都返回新的 rejected Promise，避免共享同一拒绝引发 unhandled rejection
      const createInstrument = vi.fn(() =>
        makeMockInstance({
          ready: Promise.reject(new Error("always fails")),
        }),
      );
      const createContext = vi.fn(async () => ({}) as BaseAudioContext);
      manager = new InstrumentCacheManager({ createContext, createInstrument });

      const info = makeInfo("piano");
      // 三次失败：每次都进入 error 状态、retryCount 递增
      await expect(manager.load("piano", info)).rejects.toThrow("always fails");
      await expect(manager.load("piano", info)).rejects.toThrow("always fails");
      await expect(manager.load("piano", info)).rejects.toThrow("always fails");

      expect(manager.getEntry("piano")?.retryCount).toBe(3);

      // 第四次：重试耗尽，直接抛出已存的 error，不再调用 createInstrument
      await expect(manager.load("piano", info)).rejects.toThrow("always fails");
      expect(createInstrument).toHaveBeenCalledTimes(3);
    });
  });

  describe("load — onProgress 回调", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });
    afterEach(() => {
      vi.useRealTimers();
    });

    it("invokes onProgress while polling (advance 100ms)", async () => {
      // loadProgress 有非零 total
      let resolveReady: () => void = () => {};
      const slowReady = new Promise<void>((r) => {
        resolveReady = r;
      });
      const instance = makeMockInstance({
        ready: slowReady,
        loadProgress: { loaded: 5, total: 10 },
      });
      const createInstrument = vi.fn(() => instance);
      const createContext = vi.fn(async () => ({}) as BaseAudioContext);
      manager = new InstrumentCacheManager({ createContext, createInstrument });

      const onProgress = vi.fn();
      const info = makeInfo("piano");
      const promise = manager.load("piano", info, { onProgress });

      // 推进 100ms 触发一次轮询
      await vi.advanceTimersByTimeAsync(100);
      expect(onProgress).toHaveBeenCalled();
      // loaded/total = 5/10 = 50%
      expect(onProgress).toHaveBeenLastCalledWith(50);

      resolveReady();
      await promise;
    });

    it("does not invoke onProgress if not provided", async () => {
      let resolveReady: () => void = () => {};
      const slowReady = new Promise<void>((r) => {
        resolveReady = r;
      });
      const instance = makeMockInstance({
        ready: slowReady,
        loadProgress: { loaded: 1, total: 2 },
      });
      const createInstrument = vi.fn(() => instance);
      const createContext = vi.fn(async () => ({}) as BaseAudioContext);
      manager = new InstrumentCacheManager({ createContext, createInstrument });

      const info = makeInfo("piano");
      const promise = manager.load("piano", info);

      await vi.advanceTimersByTimeAsync(200);
      resolveReady();
      await promise;
      // 不传 onProgress 时不应抛错（startProgressPoll 早返回 noop）
      expect(manager.getActive()).toBe(instance);
    });
  });

  describe("downloadToCache", () => {
    it("creates instance, awaits ready, disposes it; active unchanged", async () => {
      const dispose = vi.fn();
      const instance = makeMockInstance({ dispose });
      const createInstrument = vi.fn(() => instance);
      const createContext = vi.fn(async () => ({}) as BaseAudioContext);
      manager = new InstrumentCacheManager({ createContext, createInstrument });

      // 先加载 piano 到 active
      const pianoInstance = makeMockInstance({});
      const createInstrument2 = vi.fn((_info: InstrumentInfo) =>
        _info.id === "piano" ? pianoInstance : instance,
      );
      manager = new InstrumentCacheManager({
        createContext,
        createInstrument: createInstrument2,
      });
      await manager.load("piano", makeInfo("piano"));
      const activeBefore = manager.getActive();

      await manager.downloadToCache("marimba", makeInfo("marimba"));

      // 下载用实例被 dispose
      expect(dispose).toHaveBeenCalledTimes(1);
      // active 不变
      expect(manager.getActive()).toBe(activeBefore);
      // 下载不进入缓存池
      expect(manager.getEntry("marimba")).toBeUndefined();
    });

    it("rejects when ready rejects (no swallow)", async () => {
      const failingInstance = makeMockInstance({
        ready: Promise.reject(new Error("dl failed")),
      });
      const createInstrument = vi.fn(() => failingInstance);
      const createContext = vi.fn(async () => ({}) as BaseAudioContext);
      manager = new InstrumentCacheManager({ createContext, createInstrument });

      await expect(
        manager.downloadToCache("marimba", makeInfo("marimba")),
      ).rejects.toThrow("dl failed");
    });
  });

  describe("unload", () => {
    it("returns false for the active instrument", async () => {
      const { deps } = makeDeps();
      manager = new InstrumentCacheManager(deps);
      await manager.load("piano", makeInfo("piano"));

      expect(manager.unload("piano")).toBe(false);
      expect(manager.getEntry("piano")).toBeDefined(); // 仍在池中
    });

    it("disposes and removes a cached non-active instrument", async () => {
      const dispose = vi.fn();
      const instance = makeMockInstance({ dispose });
      const createInstrument = vi.fn(() => instance);
      const createContext = vi.fn(async () => ({}) as BaseAudioContext);
      manager = new InstrumentCacheManager({ createContext, createInstrument });

      await manager.load("piano", makeInfo("piano"));
      // piano 现在是 active，无法 unload。改用 setActive 之外的方式：
      // 加载第二个乐器使 piano 留在缓存（state=ready）但不再 active
      const marimba = makeMockInstance({});
      const createInstrument2 = vi.fn((_info: InstrumentInfo) =>
        _info.id === "marimba" ? marimba : instance,
      );
      manager = new InstrumentCacheManager({
        createContext,
        createInstrument: createInstrument2,
      });
      await manager.load("piano", makeInfo("piano"));
      await manager.load("marimba", makeInfo("marimba"));

      // piano 仍在池中（state=ready），marimba 是 active
      expect(manager.getEntry("piano")?.state).toBe("ready");
      expect(manager.getActive()).toBe(marimba);

      // 卸载 piano（非 active）
      const result = manager.unload("piano");
      expect(result).toBe(true);
      expect(dispose).toHaveBeenCalledTimes(1); // piano 实例被 dispose
      expect(manager.getEntry("piano")).toBeUndefined();
    });

    it("returns false when instrument not in pool", () => {
      expect(manager.unload("nonexistent")).toBe(false);
    });

    it("returns false when instrument is loading", async () => {
      let resolveReady: () => void = () => {};
      const slowReady = new Promise<void>((r) => {
        resolveReady = r;
      });
      const slowInstance = makeMockInstance({ ready: slowReady });
      const createInstrument = vi.fn(() => slowInstance);
      const createContext = vi.fn(async () => ({}) as BaseAudioContext);
      manager = new InstrumentCacheManager({ createContext, createInstrument });

      const info = makeInfo("piano");
      const promise = manager.load("piano", info);
      // 此时 state=loading
      expect(manager.getEntry("piano")?.state).toBe("loading");
      expect(manager.unload("piano")).toBe(false);

      resolveReady();
      await promise;
    });
  });

  describe("disposeAll", () => {
    it("clears the pool and active, disposes all instances", async () => {
      const pianoDispose = vi.fn();
      const marimbaDispose = vi.fn();
      const createInstrument = vi.fn((_info: InstrumentInfo) =>
        _info.id === "piano"
          ? makeMockInstance({ dispose: pianoDispose })
          : makeMockInstance({ dispose: marimbaDispose }),
      );
      const createContext = vi.fn(async () => ({}) as BaseAudioContext);
      manager = new InstrumentCacheManager({ createContext, createInstrument });

      await manager.load("piano", makeInfo("piano"));
      await manager.load("marimba", makeInfo("marimba"));

      manager.disposeAll();

      expect(manager.getPool().size).toBe(0);
      expect(manager.getActive()).toBeNull();
      expect(manager.getLastSuccessfulId()).toBeNull();
      // marimba 是 active，piano 留在池中：两者都被 dispose
      // 注意 setActive 时旧 active 会被 dispose，所以 piano 在 load(marimba) 时已 dispose 一次
      expect(marimbaDispose).toHaveBeenCalled();
    });
  });

  describe("resetLastSuccessful", () => {
    it("clears lastSuccessfulId", async () => {
      const { deps } = makeDeps();
      manager = new InstrumentCacheManager(deps);
      await manager.load("piano", makeInfo("piano"));
      expect(manager.getLastSuccessfulId()).toBe("piano");

      manager.resetLastSuccessful();
      expect(manager.getLastSuccessfulId()).toBeNull();
    });
  });

  describe("getPool / getEntry — 只读访问", () => {
    it("getPool returns readonly map", async () => {
      const { deps } = makeDeps();
      manager = new InstrumentCacheManager(deps);
      await manager.load("piano", makeInfo("piano"));

      const pool = manager.getPool();
      expect(pool.size).toBe(1);
      expect(pool.get("piano")?.state).toBe("ready");
    });

    it("getEntry returns undefined for unknown id", () => {
      expect(manager.getEntry("nonexistent")).toBeUndefined();
    });

    it("isReady returns false for unknown id", () => {
      expect(manager.isReady("nonexistent")).toBe(false);
    });

    it("getLoadingPromise returns null when not loading", async () => {
      const { deps } = makeDeps();
      manager = new InstrumentCacheManager(deps);
      await manager.load("piano", makeInfo("piano"));

      expect(manager.getLoadingPromise("piano")).toBeNull();
    });
  });
});
