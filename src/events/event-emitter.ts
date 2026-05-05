/**
 * @fileoverview 事件发射器（Observer 模式实现）
 * @module events/EventEmitter
 */

import { logger } from '../crypto/logger.js'

/**
 * @description 事件回调函数类型
 */
export type EventCallback<T = unknown> = (...args: T[]) => void

/**
 * @description Ditto SDK 事件类型
 */
export type DittoEvent
  = | 'connect'
    | 'disconnect'
    | 'receive'
    | 'error'
    | 'message'
    | 'connectionerror'
    | 'sent'
    | 'filesReceived'

/**
 * @description 事件发射器类
 * 实现观察者模式，提供事件订阅和发布功能
 */
export class EventEmitter {
  private listeners: Map<DittoEvent, Set<EventCallback>>

  /**
   * @description 创建事件发射器实例
   */
  constructor() {
    this.listeners = new Map<DittoEvent, Set<EventCallback>>()
  }

  /**
   * @description 订阅事件
   * @param {DittoEvent} event - 事件名称
   * @param {EventCallback} callback - 回调函数
   * @returns {Function} 取消订阅的函数
   */
  on(event: DittoEvent, callback: EventCallback): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set<EventCallback>())
    }

    this.listeners.get(event)!.add(callback)
    logger.debug(`Event listener added: ${event}`)

    return () => this.off(event, callback)
  }

  /**
   * @description 订阅事件（一次性）
   * @param {DittoEvent} event - 事件名称
   * @param {EventCallback} callback - 回调函数
   */
  once(event: DittoEvent, callback: EventCallback): void {
    const wrappedCallback = ((...args: unknown[]) => {
      callback(...args)
      this.off(event, wrappedCallback)
    }) as EventCallback

    this.on(event, wrappedCallback)
  }

  /**
   * @description 取消订阅事件
   * @param {DittoEvent} event - 事件名称
   * @param {EventCallback} callback - 回调函数
   */
  off(event: DittoEvent, callback: EventCallback): void {
    const callbacks = this.listeners.get(event)
    if (callbacks) {
      callbacks.delete(callback)
      logger.debug(`Event listener removed: ${event}`)
    }
  }

  /**
   * @description 触发事件
   * @param {DittoEvent} event - 事件名称
   * @param {...unknown} args - 传递给回调的参数
   */
  emit(event: DittoEvent, ...args: unknown[]): void {
    const callbacks = this.listeners.get(event)
    if (callbacks && callbacks.size > 0) {
      logger.debug(`Event emitted: ${event} (${callbacks.size} listeners)`)
      for (const callback of callbacks) {
        try {
          callback(...args)
        }
        catch (error) {
          logger.error(`Error in event callback for ${event}: ${error}`)
        }
      }
    }
  }

  /**
   * @description 移除指定事件的所有监听器
   * @param {DittoEvent} event - 事件名称
   */
  removeAllListeners(event?: DittoEvent): void {
    if (event) {
      this.listeners.delete(event)
      logger.debug(`All listeners removed for event: ${event}`)
    }
    else {
      this.listeners.clear()
      logger.debug('All event listeners removed')
    }
  }

  /**
   * @description 获取指定事件的监听器数量
   * @param {DittoEvent} event - 事件名称
   * @returns {number} 监听器数量
   */
  listenerCount(event: DittoEvent): number {
    return this.listeners.get(event)?.size || 0
  }

  /**
   * @description 获取所有事件名称
   * @returns {DittoEvent[]} 事件名称数组
   */
  eventNames(): DittoEvent[] {
    return Array.from(this.listeners.keys()) as DittoEvent[]
  }
}
