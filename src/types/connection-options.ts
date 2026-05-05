/**
 * @fileoverview 连接选项配置定义
 * @module types/ConnectionOptions
 */

import os from 'node:os'

/**
 * @description 客户端连接选项
 * 用于配置 DittoClient 的连接参数
 */
export interface ConnectionOptions {
  /**
   * 网络密码，用于加密通信
   * @description 必须与 Ditto 的网络密码匹配（默认为 "LetMeIn"）
   * 如果为空字符串，加密仍会使用 SHA-256(空字符串) 作为密钥
   */
  password: string

  /**
   * 连接超时时间（毫秒）
   * @default 10000
   */
  timeout?: number

  /**
   * 是否启用自动重连
   * @default false
   */
  autoReconnect?: boolean

  /**
   * 最大重连尝试次数
   * @default 3
   */
  maxReconnectAttempts?: number

  /**
   * 计算机名称
   * @default 自动获取当前计算机名
   */
  computerName?: string

  /**
   * 本地 IP 地址
   * @default 自动获取第一个非回环 IP
   */
  localIP?: string

  /**
   * 本地端口（用于设置 respondPort）
   * @default 23443
   */
  port?: number
}

/**
 * @description 服务器监听选项
 * 用于配置 DittoServer 的监听参数
 */
export interface ServerOptions {
  /**
   * 监听端口
   * @default 23443
   */
  port?: number

  /**
   * 绑定 IP 地址
   * @default '*' 表示绑定所有地址
   */
  bindIP?: string

  /**
   * 服务器自己的端口（用于设置 respondPort）
   * @default 与 port 相同
   */
  serverPort?: number

  /**
   * 网络密码，用于解密通信
   */
  password: string

  /**
   * 额外的网络密码数组（按顺序尝试解密）
   * @description 服务器会按顺序尝试使用这些密码解密，直到成功或全部失败
   */
  extraPasswords?: string[]

  /**
   * 自动设置到剪贴板的白名单 IP 列表
   * @description 匹配到的 IP 会自动将接收到的数据设置到系统剪贴板
   * @default []
   */
  autoSetClipboardIPs?: string[]

  /**
   * 是否使用 accept 返回的 IP 地址
   * @default false
   */
  useIPFromAccept?: boolean

  /**
   * 是否允许文件传输请求
   * @default true
   */
  allowFileTransfer?: boolean

  /**
   * 连接超时时间（毫秒）
   * @default 10000
   */
  timeout?: number
}

/**
 * @description 获取默认的计算机名称
 * @returns {string} 当前计算机的主机名
 */
export function getDefaultComputerName(): string {
  return os.hostname()
}

/**
 * @description 获取默认的本地 IP 地址
 * @returns {string} 第一个非回环网卡的 IP 地址
 */
export function getDefaultLocalIP(): string {
  const interfaces = os.networkInterfaces()
  for (const name of Object.keys(interfaces)) {
    const iface = interfaces[name]
    if (!iface)
      continue
    for (const info of iface) {
      if (info.family === 'IPv4' && !info.internal) {
        return info.address
      }
    }
  }
  return '127.0.0.1'
}
