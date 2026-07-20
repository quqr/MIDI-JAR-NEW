import { Chord } from "tonal";

type DetectOptions = {
  disabledChords: string[];
};

/**
 * 根据音符列表检测可能的和弦名称，按匹配权重降序排列
 * @param source - 音符名称列表（如 ["C", "E", "G"]）
 * @param options - 检测选项，包括禁用的和弦别名
 * @returns 匹配的和弦名称列表（如 ["CM"]）
 */
export function detect(
  source: string[],
  options: Partial<DetectOptions> = {},
): string[] {
  if (source.length === 0) {
    return [];
  }

  const results = Chord.detect(source);

  if (options.disabledChords && options.disabledChords.length > 0) {
    return results.filter((name) => {
      const chord = Chord.get(name);
      const primaryAlias = chord.type ? chord.aliases[0] : "";
      return !options.disabledChords!.includes(primaryAlias);
    });
  }

  return results;
}

export default { detect };
