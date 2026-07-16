/**
 * 循环左移字符串：将前 shift 位字符移到末尾
 * @param str - 原始字符串
 * @param shift - 左移位数
 * @returns 旋转后的字符串
 */
export function stringRotate(str: string, shift: number) {
  const n = shift % str.length;
  const part1 = str.slice(0, n);
  const part2 = str.slice(n);
  return `${part2}${part1}`;
}
