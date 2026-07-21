# Ticket: 全局音源服务架构设计

**Label:** wayfinder:grilling
**Parent:** 010-map-audio-smplr
**Status:** Open
**Blocked by:** 011-smplr-api-research

---

## Question

基于 011-smplr-api-research 的研究结果,需要设计全局音源服务的架构:

1. **服务设计**: 全局音源服务应该提供哪些 API 方法?(加载音色、播放音符、停止音符、切换音色、获取状态等)
2. **状态管理**: 使用 Pinia store 还是简单的 composable 函数?状态应该包含哪些字段?(当前音色、加载状态、缓存信息等)
3. **生命周期**: 音源服务何时初始化?在 App.vue 还是路由守卫中?如何确保 AudioContext 已启动?
4. **音色切换**: 如何实现平滑的音色切换?是否需要保留前一个音色的余音?
5. **缓存策略**: 哪些数据应该缓存到 IndexedDB?(音色元数据、音频数据、用户配置)缓存的生命周期是什么?
6. **错误处理**: 音色加载失败时如何降级?(回退到 Tone.js?显示错误提示?)
7. **并发控制**: 多个视图同时请求播放音符时如何处理?是否有优先级?
8. **与现有系统集成**: 如何让瀑布钢琴和 RipplerX 使用全局音源服务?需要修改哪些现有代码?

## Resolution

基于研究结果和用户访谈,确定架构方案:

### 1. 服务设计

全局音源服务提供以下 API 方法:

```typescript
interface SamplerService {
  // 音色管理
  loadInstrument(instrumentId: string): Promise<void>;
  switchInstrument(instrumentId: string): Promise<void>;
  getCurrentInstrument(): string | null;

  // 音符控制
  playNote(note: number, velocity?: number, duration?: number): void;
  stopNote(note: number): void;
  stopAllNotes(): void;

  // 状态查询
  getLoadProgress(): { loaded: number; total: number };
  isLoading(): boolean;
  isReady(): boolean;

  // 缓存管理
  clearCache(instrumentId?: string): Promise<void>;
  getCacheSize(): Promise<number>;

  // 用户音色库
  exportLibrary(): Promise<Blob>;
  importLibrary(file: File): Promise<void>;
}
```

### 2. 状态管理

采用**混合方案**:Pinia store 管理状态,composable 封装逻辑

**Pinia Store (`useSamplerStore`)**:

```typescript
interface SamplerState {
  currentInstrument: string | null;
  instruments: Map<string, InstrumentInfo>;
  loadProgress: Map<string, LoadProgress>;
  cacheSize: number;
  userLibrary: UserInstrument[];
}
```

**Composable (`useSamplerService`)**:

- 封装 smplr 实例的创建和管理
- 提供响应式的 API 方法
- 处理错误和降级逻辑

### 3. 生命周期

- **初始化时机**: 在 App.vue 的 onMounted 中初始化
- **AudioContext**: 复用现有的 useAudioContext,确保用户交互后启动
- **预加载**: 用户首次访问时预加载默认音色(如钢琴)

### 4. 音色切换

- 平滑切换:新音色加载完成后立即切换
- 保留余音:stopAllNotes() 在切换前调用
- 切换提示:显示加载进度,防止用户误操作

### 5. 缓存策略

使用 **CacheStorage API**(smplr 内置) + IndexedDB 补充:

- **音频数据**: CacheStorage(smplr 自动管理)
- **用户配置**: IndexedDB(当前音色、用户音色库列表)
- **缓存策略**: LRU,限制总大小(如 500MB)

### 6. 错误处理

```typescript
try {
  await samplerService.loadInstrument("marimba");
} catch (error) {
  // 1. 回退到默认音色(已缓存)
  // 2. 显示错误提示
  // 3. 记录日志
  await fallbackToCachedInstrument();
  showErrorToast("音色加载失败");
}
```

### 7. 并发控制

- 单例模式:全局唯一 AudioContext 和 sampler 实例
- 队列管理:音符请求进入队列,防止重复加载
- 优先级:用户手动播放 > 自动播放 > 背景播放

### 8. 与现有系统集成

**瀑布钢琴**:

```typescript
// 修改 WaterfallPiano.vue
const samplerService = useSamplerService();
const playNote = (note: number) => {
  if (settingsStore.useSampler) {
    samplerService.playNote(note);
  } else {
    toneSynth.triggerAttack(note);
  }
};
```

**RipplerX**:

```typescript
// 新增音源选项
const audioSourceOptions = [
  { label: "Modal DSP", value: "modal" },
  { label: "Sampler", value: "sampler" },
  { label: "Tone.js", value: "tone" },
];
```

### SFZ/SF2 处理

**暂不支持** SFZ/SF2 格式,仅使用 smpldsnds 内置音色库。后续可考虑添加转换工具。
