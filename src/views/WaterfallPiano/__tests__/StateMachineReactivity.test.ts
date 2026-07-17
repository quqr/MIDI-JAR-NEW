/**
 * 状态机与 Vue 响应式集成测试
 *
 * 验证 Bug：PlayerStateMachine.state 是普通属性，Vue computed 无法追踪其变化。
 * 修复方案：通过 onStateChange 将状态同步到 Vue ref。
 */
import { describe, it, expect } from "vitest";
import { ref, computed } from "vue";
import { PlayerStateMachine } from "../state/PlayerStateMachine";

describe("状态机与 Vue 响应式集成", () => {
  describe("Bug 复现：computed 直接读取状态机 getter", () => {
    it("状态机变为 playing 后，computed isPlaying 不会自动更新", () => {
      const sm = new PlayerStateMachine();
      sm.setState("loading");
      sm.setState("ready");

      // 模拟 WaterfallPiano.vue 中当前的模式（Bug 模式）
      const isPlaying = computed(() => sm.isPlaying);
      const isPaused = computed(() => sm.isPaused);

      // 初始状态
      expect(isPlaying.value).toBe(false);
      expect(isPaused.value).toBe(false);

      // 状态机切换到 playing
      sm.setState("playing");

      // BUG: computed 不会自动重新计算，因为没有 Vue ref 被修改
      // 依赖追踪失效：sm.isPlaying getter 读取的是普通属性 this.state，
      // Vue 无法追踪普通属性的变化
      expect(isPlaying.value).toBe(false); // 仍然是旧值！
      expect(isPaused.value).toBe(false);
    });

    it("播放后暂停，computed isPaused 不会自动更新", () => {
      const sm = new PlayerStateMachine();
      sm.setState("loading");
      sm.setState("ready");

      // computed 在 ready 状态时创建（模拟组件挂载时的状态）
      const isPlaying = computed(() => sm.isPlaying);
      const isPaused = computed(() => sm.isPaused);

      // 首次访问，建立缓存（此时 state = "ready"）
      expect(isPlaying.value).toBe(false);
      expect(isPaused.value).toBe(false);

      // 切换到 playing
      sm.setState("playing");
      // BUG: 状态变了但 computed 没有自动重新计算，返回缓存值
      expect(isPlaying.value).toBe(false); // 应该是 true！但缓存了旧值
      expect(isPaused.value).toBe(false);

      // 切换到 paused
      sm.setState("paused");
      // BUG: computed 依然缓存着 ready 时的值
      expect(isPlaying.value).toBe(false); // 巧合正确
      expect(isPaused.value).toBe(false); // 应该是 true！但仍然是旧值
    });
  });

  describe("修复验证：通过 onStateChange 桥接到 Vue ref", () => {
    it("状态机变为 playing 后，ref 驱动的 computed 正确更新", () => {
      const sm = new PlayerStateMachine();

      // 修复方案：用 Vue ref 镜像状态机状态
      const playerState = ref(sm.getState());
      sm.onStateChange((newState) => {
        playerState.value = newState;
      });

      const isPlaying = computed(() => playerState.value === "playing");
      const isPaused = computed(() => playerState.value === "paused");

      sm.setState("loading");
      sm.setState("ready");

      expect(isPlaying.value).toBe(false);
      expect(isPaused.value).toBe(false);

      // 切换到 playing
      sm.setState("playing");

      // 修复后：ref 被更新 → computed 自动重新计算
      expect(isPlaying.value).toBe(true);
      expect(isPaused.value).toBe(false);
    });

    it("播放后暂停，ref 驱动的 computed 正确更新", () => {
      const sm = new PlayerStateMachine();

      const playerState = ref(sm.getState());
      sm.onStateChange((newState) => {
        playerState.value = newState;
      });

      const isPlaying = computed(() => playerState.value === "playing");
      const isPaused = computed(() => playerState.value === "paused");

      sm.setState("loading");
      sm.setState("ready");
      sm.setState("playing");

      expect(isPlaying.value).toBe(true);
      expect(isPaused.value).toBe(false);

      // 切换到 paused
      sm.setState("paused");

      // 修复后：正确反映状态
      expect(isPlaying.value).toBe(false);
      expect(isPaused.value).toBe(true);
    });

    it("停止后回到 ready，computed 正确更新", () => {
      const sm = new PlayerStateMachine();

      const playerState = ref(sm.getState());
      sm.onStateChange((newState) => {
        playerState.value = newState;
      });

      const isPlaying = computed(() => playerState.value === "playing");
      const isPaused = computed(() => playerState.value === "paused");
      const canPlay = computed(
        () => playerState.value === "ready" || playerState.value === "paused",
      );

      sm.setState("loading");
      sm.setState("ready");
      sm.setState("playing");

      expect(isPlaying.value).toBe(true);
      expect(canPlay.value).toBe(false);

      // 停止 → ready
      sm.setState("ready");

      expect(isPlaying.value).toBe(false);
      expect(isPaused.value).toBe(false);
      expect(canPlay.value).toBe(true);
    });

    it("error 状态正确反映到 computed", () => {
      const sm = new PlayerStateMachine();

      const playerState = ref(sm.getState());
      sm.onStateChange((newState) => {
        playerState.value = newState;
      });

      const isError = computed(() => playerState.value === "error");

      sm.setState("loading");
      sm.setState("error");

      expect(isError.value).toBe(true);

      sm.setState("idle");
      expect(isError.value).toBe(false);
    });
  });
});
