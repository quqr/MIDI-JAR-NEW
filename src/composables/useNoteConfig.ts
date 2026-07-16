import { computed } from "vue";
import { getKeySignature, type KeySignatureConfig } from "@/helpers";
import { MIDI_CHANNEL_ALL } from "./useMidiHandler";

/**
 * useNotes 的配置项接口。
 * 所有选项均支持传入值或响应式 getter 函数，以便在运行时动态变更。
 */
export interface UseNotesOptions {
  accidentals?: "flat" | "sharp" | (() => "flat" | "sharp");
  key?: string | (() => string);
  midiChannel?: number;
  allowOmissions?: boolean | (() => boolean);
  useSustain?: boolean | (() => boolean);
  detectOnRelease?: boolean | (() => boolean);
  disabledChords?: string[] | (() => string[]);
  namespace?: string;
}

/**
 * 解析可能为 getter 的选项值：若为函数则调用取值，若为 undefined 则使用默认值。
 *
 * @param option - 选项值、getter 函数或 undefined
 * @param defaultValue - 选项为 undefined 时的默认值
 * @returns 解析后的实际值
 */
export function resolveOption<T>(
  option: T | (() => T) | undefined,
  defaultValue: T,
): T {
  if (option === undefined) return defaultValue;
  return typeof option === "function" ? (option as () => T)() : option;
}

/**
 * 将选项值或 getter 转换为统一的 getter 函数。
 *
 * @param option - 选项值、getter 函数或 undefined
 * @param defaultValue - 选项为 undefined 时的默认值
 * @returns 始终返回解析后值的 getter 函数
 */
export function toGetter<T>(
  option: T | (() => T) | undefined,
  defaultValue: T,
): () => T {
  return () => resolveOption(option, defaultValue);
}

/**
 * 构建 useNotes 的配置对象，将各选项统一转换为 getter 并计算调号。
 *
 * @param options - 配置项，参见 UseNotesOptions
 * @returns 包含调号 computed、各选项 getter 及静态配置的对象
 */
export function useNoteConfig(options: UseNotesOptions = {}) {
  const accidentalsGetter = toGetter(options.accidentals, "flat" as const);
  const keyGetter = toGetter(options.key, "C");
  const allowOmissionsGetter = toGetter(options.allowOmissions, false);
  const useSustainGetter = toGetter(options.useSustain, true);
  const detectOnReleaseGetter = toGetter(options.detectOnRelease, true);
  const disabledChordsGetter = toGetter(options.disabledChords, [] as string[]);

  const keySignature = computed<KeySignatureConfig>(() => {
    const currentKey = keyGetter();
    const currentAccidentals = accidentalsGetter();
    return getKeySignature(currentKey, currentAccidentals === "sharp");
  });

  const midiChannel = options.midiChannel ?? MIDI_CHANNEL_ALL;
  const namespace = options.namespace ?? "debugger";

  return {
    keySignature,
    accidentalsGetter,
    keyGetter,
    allowOmissionsGetter,
    useSustainGetter,
    detectOnReleaseGetter,
    disabledChordsGetter,
    midiChannel,
    namespace,
  };
}
