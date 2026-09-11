<template>
  <button
    ref="triggerRef"
    type="button"
    class="cp-trigger"
    :disabled="disabled"
    :aria-haspopup="'dialog'"
    :aria-expanded="open"
    :aria-label="ariaLabel ?? t('colorPicker.panelLabel')"
    @click="toggle"
  >
    <span
      class="cp-swatch"
      :class="{ 'cp-checker': alpha }"
      :style="{ backgroundColor: triggerColor }"
    />
    <span class="cp-trigger-hex">{{ triggerHex }}</span>
    <Icon name="chevron-down" :size="12" class="opacity-60" />
  </button>

  <Teleport to="body">
    <div
      v-if="open"
      ref="panelRef"
      class="cp-panel z-popover bg-base-100 border border-base-300 shadow-xl"
      role="dialog"
      :aria-label="ariaLabel ?? t('colorPicker.panelLabel')"
      tabindex="-1"
      :style="panelStyle"
      @keydown.stop
    >
      <!-- 预览 + 当前值 + 吸管 + 复制 -->
      <div class="cp-header">
        <span
          class="cp-preview"
          :class="{ 'cp-checker': alpha && hsv.a < 1 }"
          :style="{ backgroundColor: displayHex }"
        />
        <input
          class="input input-sm cp-hex-input"
          :value="displayHex"
          spellcheck="false"
          :aria-label="t('colorPicker.panelLabel')"
          @change="onHexInput"
        />
        <button
          v-if="eyedropperSupported"
          type="button"
          class="cp-icon-btn"
          :title="t('colorPicker.eyedropper')"
          :aria-label="t('colorPicker.eyedropper')"
          @click="onEyedropper"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="m2 22 1-1h3l9-9" />
            <path d="M3 21v-3l9-9" />
            <path
              d="m15 6 3.4-3.4a2.1 2.1 0 1 1 3 3L18 9l.4.4a2.1 2.1 0 1 1-3 3l-3.8-3.8a2.1 2.1 0 1 1 3-3l.4.4Z"
            />
          </svg>
        </button>
        <button
          type="button"
          class="cp-icon-btn"
          :title="t('colorPicker.copy')"
          :aria-label="t('colorPicker.copy')"
          @click="copyFormat"
        >
          <Icon v-if="copied" name="check" :size="14" class="text-success" />
          <svg
            v-else
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <rect x="9" y="9" width="13" height="13" rx="2" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
          </svg>
        </button>
      </div>

      <!-- 色环（外圈色相）+ 内三角（饱和度/明度） -->
      <div ref="wheelRef" class="cp-wheel" @pointerdown="onWheelDown">
        <canvas
          ref="triCanvasRef"
          class="cp-tri"
          :style="{ width: `${TRI_CANVAS}px`, height: `${TRI_CANVAS}px` }"
        />
        <span class="cp-hue-pointer" :style="huePointerStyle" />
        <span class="cp-cursor" :style="cursorStyle" />
        <span
          class="cp-comp-marker"
          :style="compMarkerStyle"
          :title="t('colorPicker.harmonies.complementary')"
          @pointerdown.stop
          @click.stop="applyHex(compHex)"
        />
      </div>

      <!-- 透明度滑条（0-255，与 RGB 通道量纲一致） -->
      <input
        v-if="alpha"
        ref="alphaSliderRef"
        type="range"
        min="0"
        max="255"
        step="1"
        class="range range-xs"
        :style="{ ...alphaTrackStyle, '--range-fill': '0' }"
        :aria-label="t('colorPicker.channels.a')"
        @input="onAlphaSlider"
      />

      <!-- 滑块模式选择 -->
      <div class="tabs tabs-box tabs-sm">
        <button
          v-for="m in modes"
          :key="m"
          type="button"
          class="tab"
          :class="{ 'tab-active': mode === m }"
          @click="mode = m"
        >
          {{ t(`colorPicker.modes.${m}`) }}
        </button>
      </div>

      <!-- 通道滑块组 -->
      <div class="cp-sliders">
        <label v-for="ch in sliderChannels" :key="ch.key" class="cp-slider-row">
          <span class="cp-slider-label">{{ ch.key }}</span>
          <input
            type="range"
            min="0"
            :max="ch.max"
            step="1"
            class="range range-xs grow"
            :style="channelRangeStyle(ch)"
            :aria-label="t(`colorPicker.channels.${ch.key.toLowerCase()}`)"
            @input="onSliderInput(ch, $event)"
          />
          <input
            type="number"
            min="0"
            :max="ch.max"
            class="input input-xs cp-slider-num"
            :value="ch.value"
            @change="onSliderInput(ch, $event)"
          />
        </label>
      </div>

      <!-- 最近使用 -->
      <template v-if="recents.length > 0">
        <p class="cp-section-label">{{ t("colorPicker.palette.recent") }}</p>
        <div class="cp-swatches cp-swatches--6">
          <button
            v-for="hex in recents"
            :key="hex"
            type="button"
            class="cp-swatch-btn"
            :style="{ backgroundColor: hex }"
            :title="hex"
            :aria-label="hex"
            @click="applyHex(hex)"
          />
        </div>
      </template>

      <!-- 和谐色系 -->
      <p class="cp-section-label">{{ t("colorPicker.harmonies.title") }}</p>
      <div class="cp-harmonies">
        <div v-for="h in harmonyGroups" :key="h.name" class="cp-harmony-row">
          <span class="cp-harmony-name">{{
            t(`colorPicker.harmonies.${h.label}`)
          }}</span>
          <div class="cp-harmony-swatches">
            <button
              v-for="hex in h.colors"
              :key="`${h.name}-${hex}`"
              type="button"
              class="cp-swatch-btn cp-swatch-btn--sm"
              :style="{ backgroundColor: hex }"
              :title="hex"
              :aria-label="hex"
              @mouseenter="previewHex = hex"
              @mouseleave="previewHex = null"
              @focus="previewHex = hex"
              @blur="previewHex = null"
              @click="applyHex(hex)"
            />
          </div>
        </div>
      </div>

      <!-- 明暗阶 -->
      <p class="cp-section-label">
        {{ t("colorPicker.scales.tints") }} /
        {{ t("colorPicker.scales.shades") }}
      </p>
      <div class="cp-scale">
        <button
          v-for="hex in tintScale"
          :key="`t-${hex}`"
          type="button"
          class="cp-scale-btn"
          :style="{ backgroundColor: hex }"
          :title="hex"
          :aria-label="hex"
          @click="applyHex(hex)"
        />
      </div>
      <div class="cp-scale">
        <button
          v-for="hex in shadeScale"
          :key="`s-${hex}`"
          type="button"
          class="cp-scale-btn"
          :style="{ backgroundColor: hex }"
          :title="hex"
          :aria-label="hex"
          @click="applyHex(hex)"
        />
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, nextTick, reactive, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import Icon from "@/components/Icon/Icon.vue";
import {
  harmonyColors,
  isEyeDropperSupported,
  isValidHexColor,
  parseColor,
  pickColorWithEyeDropper,
  rgbToHex,
  shades,
  tints,
  type HarmonyName,
} from "@/helpers/color";
import {
  clampToTriangle,
  drawHsvTriangle,
  hexToHsv,
  hsvToHex,
  loadRecentColors,
  offsetToHue,
  pointToSv,
  pushRecentColor,
  saveRecentColors,
  svToPoint,
  triangleVertices,
  type ColorMode,
  type HsvState,
  type WheelPoint,
} from "./colorPicker";

// ============================================================================
// Props / Emits
// ============================================================================

interface Props {
  /** v-model：#rrggbb；alpha 启用时 #rrggbbaa；容忍脏值（transparent/null） */
  modelValue: string | null;
  /** 启用透明度（面板含透明度滑条，emit 8 位 hex） */
  alpha?: boolean;
  disabled?: boolean;
  /** 触发器 a11y 标签（缺省用 i18n 的 panelLabel） */
  ariaLabel?: string;
}

const props = withDefaults(defineProps<Props>(), {
  alpha: false,
  disabled: false,
  ariaLabel: undefined,
});

const emit = defineEmits<{
  "update:modelValue": [value: string];
}>();

const { t } = useI18n();

// ============================================================================
// 色轮几何常量
// ============================================================================

/** 色环外径（css px） */
const WHEEL_SIZE = 216;
/** 色环厚度（css px） */
const RING_WIDTH = 14;
/** 三角外接圆半径（css px，须小于 WHEEL_SIZE/2 - RING_WIDTH） */
const TRI_RADIUS = 88;
/** 三角画布 CSS 尺寸 */
const TRI_CANVAS = TRI_RADIUS * 2 + 2;
/** 色环指针所在半径（环厚中线） */
const HUE_POINTER_R = WHEEL_SIZE / 2 - RING_WIDTH / 2;
/** 环内孔半径（三角拾取与色环拾取的分界） */
const HOLE_RADIUS = WHEEL_SIZE / 2 - RING_WIDTH;

// ============================================================================
// 面板状态
// ============================================================================

const open = ref(false);
const hsv = reactive<HsvState>({ h: 0, s: 0, v: 0, a: 1 });
const mode = ref<ColorMode>("hsv");
const previewHex = ref<string | null>(null);
const recents = ref<string[]>([]);
const copied = ref(false);
const modes: ColorMode[] = ["rgb", "hsv", "hsl"];

const triggerRef = ref<HTMLButtonElement>();
const alphaSliderRef = ref<HTMLInputElement>();
const panelRef = ref<HTMLElement>();
const wheelRef = ref<HTMLDivElement>();
const triCanvasRef = ref<HTMLCanvasElement>();
const panelStyle = reactive({ left: "0px", top: "0px" });

const eyedropperSupported = isEyeDropperSupported();

/** 展示色（和谐色 hover 预览优先） */
const displayHex = computed(
  () => previewHex.value ?? hsvToHex(hsv, props.alpha),
);
/** 触发器色块颜色（脏值回落为透明，仅棋盘格） */
const triggerColor = computed(() =>
  props.modelValue && isValidHexColor(props.modelValue)
    ? props.modelValue
    : "transparent",
);
const triggerHex = computed(() =>
  props.modelValue && isValidHexColor(props.modelValue)
    ? props.modelValue.toLowerCase()
    : "—",
);

/** 当前色相下的三角顶点（相对圆心） */
const verts = computed(() => triangleVertices(hsv.h, TRI_RADIUS));

/** 当前色相的互补色 hex（同 s/v，色相 +180°） */
const compHex = computed(() =>
  hsvToHex({ h: (hsv.h + 180) % 360, s: hsv.s, v: hsv.v, a: 1 }, false),
);

const tintScale = computed(() => tints(hsvToHex(hsv, false)));
const shadeScale = computed(() => shades(hsvToHex(hsv, false)));

const HARMONY_LIST: { name: HarmonyName; label: string }[] = [
  { name: "complementary", label: "complementary" },
  { name: "analogous", label: "analogous" },
  { name: "triadic", label: "triadic" },
  { name: "splitComplementary", label: "splitComplementary" },
  { name: "tetradic", label: "tetradic" },
];

const harmonyGroups = computed(() =>
  HARMONY_LIST.map((h) => ({
    ...h,
    colors: harmonyColors(hsvToHex(hsv, false), h.name),
  })).filter((h) => h.colors.length > 0),
);

// ============================================================================
// 提交与预览
// ============================================================================

/** 以当前 HSV 状态提交 v-model（持续 emit，与原生 input 的 @input 语义一致） */
function commit(): void {
  emit("update:modelValue", hsvToHex(hsv, props.alpha));
}

/** 应用一个 hex（最近使用/和谐色/明暗阶/互补标记点击） */
function applyHex(hex: string): void {
  previewHex.value = null;
  const next = hexToHsv(hex);
  hsv.h = next.h;
  hsv.s = next.s;
  hsv.v = next.v;
  // 关闭 alpha 时忽略来源色的透明度
  hsv.a = props.alpha ? next.a : 1;
  commit();
}

// ============================================================================
// 色环 + 三角交互
// ============================================================================

const huePointerStyle = computed(() => {
  const rad = (hsv.h * Math.PI) / 180;
  const x = Math.sin(rad) * HUE_POINTER_R;
  const y = -Math.cos(rad) * HUE_POINTER_R;
  return {
    left: `${WHEEL_SIZE / 2 + x}px`,
    top: `${WHEEL_SIZE / 2 + y}px`,
    backgroundColor: hsvToHex({ h: hsv.h, s: 1, v: 1, a: 1 }, false),
  };
});

const cursorStyle = computed(() => {
  const p = svToPoint(hsv.s, hsv.v, verts.value);
  return {
    left: `${WHEEL_SIZE / 2 + p.x}px`,
    top: `${WHEEL_SIZE / 2 + p.y}px`,
    backgroundColor: displayHex.value,
  };
});

/** 互补标记：取色点关于圆心的点对称位置（钳制回三角形内），填充互补色 */
const compMarkerStyle = computed(() => {
  const p = svToPoint(hsv.s, hsv.v, verts.value);
  const mirrored = clampToTriangle({ x: -p.x, y: -p.y }, verts.value);
  return {
    left: `${WHEEL_SIZE / 2 + mirrored.x}px`,
    top: `${WHEEL_SIZE / 2 + mirrored.y}px`,
    backgroundColor: compHex.value,
  };
});

/** 色相变化时重绘三角（色相决定三角形的三顶点配色） */
watch(
  () => hsv.h,
  () => renderTriangle(),
);

function renderTriangle(): void {
  const canvas = triCanvasRef.value;
  if (!canvas) return;
  drawHsvTriangle(canvas, hsv.h, TRI_CANVAS, TRI_RADIUS);
}

function wheelOffset(e: PointerEvent): WheelPoint {
  const rect = wheelRef.value!.getBoundingClientRect();
  return {
    x: e.clientX - rect.left - rect.width / 2,
    y: e.clientY - rect.top - rect.height / 2,
  };
}

function onWheelDown(e: PointerEvent): void {
  const el = wheelRef.value;
  if (!el) return;
  const p = wheelOffset(e);
  // 落在环上（内孔半径之外）→ 调色相；落在内孔 → 调 s/v
  const kind = Math.hypot(p.x, p.y) >= HOLE_RADIUS ? "hue" : "sv";
  el.setPointerCapture(e.pointerId);
  const move = (ev: PointerEvent) => {
    const q = wheelOffset(ev);
    if (kind === "hue") {
      hsv.h = offsetToHue(q.x, q.y);
    } else {
      const clamped = clampToTriangle(q, verts.value);
      const { s, v } = pointToSv(clamped, verts.value);
      hsv.s = s;
      hsv.v = v;
    }
    commit();
  };
  const up = () => {
    el.removeEventListener("pointermove", move);
    el.removeEventListener("pointerup", up);
    el.removeEventListener("pointercancel", up);
  };
  el.addEventListener("pointermove", move);
  el.addEventListener("pointerup", up);
  el.addEventListener("pointercancel", up);
  move(e);
}

// ============================================================================
// 滑块 / 输入
// ============================================================================

function colordRgb(): { r: number; g: number; b: number } {
  const parsed = parseColor(hsvToHex(hsv, false));
  return {
    r: Math.round((parsed?.r ?? 0) * 255),
    g: Math.round((parsed?.g ?? 0) * 255),
    b: Math.round((parsed?.b ?? 0) * 255),
  };
}

function hslOf(hex: string): { h: number; s: number; l: number } {
  const parsed = parseColor(hex);
  if (!parsed) return { h: 0, s: 0, l: 0 };
  // RGB → HSL（标准公式，s/l 输出 0-100）
  const r = parsed.r;
  const g = parsed.g;
  const b = parsed.b;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) * 60;
    else if (max === g) h = ((b - r) / d + 2) * 60;
    else h = ((r - g) / d + 4) * 60;
  }
  return { h, s: s * 100, l: l * 100 };
}

interface SliderChannel {
  key: string;
  value: number;
  max: number;
  /** 轨道背景：沿该通道的当前颜色梯度 */
  track: string;
}

/** 色相彩虹梯度（H 通道轨道） */
const HUE_TRACK =
  "linear-gradient(to right, #f00 0%, #ff0 17%, #0f0 33%, #0ff 50%, #00f 67%, #f0f 83%, #f00 100%)";

const sliderChannels = computed<SliderChannel[]>(() => {
  const list: SliderChannel[] = [];
  const h = Math.round(hsv.h);
  const { r, g, b } = colordRgb();
  const hexNoAlpha = hsvToHex(hsv, false);
  if (mode.value === "rgb") {
    list.push(
      {
        key: "R",
        value: r,
        max: 255,
        track: `linear-gradient(to right, rgb(0, ${g}, ${b}), rgb(255, ${g}, ${b}))`,
      },
      {
        key: "G",
        value: g,
        max: 255,
        track: `linear-gradient(to right, rgb(${r}, 0, ${b}), rgb(${r}, 255, ${b}))`,
      },
      {
        key: "B",
        value: b,
        max: 255,
        track: `linear-gradient(to right, rgb(${r}, ${g}, 0), rgb(${r}, ${g}, 255))`,
      },
    );
  } else if (mode.value === "hsv") {
    const s = Math.round(hsv.s * 100);
    const v = Math.round(hsv.v * 100);
    const sLow = hsvToHex({ h: hsv.h, s: 0, v: hsv.v, a: 1 }, false);
    const sHigh = hsvToHex({ h: hsv.h, s: 1, v: hsv.v, a: 1 }, false);
    const vLow = hsvToHex({ h: hsv.h, s: hsv.s, v: 0, a: 1 }, false);
    const vHigh = hsvToHex({ h: hsv.h, s: hsv.s, v: 1, a: 1 }, false);
    list.push(
      { key: "H", value: h, max: 360, track: HUE_TRACK },
      {
        key: "S",
        value: s,
        max: 100,
        track: `linear-gradient(to right, ${sLow}, ${sHigh})`,
      },
      {
        key: "V",
        value: v,
        max: 100,
        track: `linear-gradient(to right, ${vLow}, ${vHigh})`,
      },
    );
  } else {
    const { h: hh, s: hs, l: hl } = hslOf(hexNoAlpha);
    const sInt = Math.round(hs);
    const lInt = Math.round(hl);
    list.push(
      { key: "H", value: Math.round(hh), max: 360, track: HUE_TRACK },
      {
        key: "S",
        value: sInt,
        max: 100,
        track: `linear-gradient(to right, hsl(${Math.round(hh)}, 0%, ${lInt}%), hsl(${Math.round(hh)}, 100%, ${lInt}%))`,
      },
      {
        key: "L",
        value: lInt,
        max: 100,
        track: `linear-gradient(to right, hsl(${Math.round(hh)}, ${sInt}%, 0%), hsl(${Math.round(hh)}, ${sInt}%, 100%))`,
      },
    );
  }
  if (props.alpha) {
    list.push({
      key: "A",
      value: Math.round(hsv.a * 255),
      max: 255,
      track: "",
    });
  }
  return list;
});

/** 通道滑条 inline 样式：A 通道用棋盘格+透明度渐变，其余用通道梯度；一律关闭 daisyUI 填充 */
function channelRangeStyle(ch: SliderChannel): Record<string, string> {
  if (ch.key === "A") {
    return { ...alphaTrackStyle.value, "--range-fill": "0" };
  }
  return { background: ch.track, "--range-fill": "0" };
}

/** 滑块/数字输入统一处理 */
function onSliderInput(ch: SliderChannel, e: Event): void {
  const raw = Number((e.target as HTMLInputElement).value) || 0;
  const v = Math.max(0, Math.min(ch.max, raw));
  if (ch.key === "A") {
    hsv.a = v / 255;
    commit();
    return;
  }
  if (mode.value === "rgb") {
    const { r, g, b } = colordRgb();
    applyRgb(
      ch.key === "R"
        ? { r: v, g, b }
        : ch.key === "G"
          ? { r, g: v, b }
          : { r, g, b: v },
    );
  } else if (mode.value === "hsv") {
    if (ch.key === "H") hsv.h = v;
    else if (ch.key === "S") hsv.s = v / 100;
    else hsv.v = v / 100;
  } else {
    const cur = hslOf(hsvToHex(hsv, false));
    const next =
      ch.key === "H"
        ? { h: v, s: cur.s, l: cur.l }
        : ch.key === "S"
          ? { h: cur.h, s: v, l: cur.l }
          : { h: cur.h, s: cur.s, l: v };
    applyRgb(hslToRgb(next));
  }
  commit();
}

/** HSL（h 0-360，s/l 0-100）→ 0-255 RGB（标准公式） */
function hslToRgb(next: { h: number; s: number; l: number }): {
  r: number;
  g: number;
  b: number;
} {
  const h = next.h / 360;
  const s = next.s / 100;
  const l = next.l / 100;
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const hue2rgb = (pp: number, qq: number, tt: number): number => {
    if (tt < 0) tt += 1;
    if (tt > 1) tt -= 1;
    if (tt < 1 / 6) return pp + (qq - pp) * 6 * tt;
    if (tt < 1 / 2) return qq;
    if (tt < 2 / 3) return pp + (qq - pp) * (2 / 3 - tt) * 6;
    return pp;
  };
  return {
    r: Math.round(hue2rgb(p, q, h + 1 / 3) * 255),
    g: Math.round(hue2rgb(p, q, h) * 255),
    b: Math.round(hue2rgb(p, q, h - 1 / 3) * 255),
  };
}

/** 0-255 RGB 写回 HSV 状态（保持当前 alpha） */
function applyRgb(next: { r: number; g: number; b: number }): void {
  const hex = rgbToHex(next.r, next.g, next.b);
  const nextHsv = hexToHsv(hex);
  hsv.h = nextHsv.h;
  hsv.s = nextHsv.s;
  hsv.v = nextHsv.v;
}

const alphaTrackStyle = computed(() => {
  const { r, g, b } = colordRgb();
  return {
    background: `linear-gradient(to right, rgba(${r}, ${g}, ${b}, 0), rgb(${r}, ${g}, ${b})), repeating-conic-gradient(#b0b0b0 0% 25%, #d0d0d0 0% 50%)`,
    "background-size": "auto, 10px 10px",
  };
});

function onAlphaSlider(e: Event): void {
  hsv.a = Number((e.target as HTMLInputElement).value) / 255;
  commit();
}

/** 独立 alpha 滑条反映当前 hsv.a（外部 applyHex/通道修改后同步） */
watch(open, (v) => {
  if (v) {
    alphaSliderRef.value?.setAttribute("value", String(Math.round(hsv.a * 255)));
  }
});

function onHexInput(e: Event): void {
  const raw = (e.target as HTMLInputElement).value.trim().toLowerCase();
  const withHash = raw.startsWith("#") ? raw : `#${raw}`;
  if (isValidHexColor(withHash)) {
    applyHex(
      withHash.length === 8 && !props.alpha ? withHash.slice(0, 7) : withHash,
    );
    commit();
  }
  // 非法输入不写回，:value 绑定会自动还原显示
}

// ============================================================================
// 复制 / 吸管
// ============================================================================

function formatString(): string {
  const hex = hsvToHex(hsv, props.alpha);
  const parsed = parseColor(hex);
  if (!parsed) return hex;
  const { r, g, b } = colordRgb();
  const a = parsed.a;
  if (mode.value === "rgb") {
    return props.alpha && a < 1
      ? `rgba(${r}, ${g}, ${b}, ${Number(a.toFixed(2))})`
      : `rgb(${r}, ${g}, ${b})`;
  }
  if (mode.value === "hsv") {
    const s = Math.round(hsv.s * 100);
    const v = Math.round(hsv.v * 100);
    return props.alpha && a < 1
      ? `hsv(${Math.round(hsv.h)}, ${s}%, ${v}%, ${Number(a.toFixed(2))})`
      : `hsv(${Math.round(hsv.h)}, ${s}%, ${v}%)`;
  }
  const { h, s, l } = hslOf(hex);
  return props.alpha && a < 1
    ? `hsl(${Math.round(h)}, ${Math.round(s)}%, ${Math.round(l)}%, ${Number(a.toFixed(2))})`
    : `hsl(${Math.round(h)}, ${Math.round(s)}%, ${Math.round(l)}%)`;
}

async function copyFormat(): Promise<void> {
  try {
    await navigator.clipboard.writeText(formatString());
    copied.value = true;
    setTimeout(() => (copied.value = false), 1200);
  } catch {
    // 剪贴板不可用时静默失败
  }
}

async function onEyedropper(): Promise<void> {
  const hex = await pickColorWithEyeDropper();
  if (hex) {
    applyHex(hex);
  }
}

// ============================================================================
// 开合 / 定位 / 全局监听
// ============================================================================

async function toggle(): Promise<void> {
  if (props.disabled) return;
  if (open.value) {
    closePanel();
    return;
  }
  // 从 modelValue 初始化面板状态（脏值兜底黑）
  const parsed = parseColor(props.modelValue);
  if (parsed && parsed.a > 0) {
    const hex = rgbToHex(
      Math.round(parsed.r * 255),
      Math.round(parsed.g * 255),
      Math.round(parsed.b * 255),
    );
    const next = hexToHsv(hex);
    hsv.h = next.h;
    hsv.s = next.s;
    hsv.v = next.v;
    hsv.a = parsed.a;
  } else {
    hsv.h = 0;
    hsv.s = 0;
    hsv.v = 0;
    hsv.a = props.alpha ? (parsed?.a ?? 0) : 1;
  }
  mode.value = "hsv";
  previewHex.value = null;
  recents.value = loadRecentColors();
  open.value = true;
  await nextTick();
  renderTriangle();
  position();
  panelRef.value?.focus();
  addListeners();
}

function closePanel(): void {
  if (!open.value) return;
  open.value = false;
  removeListeners();
  previewHex.value = null;
  recents.value = pushRecentColor(recents.value, hsvToHex(hsv, props.alpha));
  saveRecentColors(recents.value);
  triggerRef.value?.focus();
}

function position(): void {
  const tr = triggerRef.value;
  const panel = panelRef.value;
  if (!tr || !panel) return;
  const r = tr.getBoundingClientRect();
  const pw = panel.offsetWidth;
  const ph = panel.offsetHeight;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const left = Math.min(Math.max(8, r.left), Math.max(8, vw - pw - 8));
  let top = r.bottom + 8;
  if (top + ph > vh - 8) top = Math.max(8, r.top - ph - 8);
  panelStyle.left = `${left}px`;
  panelStyle.top = `${top}px`;
}

function onDocPointerDown(e: PointerEvent): void {
  const target = e.target as Node;
  if (panelRef.value?.contains(target) || triggerRef.value?.contains(target)) {
    return;
  }
  closePanel();
}

function onKeydown(e: KeyboardEvent): void {
  if (e.key === "Escape") {
    // capture 相位 + stopPropagation：避免设置抽屉的 window keydown 监听把抽屉一起关掉
    e.preventDefault();
    e.stopPropagation();
    closePanel();
  }
}

function onScrollOrResize(): void {
  position();
}

function addListeners(): void {
  document.addEventListener("pointerdown", onDocPointerDown, true);
  document.addEventListener("keydown", onKeydown, true);
  // capture 相位才能捕获抽屉卡片 overflow-y-auto 的内部滚动
  document.addEventListener("scroll", onScrollOrResize, true);
  window.addEventListener("resize", onScrollOrResize);
  window.addEventListener("blur", onWindowBlur);
}

function removeListeners(): void {
  document.removeEventListener("pointerdown", onDocPointerDown, true);
  document.removeEventListener("keydown", onKeydown, true);
  document.removeEventListener("scroll", onScrollOrResize, true);
  window.removeEventListener("resize", onScrollOrResize);
  window.removeEventListener("blur", onWindowBlur);
}

function onWindowBlur(): void {
  closePanel();
}
</script>

<style scoped>
/* 触发器：色块 + hex 文本 + chevron */
.cp-trigger {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  height: 2rem;
  padding: 0 0.5rem 0 0.375rem;
  border-radius: var(--radius-selector, 0.5rem);
  border: 1px solid var(--color-base-300, oklch(0.92 0 0));
  background: var(--color-base-100, white);
  cursor: pointer;
  transition: border-color 0.15s;
}
.cp-trigger:hover:not(:disabled) {
  border-color: var(--color-primary, oklch(0.55 0.25 285));
}
.cp-trigger:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.cp-trigger-hex {
  font-size: 0.75rem;
  font-family: ui-monospace, monospace;
  color: var(--color-base-content, black);
  min-width: 4.5rem;
  text-align: left;
}

/* 色块通用 */
.cp-swatch {
  width: 1.5rem;
  height: 1.25rem;
  border-radius: 0.25rem;
  border: 1px solid var(--color-base-300, oklch(0.92 0 0));
  flex-shrink: 0;
}

/* 透明棋盘格 */
.cp-checker {
  background-image: repeating-conic-gradient(#b0b0b0 0% 25%, #d0d0d0 0% 50%);
  background-size: 10px 10px;
}

/* 面板 */
.cp-panel {
  position: fixed;
  width: 18rem;
  max-height: min(76vh, 660px);
  overflow-y: auto;
  border-radius: var(--radius-box, 1rem);
  padding: 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

/* 预览行 */
.cp-header {
  display: flex;
  align-items: center;
  gap: 0.25rem;
}
.cp-preview {
  width: 2.25rem;
  height: 1.75rem;
  border-radius: 0.375rem;
  border: 1px solid var(--color-base-300, oklch(0.92 0 0));
  flex-shrink: 0;
}
.cp-icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.75rem;
  height: 1.75rem;
  border-radius: 0.375rem;
  color: var(--color-base-content, black);
  flex-shrink: 0;
  cursor: pointer;
}
.cp-icon-btn:hover {
  background: var(--color-base-200, oklch(0.96 0 0));
}
.cp-icon-btn svg {
  width: 1rem;
  height: 1rem;
}

/* 色环 + 三角 */
.cp-wheel {
  position: relative;
  width: 216px;
  height: 216px;
  border-radius: 50%;
  align-self: center;
  flex-shrink: 0;
  touch-action: none;
  cursor: crosshair;
  background: conic-gradient(
    from 0deg,
    #f00 0deg,
    #ff0 60deg,
    #0f0 120deg,
    #0ff 180deg,
    #00f 240deg,
    #f0f 300deg,
    #f00 360deg
  );
}
/* 环内孔（覆盖中央，露出面板底色） */
.cp-wheel::after {
  content: "";
  position: absolute;
  inset: 14px;
  border-radius: 50%;
  background: var(--color-base-100, white);
}
.cp-tri {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  z-index: 1;
}
.cp-hue-pointer {
  position: absolute;
  width: 16px;
  height: 16px;
  border: 2px solid #fff;
  border-radius: 50%;
  box-shadow: 0 0 3px rgba(0, 0, 0, 0.6);
  transform: translate(-50%, -50%);
  pointer-events: none;
  z-index: 2;
}
.cp-cursor {
  position: absolute;
  width: 13px;
  height: 13px;
  border: 2px solid #fff;
  border-radius: 50%;
  box-shadow: 0 0 3px rgba(0, 0, 0, 0.5);
  transform: translate(-50%, -50%);
  pointer-events: none;
  z-index: 3;
}
/* 互补色标记：虚线描边小圆（与取色光标明确区分），点击应用互补色 */
.cp-comp-marker {
  position: absolute;
  width: 11px;
  height: 11px;
  border: 2px dashed #fff;
  outline: 1px solid rgba(0, 0, 0, 0.45);
  border-radius: 50%;
  transform: translate(-50%, -50%);
  z-index: 3;
  cursor: pointer;
}

/* 通道滑块组 */
.cp-sliders {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
  flex-shrink: 0;
}
.cp-slider-row {
  display: grid;
  grid-template-columns: 1rem 1fr 3rem;
  align-items: center;
  gap: 0.5rem;
}
.cp-slider-label {
  font-size: 0.6875rem;
  opacity: 0.6;
  text-align: center;
}
.cp-slider-num {
  width: 100%;
  height: 1.5rem;
  min-height: 0;
  font-size: 0.6875rem;
  font-family: ui-monospace, monospace;
  text-align: center;
  padding: 0 0.25rem;
}

/* 头部 HEX 输入 */
.cp-hex-input {
  flex: 1;
  min-width: 0;
  height: 1.75rem;
  min-height: 0;
  font-size: 0.75rem;
  font-family: ui-monospace, monospace;
}
.cp-hex-input:focus {
  outline: none;
}
/* 隐藏 number input 的步进箭头 */
.cp-slider-num::-webkit-outer-spin-button,
.cp-slider-num::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}
.cp-slider-num[type="number"] {
  -moz-appearance: textfield;
  appearance: textfield;
}

/* 分节标签 */
.cp-section-label {
  font-size: 0.6875rem;
  opacity: 0.6;
  margin-top: 0.125rem;
  flex-shrink: 0;
}

/* 色板网格 */
.cp-swatches {
  display: grid;
  gap: 0.25rem;
  flex-shrink: 0;
}
.cp-swatches--6 {
  grid-template-columns: repeat(6, 1fr);
}
.cp-swatch-btn {
  aspect-ratio: 1;
  border-radius: 0.25rem;
  border: 1px solid var(--color-base-300, oklch(0.92 0 0));
  cursor: pointer;
  transition: transform 0.1s;
}
.cp-swatch-btn:hover {
  transform: scale(1.12);
}
.cp-swatch-btn--sm {
  width: 1.5rem;
  aspect-ratio: 1;
}

/* 和谐色 */
.cp-harmonies {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  flex-shrink: 0;
}
.cp-harmony-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
.cp-harmony-name {
  font-size: 0.625rem;
  opacity: 0.6;
  width: 4rem;
  flex-shrink: 0;
}
.cp-harmony-swatches {
  display: flex;
  gap: 0.25rem;
}

/* 明暗阶 */
.cp-scale {
  display: grid;
  grid-template-columns: repeat(9, 1fr);
  gap: 1px;
  flex-shrink: 0;
}
.cp-scale-btn {
  height: 1.25rem;
  border: 1px solid var(--color-base-300, oklch(0.92 0 0));
  cursor: pointer;
}
.cp-scale-btn:hover {
  border-color: var(--color-primary, oklch(0.55 0.25 285));
}
</style>
