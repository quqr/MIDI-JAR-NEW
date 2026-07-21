# Ticket: .ripx 预置文件格式解析

**Label:** wayfinder:research
**Parent:** 001-map-ripplerx-port
**Status:** Resolved
**Blocked by:** (none)

---

## Question

RipplerX 使用 .ripx 作为预置文件格式。需要研究：

1. **文件格式已确认**：.ripx 是 JUCE ValueTree 的 XML 序列化 + 二进制编码。`getStateInformation` 将 ValueTree → XML → `copyXmlToBinary`；`setStateInformation` 用 `getXmlFromBinary` → XML → `ValueTree::fromXml`。参数存储为 `<PARAM id="xxx" value="yyy"/>` 节点。
2. **参数映射**：已从 PluginProcessor 构造函数提取完整参数清单（约 50+ 个参数），包含 ID、范围、默认值、skew factor 等。关键参数组：Mallet(6)、Resonator A(14)、Resonator B(14)、Noise(12)、Velocity(14)、Coupling(5)、Global(4)
3. **Web 环境加载**：需要在浏览器中解析 .ripx（二进制 → XML → 提取参数值）。需要实现 `getXmlFromBinary` 的逆操作。
4. **预设库**：RipplerX 有 28 个内置预设（Init、Harpsi、Harp、Sankyo、Tubes、Stars、DoorBell、Bells/Bells2、KeyRing、Sink、Cans、Gong、Bong、Marimba、Fight、Tabla/Tabla2、Strings、OldClock、Crystal、Ride/Ride2、Crash、Vibes、Flute、Fifths、Kalimba），全部为 JUCE 二进制嵌入的 XML 资源。
5. **用户采样**：预设文件可包含 Base64 编码的用户 Mallet 采样数据（waveform double 数组 → MemoryBlock → Base64）

这是 UI 控件和参数系统设计的前置条件。

## Resolution

### 1. .ripx 二进制格式已完全逆向

**格式布局：**

```
Offset  Size  Description
0x00    4     Magic Number: 0x21324356 (LE), 文件中为 56 43 32 21
0x04    4     XML 字符串长度 N (little-endian uint32)
0x08    N     UTF-8 编码的 XML 字符串
0x08+N  1     Null terminator (0x00)
```

- **无压缩**：标准 JUCE `copyXmlToBinary` 不做任何压缩
- **无现有 JS 解析器**：这是首个已知的 JavaScript 实现

### 2. JavaScript 解析器实现

```typescript
function parseRipx(buffer: ArrayBuffer): Record<string, number> {
  const view = new DataView(buffer);
  // 验证 magic number
  const magic = view.getUint32(0, true); // little-endian
  if (magic !== 0x21324356) throw new Error("Invalid .ripx file");
  // 读取 XML 长度
  const xmlLength = view.getUint32(4, true);
  // 提取 XML 字符串
  const xmlBytes = new Uint8Array(buffer, 8, xmlLength);
  const xmlString = new TextDecoder("utf-8").decode(xmlBytes);
  // 解析 XML
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlString, "text/xml");
  // 提取参数
  const params: Record<string, number> = {};
  const paramNodes = doc.querySelectorAll("PARAM");
  paramNodes.forEach((node) => {
    const id = node.getAttribute("id");
    const value = parseFloat(node.getAttribute("value") || "0");
    if (id) params[id] = value;
  });
  return params;
}
```

### 3. 参数值归一化映射

JUCE AudioProcessorValueTreeState 存储的是 0-1 归一化值。需要根据每个参数的范围和 skew factor 反归一化。完整参数清单已从 PluginProcessor 构造函数提取（约 50+ 个参数）。

### 4. 内置预设提取策略

28 个内置预设编译在 JUCE BinaryData 中（XML 格式）。移植方案：

- 从 RipplerX 仓库提取预设 XML 文件（在 `resources/` 目录或 CMake 的 BinaryData 配置中）
- 转换为 JSON 格式作为 Web 应用的静态资源
- 或直接保留 .ripx 格式，运行时用上述解析器加载

### 5. 用户采样数据处理

预设中可包含 Base64 编码的采样数据：

- 解码 Base64 → ArrayBuffer → Float64Array（每个 double 是一个采样点）
- 通过 MessagePort 传输到 AudioWorklet
