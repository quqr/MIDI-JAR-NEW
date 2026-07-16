# MIDI Player Logic

## 架构总览

MIDI 播放涉及 4 个核心模块，按层级从上到下：

```
┌─────────────────────────────────────────────────┐
│  WaterfallPiano.vue  (Vue 组件层)                │
│  - 用户交互、状态管理、回调注册                      │
├─────────────────────────────────────────────────┤
│  MidiFilePlayer      (播放控制层)                 │
│  - MIDI 解析、Transport 时间轴、播放状态机          │
├─────────────────────────────────────────────────┤
│  WaterfallEngine     (引擎协调层)                 │
│  - 主循环(rAF)、子系统调度、音效触发                 │
├─────────────────────────────────────────────────┤
│  NoteBlockSystem     (方块渲染层)                 │
│  - 方块生命周期、触发判定、Canvas 渲染              │
└─────────────────────────────────────────────────┘
```

---

## 1. MIDI 文件加载

### 流程

```
用户选择文件 → onLoadMidi(file)
  → player.loadFile(file)
    → @tonejs/midi 解析 ArrayBuffer
    → extractTrackInfo()  提取轨道摘要
    → collectNotes()      收集所有音符，按时间排序
    → callbacks.onScheduledNotesReady(notes)
      → noteBlockSystem.scheduleSynthesiaNotes(notes)
    → callbacks.onTracksReady(tracks)
  → 切换模式为 synthesia
  → 更新 duration / currentTime
```

### ScheduledNote 数据结构

```typescript
interface ScheduledNote {
  midi: number; // MIDI 音符号 (0-127)
  velocity: number; // 力度 (0-127)
  time: number; // 命中时间（秒）
  duration: number; // 持续时间（秒）
  hand: "left" | "right" | "unknown"; // 左右手
  trackIndex: number; // 轨道索引
}
```

### collectNotes 逻辑

- 只处理含音符的轨道（`track.notes.length > 0`）
- 轨道 0 → 右手，轨道 1 → 左手，其余 → unknown
- 支持 `selectedTracks` 过滤
- 最终按 `time` 升序排序

---

## 2. 播放启动

### onPlay() 流程

```
onPlay()
  → ensureAudioReady()           // 处理浏览器自动播放策略
  → player.startPlayback()
    → resetPlaybackState()       // 清空 triggeredIndices / endedIndices
    → Tone.Transport.seconds = 0
    → Tone.Transport.start()     // 启动 Tone.js 时间轴
    → callbacks.onScheduledNotesReady(notes)  // 重新通知 NoteBlockSystem
  → noteBlockSystem.setTransportTime(0)
  → noteBlockSystem.setTransportPlaying(true)
```

### 关键时序

1. `startPlayback()` 先启动 Transport 并重置 NoteBlockSystem 状态
2. `setTransportPlaying(true)` 后，NoteBlockSystem 的 `updateSynthesia` 才会执行
3. 这确保了方块系统在第一个有效帧开始时状态是干净的

---

## 3. 主循环（每帧执行）

### WaterfallEngine.startLoop()

```
requestAnimationFrame(loop)
  ┌─ loop(now) ─────────────────────────────────────┐
  │  dt = now - lastTime                             │
  │  perfMonitor.recordFrame(dt)                     │
  │                                                  │
  │  ① frameCallback()                               │
  │     └→ player.tick()                             │
  │         ├→ 推进 triggeredIndices / endedIndices   │
  │         ├→ callbacks.onProgress(current, duration)│
  │         │   └→ noteBlockSystem.setTransportTime() │
  │         └→ 检测播放结束 / 循环                     │
  │                                                  │
  │  ② backgroundRenderer.render(now)                │
  │  ③ noteBlockSystem.update(dt / 1000)             │
  │  ④ noteBlockSystem.render()                      │
  │  ⑤ keyboardRenderer.render()                     │
  │                                                  │
  │  ⑥ 流体模拟（隔帧执行）                           │
  │     ├→ fluid.update()                            │
  │     ├→ 持续 splat（长按音符）                      │
  │     └→ blockCoverage（方块尾焰）                  │
  │                                                  │
  │  rAF(loop)                                       │
  └──────────────────────────────────────────────────┘
```

**执行顺序保证**：`frameCallback` 在 `noteBlockSystem.update` 之前调用，确保 `updateSynthesia` 使用最新的 `transportTime`。

---

## 4. MidiFilePlayer.tick() 详解

```typescript
tick(): void {
  const current = getCurrentTime();  // Tone.Transport.seconds * playbackSpeed

  // ① 遍历所有音符，触发新到达的
  for (note of notes) {
    if (note.time <= current && !triggeredIndices.has(i)) {
      triggeredIndices.add(i);
      callbacks.onNoteOn?.(midi, velocity, hand, trackIndex);
      // 注意：此回调当前未被 Vue 组件注册，仅用于外部扩展
    }
  }

  // ② 遍历所有音符，结束已过期的
  for (note of notes) {
    if (note.time + note.duration <= current && !endedIndices.has(i)) {
      endedIndices.add(i);
      callbacks.onNoteOff?.(midi);
      // 同样未被注册
    }
  }

  // ③ 报告进度
  callbacks.onProgress?.(current, duration);
  // → WaterfallPiano.vue 中注册：setTransportTime(current)

  // ④ 检测播放结束
  if (current >= duration) {
    if (loop) { Transport.seconds = 0; resetState(); }
    else      { Transport.stop(); callbacks.onPlaybackEnd?.(); }
  }
}
```

### 时间计算

```typescript
getCurrentTime(): Tone.Transport.seconds * playbackSpeed
```

- Tone.js Transport 基于 Web Audio API 时钟，精度高于 `performance.now()`
- `playbackSpeed` 通过调整 `Transport.bpm` 实现（`bpm = 120 * speed`）

---

## 5. NoteBlockSystem.updateSynthesia() 详解

这是方块系统的核心，每帧执行一次。

### 5.1 Seek 检测

```typescript
if (t < lastTransportTime - 0.1) {
  // 时间回退 > 0.1s → 全量重置
  synthesiaCursor = 0;
  synthesiaBlockMap.clear();
  triggeredSet.clear();
  triggeredNoteKeys.clear();
  activeMidiCount.clear();
  // 释放所有 synthesia 方块
}
lastTransportTime = t;
```

### 5.2 游标管理

```
synthesiaNotes: [n0, n1, n2, n3, n4, n5, ...]
                       ↑
                  synthesiaCursor
                  (已处理过的不再回溯)
```

**游标前移条件**：音符结束时间 + `lookAhead + duration + 1` 秒前 → 跳过

**游标重置条件**：`notes[cursor].time > t + lookAhead` → 回到 0（Seek 场景）

### 5.3 音符处理窗口

```
时间轴:  ←─────────────────────────────────────────→
          已结束     命中线      未来
           ←─────── t ────────→
         |<-- lookAhead -->|

  skip zone    process zone    break zone
(endOffset     (创建方块、      (timeUntilHit
 > lookAhead)   触发/结束)      > lookAhead)
```

每个音符的处理窗口 = `[time - lookAhead, time + duration + lookAhead]`

### 5.4 方块生命周期

```
首次遇到音符
  ├→ triggeredNoteKeys 中无记录 → 创建方块 (acquire)
  └→ triggeredNoteKeys 中有记录 → 跳过（防重复触发）

timeUntilHit <= 0 且 !triggered
  → triggered = true
  → triggeredNoteKeys.add(key)
  → addActiveMidi(midi)        // 引用计数 +1
  → callbacks.onNoteTrigger()  // 触发声音/高亮/流体

t >= note.time + note.duration 且 !ended
  → ended = true
  → removeActiveMidi(midi)     // 引用计数 -1
  → callbacks.onNoteEnd()      // 停止声音/清除高亮

方块落出屏幕 (blockTop > height * 1.5)
  → 从 active 移除
  → 从 synthesiaBlockMap 删除
  → release 回对象池
```

### 5.5 防重复触发机制

```
triggeredNoteKeys: Set<string>
  key = "${trackIndex}-${midi}-${time}"

方块回收后重建时：
  if (triggeredNoteKeys.has(key))
    → 跳过，不创建新方块，不触发回调
```

### 5.6 引用计数管理 triggeredSet

```
activeMidiCount: Map<midi, count>

addActiveMidi(midi):    count++ → triggeredSet.add(midi)
removeActiveMidi(midi): count-- → count==0 时 triggeredSet.delete(midi)
```

支持同一 MIDI 音符并发（如两个轨道同时弹 C4），只有全部结束后才从 `triggeredSet` 移除。

---

## 6. 触发链路（Synthesia 模式）

```
NoteBlockSystem.updateSynthesia()
  │ timeUntilHit <= 0
  ↓
callbacks.onNoteTrigger(midi, velocity, hand)
  │ (注册于 WaterfallEngine.init)
  ↓
WaterfallEngine.onSynthesiaTrigger(midi, velocity)
  ├→ soundEngine.noteOn(midi, velocity)        // 发声
  ├→ keyboardRenderer.highlightNote(midi)      // 键盘高亮
  ├→ fluidSplat(midi, velocity)                // 流体喷射
  └→ hitExplosionSplat(midi, velocity)         // 命中爆炸（可选）

NoteBlockSystem.updateSynthesia()
  │ t >= note.time + note.duration
  ↓
callbacks.onNoteEnd(midi)
  │
  ↓
WaterfallEngine.onSynthesiaEnd(midi)
  ├→ soundEngine.noteOff(midi)                 // 停声
  └→ keyboardRenderer.clearHighlight(midi)     // 清除高亮
```

---

## 7. 方块渲染

### 坐标系统

```
Canvas 坐标系:
  (0,0) ───────→ (width, 0)
    │
    │  瀑布区域
    │
  (0, height) ← 命中线位置

block.y    = 方块底部 Y 坐标
block.y - h = 方块顶部 Y 坐标
```

### 位置计算

```typescript
// synthesia 模式
block.y = this.height - timeUntilHit * pps;
// timeUntilHit > 0 → y < height → 方块在命中线上方
// timeUntilHit < 0 → y > height → 方块在命中线下方（已过）

block.height = note.duration * pps;
// pps = settings.particles.speed * 100
```

### 渲染细节

- 方块颜色：`noteToColor(midi, colorScheme, hand, customColors)`
- 触发时增亮：`brightenColor(baseColor, 0.4)` + 白色外框发光
- 黑键方块宽度 = 白键宽度 × 0.6 × 0.9
- 白键方块宽度 = 白键宽度 × 0.85

---

## 8. 对象池

```typescript
const POOL_MAX = 512;

acquire(): NoteBlock {
  return pool.pop() ?? new NoteBlock();
}

release(b: NoteBlock): void {
  b.active = false;
  if (pool.length < POOL_MAX) pool.push(b);
}
```

避免频繁 GC，对高音符密度的 MIDI 文件尤为重要。

---

## 9. Realtime 模式 vs Synthesia 模式

| 特性     | Realtime                               | Synthesia                    |
| -------- | -------------------------------------- | ---------------------------- |
| 方块方向 | 从底部向上生长                         | 从顶部向下跌落               |
| 触发时机 | 用户按下键盘/点击                      | transportTime 到达 note.time |
| 方块来源 | `playRealtimeNote()`                   | `updateSynthesia()` 自动创建 |
| 释放方式 | `releaseRealtimeNote()` → 方块向上滑出 | 方块自动跌出屏幕底部         |
| 音源     | 外部 MIDI 输入 / 键盘点击              | MidiFilePlayer 驱动          |
| 命中线   | 方块顶部触碰                           | 方块底部触碰                 |

---

## 10. 诊断日志

播放时控制台输出格式：

```
[NBS] Trigger: midi=60, time=1.25s, key=0-60-1.25     // 音符触发
[NBS] t=2.00s active=15 created=3 triggered=3           // 每秒摘要
      skipped=0 reuse-skip=5 triggeredKeys=20 midiActive=8
[NBS] Seek backward detected: 5.00s → 1.00s             // Seek 事件
```

| 字段            | 含义                                        |
| --------------- | ------------------------------------------- |
| `active`        | 当前活跃方块数                              |
| `created`       | 本帧新建方块数                              |
| `triggered`     | 本帧触发回调数                              |
| `skipped`       | 被 endOffset > lookAhead 跳过的音符数       |
| `reuse-skip`    | 因 triggeredNoteKeys 命中而跳过的回收方块数 |
| `triggeredKeys` | 累计已触发音符 key 总数                     |
| `midiActive`    | 当前活跃 MIDI 音符数（引用计数 > 0）        |
