/** MIDI 输出设备的 API 层数据结构 */
export interface ApiMidiOutput {
  name: string;
  type: string;
  opened: boolean;
  connected: boolean;
  error: boolean;
}

/** MIDI 输出设备，封装设备名称、类型与连接状态信息 */
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
