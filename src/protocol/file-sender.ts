/**
 * @fileoverview 文件发送器
 * @module protocol/FileSender
 */

import type { SendInfo } from '../types/send-info.js'
import { Buffer } from 'node:buffer'
import { createHash } from 'node:crypto'
import { open, stat } from 'node:fs/promises'
import { basename } from 'node:path'
import { AESEncryption } from '../crypto/aes.js'
import { logger } from '../crypto/logger.js'
import { MessageType } from '../types/message-type.js'
import { createDefaultSendInfo } from '../types/send-info.js'
import { MessageBuilder } from './message-builder.js'
import { Serializer } from './serializer.js'

/**
 * @description 文件传输块大小 (64KB)
 * 对应 C++ 中的 CHUNK_WRITE_SIZE
 */
const CHUNK_SIZE = 65536

/**
 * @description 文件信息
 */
interface FileInfo {
  path: string
  name: string
  size: number
  mtime: Date
}

/**
 * @description 文件发送结果
 */
export interface FileSendResult {
  success: boolean
  fileName: string
  fileSize: number
  md5: string
  error?: string
}

/**
 * @description 文件发送器
 * 对应 C++ 中的 CFileSend
 */
export class FileSender {
  private socket: import('node:net').Socket
  private encryption: AESEncryption
  private password: string

  /**
   * @description 创建 FileSender 实例
   * @param {import('net').Socket} socket - TCP Socket
   * @param {string} password - 加密密码
   */
  constructor(socket: import('node:net').Socket, password: string) {
    this.socket = socket
    this.encryption = new AESEncryption()
    this.password = password
  }

  /**
   * @description 发送多个文件
   * @param {string[]} filePaths - 文件路径列表
   * @returns {Promise<FileSendResult[]>} 发送结果列表
   */
  async sendFiles(filePaths: string[]): Promise<FileSendResult[]> {
    logger.info(`Sending ${filePaths.length} files`)

    const results: FileSendResult[] = []

    // 发送 START 消息（文件数量）
    const startInfo = new MessageBuilder()
      .setType(MessageType.START)
      .setParameter1(filePaths.length)
      .build()
    await this.sendCSendInfo(startInfo, MessageType.START)

    // 逐个发送文件
    for (let i = 0; i < filePaths.length; i++) {
      const result = await this.sendFile(filePaths[i], i + 1, filePaths.length)
      results.push(result)
    }

    // 发送 END 消息
    const endInfo = createDefaultSendInfo()
    await this.sendCSendInfo(endInfo, MessageType.END)

    logger.info(`All ${filePaths.length} files sent`)
    return results
  }

  /**
   * @description 发送单个文件
   * @param {string} filePath - 文件路径
   * @param {number} index - 当前文件索引
   * @param {number} total - 文件总数
   * @returns {Promise<FileSendResult>} 发送结果
   */
  private async sendFile(
    filePath: string,
    index: number,
    total: number,
  ): Promise<FileSendResult> {
    try {
      const fileInfo = await this.getFileInfo(filePath)
      logger.info(`Sending file ${index}/${total}: ${fileInfo.name} (${fileInfo.size} bytes)`)

      // 发送 DATA_START 消息（文件名和大小）
      const dataStartInfo = new MessageBuilder()
        .setType(MessageType.DATA_START)
        .setDescription(fileInfo.name)
        .setParameter1(fileInfo.size)
        .build()
      await this.sendCSendInfo(dataStartInfo, MessageType.DATA_START)

      // 分块读取并发送文件数据
      const md5Hash = createHash('md5')
      const fileHandle = await open(filePath, 'r')

      try {
        let offset = 0
        while (offset < fileInfo.size) {
          const chunkSize = Math.min(CHUNK_SIZE, fileInfo.size - offset)
          const buffer = Buffer.alloc(chunkSize)
          const { bytesRead } = await fileHandle.read(buffer, 0, chunkSize, offset)

          if (bytesRead === 0)
            break

          const chunk = buffer.subarray(0, bytesRead)
          md5Hash.update(chunk)
          await this.sendExactSize(chunk)

          offset += bytesRead
        }
      }
      finally {
        await fileHandle.close()
      }

      // 发送 DATA_END 消息（MD5 和修改时间）
      const md5 = md5Hash.digest('hex')
      const dataEndInfo = new MessageBuilder()
        .setType(MessageType.DATA_END)
        .setMD5(md5)
        .setParameter1(Math.floor(fileInfo.mtime.getTime() / 1000))
        .setParameter2((fileInfo.mtime.getTime() % 1000) * 1000)
        .build()
      await this.sendCSendInfo(dataEndInfo, MessageType.DATA_END)

      logger.info(`File sent: ${fileInfo.name}, MD5: ${md5}`)

      return {
        success: true,
        fileName: fileInfo.name,
        fileSize: fileInfo.size,
        md5,
      }
    }
    catch (error) {
      const errMsg = (error as Error).message
      logger.error(`Failed to send file ${filePath}: ${errMsg}`)
      return {
        success: false,
        fileName: basename(filePath),
        fileSize: 0,
        md5: '',
        error: errMsg,
      }
    }
  }

  /**
   * @description 获取文件信息
   * @param {string} filePath - 文件路径
   * @returns {Promise<FileInfo>} 文件信息
   */
  private async getFileInfo(filePath: string): Promise<FileInfo> {
    const stats = await stat(filePath)
    return {
      path: filePath,
      name: basename(filePath),
      size: stats.size,
      mtime: stats.mtime,
    }
  }

  /**
   * @description 发送 CSendInfo 消息
   * @param {SendInfo} info - 消息对象
   * @param {MessageType} type - 消息类型
   * @returns {Promise<void>}
   */
  private async sendCSendInfo(info: SendInfo, type: MessageType): Promise<void> {
    return new Promise((resolve, reject) => {
      info.m_Type = type
      const buffer = Serializer.serialize(info)
      const encrypted = this.encryption.encrypt(buffer, this.password)

      this.socket.write(encrypted.data, (err) => {
        if (err) {
          logger.error(`Failed to send message: ${err.message}`)
          reject(err)
        }
        else {
          resolve()
        }
      })
    })
  }

  /**
   * @description 发送精确大小的数据（不加密）
   * @param {Buffer} data - 数据
   * @returns {Promise<void>}
   */
  private async sendExactSize(data: Buffer): Promise<void> {
    return new Promise((resolve) => {
      const canWrite = this.socket.write(data)
      if (canWrite) {
        resolve()
      }
      else {
        this.socket.once('drain', resolve)
      }
    })
  }
}
