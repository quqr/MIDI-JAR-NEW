import { ChordDisplaySettings, defaultChordDisplaySettings } from "@/types";

export class FieldError extends Error {
  fields: Record<string, string>;

  constructor(fields: Record<string, string>) {
    super("One or more fields contains errors");
    this.fields = fields;
  }
}

export const transformModuleName = (name: string) => {
  return name
    .replace(/[^a-zA-Z0-9-_]/g, "-")
    .replace(/-+/g, "-")
    .toLowerCase();
};

export function addModule(
  name: string,
  chordDisplay: ChordDisplaySettings[],
  settings: ChordDisplaySettings = defaultChordDisplaySettings,
) {
  const id = transformModuleName(name);

  if (!id) {
    // i18n key：settings.chordDisplaySettings.cannotBeEmpty
    throw new FieldError({ name: "cannotBeEmpty" });
  }

  if (chordDisplay.find((module) => module.id === id)) {
    // i18n key：settings.chordDisplaySettings.alreadyExists
    throw new FieldError({ name: "alreadyExists" });
  }

  const moduleSettings = { ...settings, id };

  return [...chordDisplay, moduleSettings];
}
