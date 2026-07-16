/**
 * 工具类
 */
export default class Utils {
  /**
   * 获取浏览器当前语言的主标签（如 "zh"、"en"），无法获取时默认为 "zh"
   * @returns 语言主标签
   */
  static getCurrentLocale(): string {
    // return navigator?.language?.split('-')[0] || 'en'
    return navigator?.language?.split("-")[0] || "zh";
  }
}

export const { getCurrentLocale } = Utils;
