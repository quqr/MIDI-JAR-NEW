export function isElectron(): boolean {
  return (
    typeof window !== "undefined" &&
    window.electronAPI != null &&
    typeof window.electronAPI === "object"
  );
}

export function getElectronAPI(): NonNullable<Window["electronAPI"]> {
  if (!isElectron()) {
    throw new Error("Not running in Electron environment");
  }
  return window.electronAPI!;
}

export function runInElectron<T>(fn: () => T, fallback?: T): T | undefined {
  if (isElectron()) {
    return fn();
  }
  return fallback;
}
