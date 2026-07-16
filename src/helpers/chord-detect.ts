import { all, ChordType } from "@tonaljs/chord-type";
import { note } from "@tonaljs/core";
import { modes, chroma as pcsetChroma } from "@tonaljs/pcset";

const DETECT_INVERSION_SCORE = 0.5;
const DETECT_OMISSION_SCORE = 0.75;

interface FoundChord {
  readonly weight: number;
  readonly name: string;
}

/**
 * 获取和弦类型中标记为可省略的音程（以 * 结尾的音程）
 * @param chordType - 和弦类型
 * @returns 可省略音程列表
 */
const getOmissions = (chordType: ChordType) => {
  return chordType.intervals.filter((interval: string) =>
    interval.endsWith("*"),
  );
};

type ChordTypeWithOmission = ChordType & {
  omissions: string[];
  omissionChroma: string;
};

const chordTypesWithOmissions = all().map(
  (chordType: ChordType): ChordTypeWithOmission => {
    const omissions = getOmissions(chordType);
    return {
      ...chordType,
      omissions,
      omissionChroma: pcsetChroma(omissions),
    };
  },
);

const namedSet = (notes: string[]) => {
  const pcToName = notes.reduce<Record<number, string>>((record, n) => {
    const { chroma } = note(n);
    if (chroma !== undefined) {
      record[chroma] = record[chroma] || note(n).name;
    }
    return record;
  }, {});

  return (chroma: number) => pcToName[chroma];
};

function withOmissions(chroma: string, omissionChroma: string): string {
  const chromaNumber = parseInt(chroma, 2);
  const omissionChromaNumber = parseInt(omissionChroma, 2);
  return (chromaNumber | omissionChromaNumber).toString(2);
}

type FindMatchesOptions = {
  allowOmissions: boolean;
  disabledChords: string[];
};
function findMatches(
  notes: string[],
  weight: number,
  options: Partial<FindMatchesOptions>,
): FoundChord[] {
  const tonic = notes[0];
  const tonicChroma = note(tonic).chroma;
  const noteName = namedSet(notes);
  const allModes = modes(notes, false);

  const found: FoundChord[] = [];
  allModes.forEach((mode, index) => {
    const chordTypes = chordTypesWithOmissions.filter((chordType) => {
      if (
        options.disabledChords &&
        options.disabledChords.includes(chordType.aliases[0])
      ) {
        return false;
      }

      if (options.allowOmissions) {
        const modeWithOmissions = withOmissions(mode, chordType.omissionChroma);
        return chordType.chroma === modeWithOmissions;
      }
      return chordType.chroma === mode;
    });

    chordTypes.forEach((chordType) => {
      const chordName = chordType.aliases[0];
      const baseNote = noteName(index);
      const modeWithOmissions = withOmissions(mode, chordType.omissionChroma);
      const isInversion = index !== tonicChroma;
      const hasOmissions = mode !== modeWithOmissions;

      if (isInversion && hasOmissions) {
        found.push({
          weight: DETECT_INVERSION_SCORE * DETECT_OMISSION_SCORE * weight,
          name: `${baseNote}${chordName}/${tonic}`,
        });
      } else if (isInversion) {
        found.push({
          weight: DETECT_INVERSION_SCORE * weight,
          name: `${baseNote}${chordName}/${tonic}`,
        });
      } else if (hasOmissions) {
        found.push({
          weight: DETECT_OMISSION_SCORE * weight,
          name: `${baseNote}${chordName}`,
        });
      } else {
        found.push({ weight, name: `${baseNote}${chordName}` });
      }
    });
  });

  return found;
}

type DetectOptions = {
  allowOmissions: boolean;
  disabledChords: string[];
};
/**
 * 根据音符列表检测可能的和弦名称，按匹配权重降序排列
 * @param source - 音符名称列表（如 ["C", "E", "G"]）
 * @param options - 检测选项，包括是否允许省略音和禁用的和弦别名
 * @returns 匹配的和弦名称列表（如 ["CM"]）
 */
export function detect(
  source: string[],
  options: Partial<DetectOptions> = {},
): string[] {
  const notes = source.map((n) => note(n).pc).filter((x) => x);
  if (notes.length === 0) {
    return [];
  }

  const found: FoundChord[] = findMatches(notes, 1, options);

  return found
    .filter((chord) => chord.weight)
    .sort((a, b) => b.weight - a.weight)
    .map((chord) => chord.name);
}

export default { detect };
