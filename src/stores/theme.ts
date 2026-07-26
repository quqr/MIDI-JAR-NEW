import { defineStore } from "pinia";
import { computed, ref, watchEffect } from "vue";
import { loadFromStorage, saveToStorage } from "@/helpers";
import { createLogger } from "@/utils/logger";

const logger = createLogger("ThemeStore");

const THEME_STORAGE_KEY = "midi-jar-theme";

export interface ThemeInfo {
  name: string;
  colorScheme: "light" | "dark";
}

export const themes: ThemeInfo[] = [
  { name: "light", colorScheme: "light" },
  { name: "dark", colorScheme: "dark" },
  { name: "cupcake", colorScheme: "light" },
  { name: "bumblebee", colorScheme: "light" },
  { name: "emerald", colorScheme: "light" },
  { name: "corporate", colorScheme: "light" },
  { name: "synthwave", colorScheme: "dark" },
  { name: "retro", colorScheme: "light" },
  { name: "cyberpunk", colorScheme: "dark" },
  { name: "valentine", colorScheme: "light" },
  { name: "halloween", colorScheme: "dark" },
  { name: "garden", colorScheme: "light" },
  { name: "forest", colorScheme: "dark" },
  { name: "aqua", colorScheme: "light" },
  { name: "lofi", colorScheme: "light" },
  { name: "pastel", colorScheme: "light" },
  { name: "fantasy", colorScheme: "light" },
  { name: "wireframe", colorScheme: "light" },
  { name: "black", colorScheme: "dark" },
  { name: "luxury", colorScheme: "dark" },
  { name: "dracula", colorScheme: "dark" },
  { name: "cmyk", colorScheme: "light" },
  { name: "autumn", colorScheme: "light" },
  { name: "business", colorScheme: "dark" },
  { name: "acid", colorScheme: "light" },
  { name: "lemonade", colorScheme: "light" },
  { name: "night", colorScheme: "dark" },
  { name: "coffee", colorScheme: "dark" },
  { name: "winter", colorScheme: "light" },
  { name: "dim", colorScheme: "dark" },
  { name: "nord", colorScheme: "dark" },
  { name: "sunset", colorScheme: "dark" },
  { name: "caramellatte", colorScheme: "light" },
  { name: "abyss", colorScheme: "dark" },
  { name: "silk", colorScheme: "light" },
];

const darkThemeNames = themes
  .filter((t) => t.colorScheme === "dark")
  .map((t) => t.name);

export function getThemes(): ThemeInfo[] {
  return themes;
}

export function isDarkTheme(themeName: string): boolean {
  return darkThemeNames.includes(themeName);
}

export const useThemeStore = defineStore("theme", () => {
  const defaultTheme = "light";
  const savedTheme = loadFromStorage<string>({
    key: THEME_STORAGE_KEY,
    defaultValue: defaultTheme,
  });
  const currentTheme = ref<string>(savedTheme);

  const isDark = computed(() => isDarkTheme(currentTheme.value));

  watchEffect(() => {
    document.documentElement.setAttribute("data-theme", currentTheme.value);
  });

  function setTheme(theme: string) {
    currentTheme.value = theme;
    saveToStorage(THEME_STORAGE_KEY, theme);
    document.documentElement.setAttribute("data-theme", theme);
    logger.info(`主题已切换为: ${theme}`);
  }

  function toggleTheme() {
    const newTheme = isDark.value ? defaultTheme : "dark";
    setTheme(newTheme);
  }

  return {
    currentTheme,
    isDark,
    setTheme,
    toggleTheme,
  };
});
