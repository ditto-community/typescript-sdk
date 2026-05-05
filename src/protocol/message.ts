/**
 * @fileoverview 消息类定义
 * @module protocol/Message
 */

import type { SendInfo } from '../types/send-info.js'
import { MessageType } from '../types/message-type.js'

/**
 * @description 消息类
 * 表示一个完整的协议消息
 */
export class Message {
  /**
   * 消息头信息
   */
  public info: SendInfo

  /**
   * 消息类型
   */
  public type: MessageType

  /**
   * 构造时间戳
   */
  public timestamp: Date

  /**
   * @description 创建消息实例
   * @param {SendInfo} info - 消息头
   * @param {MessageType} type - 消息类型
   */
  constructor(info: SendInfo, type: MessageType) {
    this.info = info
    this.type = type
    this.timestamp = new Date()
  }

  /**
   * @description 获取消息类型的字符串描述
   * @returns {string} 消息类型名称
   */
  getTypeName(): string {
    return MessageType[this.type] || `UNKNOWN(${this.type})`
  }

  /**
   * @description 检查是否为数据消息
   * @returns {boolean} 是否为 DATA_START 或 DATA_END
   */
  isDataMessage(): boolean {
    return this.type === MessageType.DATA_START || this.type === MessageType.DATA_END
  }

  /**
   * @description 检查是否为结束消息
   * @returns {boolean} 是否为 END 或 EXIT
   */
  isEndMessage(): boolean {
    return this.type === MessageType.END || this.type === MessageType.EXIT
  }

  /**
   * @description 转换为字符串表示
   * @returns {string} 字符串表示
   */
  toString(): string {
    return `Message[type=${this.getTypeName()}, computer=${this.info.m_cComputerName}, desc=${this.info.m_cDesc}]`
  }
}
