import { getChordTypes, tokenizeChord } from "@/helpers";
import { levenshtein } from "@/helpers/array";
import { Chord } from "tonal";
import type { Chord as TChord } from "@tonaljs/chord";

export interface ChordSearchResult {
  chord: TChord;
  parts: [string, string];
  score: number; // lower is better: 0 = exact, 1+ = fuzzy
}

export function cleanupText(text: string) {
  if (!text) return "";

  const capitalized = text.charAt(0).toUpperCase() + text.slice(1);

  return capitalized
    .replace(/ /g, "")
    .replace(/♭/gi, "b")
    .replace(/♯/gi, "#")
    .replace(/maj/gi, "maj")
    .replace(/min/gi, "min")
    .replace(/sus/gi, "sus")
    .replace(/dom/gi, "dom")
    .replace(/dim/gi, "dim")
    .replace(/aug/gi, "aug")
    .replace(/add/gi, "add")
    .replace(/\^/g, "Δ")
    .replace(/°/g, "o");
}

function fuzzyScore(query: string, target: string): number {
  if (!query || !target) return Infinity;

  // Exact match
  if (target === query) return 0;

  // Starts with
  if (target.startsWith(query)) return 0.1 + (target.length - query.length) * 0.05;

  // Contains
  if (target.includes(query)) return 0.5 + (target.length - query.length) * 0.05;

  // Levenshtein distance normalized by target length
  const dist = levenshtein([...query], [...target]);
  const normalized = dist / Math.max(query.length, target.length);

  // Only accept if similarity is reasonable
  if (normalized <= 0.5) return 1 + normalized;

  return Infinity;
}

/**
 * Search chord types by alias/name without requiring a tonic.
 * Returns candidates with a default tonic "C" so they can be displayed.
 */
export function searchChordTypes(query: string): ChordSearchResult[] {
  if (!query || query.length < 1) return [];

  const q = query.toLowerCase().replace(/[#♯b♭]/g, (m) =>
    m === "♯" || m === "#" ? "#" : "b",
  );
  const results: ChordSearchResult[] = [];
  const seen = new Set<string>();

  for (const c of getChordTypes()) {
    let bestScore = Infinity;
    let bestAlias = "";

    for (const a of c.aliases) {
      const score = fuzzyScore(q, a.toLowerCase());
      if (score < bestScore) {
        bestScore = score;
        bestAlias = a;
      }
    }

    // Also match chord name
    if (c.name) {
      const nameScore = fuzzyScore(q, c.name.toLowerCase());
      if (nameScore < bestScore) {
        bestScore = nameScore;
        bestAlias = c.aliases[0];
      }
    }

    // Also match chord symbol (full name like "major", "minor seventh")
    if (c.aliases[0]) {
      const symScore = fuzzyScore(q, c.aliases[0].toLowerCase());
      if (symScore < bestScore) {
        bestScore = symScore;
        bestAlias = c.aliases[0];
      }
    }

    if (bestScore < Infinity && bestScore <= 1.5) {
      const chord = Chord.getChord(c.aliases[0], "C", "C");
      if (chord.empty) continue;
      const key = c.aliases[0];
      if (!seen.has(key)) {
        seen.add(key);
        results.push({
          chord,
          parts: ["C" + bestAlias.slice(0, q.length), bestAlias.slice(q.length) || bestAlias] as [string, string],
          score: bestScore,
        });
      }
    }
  }

  results.sort((a, b) => a.score - b.score);
  return results.slice(0, 12);
}

export function searchChords(searchText: string): ChordSearchResult[] {
  const cleaned = cleanupText(searchText);
  if (!cleaned) return [];

  try {
    const [tonic, type, root] = tokenizeChord(cleaned);

    // If tokenizeChord didn't recognize a tonic, fall back to type-only search
    if (!tonic) {
      return searchChordTypes(cleaned);
    }

    if (!type) {
      const chord = Chord.getChord("maj", tonic, root);
      if (chord) {
        return [{ chord, parts: [tonic, "maj"] as [string, string], score: 0 }];
      }
    }

    const results: ChordSearchResult[] = [];
    const seen = new Set<string>();

    // Phase 1: exact/prefix matches (original behavior)
    const exactMatches = getChordTypes().reduce<ChordSearchResult[]>((m, c) => {
      const match = c.aliases.reduce<string | undefined>((found, a) => {
        if (a === type) return a;
        if (!found && a.startsWith(type)) return a;
        return found;
      }, undefined);

      if (match) {
        const parts: [string, string] = [
          tonic + match.slice(0, type.length),
          match.slice(type.length),
        ];
        const chord = Chord.getChord(c.aliases[0], tonic, root);
        if (chord.tonic) {
          const key = chord.symbol;
          if (!seen.has(key)) {
            seen.add(key);
            m.push({ chord, parts, score: parts[1] ? 0.1 : 0 });
          }
        }
      }
      return m;
    }, []);

    results.push(...exactMatches);

    // Phase 2: fuzzy matches on aliases and chord names
    if (type.length >= 2) {
      for (const c of getChordTypes()) {
        let bestScore = Infinity;
        let bestAlias = "";

        for (const a of c.aliases) {
          const score = fuzzyScore(type, a);
          if (score < bestScore) {
            bestScore = score;
            bestAlias = a;
          }
        }

        if (c.name) {
          const nameScore = fuzzyScore(type, c.name.toLowerCase());
          if (nameScore < bestScore) {
            bestScore = nameScore;
            bestAlias = c.aliases[0];
          }
        }

        if (bestScore < Infinity && bestScore > 0.2) {
          const chord = Chord.getChord(c.aliases[0], tonic, root);
          if (chord.tonic) {
            const key = chord.symbol;
            if (!seen.has(key)) {
              seen.add(key);
              const parts: [string, string] = [
                tonic + bestAlias.slice(0, Math.min(bestAlias.length, type.length)),
                bestAlias,
              ];
              results.push({ chord, parts, score: bestScore });
            }
          }
        }
      }
    }

    // Sort: exact first, then by score
    results.sort((a, b) => a.score - b.score);

    return results.slice(0, 12);
  } catch (err) {
    // If tokenization fails entirely, try type-only search
    return searchChordTypes(cleaned);
  }
}
