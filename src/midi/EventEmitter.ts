import { logger } from "@/utils/logger";

/** 事件监听器函数类型 */
type EventListener = (...args: any[]) => void;

/**
 * 事件发射器基类
 * 提供事件的注册、移除、触发和清理功能
 * 采用 Map + Set 数据结构，确保同一监听器不会重复注册
 */
export class EventEmitter {
  // 存储所有事件监听器，key 为事件名，value 为监听器集合
  private listeners: Map<string, Set<EventListener>> = new Map();

  /**
   * 注册事件监听器
   * @param event - 事件名称
   * @param listener - 事件监听函数
   * @returns 返回 this 以支持链式调用
   */
  on(event: string, listener: EventListener): this {
    let listeners = this.listeners.get(event);
    if (!listeners) {
      listeners = new Set();
      this.listeners.set(event, listeners);
    }
    listeners.add(listener);
    return this;
  }

  /**
   * 移除指定的事件监听器
   * @param event - 事件名称
   * @param listener - 要移除的监听函数
   * @returns 返回 this 以支持链式调用
   */
  off(event: string, listener: EventListener): this {
    const listeners = this.listeners.get(event);
    if (listeners) {
      listeners.delete(listener);
    }
    return this;
  }

  /**
   * 触发指定事件，执行所有已注册的监听器
   * @param event - 事件名称
   * @param args - 传递给监听器的参数
   * @returns 如果有监听器被触发则返回 true，否则返回 false
   */
  emit(event: string, ...args: any[]): boolean {
    const listeners = this.listeners.get(event);
    if (listeners) {
      listeners.forEach((listener) => {
        try {
          listener(...args);
        } catch (e) {
          // 捕获单个监听器的错误，避免影响其他监听器
          logger.error(`Error in event listener for "${event}": ` + e);
        }
      });
      return true;
    }
    return false;
  }

  /**
   * 移除事件监听器
   * @param event - 可选，事件名称。若未指定则移除所有事件的所有监听器
   */
  removeAllListeners(event?: string): void {
    if (event) {
      this.listeners.delete(event);
    } else {
      this.listeners.clear();
    }
  }
}
