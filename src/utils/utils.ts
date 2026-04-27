export default class Utils {
  static getCurrentLocale(): string {
    // return navigator?.language?.split('-')[0] || 'en'
    return navigator?.language?.split("-")[0] || "zh";
  }
}

export const { getCurrentLocale } = Utils;
