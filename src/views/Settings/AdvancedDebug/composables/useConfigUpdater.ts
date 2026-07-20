import type { Ref } from 'vue'

/**
 * Creates a type-safe updater for a config object stored in a settings store.
 * Pattern: read current → spread → set key → call updateSetting(path, newObject)
 */
export function createConfigUpdater<T extends Record<string, unknown>>(
  getSetting: () => T,
  updateSetting: (path: string, value: T) => void,
  path: string,
) {
  return (key: keyof T, value: T[keyof T]) => {
    const current = { ...getSetting() } as T
    ;(current as Record<string, unknown>)[key as string] = value
    updateSetting(path, current)
  }
}

/**
 * Creates a type-safe updater for a nested config object.
 * Pattern: read current → spread → set key → call store.updateSetting(section, nestedKey, newObject)
 */
export function createNestedUpdater<T extends Record<string, unknown>>(
  getSetting: () => T,
  updateSetting: (section: string, key: string, value: unknown) => void,
  section: string,
  nestedKey: string,
) {
  return (key: keyof T, value: T[keyof T]) => {
    const current = { ...getSetting() } as T
    ;(current as Record<string, unknown>)[key as string] = value
    updateSetting(section, nestedKey, current)
  }
}
