<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, nextTick } from "vue";
import type { Chord } from "@tonaljs/chord";
import { KeyboardRenderer } from "@/views/WaterfallPiano/engine/KeyboardRenderer";
import type {
  KeyboardSettings,
  KeySignatureConfig,
} from "@/components/PianoKeyboard/types";
import type { WaterfallPianoSettings } from "@/views/WaterfallPiano/types";

interface Props {
  id?: string;
  className?: string;
  keyboard?: KeyboardSettings;
  keySignature?: KeySignatureConfig;
  played?: number[];
  sustained?: number[];
  midi?: number[];
  targets?: number[] | null;
  exactTargets?: boolean;
  chord?: Chord | undefined;
  clickable?: boolean;
  sustainMode?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  id: undefined,
  className: undefined,
  keyboard: () => ({
    skin: "classic",
    from: "C3",
    to: "B5",
    label: "none",
    keyName: "none",
    keyInfo: "none",
    fadeOutDuration: 0,
    textOpacity: 0.5,
    displaySustained: false,
    wrap: false,
    sizes: { radius: 1, height: 5, ratio: 0.6, bevel: true },
    colors: {
      white: "#ffffff",
      black: "#000000",
      played: "#ff0000",
      wrapped: "#800000",
      sustained: "#777777",
    },
  }),
  played: () => [],
  sustained: () => [],
  midi: () => [],
  targets: null,
  exactTargets: false,
  chord: undefined,
  clickable: false,
  sustainMode: false,
});

const emit = defineEmits<{
  noteClick: [midi: number];
  noteOn: [midi: number];
  noteOff: [midi: number];
}>();

const containerRef = ref<HTMLDivElement | null>(null);
const canvasRef = ref<HTMLCanvasElement | null>(null);

let renderer: KeyboardRenderer | null = null;
let resizeObserver: ResizeObserver | null = null;
let animFrameId: number | null = null;
/** 按 pointer 按下的 midi 音符（用于 sustainMode） */
const pointerDownNotes = new Set<number>();

/** 将 KeyboardSettings 转换为 WaterfallPianoSettings 格式（仅 keyboard 部分） */
function toWaterfallSettings(kb: KeyboardSettings): WaterfallPianoSettings {
  return {
    particles: {
      colorScheme: "pitch",
      customColors: { low: "#0000ff", mid: "#00ff00", high: "#ff0000" },
      speed: 1,
      lookAhead: 3,
      opacity: 1,
      cornerRadius: 2,
      hitLine: { visible: false, color: "#ffffff", thickness: 1 },
      hitExplosionRadius: 0,
    },
    background: {
      type: "solid",
      solidColor: "#1a1a2e",
      fluidEnabled: false,
      fluidQuality: "medium",
      fluidStyle: "standard",
      fluidAdvanced: false,
      fluidParams: {},
    },
    keyboard: {
      visible: true,
      range: "61" as const,
      customFrom: kb.from,
      customTo: kb.to,
      keyLabel:
        kb.keyName === "none"
          ? "none"
          : kb.keyName === "note"
            ? "note"
            : kb.keyName === "pitchClass"
              ? "pitchClass"
              : "octave",
      whiteKeyColor: kb.colors.white ?? "#ffffff",
      blackKeyColor: kb.colors.black ?? "#000000",
      pressedKeyColor: kb.colors.played ?? "#ff0000",
      heightRatio: 0.3,
      keyCornerRadius: Math.max(0, kb.sizes.radius ?? 0),
      keyBorderWidth: 0,
      keyBorderColor: "#666666",
      gapBlur: 0,
      separatorEnabled: false,
      separatorColor: "#ffffff",
      separatorThickness: 0,
      staffVisible: false,
      synthesiaFlowDirection: "down" as const,
      showNoteNames: kb.label !== "none",
      defaultVelocity: 90,
    },
    midiFile: {
      playbackSpeed: 1,
      selectedTracks: [],
      trackColors: [],
      loop: false,
      showNoteNames: false,
      rightHandTrackIdx: 0,
      leftHandTrackIdx: 1,
    },
    sound: {
      volume: 1,
      reverbAmount: 0,
      reverbDecay: 0,
      sustain: false,
      velocitySensitivity: true,
      harmonicity: 1,
      modulationIndex: 1,
      oscillatorType: "triangle" as const,
      envelope: { attack: 0.01, decay: 0.3, sustain: 0.5, release: 0.3 },
      modulationEnvelope: {
        attack: 0.01,
        decay: 0.3,
        sustain: 0.5,
        release: 0.3,
      },
    },
    aura: {
      enabled: false,
      style: "none" as const,
      target: "off" as const,
      padding: 2,
      innerBlur: 4,
      innerOpacity: 70,
      outerBlur: 16,
      outerOpacity: 30,
      duration: 6,
      rotationRange: 360,
      beamAngle: 225,
      beamWidth: 135,
      glowExtent: 90,
      glowPeakOpacity: 100,
      glowPeakBlur: 12,
      glowAfterPeakOpacity: 60,
      glowAfterPeakBlur: 24,
      rainbowMargin: 10,
      dualOffRatio: 40,
      dualOnRatio: 50,
    },
  };
}

function updateHighlights() {
  if (!renderer) return;
  // 先清除所有
  renderer.clearAllHighlights();
  // 高亮 played
  for (const midi of props.played) {
    renderer.highlightNote(midi);
  }
  // 高亮 sustained
  for (const midi of props.sustained) {
    renderer.highlightNote(midi);
  }
  // 高亮 targets
  if (props.targets) {
    for (const midi of props.targets) {
      renderer.highlightNote(midi);
    }
  }
  // 高亮 midi
  for (const midi of props.midi) {
    renderer.highlightNote(midi);
  }
  // chord 的音符也高亮
  if (props.chord && props.chord.notes) {
    // chord.notes 是音名字符串数组，转换为 midi 需要额外逻辑
    // 暂时不处理，使用 targets 代替
  }
  renderer.render();
}

function scheduleRender() {
  if (animFrameId !== null) return;
  animFrameId = requestAnimationFrame(() => {
    animFrameId = null;
    updateHighlights();
  });
}

function onPointerDown(e: PointerEvent) {
  if (!renderer || !props.clickable) return;
  e.preventDefault();
  const midi = renderer.xToMidi(e.offsetX);
  if (midi === null) return;

  if (props.sustainMode) {
    pointerDownNotes.add(midi);
    emit("noteOn", midi);
  } else {
    emit("noteClick", midi);
  }
  renderer.highlightNote(midi);
  renderer.render();
}

function onPointerUp(_e: PointerEvent) {
  if (!renderer) return;
  // 释放所有 pointerDown 的音符
  for (const midi of pointerDownNotes) {
    emit("noteOff", midi);
  }
  pointerDownNotes.clear();
  updateHighlights();
}

function onPointerLeave(_e: PointerEvent) {
  if (!renderer) return;
  for (const midi of pointerDownNotes) {
    emit("noteOff", midi);
  }
  pointerDownNotes.clear();
  updateHighlights();
}

onMounted(async () => {
  if (!canvasRef.value || !containerRef.value) return;

  const settings = toWaterfallSettings(props.keyboard);
  renderer = new KeyboardRenderer();
  renderer.init(canvasRef.value, settings);

  // 初始尺寸
  await nextTick();
  const rect = containerRef.value.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  renderer.resize(Math.max(1, rect.width), Math.max(1, rect.height), dpr);

  // 触发初始高亮
  updateHighlights();

  // ResizeObserver
  resizeObserver = new ResizeObserver(() => {
    if (!containerRef.value || !renderer) return;
    const r = containerRef.value.getBoundingClientRect();
    const d = Math.min(window.devicePixelRatio || 1, 2);
    renderer.resize(Math.max(1, r.width), Math.max(1, r.height), d);
    updateHighlights();
  });
  resizeObserver.observe(containerRef.value);
});

onUnmounted(() => {
  if (animFrameId !== null) {
    cancelAnimationFrame(animFrameId);
    animFrameId = null;
  }
  resizeObserver?.disconnect();
  resizeObserver = null;
  renderer = null;
  pointerDownNotes.clear();
});

// 监听 props 变化更新渲染
watch(
  () => [props.played, props.sustained, props.midi, props.targets],
  () => scheduleRender(),
  { deep: true },
);

watch(
  () => props.keyboard,
  (kb) => {
    if (!renderer) return;
    renderer.setSettings(toWaterfallSettings(kb));
    updateHighlights();
  },
  { deep: true },
);
</script>

<template>
  <div
    ref="containerRef"
    :id="id"
    :class="className"
    style="width: 100%; height: 100%; position: relative"
  >
    <canvas
      ref="canvasRef"
      :style="{
        width: '100%',
        height: '100%',
        touchAction: clickable ? 'none' : 'auto',
        cursor: clickable ? 'pointer' : 'default',
      }"
      @pointerdown="onPointerDown"
      @pointerup="onPointerUp"
      @pointerleave="onPointerLeave"
      @pointercancel="onPointerUp"
    />
  </div>
</template>
