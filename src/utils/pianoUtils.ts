import type { PianoSettings } from "@/types";
import type { KeyboardSettings } from "@/types/settings";

/**
 * 将应用层 PianoSettings（"钢琴设置"页）映射为渲染器使用的 KeyboardSettings。
 *
 * 用途：作为所有 PianoKeyboard 渲染器的「全局默认键盘」基础 ——
 * 各模块（如 ChordDisplay 的模块级 keyboard）若另行指定，则优先于本默认值。
 *
 * 映射规则：
 * - from / to / keyName            → 直接透传
 * - showNoteNames + label          → label = showNoteNames ? label : "none"
 *                                     （KeyboardSettings 通过 label==="none" 推导 showNoteNames）
 * - keyCornerRadius                → sizes.radius
 * - useThemeColors === true        → skin 取主题基底（coral），colors.* 置 null 让主题色板生效
 * - useThemeColors === false       → skin 仍取 coral 基底以保持渐变质感，
 *                                    colors.white/black/played 使用 PianoSettings 的自定义颜色
 *
 * 注：PianoSettings.gradientIntensity 暂无 KeyboardSettings 对应字段，
 * 渲染器渐变由 theme 决定，故该字段目前不参与映射（保持向后兼容）。
 */
export function createKeyboardSettingsFromPiano(
  piano: PianoSettings,
): KeyboardSettings {
  const label = piano.showNoteNames ? piano.label : "none";

  // 主题基底：PianoSettings 当前不含主题选择器，统一以 coral 作为默认主题，
  // 既能让 useThemeColors=true 走主题色板，也能让自定义颜色附带 coral 渐变质感。
  const skin: KeyboardSettings["skin"] = "coral";

  const colors: KeyboardSettings["colors"] = piano.useThemeColors
    ? { white: null, black: null, played: null, wrapped: null, sustained: null }
    : {
        white: piano.whiteKeyColor,
        black: piano.blackKeyColor,
        played: piano.pressedKeyColor,
        wrapped: null,
        sustained: null,
      };

  return {
    skin,
    from: piano.from,
    to: piano.to,
    label,
    keyName: piano.keyName,
    keyInfo: "none",
    fadeOutDuration: 0,
    textOpacity: 1,
    displaySustained: true,
    wrap: false,
    sizes: {
      radius: piano.keyCornerRadius,
      height: 0,
      ratio: 0,
      bevel: false,
    },
    colors,
  };
}
