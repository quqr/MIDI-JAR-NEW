export interface ApiMidiInput {
  name: string;
  opened: boolean;
  connected: boolean;
  error: boolean;
}

export class MidiInputDevice {
  name: string;
  connected: boolean;
  opened: boolean;
  error: boolean;

  constructor(api: ApiMidiInput) {
    this.name = api.name;
    this.connected = api.connected;
    this.opened = api.opened;
    this.error = api.error;
  }

  toApi(): ApiMidiInput {
    return {
      name: this.name,
      opened: this.opened,
      connected: this.connected,
      error: this.error,
    };
  }
}
