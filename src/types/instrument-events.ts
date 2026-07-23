/**
 * 乐器加载相关的事件类型定义
 */

import { Event } from '@/utils/delegate';
import type { InstrumentInfo } from '@/stores/sampler';

// ============================================================================
// 事件参数类型
// ============================================================================

/** 加载开始事件参数 */
export interface InstrumentLoadStartArgs {
  instrumentId: string;
  instrument: InstrumentInfo;
}

/** 加载进度事件参数 */
export interface InstrumentLoadProgressArgs {
  instrumentId: string;
  /** 进度百分比 (0-100) */
  progress: number;
}

/** 加载成功事件参数 */
export interface InstrumentLoadSuccessArgs {
  instrumentId: string;
  instrument: InstrumentInfo;
  fromCache: boolean;
}

/** 加载失败事件参数 */
export interface InstrumentLoadErrorArgs {
  instrumentId: string;
  error: Error;
}

/** 缓存切换事件参数（从缓存中切换到已加载的乐器） */
export interface InstrumentCacheSwitchArgs {
  instrumentId: string;
}

/** 批量下载开始事件参数 */
export interface BatchDownloadStartArgs {
  total: number;
}

/** 批量下载进度事件参数 */
export interface BatchDownloadProgressArgs {
  completed: number;
  total: number;
  /** 进度百分比 (0-100) */
  progress: number;
  activeDownloads: string[];
}

/** 批量下载完成事件参数 */
export interface BatchDownloadCompleteArgs {
  succeeded: string[];
  failed: Array<{ id: string; error: string }>;
}

// ============================================================================
// 事件集合
// ============================================================================

/**
 * 乐器事件集合
 *
 * 事件流：
 * - 加载新乐器：loadStart → loadProgress* → loadSuccess / loadError
 * - 切换缓存乐器：cacheSwitch
 * - 批量下载：batchStart → (loadStart → loadProgress* → loadSuccess / loadError)* → batchProgress* → batchComplete
 */
export class InstrumentEvents {
  /** 加载开始 */
  readonly onLoadStart = new Event<InstrumentLoadStartArgs>();

  /** 加载进度 */
  readonly onLoadProgress = new Event<InstrumentLoadProgressArgs>();

  /** 加载成功 */
  readonly onLoadSuccess = new Event<InstrumentLoadSuccessArgs>();

  /** 加载失败 */
  readonly onLoadError = new Event<InstrumentLoadErrorArgs>();

  /** 缓存切换 */
  readonly onCacheSwitch = new Event<InstrumentCacheSwitchArgs>();

  /** 批量下载开始 */
  readonly onBatchStart = new Event<BatchDownloadStartArgs>();

  /** 批量下载进度 */
  readonly onBatchProgress = new Event<BatchDownloadProgressArgs>();

  /** 批量下载完成 */
  readonly onBatchComplete = new Event<BatchDownloadCompleteArgs>();
}
