/** MIDI 输入设备的 API 层数据结构 */
export interface ApiMidiInput {
  name: string;
  opened: boolean;
  connected: boolean;
  error: boolean;
}

/** MIDI 输入设备，封装设备名称与连接状态信息 */
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
