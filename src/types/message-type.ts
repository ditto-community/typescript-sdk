/**
 * @fileoverview 消息类型枚举定义
 * @module types/MessageType
 */

/**
 * @description Ditto 网络协议消息类型枚举
 * 对应 C++ 中的 MyEnums::eSendType
 */
export enum MessageType {
  /**
   * 开始传输，发送方信息
   */
  START = 0,

  /**
   * 数据传输（未使用）
   */
  DATA = 1,

  /**
   * 数据块开始，包含数据长度和格式
   */
  DATA_START = 2,

  /**
   * 数据块结束，确认格式数据接收完成
   */
  DATA_END = 3,

  /**
   * 传输结束，所有格式数据已发送
   */
  END = 4,

  /**
   * 退出连接
   */
  EXIT = 5,

  /**
   * 请求文件（用于 CF_HDROP 格式）
   */
  REQUEST_FILES = 6,
}

/**
 * @description 获取消息类型的字符串名称
 * @param {MessageType} type - 消息类型
 * @returns {string} 消息类型的字符串名称
 */
export function getMessageTypeName(type: MessageType): string {
  return MessageType[type] || `UNKNOWN(${type})`
}
