export const range = (min: number, max: number) =>
  Array(max - min + 1)
    .fill(null)
    .map((_v, n) => n + min);

export const randomPick = <T>(arr: readonly T[]): T =>
  arr[(Math.random() * arr.length) >> 0];

export const levenshtein = <T>(s: readonly T[], t: readonly T[]) => {
  const d = [] as number[][];

  const n = s.length;
  const m = t.length;

  if (n === 0) return m;
  if (m === 0) return n;

  for (let i = n; i >= 0; i -= 1) d[i] = [];

  for (let i = n; i >= 0; i -= 1) d[i][0] = i;
  for (let j = m; j >= 0; j -= 1) d[0][j] = j;

  for (let i = 1; i <= n; i += 1) {
    const sI = s[i - 1];

    for (let j = 1; j <= m; j += 1) {
      if (i === j && d[i][j] > 4) return n;

      const tJ = t[j - 1];
      const cost = sI === tJ ? 0 : 1;

      let mi = d[i - 1][j] + 1;
      const b = d[i][j - 1] + 1;
      const c = d[i - 1][j - 1] + cost;

      if (b < mi) mi = b;
      if (c < mi) mi = c;

      d[i][j] = mi;

      if (i > 1 && j > 1 && sI === t[j - 2] && s[i - 2] === tJ) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + cost);
      }
    }
  }

  return d[n][m];
};
