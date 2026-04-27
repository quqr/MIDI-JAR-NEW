/**
 * MIDI 路由配置
 * 定义 MIDI 输入到输出的连接规则
 */
export type MidiRoute = {
  // 输入设备名称
  input: string;
  // 输出设备名称
  output: string;
  // 输出类型：physical（物理设备）或 internal（内部模块）
  type: "physical" | "internal";
  // 路由是否启用
  enabled: boolean;
};

/**
 * MIDI 设备基础信息
 */
export type MidiDevice = {
  // 设备名称
  name: string;
  // 设备端口是否已打开
  opened: boolean;
  // 设备是否已连接（物理连接状态）
  connected: boolean;
  // 是否有错误
  error: boolean;
};

/**
 * MIDI 输入设备（继承基础设备类型）
 */
export type MidiInput = MidiDevice;

/**
 * MIDI 输出设备
 * 在基础设备类型上增加类型区分
 */
export type MidiOutput = MidiDevice & {
  // 输出类型：physical（物理 MIDI 设备）、internal（应用内部模块）、websocket（网络）
  type: "physical" | "internal" | "websocket";
};

/**
 * MIDI 连接线
 * 表示一个活动的 MIDI 路由连接
 */
export type MidiWire = {
  // 路由配置
  route: MidiRoute;
  // 连接是否已建立
  connected: boolean;
};

/**
 * 内部输出设备信息
 */
export type InternalOutputInfo = {
  // 设备名称
  name: string;
  // 命名空间路径数组
  namespace: string[];
};

/**
 * MIDI 消息类型
 * 三元组格式：[状态字节, 数据字节1, 数据字节2]
 */
export type MidiMessageType = [number, number, number];
