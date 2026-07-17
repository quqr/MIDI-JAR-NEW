/**
 * Pino 日志系统 - 统一的日志管理工具
 *
 * 仅控制台输出，不实现文件持久化。
 * 开发环境使用 pino-pretty 格式化输出，生产环境仅输出 warn 及以上级别。
 *
 * 使用方式：
 *   import { createLogger } from '@/utils/logger';
 *   const logger = createLogger('MidiFilePlayer');
 *   logger.debug('Loading file:', filename);
 *   logger.info('File loaded successfully');
 *   logger.warn('Block pool running low');
 *   logger.error('Failed to load file:', error);
 */

import pino from "pino";

const logger = pino({
  level: import.meta.env.DEV ? "debug" : "warn",
  browser: { asObject: false },
});

/**
 * 创建带标签的子 logger
 * @param tag - 模块标签，用于区分日志来源
 * @returns pino 子 logger 实例
 */
export function createLogger(tag: string) {
  return logger.child({ tag });
}

export default logger;
