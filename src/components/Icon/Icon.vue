<template>
  <svg
    :class="['icon inline-block align-middle flex-shrink-0', `icon-${size}`]"
    :style="{ width: computedSize, height: computedSize }"
    viewBox="0 0 24 24"
    fill="none"
    :stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    v-bind="$attrs"
  >
    <path :d="iconPath" />
  </svg>
</template>

<script setup lang="ts">
import { computed } from "vue";

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
  | "exclamation"
  | "cursor"
  | "check-circle"
  | "eye"
  | "lock"
  | "unlock";

const props = withDefaults(
  defineProps<{
    name: IconName;
    size?: string | number;
  }>(),
  {
    size: 20,
  },
);

const currentColor = "currentColor";

const computedSize = computed(() => {
  if (typeof props.size === "number") return `${props.size}px`;
  return props.size;
});

const iconPath = computed((): string => {
  const paths: Record<IconName, string> = {
    home: "M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9z M9 22V12h6v10",
    music:
      "M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z",
    menu: "M4 6h16M4 12h16M4 18h16",
    settings:
      "M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z M12 12m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0",
    "chevron-down": "M6 9l6 6 6-6",
    "chevron-up": "M18 15l-6-6-6 6",
    trash:
      "M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14M10 11v6M14 11v6",
    clock:
      "M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2S2 6.477 2 12s4.477 10 10 10zM12 6v6l4 2",
    piano:
      "M2 8V20h20V8H2zm2 0h3v5H4V8zm5 0h3v5H9V8zm5 0h3v5h-3V8zm5 0h3v5h-3V8z",
    "help-circle":
      "M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2S2 6.477 2 12s4.477 10 10 10zM9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3M12 17h.01",
    circle:
      "M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2S2 6.477 2 12s4.477 10 10 10z",
    book: "M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2zM22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z",
    swap: "M7 16V4m0 0L3 8m4-4l4 4M17 8v12m0 0l4-4m-4 4l-4-4",
    bug: "M8 2l1.88 1.88M14.12 3.88L16 2M9 7.13v-1a3.003 3.003 0 1 1 6 0v1M12 20c-3.3 0-6-2.7-6-6v-3a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v3c0 3.3-2.7 6-6 6zM12 20v-9M6.53 9C4.6 8.8 3 7.1 3 5M6 13H2v3h4M6 19l-2 2M17.47 9c1.93-.2 3.53-1.9 3.53-4M18 13h4v3h-4M18 19l2 2M12 8V2",
    cog: "M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2S2 6.477 2 12s4.477 10 10 10zM12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z",
    layers: "M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5",
    midi: "M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z",
    power: "M18.36 6.64a9 9 0 1 1-12.73 0M12 2v10",
    refresh:
      "M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15",
    overlay: "M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5",
    "arrow-left": "M19 12H5M12 19l-7-7 7-7",
    "arrow-right": "M5 12h14M12 5l7 7-7 7",
    star: "M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z",
    heart:
      "M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z",
    info: "M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2S2 6.477 2 12s4.477 10 10 10zM12 16v-4M12 8h.01",
    warning:
      "M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4M12 17h.01",
    error:
      "M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4M12 17h.01",
    check: "M20 6L9 17l-5-5",
    x: "M18 6L6 18M6 6l12 12",
    plus: "M12 5v14M5 12h14",
    minus: "M5 12h14",
    search: "M21 21l-6-6m2-5a7 7 0 1 1-14 0 7 7 0 0 1 14 0z",
    save: "M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2zM17 21v-8H7v8M7 3v5h8",
    controller:
      "M6 12h4M8 10v4M15 11h.01M18 14h.01M22 12a5 5 0 1 1-10 0 5 5 0 0 1 10 0zM2 12a5 5 0 1 1 10 0 5 5 0 0 1-10 0z",
    server:
      "M2 12h20M2 6h20M2 18h20M6 12v6M10 12v6M14 12v6M18 12v6M4 6l2 6M8 6l2 6M12 6l2 6M16 6l2 6M20 6l-2 6M4 18l2-6M8 18l2-6M12 18l2-6M16 18l2-6M20 18l-2-6",
    github:
      "M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.17 6.839 9.49.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.604-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.464-1.11-1.464-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.564 9.564 0 0 1 12 6.844c.85.004 1.705.115 2.504.337 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.31.678.92.678 1.852 0 1.338-.012 2.419-.012 2.747 0 .267.18.578.688.48C19.138 20.167 22 16.418 22 12c0-5.523-4.477-10-10-10z",
    copyright:
      "M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2S2 6.477 2 12s4.477 10 10 10zM14.5 11.5a2.5 2.5 0 0 0-4.96-.5C9.5 11 9.5 13 9.5 13s0 2 .04 2a2.5 2.5 0 0 0 4.96-.5",
    routing: "M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5",
    dictionary:
      "M4 19.5A2.5 2.5 0 0 1 6.5 17H20M4 19.5A2.5 2.5 0 0 0 4 17V5a2 2 0 0 1 2-2h14v14H6.5A2.5 2.5 0 0 0 4 19.5zM8 7h8M8 11h6",
    "circle-of-fifths":
      "M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2S2 6.477 2 12s4.477 10 10 10zM12 2v4M12 18v4M2 12h4M18 12h4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83",
    quiz: "M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2S2 6.477 2 12s4.477 10 10 10zM9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3M12 17h.01",
    window: "M3 3h18v18H3zM3 9h18M9 21V9",
    maximize:
      "M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3",
    minimize: "M4 14h6v6H4zM14 4h6v6h-6zM4 4h6v6H4zM14 14h6v6h-6z",
    unmaximize: "M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7",
    loading:
      "M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83",
    pin: "M12 17v5M9 3h6l-1 7h3l-4 4-4-4h3L9 3z",
    unpin: "M12 17v5M9 3h6l-1 7h3l-4 4-4-4h3L9 3zM4 4l16 16",
    visible:
      "M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z",
    hidden:
      "M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24M1 1l22 22",
    reset:
      "M1 4v6h6M23 20v-6h-6M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15",
    "angle-up": "M18 15l-6-6-6 6",
    "angle-down": "M6 9l6 6 6-6",
    "angle-left": "M15 18l-6-6 6-6",
    "angle-right": "M9 18l6-6-6-6",
    "midi-error":
      "M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z M4 4l16 16",
    pads: "M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z",
    exclamation:
      "M12 9v4M12 17h.01M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z",
    cursor: "M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z",
    "check-circle": "M22 11.08V12a10 10 0 1 1-5.93-9.14M22 4L12 14.01l-3-3",
    eye: "M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z",
    lock: "M16 8h1a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h1V6a4 4 0 0 1 8 0v2zm-4 6v2",
    unlock: "M8 11V7a4 4 0 1 1 8 0M7 11h10a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-6a2 2 0 0 1 2-2z",
  };
  return paths[props.name] || paths.home;
});
</script>
