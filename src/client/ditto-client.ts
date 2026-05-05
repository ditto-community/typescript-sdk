/**
 * @fileoverview Ditto 客户端类
 * @module client/DittoClient
 */

import type { DittoEvent, EventCallback } from '../events/event-emitter.js'
import type { ClipboardData, ClipboardFormatData } from '../types/clipboard-format.js'
import type { ConnectionOptions } from '../types/connection-options.js'
import type { SendInfo } from '../types/send-info.js'
import { Buffer } from 'node:buffer'
import net from 'node:net'
import { AESEncryption } from '../crypto/aes.js'
import { logger } from '../crypto/logger.js'
import { EventEmitter } from '../events/event-emitter.js'
import { FileSender } from '../protocol/file-sender.js'
import { createEndMessage, createExitMessage, createStartMessage, MessageBuilder } from '../protocol/message-builder.js'
import { Serializer } from '../protocol/serializer.js'
import { ClipboardFormatType } from '../types/clipboard-format.js'
import { getDefaultComputerName, getDefaultLocalIP } from '../types/connection-options.js'
import { MessageType } from '../types/message-type.js'
import { ENCRYPTED_SEND_INFO_SIZE } from '../types/send-info.js'

/**
 * @description 默认端口
 */
const DEFAULT_PORT = 23443

/**
 * @description 默认超时时间
 */
const DEFAULT_TIMEOUT = 10000

/**
 * @description 加密后的消息头大小
 * 对应 C++ 中的 ENCRYPTED_SIZE_CSENDINFO
 */
const ENCRYPTED_SIZE_CSENDINFO = ENCRYPTED_SEND_INFO_SIZE

/**
 * @description 连接状态
 */
export enum ConnectionState {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  DISCONNECTING = 'disconnecting',
}

/**
 * @description Ditto 客户端类
 * 用于连接到远程 Ditto 服务器并发送剪贴板数据
 */
export class DittoClient extends EventEmitter {
  private options: Required<ConnectionOptions>
  private socket: net.Socket | null = null
  private state: ConnectionState = ConnectionState.DISCONNECTED
  private encryption: AESEncryption
  private fileSender: FileSender | null = null
  private reconnectAttempts: number = 0

  /**
   * @description 创建 DittoClient 实例
   * @param {ConnectionOptions} options - 连接选项
   */
  constructor(options: ConnectionOptions) {
    super()

    this.options = {
      password: options.password || '',
      timeout: options.timeout || DEFAULT_TIMEOUT,
      autoReconnect: options.autoReconnect || false,
      maxReconnectAttempts: options.maxReconnectAttempts || 3,
      computerName: options.computerName || getDefaultComputerName(),
      localIP: options.localIP || getDefaultLocalIP(),
      port: options.port || DEFAULT_PORT,
    }

    this.encryption = new AESEncryption()

    logger.info(`DittoClient created with computerName: ${this.options.computerName}`)
  }

  /**
   * @description 获取当前连接状态
   * @returns {ConnectionState} 连接状态
   */
  getState(): ConnectionState {
    return this.state
  }

  /**
   * @description 检查是否已连接
   * @returns {boolean} 是否已连接
   */
  isConnected(): boolean {
    return this.state === ConnectionState.CONNECTED && this.socket !== null
  }

  /**
   * @description 连接到远程 Ditto 服务器
   * @param {string} host - 服务器地址（IP 或主机名）
   * @param {number} port - 服务器端口（默认 23443）
   * @returns {Promise<void>} 连接成功时 resolve
   */
  connect(host: string, port: number = DEFAULT_PORT): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.state === ConnectionState.CONNECTED) {
        logger.warn('Already connected')
        resolve()
        return
      }

      if (this.state === ConnectionState.CONNECTING) {
        logger.warn('Connection in progress')
        resolve()
        return
      }

      this.state = ConnectionState.CONNECTING
      logger.info(`Connecting to ${host}:${port}...`)

      this.socket = new net.Socket()

      this.socket.setTimeout(this.options.timeout)

      this.socket.on('connect', () => {
        this.state = ConnectionState.CONNECTED
        this.reconnectAttempts = 0
        this.fileSender = new FileSender(this.socket!, this.options.password)
        logger.info(`Connected to ${host}:${port}`)
        this.emit('connect')
        resolve()
      })

      this.socket.on('close', () => {
        const wasConnected = this.state === ConnectionState.CONNECTED
        this.state = ConnectionState.DISCONNECTED
        this.socket = null
        this.fileSender = null

        logger.info('Connection closed')

        if (wasConnected) {
          this.emit('disconnect')

          if (this.options.autoReconnect && this.reconnectAttempts < this.options.maxReconnectAttempts) {
            this.reconnectAttempts++
            logger.info(`Attempting to reconnect (${this.reconnectAttempts}/${this.options.maxReconnectAttempts})...`)
            setTimeout(() => this.connect(host, port).catch(() => {}), 1000)
          }
        }
      })

      this.socket.on('error', (err) => {
        logger.error(`Socket error: ${err.message}`)
        this.state = ConnectionState.DISCONNECTED
        this.emit('error', err)
        this.emit('connectionerror', err)
        reject(err)
      })

      this.socket.on('timeout', () => {
        logger.error('Connection timeout')
        this.socket?.destroy()
        this.state = ConnectionState.DISCONNECTED
        reject(new Error('Connection timeout'))
      })

      this.socket.connect(port, host)
    })
  }

  /**
   * @description 发送剪贴板数据
   * @param {ClipboardData} data - 剪贴板数据
   * @param {boolean} manualSend - 是否手动发送
   * @returns {Promise<void>} 发送成功时 resolve
   */
  async sendClipboard(data: ClipboardData, manualSend: boolean = false): Promise<void> {
    if (!this.isConnected()) {
      throw new Error('Not connected to server')
    }

    logger.info(`Sending clipboard data: ${data.description}`)

    // 设置响应端口（当端口不是默认 23443 时）
    const respondPort = this.options.port !== DEFAULT_PORT ? this.options.port : 0

    const startInfo = createStartMessage(
      this.options.computerName,
      this.options.localIP,
      data.description,
      manualSend,
      respondPort,
    )
    await this.sendCSendInfo(startInfo, MessageType.START)

    for (const format of data.formats) {
      await this.sendFormat(format)
    }

    const endInfo = createEndMessage()
    await this.sendCSendInfo(endInfo, MessageType.END)

    logger.info('Clipboard data sent successfully')
  }

  /**
   * @description 发送单个格式数据
   * @param {ClipboardFormatData} format - 格式数据
   * @returns {Promise<void>} 发送成功时 resolve
   */
  async sendFormat(format: ClipboardFormatData): Promise<void> {
    // 根据格式类型转换编码，确保与 C++ Ditto 兼容
    // C++ 使用 GlobalLock/GlobalSize 获取原始剪贴板字节：
    // - CF_UNICODETEXT: UTF-16LE（Windows 原生 Unicode 文本）
    // - CF_TEXT: ANSI/Latin1
    const preparedData = this.prepareFormatData(format)

    // 使用完整 TD_TLHEADER 加密
    const encrypted = this.encryption.encrypt(preparedData, this.options.password)

    const mb = new MessageBuilder()
      .setType(MessageType.DATA_START)
      .setParameter1(encrypted.length)
      .setDescription(format.formatName)

    const dataStartInfo = mb.build()

    await this.sendCSendInfo(dataStartInfo, MessageType.DATA_START)
    await this.sendExactSize(encrypted.data)

    const dataEndInfo = new MessageBuilder()
      .setType(MessageType.DATA_END)
      .setParameter1(encrypted.length)
      .setDescription(format.formatName)
      .build()

    await this.sendCSendInfo(dataEndInfo, MessageType.DATA_END)

    this.emit('sent', format)
  }

  /**
   * @description 根据格式类型准备数据，确保编码与 C++ Ditto 兼容
   *
   * C++ Client.cpp SendClipFormat 使用 GlobalLock/GlobalSize 获取剪贴板原始字节：
   * - CF_UNICODETEXT (13): 原始 UTF-16LE 字节（Windows 原生 Unicode 文本）
   * - CF_TEXT (1): 原始 ANSI/Latin1 字节
   *
   * Node.js 中用户通常传入 UTF-8 Buffer，需要转换为 C++ 期望的编码。
   *
   * @param {ClipboardFormatData} format - 格式数据
   * @returns {Buffer} 转换后的数据
   */
  private prepareFormatData(format: ClipboardFormatData): Buffer {
    const { cfType, data } = format

    switch (cfType) {
      case ClipboardFormatType.CF_UNICODETEXT: {
        // CF_UNICODETEXT: C++ 期望 UTF-16LE 编码，且必须以 \0\0 终止
        // Windows 剪贴板的 CF_UNICODETEXT 原始数据包含 null 终止符
        let utf16Data: Buffer

        if (this.isLikelyUTF16LE(data)) {
          utf16Data = data
        }
        else {
          const text = data.toString('utf8')
          utf16Data = Buffer.from(text, 'utf16le')
          logger.debug(`CF_UNICODETEXT: converted UTF-8(${data.length}B) -> UTF-16LE(${utf16Data.length}B)`)
        }

        // 确保以 \0\0 终止（C++ GlobalSize 返回的剪贴板数据包含终止符）
        if (utf16Data.length < 2
          || utf16Data[utf16Data.length - 2] !== 0
          || utf16Data[utf16Data.length - 1] !== 0) {
          const withNull = Buffer.alloc(utf16Data.length + 2)
          utf16Data.copy(withNull)
          logger.debug(`CF_UNICODETEXT: appended null terminator (${utf16Data.length}B -> ${withNull.length}B)`)
          return withNull
        }

        return utf16Data
      }

      case ClipboardFormatType.CF_TEXT: {
        // CF_TEXT: C++ 期望 ANSI/Latin1 编码，以 \0 终止
        const text = data.toString('utf8')
        const converted = Buffer.from(`${text}\0`, 'latin1')
        logger.debug(`CF_TEXT: converted UTF-8(${data.length}B) -> Latin1(${converted.length}B)`)
        return converted
      }

      case ClipboardFormatType.CF_OEMTEXT: {
        // CF_OEMTEXT: C++ 期望 OEM 编码，以 \0 终止
        // Node.js 不直接支持 OEM，作为 fallback 使用 Latin1（对于 ASCII 内容等效）
        const text = data.toString('utf8')
        const converted = Buffer.from(`${text}\0`, 'latin1')
        logger.debug(`CF_OEMTEXT: converted UTF-8(${data.length}B) -> Latin1(${converted.length}B)`)
        return converted
      }

      default:
        // 二进制格式（CF_BITMAP, CF_HDROP 等）不做转换
        return data
    }
  }

  /**
   * @description 检查 Buffer 是否可能是 UTF-16LE 编码
   * 启发式检测：偶数字节长度 + 包含大量零字节（UTF-16LE ASCII 字符高字节为 0）
   * @param {Buffer} data - 数据缓冲区
   * @returns {boolean} 是否可能是 UTF-16LE
   */
  private isLikelyUTF16LE(data: Buffer): boolean {
    // UTF-16LE 必须是偶数字节
    if (data.length % 2 !== 0 || data.length === 0) {
      return false
    }

    // 检查是否有 UTF-16LE 特征：ASCII 字符的高字节为 0
    // 采样前 100 个字节对
    const sampleSize = Math.min(data.length / 2, 100)
    let zeroHighByteCount = 0

    for (let i = 0; i < sampleSize; i++) {
      const lowByte = data[i * 2]
      const highByte = data[i * 2 + 1]

      // ASCII 可打印字符范围 (0x20-0x7E) 的高字节为 0
      if (lowByte >= 0x20 && lowByte <= 0x7E && highByte === 0) {
        zeroHighByteCount++
      }
    }

    // 如果超过 50% 的采样字节对符合 UTF-16LE ASCII 特征，认为是 UTF-16LE
    return zeroHighByteCount > sampleSize * 0.5
  }

  /**
   * @description 发送加密的消息头 (CSendInfo)
   * 对应 C++ 中的 CSendSocket::SendCSendData
   * 消息头加密后固定为 508 字节
   * @param {SendInfo} info - 消息头
   * @param {MessageType} type - 消息类型
   * @returns {Promise<void>} 发送成功时 resolve
   */
  private async sendCSendInfo(info: SendInfo, type: MessageType): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.socket) {
        reject(new Error('Socket not available'))
        return
      }

      info.m_Type = type

      // 序列化 SendInfo 为 Buffer
      const buffer = Serializer.serialize(info)

      // 使用完整 TD_TLHEADER 加密
      const encrypted = this.encryption.encrypt(buffer, this.options.password)

      logger.info(`sendCSendInfo: type=${MessageType[type]}, plaintext=${buffer.length}B, encrypted=${encrypted.length}B`)

      // 确保加密后的数据大小为 508 字节
      if (encrypted.length !== ENCRYPTED_SIZE_CSENDINFO) {
        logger.warn(`Encrypted SendInfo size mismatch: expected ${ENCRYPTED_SIZE_CSENDINFO}, got ${encrypted.length}`)
      }

      // 验证头部结构（诊断日志）
      const sig1 = encrypted.data.readUInt32LE(32)
      const sig2 = encrypted.data.readUInt32LE(36)
      logger.info(`Header: sig1=0x${sig1.toString(16)}, sig2=0x${sig2.toString(16)}, rounds=${encrypted.data.readUInt32LE(136)}`)
      logger.info(`Header hash: ${encrypted.data.slice(0, 32).toString('hex').substring(0, 32)}...`)
      logger.info(`Content hash: ${encrypted.data.slice(72, 104).toString('hex').substring(0, 32)}...`)

      this.socket.write(encrypted.data, (err) => {
        if (err) {
          logger.error(`Failed to send message: ${err.message}`)
          reject(err)
        }
        else {
          logger.info(`Message sent: ${MessageType[type]} (${encrypted.length} bytes)`)
          this.emit('message', type, info)
          resolve()
        }
      })
    })
  }

  /**
   * @description 发送确切的字节数
   * @param {Buffer} data - 数据缓冲区
   * @returns {Promise<void>} 发送成功时 resolve
   */
  private sendExactSize(data: Buffer): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.socket) {
        reject(new Error('Socket not available'))
        return
      }

      logger.info(`sendExactSize: sending ${data.length} bytes`)
      this.socket.write(data, (err) => {
        if (err) {
          logger.error(`sendExactSize write error: ${err.message}`)
          reject(err)
        }
        else {
          logger.info(`sendExactSize: sent ${data.length} bytes OK`)
          resolve()
        }
      })
    })
  }

  /**
   * @description 断开连接
   * @returns {Promise<void>} 断开成功时 resolve
   */
  disconnect(): Promise<void> {
    return new Promise((resolve) => {
      if (!this.socket) {
        this.state = ConnectionState.DISCONNECTED
        resolve()
        return
      }

      this.state = ConnectionState.DISCONNECTING

      const exitInfo = createExitMessage()
      this.sendCSendInfo(exitInfo, MessageType.EXIT)
        .catch(() => {})
        .finally(() => {
          this.socket?.end()
          this.socket = null
          this.state = ConnectionState.DISCONNECTED
          logger.info('Disconnected')
          this.emit('disconnect')
          resolve()
        })
    })
  }

  /**
   * @description 发送文件
   * @param {string[]} filePaths - 文件路径列表
   * @returns {Promise<import('../protocol/file-sender.js').FileSendResult[]>} 发送结果
   */
  async sendFiles(filePaths: string[]): Promise<import('../protocol/file-sender.js').FileSendResult[]> {
    if (!this.fileSender) {
      throw new Error('Not connected to server')
    }
    return this.fileSender.sendFiles(filePaths)
  }

  /**
   * @description 获取文件发送器
   * @returns {FileSender | null} 文件发送器实例
   */
  getFileSender(): FileSender | null {
    return this.fileSender
  }

  /**
   * @description 订阅事件
   * @param {DittoEvent} event - 事件名称
   * @param {EventCallback} callback - 回调函数
   * @returns {Function} 取消订阅函数
   */
  on(event: DittoEvent, callback: EventCallback): () => void {
    return super.on(event, callback)
  }

  /**
   * @description 订阅一次性事件
   * @param {DittoEvent} event - 事件名称
   * @param {EventCallback} callback - 回调函数
   */
  once(event: DittoEvent, callback: EventCallback): void {
    super.once(event, callback)
  }
}
