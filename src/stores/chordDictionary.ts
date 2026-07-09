import { defineStore } from "pinia";
import { computed } from "vue";
import { useSettingsStore } from "@/stores/settings";
import { ALIAS_NOTATION } from "@/helpers";

export const useChordDictionaryStore = defineStore("chordDictionary", () => {
  const settingsStore = useSettingsStore();

  const aliases = computed(() => {
    return new Map<string, string>(
      settingsStore.settings.chordDictionary.aliases,
    );
  });

  const defaultNotation = computed(() => {
    return settingsStore.settings.chordDictionary.defaultNotation;
  });

  const disabled = computed(() => {
    return settingsStore.settings.chordDictionary.disabled;
  });

  const interactive = computed(() => {
    return settingsStore.settings.chordDictionary.interactive;
  });

  const hideDisabled = computed(() => {
    return settingsStore.settings.chordDictionary.hideDisabled;
  });

  const filterInKey = computed(() => {
    return settingsStore.settings.chordDictionary.filterInKey;
  });

  const groupBy = computed(() => {
    return settingsStore.settings.chordDictionary.groupBy;
  });

  function addAlias(key: string, value: string): void {
    const currentAliases = [...settingsStore.settings.chordDictionary.aliases];
    const existingIndex = currentAliases.findIndex(([k]) => k === key);
    if (existingIndex >= 0) {
      currentAliases[existingIndex] = [key, value];
    } else {
      currentAliases.push([key, value]);
    }
    settingsStore.updateSetting("chordDictionary.aliases", currentAliases);
  }

  function removeAlias(key: string): void {
    const currentAliases =
      settingsStore.settings.chordDictionary.aliases.filter(([k]) => k !== key);
    settingsStore.updateSetting("chordDictionary.aliases", currentAliases);
  }

  function toggleDisabled(chordName: string): void {
    const currentDisabled = [
      ...settingsStore.settings.chordDictionary.disabled,
    ];
    const index = currentDisabled.indexOf(chordName);
    if (index >= 0) {
      currentDisabled.splice(index, 1);
    } else {
      currentDisabled.push(chordName);
    }
    settingsStore.updateSetting("chordDictionary.disabled", currentDisabled);
  }

  function setDefaultNotation(notation: "long" | "short" | "symbol"): void {
    settingsStore.updateSetting("chordDictionary.defaultNotation", notation);
  }

  function setInteractive(mode: "detect" | "play"): void {
    settingsStore.updateSetting("chordDictionary.interactive", mode);
  }

  function setHideDisabled(value: boolean): void {
    settingsStore.updateSetting("chordDictionary.hideDisabled", value);
  }

  function setFilterInKey(value: boolean): void {
    settingsStore.updateSetting("chordDictionary.filterInKey", value);
  }

  function setGroupBy(value: "none" | "quality" | "intervals"): void {
    settingsStore.updateSetting("chordDictionary.groupBy", value);
  }

  function isChordDisabled(chordName: string): boolean {
    return disabled.value.includes(chordName);
  }

  function resolveChordName(chordName: string): string {
    if (aliases.value.has(chordName)) {
      const alias = aliases.value.get(chordName)!;
      if (alias !== "") {
        return alias;
      }
    }
    return chordName;
  }

  function getPreferredAlias(chordAlias: string): string | null {
    const alias = aliases.value.get(chordAlias);
    return alias !== undefined ? alias : null;
  }

  function setPreferredAlias(chordAlias: string, preferredAlias: string): void {
    addAlias(chordAlias, preferredAlias);
  }

  function removePreferredAlias(chordAlias: string): void {
    removeAlias(chordAlias);
  }

  function isPreferredAlias(chordAlias: string, alias: string): boolean {
    return getPreferredAlias(chordAlias) === alias;
  }

  function getDefaultAliasIndex(): number {
    const notation =
      settingsStore.settings.chordDictionary.defaultNotation || "long";
    return ALIAS_NOTATION[notation];
  }

  function isDefaultAlias(chordAlias: string, index: number): boolean {
    return (
      getPreferredAlias(chordAlias) === null &&
      index === getDefaultAliasIndex()
    );
  }

  return {
    aliases,
    defaultNotation,
    disabled,
    interactive,
    hideDisabled,
    filterInKey,
    groupBy,
    addAlias,
    removeAlias,
    toggleDisabled,
    setDefaultNotation,
    setInteractive,
    setHideDisabled,
    setFilterInKey,
    setGroupBy,
    isChordDisabled,
    resolveChordName,
    getPreferredAlias,
    setPreferredAlias,
    removePreferredAlias,
    isPreferredAlias,
    getDefaultAliasIndex,
    isDefaultAlias,
  };
});
