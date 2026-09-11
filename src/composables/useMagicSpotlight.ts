import { watch } from "vue";
import { createAnimatable } from "animejs";
import router from "@/router";
import { useSettingsStore } from "@/stores/settings";
import { hexToRgbChannels } from "@/directives/magic";

/**
 * 全局聚光灯（MagicBento GlobalSpotlight 的忠实移植，anime.js 版）。
 *
 * 在 App.vue onMounted 调用一次：当 settings.magic.enabled && magic.spotlight
 * 且非移动端（≤768px / 无 hover 设备）时，创建一个 position: fixed 的 800px
 * 光斑 div（mix-blend-mode: screen）挂到 body 上，并按参考实现逻辑工作：
 *
 * - 每次鼠标移动，对所有 [data-magic] 卡片按「鼠标到卡片边缘的距离」计算强度：
 *   ≤ proximity(radius×0.5) → 1；≤ fadeDistance(radius×0.75) → 线性衰减；否则 0；
 *   同时以百分比写 --glow-x/--glow-y 与 --glow-radius。
 * - 光斑 opacity 按最近卡片距离比例映射到 0.8 上限：靠近卡片渐亮、
 *   远离全部卡片淡出（参考实现的 minDistance 逻辑，非简单开关）。
 * - 位置/透明度补间用 createAnimatable（= gsap.to 每帧补间的等价物，复用实例）。
 * - document mouseleave → 强度清零 + 光斑淡出。
 *
 * 设置实时生效（watch enabled/spotlight），模块级单例防止重复激活。
 */

const SPOTLIGHT_RADIUS = 300; // 参考实现 DEFAULT_SPOTLIGHT_RADIUS（old hard-coded fallback）
const SPOTLIGHT_MAX_OPACITY = 0.8; // old hard-coded fallback

const NARROW_MEDIA = "(max-width: 768px)";
const HOVER_NONE_MEDIA = "(hover: none)";

let started = false;
let spotlightEl: HTMLElement | null = null;
// anime.js Animatable（动态属性 .left()/.top()/.opacity()），any 兼容同 CustomCursor.vue
let spotAnim: {
  left: (v: number) => void;
  top: (v: number) => void;
  opacity: (v: number) => void;
  revert: () => void;
} | null = null;

function calculateSpotlightValues(radius: number): {
  proximity: number;
  fadeDistance: number;
} {
  return { proximity: radius * 0.5, fadeDistance: radius * 0.75 };
}

function handleDocumentMove(event: MouseEvent): void {
  if (!spotlightEl || !spotAnim) return;

  // 实时读取设置：半径 / 最大透明度（默认 300 / 0.8，与旧硬编码一致）
  const magic = useSettingsStore().settings.magic;
  const radius = magic.spotlightRadius ?? SPOTLIGHT_RADIUS;
  const maxOpacity = magic.spotlightOpacity ?? SPOTLIGHT_MAX_OPACITY;

  const { proximity, fadeDistance } = calculateSpotlightValues(radius);
  const cards = document.querySelectorAll<HTMLElement>("[data-magic]");
  let minDistance = Infinity;

  for (const card of cards) {
    const rect = card.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    // 参考实现：距离从卡片边缘起算（中心距 - 最大边长一半）
    const distance =
      Math.hypot(event.clientX - centerX, event.clientY - centerY) -
      Math.max(rect.width, rect.height) / 2;
    const effectiveDistance = Math.max(0, distance);
    if (effectiveDistance < minDistance) minDistance = effectiveDistance;

    let glowIntensity = 0;
    if (effectiveDistance <= proximity) {
      glowIntensity = 1;
    } else if (effectiveDistance <= fadeDistance) {
      glowIntensity =
        (fadeDistance - effectiveDistance) / (fadeDistance - proximity);
    }

    card.style.setProperty(
      "--glow-x",
      `${(((event.clientX - rect.left) / rect.width) * 100).toFixed(2)}%`,
    );
    card.style.setProperty(
      "--glow-y",
      `${(((event.clientY - rect.top) / rect.height) * 100).toFixed(2)}%`,
    );
    card.style.setProperty("--glow-intensity", glowIntensity.toString());
    card.style.setProperty("--glow-radius", `${radius}px`);
  }

  spotAnim.left(event.clientX);
  spotAnim.top(event.clientY);

  // 参考实现：光斑透明度按最近卡片距离在 [0, maxOpacity] 间平滑映射
  const targetOpacity =
    minDistance <= proximity
      ? maxOpacity
      : minDistance <= fadeDistance
        ? ((fadeDistance - minDistance) / (fadeDistance - proximity)) *
          maxOpacity
        : 0;
  spotAnim.opacity(targetOpacity);
}

function handleDocumentLeave(): void {
  const cards = document.querySelectorAll<HTMLElement>("[data-magic]");
  for (const card of cards) {
    card.style.setProperty("--glow-intensity", "0");
  }
  spotAnim?.opacity(0);
}

function activate(): void {
  if (spotlightEl) return;
  const settingsStore = useSettingsStore();
  const spot = document.createElement("div");
  spot.className = "magic-spotlight";
  spot.style.setProperty(
    "--glow-color",
    hexToRgbChannels(settingsStore.settings.magic.glowColor),
  );
  document.body.appendChild(spot);
  spotlightEl = spot;

  // left/top 100ms 跟随（参考 gsap.to duration 0.1），opacity 300ms 渐变
  spotAnim = createAnimatable(spot, {
    left: { unit: "px", duration: 100, ease: "out(2)" },
    top: { unit: "px", duration: 100, ease: "out(2)" },
    opacity: { duration: 300, ease: "out(2)" },
  }) as unknown as {
    left: (v: number) => void;
    top: (v: number) => void;
    opacity: (v: number) => void;
    revert: () => void;
  };

  document.addEventListener("mousemove", handleDocumentMove, { passive: true });
  document.documentElement.addEventListener("mouseleave", handleDocumentLeave);
}

function deactivate(): void {
  if (!spotlightEl) return;
  document.removeEventListener("mousemove", handleDocumentMove);
  document.documentElement.removeEventListener(
    "mouseleave",
    handleDocumentLeave,
  );
  spotAnim?.revert();
  spotAnim = null;
  spotlightEl.remove();
  spotlightEl = null;
  const cards = document.querySelectorAll<HTMLElement>("[data-magic]");
  for (const card of cards) {
    card.style.setProperty("--glow-intensity", "0");
  }
}

/**
 * 启动聚光灯设置监听（幂等，App.vue onMounted 调用一次即可）。
 * watch 由本函数持有，应用生命周期内常驻。
 *
 * 路由门控：特效仅在首页（/home）激活，离开首页自动 deactivate，
 * 回到首页时按设置重新 activate。
 */
export function useMagicSpotlight(): void {
  if (started) return;
  started = true;

  const settingsStore = useSettingsStore();
  const narrowMql = window.matchMedia(NARROW_MEDIA);
  const hoverNoneMql = window.matchMedia(HOVER_NONE_MEDIA);

  const isHomeRoute = (): boolean => router.currentRoute.value.path === "/home";

  const syncActivation = (): void => {
    const magic = settingsStore.settings.magic;
    const shouldActivate =
      magic.enabled &&
      magic.spotlight &&
      isHomeRoute() &&
      !narrowMql.matches &&
      !hoverNoneMql.matches;
    if (shouldActivate) {
      activate();
      if (spotlightEl) {
        spotlightEl.style.setProperty(
          "--glow-color",
          hexToRgbChannels(magic.glowColor),
        );
      }
    } else {
      deactivate();
    }
  };

  watch(() => settingsStore.settings.magic, syncActivation, {
    immediate: true,
  });

  // 离开 / 回到首页时同步聚光灯的创建与销毁
  watch(
    () => router.currentRoute.value.path,
    (path, oldPath) => {
      if (path === oldPath) return;
      if (path === "/home" || oldPath === "/home") syncActivation();
    },
  );
}
