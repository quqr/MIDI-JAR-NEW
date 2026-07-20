import { watch, computed, onMounted } from "vue";
import type { ComputedRef, Ref } from "vue";
import type { Chord } from "@tonaljs/chord";

import { getContrastColor } from "@/helpers";

import type {
  KeyboardSettings,
  KeySignatureConfig,
} from "../types";
import {
  fadeAllHighlights,
  applyHighlightStrategy,
  highlightTargets,
  highlightLabels,
  highlightWrapLabels,
  fadeInfo,
  highlightInfo,
} from "../utils";
import type { HighlightStrategy } from "../utils";

export interface UseKeyRenderingProps {
  keyboard: KeyboardSettings;
  keySignature: KeySignatureConfig;
  played: number[];
  sustained: number[];
  midi: number[];
  targets: number[] | null;
  exactTargets: boolean;
  chord?: Chord;
}

export interface UseKeyRenderingReturn {
  style: ComputedRef<Record<string, string | undefined>>;
}

/**
 * 键盘渲染 composable
 *
 * 集中管理钢琴键盘的视觉状态与 DOM 高亮逻辑：
 * - 高亮策略（目标音 / 已演奏 / 延音）的应用与清除
 * - 和弦信息（根音 / 音程）的显示
 * - CSS 变量（颜色、淡出时长、文字透明度）的计算
 * - 响应式监听 props 变化以重新渲染高亮与信息
 *
 * 通过 onMounted 完成首次渲染，并在 props 变化时由 watch 触发更新。
 *
 * @param props - 组件 props 的响应式子集（直接传入 props 对象以保持响应式追踪）
 * @param pianoRef - 钢琴键盘容器元素的 ref（由组件持有并传入）
 */
export function useKeyRendering(
  props: UseKeyRenderingProps,
  pianoRef: Ref<HTMLDivElement | null>,
): UseKeyRenderingReturn {
  const noteStrategies = computed<HighlightStrategy[]>(() => [
    {
      getNotes: () => props.targets ?? undefined,
      className: "exactTarget",
      wrapClassName: "wrapExactTarget",
      shouldApply: () => !!props.targets,
      getLabelNotes: () => props.targets ?? undefined,
    },
    {
      getNotes: () => props.played,
      className: "played",
      wrapClassName: "wrapPlayed",
      shouldApply: () => !!props.played?.length,
    },
    {
      getNotes: () => props.sustained,
      className: "sustained",
      wrapClassName: "wrapSustained",
      shouldApply: (kb) => !!props.sustained?.length && kb.displaySustained,
    },
  ]);

  function applyHighlights() {
    const el = pianoRef.value;
    if (!el) return;

    fadeAllHighlights(el);

    if (props.targets && !props.exactTargets) {
      highlightTargets(el, props.targets);
    }

    // 标准策略：音符高亮 + 可选标签高亮
    for (const strategy of noteStrategies.value) {
      if (strategy.shouldApply(props.keyboard)) {
        applyHighlightStrategy(
          el,
          strategy,
          props.keyboard,
          props.keySignature,
          props.chord,
        );
      }
    }

    // midi 标签高亮：标签数据源取决于 displaySustained，与 wrapLabels 独立
    if (props.midi?.length) {
      const labelMidi = props.keyboard.displaySustained
        ? props.midi
        : props.played;
      if (labelMidi?.length) {
        highlightLabels(
          el,
          props.keySignature,
          props.keyboard,
          labelMidi,
          props.chord,
        );
      }
      if (props.keyboard.wrap) {
        highlightWrapLabels(
          el,
          props.keySignature,
          props.keyboard,
          props.midi,
          props.chord,
        );
      }
    }
  }

  function applyInfo() {
    const el = pianoRef.value;
    if (!el) return;

    fadeInfo(el);
    highlightInfo(el, props.keyboard.keyInfo, props.chord);
  }

  const playedKey = computed(() => (props.played ?? []).join(","));
  const sustainedKey = computed(() => (props.sustained ?? []).join(","));
  const midiKey = computed(() => (props.midi ?? []).join(","));
  const targetsKey = computed(() => (props.targets ?? []).join(","));
  const chordKey = computed(() =>
    props.chord ? `${props.chord.tonic}-${props.chord.aliases?.[0]}` : "",
  );
  const keyboardKey = computed(() =>
    props.keyboard ? `${props.keyboard.skin}-${props.keyboard.label}` : "",
  );

  watch(
    [
      playedKey,
      sustainedKey,
      midiKey,
      targetsKey,
      chordKey,
      keyboardKey,
      () => props.keySignature?.tonic,
      () => props.exactTargets,
    ],
    () => {
      applyHighlights();
    },
  );

  watch([chordKey, keyboardKey], () => {
    applyInfo();
  });

  onMounted(() => {
    applyHighlights();
    applyInfo();
  });

  const style = computed(
    (): Record<string, string | undefined> => ({
      "--PianoKeyboard-white_background":
        props.keyboard.colors.white ?? undefined,
      "--PianoKeyboard-white_color": getContrastColor(
        props.keyboard.colors.white ?? "#ffffff",
      ),
      "--PianoKeyboard-black_background":
        props.keyboard.colors.black ?? undefined,
      "--PianoKeyboard-black_color": getContrastColor(
        props.keyboard.colors.black ?? "#000000",
      ),
      "--PianoKeyboard--played_background":
        props.keyboard.colors.played ?? undefined,
      "--PianoKeyboard--played_color": getContrastColor(
        props.keyboard.colors.played ?? "#ff0000",
      ),
      "--PianoKeyboard--sustained_background":
        props.keyboard.colors.sustained ?? undefined,
      "--PianoKeyboard--sustained_color": getContrastColor(
        props.keyboard.colors.sustained ?? "#777777",
      ),
      "--PianoKeyboard--wrapPlayed_background":
        props.keyboard.colors.wrapped ?? "#800000",
      "--PianoKeyboard--wrapPlayed_color": getContrastColor(
        props.keyboard.colors.wrapped ?? "#800000",
      ),
      "--PianoKeyboard--wrapSustained_background":
        props.keyboard.colors.sustained ?? "#777777",
      "--PianoKeyboard--wrapSustained_color": getContrastColor(
        props.keyboard.colors.sustained ?? "#777777",
      ),
      "--PianoKeyboard-fadeOut_duration": `${props.keyboard.fadeOutDuration}s`,
      "--PianoKeyboard-text_opacity": `${props.keyboard.textOpacity}`,
    }),
  );

  return { style };
}
