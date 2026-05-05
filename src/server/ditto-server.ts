/**
 * @fileoverview Ditto 服务器类
 * @module server/DittoServer
 */

import type { DittoEvent, EventCallback } from '../events/event-emitter.js'
import type { ClipboardData, ClipboardFormatData } from '../types/clipboard-format.js'
import type { ServerOptions } from '../types/connection-options.js'
import type { SendInfo } from '../types/send-info.js'
import { Buffer } from 'node:buffer'
import net from 'node:net'
import process from 'node:process'
import { AESEncryption } from '../crypto/aes.js'
import { logger } from '../crypto/logger.js'
import { EventEmitter } from '../events/event-emitter.js'
import { FileReceiver } from '../protocol/file-receiver.js'
import { Serializer } from '../protocol/serializer.js'
import { ClipboardFormat } from '../types/clipboard-format.js'
import { MessageType } from '../types/message-type.js'
import { ENCRYPTED_SEND_INFO_SIZE } from '../types/send-info.js'

/**
 * @description 默认端口
 */
const DEFAULT_PORT = 23443

/**
 * @description 加密后的消息头大小
 * 对应 C++ 中的 ENCRYPTED_SIZE_CSENDINFO
 */
const ENCRYPTED_SIZE_CSENDINFO = ENCRYPTED_SEND_INFO_SIZE

/**
 * @description 服务器状态
 */
export enum ServerState {
  STOPPED = 'stopped',
  STARTING = 'starting',
  RUNNING = 'running',
  STOPPING = 'stopping',
}

/**
 * @description 客户端连接信息
 */
interface ClientInfo {
  ip: string
  computerName: string
  description: string
  manualSend: number
  respondPort: number
}

/**
 * @description 待接收的格式数据
 */
interface PendingFormat {
  cfType: number
  formatName: string
  data: Buffer
  dataWrite: number
}

/**
 * @description Ditto 服务器类
 * 用于监听并接收来自远程 Ditto 客户端的剪贴板数据
 */
export class DittoServer extends EventEmitter {
  private options: Required<ServerOptions>
  private server: net.Server | null = null
  private state: ServerState = ServerState.STOPPED
  private clients: Map<net.Socket, ClientHandler> = new Map()

  /**
   * @description 创建 DittoServer 实例
   * @param {ServerOptions} options - 服务器选项
   */
  constructor(options: ServerOptions) {
    super()

    this.options = {
      port: options.port || DEFAULT_PORT,
      bindIP: options.bindIP || '*',
      serverPort: options.serverPort || options.port || DEFAULT_PORT,
      password: options.password || '',
      extraPasswords: options.extraPasswords || [],
      autoSetClipboardIPs: options.autoSetClipboardIPs || [],
      useIPFromAccept: options.useIPFromAccept || false,
      allowFileTransfer: options.allowFileTransfer !== false,
      timeout: options.timeout || 10000,
    }

    logger.info(`DittoServer created, port: ${this.options.port}`)
  }

  /**
   * @description 获取当前服务器状态
   * @returns {ServerState} 服务器状态
   */
  getState(): ServerState {
    return this.state
  }

  /**
   * @description 检查服务器是否正在运行
   * @returns {boolean} 是否正在运行
   */
  isRunning(): boolean {
    return this.state === ServerState.RUNNING && this.server !== null
  }

  /**
   * @description 启动服务器
   * @returns {Promise<void>} 启动成功时 resolve
   */
  start(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.state === ServerState.RUNNING) {
        logger.warn('Server already running')
        resolve()
        return
      }

      if (this.state === ServerState.STARTING) {
        logger.warn('Server starting in progress')
        resolve()
        return
      }

      this.state = ServerState.STARTING
      logger.info(`Starting server on port ${this.options.port}...`)

      this.server = net.createServer()

      this.server.on('listening', () => {
        this.state = ServerState.RUNNING
        logger.info(`Server listening on port ${this.options.port}`)
        this.emit('connect')
        resolve()
      })

      this.server.on('close', () => {
        this.state = ServerState.STOPPED
        this.clients.clear()
        logger.info('Server stopped')
        this.emit('disconnect')
      })

      this.server.on('error', (err) => {
        logger.error(`Server error: ${err.message}`)
        this.state = ServerState.STOPPED
        this.emit('error', err)
        reject(err)
      })

      this.server.on('connection', (socket) => {
        this.handleConnection(socket)
      })

      const address = this.options.bindIP === '*' ? '0.0.0.0' : this.options.bindIP
      this.server.listen(this.options.port, address)
    })
  }

  /**
   * @description 处理新的客户端连接
   * @param {net.Socket} socket - 客户端 socket
   */
  private handleConnection(socket: net.Socket): void {
    const clientIP = socket.remoteAddress?.replace('::ffff:', '') || 'unknown'
    logger.info(`New connection from ${clientIP}`)

    const handler = new ClientHandler(socket, {
      ...this.options,
      onReceive: data => this.emit('receive', data),
      onFilesReceived: files => this.emit('filesReceived', files),
      onMessage: (type, info) => this.emit('message', type, info),
      onError: err => this.emit('error', err),
      onClose: () => {
        this.clients.delete(socket)
      },
    })

    this.clients.set(socket, handler)
    handler.start()
  }

  /**
   * @description 停止服务器
   * @returns {Promise<void>} 停止成功时 resolve
   */
  stop(): Promise<void> {
    return new Promise((resolve) => {
      if (!this.server) {
        this.state = ServerState.STOPPED
        resolve()
        return
      }

      this.state = ServerState.STOPPING
      logger.info('Stopping server...')

      for (const handler of this.clients.values()) {
        handler.stop()
      }
      this.clients.clear()

      this.server.close(() => {
        this.server = null
        this.state = ServerState.STOPPED
        logger.info('Server stopped')
        resolve()
      })
    })
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

/**
 * @description 客户端处理器
 * 处理单个客户端的协议交互
 */
class ClientHandler {
  private socket: net.Socket
  private options: Required<ServerOptions> & {
    onReceive: (data: ClipboardData) => void
    onFilesReceived: (files: import('../protocol/file-receiver.js').FileReceiveResult[]) => void
    onMessage: (type: MessageType, info: SendInfo) => void
    onError: (err: Error) => void
    onClose: () => void
  }

  private encryption: AESEncryption
  private buffer: Buffer = Buffer.alloc(0)
  private clientInfo: ClientInfo | null = null
  private clipboardData: ClipboardData | null = null
  private pendingFormat: PendingFormat | null = null
  private lastGoodPasswordIndex: number = -2
  private isReceivingData: boolean = false

  /**
   * @description 创建客户端处理器
   * @param {net.Socket} socket - 客户端 socket
   * @param {object} options - 选项
   */
  constructor(socket: net.Socket, options: typeof ClientHandler.prototype.options) {
    this.socket = socket
    this.options = options
    this.encryption = new AESEncryption()
  }

  /**
   * @description 开始处理客户端
   */
  start(): void {
    this.socket.setTimeout(this.options.timeout)

    this.socket.on('data', data => this.handleData(data))
    this.socket.on('close', () => this.handleClose())
    this.socket.on('error', err => this.handleError(err))
    this.socket.on('timeout', () => this.handleTimeout())
  }

  /**
   * @description 停止处理
   */
  stop(): void {
    this.socket.end()
  }

  /**
   * @description 处理接收到的数据
   * @param {Buffer} data - 接收到的数据
   */
  private handleData(data: Buffer): void {
    this.buffer = Buffer.concat([this.buffer, data])
    this.processBuffer()
  }

  /**
   * @description 处理缓冲区数据
   */
  private processBuffer(): void {
    while (true) {
      if (!this.isReceivingData) {
        // 等待完整的消息头（加密后 508 字节）
        if (this.buffer.length < ENCRYPTED_SIZE_CSENDINFO) {
          break
        }

        // 尝试解密消息头
        const headerData = this.buffer.slice(0, ENCRYPTED_SIZE_CSENDINFO)
        const decrypted = this.decryptData(headerData)

        if (!decrypted) {
          // 解密失败，跳过一个字节继续尝试
          this.buffer = this.buffer.slice(1)
          continue
        }

        try {
          const info = Serializer.deserialize(decrypted)
          this.handleMessage(info)
          this.buffer = this.buffer.slice(ENCRYPTED_SIZE_CSENDINFO)
        }
        catch (err) {
          logger.error(`Failed to deserialize message: ${err}`)
          this.buffer = this.buffer.slice(ENCRYPTED_SIZE_CSENDINFO)
        }
      }
      else {
        // 接收数据块
        if (this.pendingFormat && this.pendingFormat.data) {
          const needed = this.pendingFormat.data.length - this.pendingFormat.dataWrite
          if (this.buffer.length < needed) {
            break
          }

          this.buffer.copy(this.pendingFormat.data, this.pendingFormat.dataWrite, 0, needed)
          this.pendingFormat.dataWrite += needed
          this.buffer = this.buffer.slice(needed)

          if (this.pendingFormat.dataWrite >= this.pendingFormat.data.length) {
            // 数据接收完成，解密数据
            this.decryptPendingFormat()
            this.isReceivingData = false
          }
        }
        else {
          break
        }
      }
    }
  }

  /**
   * @description 解密数据（使用多密码尝试机制）
   * 对应 C++ 中的 CRecieveSocket::ReceiveEncryptedData
   * @param {Buffer} encrypted - 加密数据
   * @returns {Buffer | null} 解密后的数据
   */
  private decryptData(encrypted: Buffer): Buffer | null {
    const passwords = this.buildPasswordList()

    for (let i = 0; i < passwords.length; i++) {
      const result = this.encryption.decrypt(encrypted, passwords[i])
      if (result) {
        // 记住成功的密码索引
        this.lastGoodPasswordIndex = i
        return result.data
      }
    }

    logger.debug('Failed to decrypt with all passwords')
    return null
  }

  /**
   * @description 解密待处理的格式数据
   */
  private decryptPendingFormat(): void {
    if (!this.pendingFormat || !this.clipboardData) {
      return
    }

    const decrypted = this.decryptData(this.pendingFormat.data)
    if (decrypted) {
      const cfType = ClipboardFormat.getType(this.pendingFormat.formatName)
      const format: ClipboardFormatData = {
        cfType,
        formatName: ClipboardFormat.getName(cfType) ?? this.pendingFormat.formatName,
        data: decrypted,
      }
      this.clipboardData.formats.push(format)

      logger.debug(`DATA_END: ${format.formatName}, size: ${decrypted.length}`)
    }
    else {
      logger.warn('Failed to decrypt format data')
    }

    this.pendingFormat = null
  }

  /**
   * @description 构建密码列表（按优先级排序）
   * 对应 C++ 中的多密码尝试机制
   * @returns {string[]} 密码数组
   */
  private buildPasswordList(): string[] {
    const passwords: string[] = []

    // 首先尝试上次成功的密码
    if (this.lastGoodPasswordIndex >= 0 && this.lastGoodPasswordIndex < this.options.extraPasswords.length) {
      passwords.push(this.options.extraPasswords[this.lastGoodPasswordIndex])
    }

    // 然后尝试主密码
    if (this.options.password) {
      passwords.push(this.options.password)
    }

    // 最后尝试所有额外密码
    for (let i = 0; i < this.options.extraPasswords.length; i++) {
      const pwd = this.options.extraPasswords[i]
      if (!passwords.includes(pwd)) {
        passwords.push(pwd)
      }
    }

    return passwords
  }

  /**
   * @description 处理协议消息
   * @param {SendInfo} info - 消息头
   */
  private handleMessage(info: SendInfo): void {
    this.options.onMessage(info.m_Type, info)

    switch (info.m_Type) {
      case MessageType.START:
        this.handleStart(info)
        break
      case MessageType.DATA_START:
        this.handleDataStart(info)
        break
      case MessageType.DATA_END:
        this.handleDataEnd()
        break
      case MessageType.END:
        this.handleEnd()
        break
      case MessageType.EXIT:
        this.handleExit()
        break
      case MessageType.REQUEST_FILES:
        this.handleRequestFiles()
        break
    }
  }

  /**
   * @description 处理 START 消息
   * @param {SendInfo} info - 消息头
   */
  private handleStart(info: SendInfo): void {
    const clientIP = this.options.useIPFromAccept ? this.socket.remoteAddress?.replace('::ffff:', '') || '' : info.m_cIP

    this.clientInfo = {
      ip: clientIP,
      computerName: info.m_cComputerName,
      description: info.m_cDesc,
      manualSend: info.m_manualSend,
      respondPort: info.m_respondPort,
    }

    this.clipboardData = {
      description: this.clientInfo.description,
      formats: [],
    }

    const shouldAutoSet = this.options.autoSetClipboardIPs.some((ipOrName) => {
      return this.matchWildcard(ipOrName, clientIP) || this.matchWildcard(ipOrName, info.m_cComputerName)
    })

    if (shouldAutoSet) {
      logger.info(`Auto-set clipboard enabled for ${clientIP}`)
    }

    logger.info(`START: ${this.clientInfo.computerName} (${clientIP}) - ${this.clientInfo.description}`)
  }

  /**
   * @description 通配符匹配
   * @param {string} pattern - 模式（支持 * 和 ?）
   * @param {string} text - 待匹配文本
   * @returns {boolean} 是否匹配
   */
  private matchWildcard(pattern: string, text: string): boolean {
    const regexPattern = pattern
      .replace(/[.+^${}()|[\]\\]/g, '\\$&')
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.')
    return new RegExp(`^${regexPattern}$`, 'i').test(text)
  }

  /**
   * @description 处理 DATA_START 消息
   * @param {SendInfo} info - 消息头
   */
  private handleDataStart(info: SendInfo): void {
    const encryptedLength = info.m_lParameter1

    this.pendingFormat = {
      cfType: 0,
      formatName: info.m_cDesc,
      data: Buffer.alloc(encryptedLength),
      dataWrite: 0,
    }

    this.isReceivingData = true

    logger.debug(`DATA_START: ${info.m_cDesc}, encrypted size: ${encryptedLength}`)
  }

  /**
   * @description 处理 DATA_END 消息
   */
  private handleDataEnd(): void {
    // 数据已在 processBuffer 中接收并解密
    this.isReceivingData = false
  }

  /**
   * @description 处理 END 消息
   */
  private handleEnd(): void {
    logger.info('END: All formats received')
  }

  /**
   * @description 处理 EXIT 消息
   */
  private handleExit(): void {
    if (this.clipboardData && this.clipboardData.formats.length > 0) {
      logger.info(`EXIT: Received ${this.clipboardData.formats.length} formats`)
      this.options.onReceive(this.clipboardData)
    }

    this.clipboardData = null
    this.clientInfo = null
  }

  /**
   * @description 处理 REQUEST_FILES 消息
   */
  private async handleRequestFiles(): Promise<void> {
    if (this.options.allowFileTransfer && this.clientInfo) {
      logger.info('REQUEST_FILES: File transfer requested')

      try {
        const fileReceiver = new FileReceiver(this.socket, this.buildPasswordList(), process.cwd(), this.clientInfo.ip)

        const results = await fileReceiver.receiveFiles()
        this.options.onFilesReceived(results)
      }
      catch (error) {
        logger.error(`File receive failed: ${(error as Error).message}`)
        this.options.onError(error as Error)
      }
    }
  }

  /**
   * @description 处理连接关闭
   */
  private handleClose(): void {
    logger.info('Client disconnected')
    this.options.onClose()
  }

  /**
   * @description 处理错误
   * @param {Error} err - 错误
   */
  private handleError(err: Error): void {
    logger.error(`Client error: ${err.message}`)
    this.options.onError(err)
  }

  /**
   * @description 处理超时
   */
  private handleTimeout(): void {
    logger.warn('Client connection timeout')
    this.socket.destroy()
  }
}
