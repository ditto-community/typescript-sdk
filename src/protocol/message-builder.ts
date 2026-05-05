/**
 * @fileoverview 消息构建器（Builder 模式）
 * @module protocol/MessageBuilder
 */

import type { SendInfo } from '../types/send-info.js'
import { MessageType } from '../types/message-type.js'
import { createDefaultSendInfo, SEND_INFO_SIZE } from '../types/send-info.js'

/**
 * @description 消息构建器类
 * 使用 Builder 模式创建复杂的 SendInfo 对象
 */
export class MessageBuilder {
  private info: SendInfo

  /**
   * @description 创建 MessageBuilder 实例
   */
  constructor() {
    this.info = createDefaultSendInfo()
  }

  /**
   * @description 设置消息类型
   * @param {MessageType} type - 消息类型
   * @returns {MessageBuilder} 自身（支持链式调用）
   */
  setType(type: MessageType): MessageBuilder {
    this.info.m_Type = type
    return this
  }

  /**
   * @description 设置发送方 IP
   * @param {string} ip - IP 地址
   * @returns {MessageBuilder} 自身（支持链式调用）
   */
  setIP(ip: string): MessageBuilder {
    this.info.m_cIP = ip.slice(0, 19)
    return this
  }

  /**
   * @description 设置计算机名
   * @param {string} computerName - 计算机名称
   * @returns {MessageBuilder} 自身（支持链式调用）
   */
  setComputerName(computerName: string): MessageBuilder {
    this.info.m_cComputerName = computerName.slice(0, 255)
    return this
  }

  /**
   * @description 设置描述
   * @param {string} desc - 描述文本
   * @returns {MessageBuilder} 自身（支持链式调用）
   */
  setDescription(desc: string): MessageBuilder {
    this.info.m_cDesc = desc.slice(0, 249)
    return this
  }

  /**
   * @description 设置参数1（通常用于加密数据长度）
   * @param {number} param - 参数1
   * @returns {MessageBuilder} 自身（支持链式调用）
   */
  setParameter1(param: number): MessageBuilder {
    this.info.m_lParameter1 = param
    return this
  }

  /**
   * @description 设置参数2
   * @param {number} param - 参数2
   * @returns {MessageBuilder} 自身（支持链式调用）
   */
  setParameter2(param: number): MessageBuilder {
    this.info.m_lParameter2 = param
    return this
  }

  /**
   * @description 设置是否为手动发送
   * @param {boolean} manual - 是否手动发送
   * @returns {MessageBuilder} 自身（支持链式调用）
   */
  setManualSend(manual: boolean): MessageBuilder {
    this.info.m_manualSend = manual ? 1 : 0
    return this
  }

  /**
   * @description 设置响应端口
   * @param {number} port - 端口号
   * @returns {MessageBuilder} 自身（支持链式调用）
   */
  setRespondPort(port: number): MessageBuilder {
    this.info.m_respondPort = port
    return this
  }

  /**
   * @description 设置 MD5 校验值
   * @param {string} md5 - MD5 字符串
   * @returns {MessageBuilder} 自身（支持链式调用）
   */
  setMD5(md5: string): MessageBuilder {
    this.info.m_md5 = md5.slice(0, 31)
    return this
  }

  /**
   * @description 设置额外字段
   * @param {string} extra - 额外字段
   * @returns {MessageBuilder} 自身（支持链式调用）
   */
  setExtra(extra: string): MessageBuilder {
    this.info.m_cExtra = extra.slice(0, 14)
    return this
  }

  /**
   * @description 构建 SendInfo
   * @returns {SendInfo} 生成的 SendInfo 对象
   */
  build(): SendInfo {
    this.info.m_nSize = SEND_INFO_SIZE
    return { ...this.info }
  }

  /**
   * @description 重置构建器
   * @returns {MessageBuilder} 自身
   */
  reset(): MessageBuilder {
    this.info = createDefaultSendInfo()
    return this
  }

  /**
   * @description 将 SendInfo 转换为 JSON 字符串
   * @returns {string} JSON 字符串
   */
  toString(): string {
    return JSON.stringify(this.info)
  }
}

/**
 * @description 创建默认的 START 消息
 * @param {string} computerName - 计算机名
 * @param {string} ip - IP 地址
 * @param {string} desc - 描述
 * @param {boolean} manualSend - 是否手动发送
 * @param {number} respondPort - 响应端口
 * @returns {SendInfo} SendInfo 对象
 */
export function createStartMessage(
  computerName: string,
  ip: string,
  desc: string,
  manualSend: boolean = false,
  respondPort: number = 0,
): SendInfo {
  return new MessageBuilder()
    .setType(MessageType.START)
    .setComputerName(computerName)
    .setIP(ip)
    .setDescription(desc)
    .setManualSend(manualSend)
    .setRespondPort(respondPort)
    .build()
}

/**
 * @description 创建默认的 END 消息
 * @returns {SendInfo} SendInfo 对象
 */
export function createEndMessage(): SendInfo {
  return new MessageBuilder().setType(MessageType.END).build()
}

/**
 * @description 创建默认的 EXIT 消息
 * @returns {SendInfo} SendInfo 对象
 */
export function createExitMessage(): SendInfo {
  return new MessageBuilder().setType(MessageType.EXIT).build()
}
