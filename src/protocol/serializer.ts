/**
 * @fileoverview 二进制序列化器（使用 typed-struct）
 * @module protocol/Serializer
 */

import type { Buffer } from 'node:buffer'
import type { MessageType } from '../types/message-type.js'
import type { SendInfo } from '../types/send-info.js'
import { Struct } from 'typed-struct'
import { logger } from '../crypto/logger.js'
import { SEND_INFO_SIZE } from '../types/send-info.js'

/**
 * @description SendInfo 结构体定义
 * 对应 C++ 中的 struct CSendInfo 内存布局
 * 使用 Buffer 类型处理字符串字段，避免 typed-struct 的异步初始化问题
 */
const SendInfoStruct = new Struct('SendInfo')
  .Int32LE('m_nSize')
  .Int32LE('m_Type')
  .Int32LE('m_nVersion')
  .String('m_cIP', 20)
  .String('m_cComputerName', 16)
  .String('m_cDesc', 250)
  .seek(2)
  .Int32LE('m_lParameter1')
  .Int32LE('m_lParameter2')
  .String('m_md5', 32)
  .Int8('m_manualSend')
  .seek(1)
  .Int16LE('m_respondPort')
  .String('m_cExtra', 15)
  .seek(1)
  .compile()

/**
 * @description SendInfo 序列化器
 * 用于将 SendInfo 结构与二进制数据相互转换
 */
export class Serializer {
  /**
   * @description 将 SendInfo 序列化为 Buffer
   * @param {SendInfo} info - SendInfo 对象
   * @returns {Buffer} 序列化的二进制数据
   */
  static serialize(info: SendInfo): Buffer {
    const instance = new SendInfoStruct()

    instance.m_nSize = info.m_nSize
    instance.m_Type = info.m_Type
    instance.m_nVersion = info.m_nVersion
    instance.m_cIP = info.m_cIP
    instance.m_cComputerName = info.m_cComputerName
    instance.m_cDesc = info.m_cDesc
    instance.m_lParameter1 = info.m_lParameter1
    instance.m_lParameter2 = info.m_lParameter2
    instance.m_md5 = info.m_md5
    instance.m_manualSend = info.m_manualSend
    instance.m_respondPort = info.m_respondPort
    instance.m_cExtra = info.m_cExtra

    return SendInfoStruct.raw(instance)
  }

  /**
   * @description 将二进制数据反序列化为 SendInfo
   * @param {Buffer} buffer - 二进制数据
   * @returns {SendInfo} SendInfo 对象
   * @throws {Error} 如果数据大小不正确
   */
  static deserialize(buffer: Buffer): SendInfo {
    if (buffer.length < SEND_INFO_SIZE) {
      throw new Error(
        `Invalid buffer size: expected at least ${SEND_INFO_SIZE}, got ${buffer.length}`,
      )
    }

    const instance = new SendInfoStruct(buffer)
    const m_nSize = instance.m_nSize

    if (m_nSize > buffer.length) {
      logger.warn(
        `Invalid m_nSize: ${m_nSize} exceeds buffer length ${buffer.length}`,
      )
    }

    return {
      m_nSize: instance.m_nSize,
      m_Type: instance.m_Type as MessageType,
      m_nVersion: instance.m_nVersion,
      m_cIP: instance.m_cIP,
      m_cComputerName: instance.m_cComputerName,
      m_cDesc: instance.m_cDesc,
      m_lParameter1: instance.m_lParameter1,
      m_lParameter2: instance.m_lParameter2,
      m_md5: instance.m_md5,
      m_manualSend: instance.m_manualSend,
      m_respondPort: instance.m_respondPort,
      m_cExtra: instance.m_cExtra,
    }
  }

  /**
   * @description 读取确切的字节数
   * @param {Buffer} buffer - 缓冲区
   * @param {Buffer} target - 目标缓冲区
   * @param {number} length - 读取长度
   * @param {number} offset - 偏移量
   * @returns {number} 实际读取的字节数
   */
  static readExact(
    buffer: Buffer,
    target: Buffer,
    length: number,
    offset: number,
  ): number {
    const available = buffer.length - offset
    const toRead = Math.min(length, available)

    buffer.copy(target, 0, offset, offset + toRead)
    return toRead
  }
}
