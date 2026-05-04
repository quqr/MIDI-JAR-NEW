export interface ApiMidiOutput {
  name: string;
  type: string;
  opened: boolean;
  connected: boolean;
  error: boolean;
}

export class MidiOutputDevice {
  name: string;
  type: string;
  connected: boolean;
  opened: boolean;
  error: boolean;

  constructor(api: ApiMidiOutput) {
    this.name = api.name;
    this.type = api.type;
    this.connected = api.connected;
    this.opened = api.opened;
    this.error = api.error;
  }

  toApi(): ApiMidiOutput {
    return {
      name: this.name,
      type: this.type,
      opened: this.opened,
      connected: this.connected,
      error: this.error,
    };
  }
}
