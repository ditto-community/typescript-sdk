/**
 * @fileoverview 通信消息头结构定义
 * @module types/SendInfo
 */

import { MessageType } from './message-type.js'

/**
 * @description CSendInfo 结构体大小（字节）
 * 字段大小: 4+4+4+20+16+250+4+4+32+1+2+15 = 356 // NOTE: needs add 4 padding. which is 356 + 4 = 360
 */
export const SEND_INFO_SIZE = 360

/**
 * @description 加密后的 CSendInfo 大小
 * 加密后大小 = 140 (TD_TLHEADER, #pragma pack(1)) + 368 (356 填充到 16 倍数) = 508
 * 对应 C++ 中的 ENCRYPTED_SIZE_CSENDINFO = 508
 */
export const ENCRYPTED_SEND_INFO_SIZE = 508

/**
 * @description CSendInfo 结构体
 * 对应 C++ 中的 struct CSendInfo，用于网络通信的消息头
 */
export interface SendInfo {
  /**
   * 结构体大小
   */
  m_nSize: number

  /**
   * 消息类型
   */
  m_Type: MessageType

  /**
   * 版本号（固定为 1）
   */
  m_nVersion: number

  /**
   * 发送方 IP（UTF-8 编码，最大 20 字节）
   */
  m_cIP: string

  /**
   * 计算机名（UTF-8 编码，MAX_COMPUTERNAME_LENGTH + 1 = 16 字节）
   */
  m_cComputerName: string

  /**
   * 描述/格式名称（UTF-8 编码，最大 250 字节）
   */
  m_cDesc: string

  /**
   * 参数1（如加密数据长度）
   */
  m_lParameter1: number

  /**
   * 参数2（保留）
   */
  m_lParameter2: number

  /**
   * MD5 校验（未使用，32 字节）
   */
  m_md5: string

  /**
   * 是否手动发送（0/1）
   */
  m_manualSend: number

  /**
   * 响应端口
   */
  m_respondPort: number

  /**
   * 保留字段（15 字节）
   */
  m_cExtra: string
}

/**
 * @description 创建默认的 SendInfo 实例
 * @returns {SendInfo} 默认初始化的 SendInfo
 */
export function createDefaultSendInfo(): SendInfo {
  return {
    m_nSize: SEND_INFO_SIZE,
    m_Type: MessageType.START,
    m_nVersion: 1,
    m_cIP: '',
    m_cComputerName: '',
    m_cDesc: '',
    m_lParameter1: 0,
    m_lParameter2: 0,
    m_md5: '',
    m_manualSend: 0,
    m_respondPort: 0,
    m_cExtra: '',
  }
}
