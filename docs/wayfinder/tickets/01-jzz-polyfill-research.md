# Ticket: JZZ Polyfill 在非 Chromium 浏览器上的实际能力

**Type**: research (AFK)
**Status**: closed
**Blocked by**: (none)

## Question

JZZ 库声称能在不支持 Web MIDI API 的浏览器上提供 polyfill。需要研究：

1. JZZ 的 polyfill 机制到底是什么？是真正的 MIDI 硬件访问还是仅软件模拟？
2. JZZ 在 Firefox 和 Safari 上的实际能力：能否枚举物理 MIDI 设备？能否收发 MIDI 消息？
3. JZZ 的 npm 包最后更新时间、社区活跃度、是否存在已知安全问题
4. 如果 JZZ polyfill 不能提供真实 MIDI 访问，是否需要回退到 banner 降级策略？
5. 是否存在其他替代方案（如 Web MIDI API shim、Jazz-Plugin 浏览器扩展）？

## Resolution

**JZZ 不是真正的硬件 MIDI polyfill。** 当 Web MIDI API 不可用时，JZZ 降级为纯软件 MIDI 引擎，无法访问物理设备。只有用户安装 Jazz-Plugin/浏览器扩展才能桥接到硬件。

关键发现：
- Firefox 108+ 已原生支持 Web MIDI API，JZZ 无额外硬件访问价值
- Safari 是唯一主要盲区，JZZ 唯一途径是让用户安装扩展（几乎不可行）
- JZZ npm 包 Snyk 标记为 "Inactive"，单人维护，19 个未解决 issue
- Firefox Jazz-MIDI 扩展已于 2025-04 下架
- 约 87%+ 桌面浏览器原生支持 Web MIDI API

**结论：直接使用原生 Web MIDI API + 轻量封装，不引入 JZZ。**

详细研究见：`docs/wayfinder/research/jzz-polyfill-research.md`
