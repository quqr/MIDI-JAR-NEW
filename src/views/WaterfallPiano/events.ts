/**
 * WaterfallPiano 模块事件定义
 *
 * 统一管理瀑布钢琴的所有事件，替代分散的回调接口。
 * 使用 C# 风格 Event<T> 实现多播、类型安全的事件通知。
 */

import { Event } from '@/utils/delegate';
import type { WaterfallEngine } from './engine/WaterfallEngine';
import type { NoteBlockMode } from './engine/NoteBlockSystem';

// ============================================================================
// 事件参数类型
// ============================================================================

/** 音符触发事件参数 */
export interface NoteOnArgs {
  midi: number;
  velocity: number;
}

/** 音符释放事件参数 */
export interface NoteOffArgs {
  midi: number;
}

/** 播放进度事件参数 */
export interface PlaybackProgressArgs {
  currentTime: number;
  duration: number;
}

/** 引擎就绪事件参数 */
export interface EngineReadyArgs {
  engine: WaterfallEngine;
}

/** 模式切换事件参数 */
export interface ModeChangeArgs {
  mode: NoteBlockMode;
}

/** MIDI 轨道就绪事件参数 */
export interface TracksReadyArgs {
  tracks: any[];
}

/** MIDI 文件加载完成事件参数 */
export interface MidiLoadedArgs {
  fileName: string;
  duration: number;
}

/** 定时音符就绪事件参数 */
export interface ScheduledNotesReadyArgs {
  notes: any[];
}

// ============================================================================
// 事件集合
// ============================================================================

/**
 * 瀑布钢琴事件集合
 *
 * 事件流：
 * - 键盘交互：noteOn → noteOff
 * - MIDI 播放：playbackStart → (noteOn → noteOff)* → playbackProgress* → playbackEnd
 * - 引擎生命周期：engineReady
 * - 模式：modeChange
 */
export class WaterfallPianoEvents {
  // ── 音符事件 ──
  /** 音符触发（键盘点击、MIDI 播放、Synthesia 命中） */
  readonly onNoteOn = new Event<NoteOnArgs>();

  /** 音符释放 */
  readonly onNoteOff = new Event<NoteOffArgs>();

  // ── 播放事件 ──
  /** 开始播放 */
  readonly onPlaybackStart = new Event();

  /** 暂停播放 */
  readonly onPlaybackPause = new Event();

  /** 停止播放 */
  readonly onPlaybackStop = new Event();

  /** 播放完毕（自然结束） */
  readonly onPlaybackEnd = new Event();

  /** 播放进度更新 */
  readonly onPlaybackProgress = new Event<PlaybackProgressArgs>();

  // ── 引擎事件 ──
  /** 引擎初始化完成 */
  readonly onEngineReady = new Event<EngineReadyArgs>();

  /** 模式切换（realtime / synthesia） */
  readonly onModeChange = new Event<ModeChangeArgs>();

  // ── MIDI 事件 ──
  /** MIDI 轨道信息就绪 */
  readonly onTracksReady = new Event<TracksReadyArgs>();

  /** MIDI 文件加载完成 */
  readonly onMidiLoaded = new Event<MidiLoadedArgs>();

  /** 定时音符就绪（供 NoteBlockSystem 消费） */
  readonly onScheduledNotesReady = new Event<ScheduledNotesReadyArgs>();

  // ── 录音事件 ──
  /** 开始录音 */
  readonly onRecordingStart = new Event();

  /** 停止录音 */
  readonly onRecordingStop = new Event();
}

/** 模块级共享实例 */
export const waterfallPianoEvents = new WaterfallPianoEvents();
