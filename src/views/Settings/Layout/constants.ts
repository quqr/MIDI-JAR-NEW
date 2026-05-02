export type IconName =
  | "home"
  | "music"
  | "menu"
  | "settings"
  | "chevron-down"
  | "chevron-up"
  | "trash"
  | "clock"
  | "piano"
  | "help-circle"
  | "circle"
  | "book"
  | "swap"
  | "bug"
  | "cog"
  | "layers"
  | "midi"
  | "power"
  | "refresh"
  | "overlay"
  | "arrow-left"
  | "arrow-right"
  | "star"
  | "heart"
  | "info"
  | "warning"
  | "error"
  | "check"
  | "x"
  | "plus"
  | "minus"
  | "search"
  | "save"
  | "controller"
  | "server"
  | "github"
  | "copyright"
  | "routing"
  | "dictionary"
  | "circle-of-fifths"
  | "quiz"
  | "window"
  | "maximize"
  | "minimize"
  | "unmaximize"
  | "loading"
  | "pin"
  | "unpin"
  | "visible"
  | "hidden"
  | "reset"
  | "angle-up"
  | "angle-down"
  | "angle-left"
  | "angle-right"
  | "midi-error"
  | "pads"
  | "exclamation";

export interface NavItem {
  icon: IconName;
  to: string;
  labelKey: string;
}

export const navItems: NavItem[] = [
  { icon: "window", to: "/settings/general", labelKey: "settings.general" },
  { icon: "routing", to: "/settings/routing", labelKey: "settings.routing" },
  {
    icon: "music",
    to: "/settings/notation",
    labelKey: "settings.musicNotation",
  },
  {
    icon: "dictionary",
    to: "/settings/chord-dictionary",
    labelKey: "settings.chordDictionary",
  },
  { icon: "piano", to: "/settings/chords", labelKey: "settings.chordDisplay" },
  {
    icon: "circle-of-fifths",
    to: "/settings/circle-of-fifths",
    labelKey: "settings.circleOf5th",
  },
  { icon: "quiz", to: "/settings/quiz", labelKey: "settings.chordQuiz" },
  { icon: "bug", to: "/settings/debug", labelKey: "settings.debugger" },
  // {
  //   icon: "copyright",
  //   to: "/settings/licenses",
  //   labelKey: "settings.licenses.title",
  // },
  { icon: "info", to: "/settings/about", labelKey: "settings.about" },
];
