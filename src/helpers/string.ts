export function stringRotate(str: string, shift: number) {
  const n = shift % str.length;
  const part1 = str.slice(0, n);
  const part2 = str.slice(n);
  return `${part2}${part1}`;
}
