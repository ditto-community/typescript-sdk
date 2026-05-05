/**
 * @fileoverview 文件接收器
 * @module protocol/FileReceiver
 */

import type { SendInfo } from '../types/send-info.js'
import { Buffer } from 'node:buffer'
import { createHash } from 'node:crypto'
import { mkdir, open } from 'node:fs/promises'
import { join } from 'node:path'
import { AESEncryption } from '../crypto/aes.js'
import { logger } from '../crypto/logger.js'
import { MessageType } from '../types/message-type.js'
import { ENCRYPTED_SEND_INFO_SIZE } from '../types/send-info.js'
import { Serializer } from './serializer.js'

/**
 * @description 文件传输块大小 (64KB)
 */
const CHUNK_SIZE = 65536

/**
 * @description 加密后的消息头大小
 */
const ENCRYPTED_SIZE_CSENDINFO = ENCRYPTED_SEND_INFO_SIZE

/**
 * @description 文件接收结果
 */
export interface FileReceiveResult {
  success: boolean
  fileName: string
  fileSize: number
  md5: string
  localPath: string
  error?: string
}

/**
 * @description 文件接收器
 * 对应 C++ 中的 CFileRecieve
 */
export class FileReceiver {
  private socket: import('node:net').Socket
  private encryption: AESEncryption
  private passwords: string[]
  private basePath: string
  private sourceIP: string
  private buffer: Buffer = Buffer.alloc(0)

  /**
   * @description 创建 FileReceiver 实例
   * @param {import('net').Socket} socket - TCP Socket
   * @param {string[]} passwords - 解密密码列表
   * @param {string} basePath - 文件存储基础路径
   * @param {string} sourceIP - 来源 IP
   */
  constructor(
    socket: import('node:net').Socket,
    passwords: string[],
    basePath: string,
    sourceIP: string,
  ) {
    this.socket = socket
    this.encryption = new AESEncryption()
    this.passwords = passwords
    this.basePath = basePath
    this.sourceIP = sourceIP
  }

  /**
   * @description 接收文件
   * @returns {Promise<FileReceiveResult[]>} 接收结果列表
   */
  async receiveFiles(): Promise<FileReceiveResult[]> {
    const results: FileReceiveResult[] = []

    // 接收 START 消息（文件数量）
    const startInfo = await this.receiveCSendInfo()
    if (startInfo.m_Type !== MessageType.START) {
      throw new Error(`Expected START message, got ${MessageType[startInfo.m_Type]}`)
    }

    const numFiles = startInfo.m_lParameter1
    logger.info(`Receiving ${numFiles} files`)

    // 确保存储目录存在
    const storePath = join(this.basePath, 'RemoteFiles', this.sourceIP)
    await mkdir(storePath, { recursive: true })

    // 循环接收文件
    for (let i = 0; i < numFiles; i++) {
      const result = await this.receiveFile(storePath, i + 1, numFiles)
      results.push(result)
    }

    // 接收 END 消息
    const endInfo = await this.receiveCSendInfo()
    if (endInfo.m_Type !== MessageType.END) {
      logger.warn(`Expected END message, got ${MessageType[endInfo.m_Type]}`)
    }

    logger.info(`All ${numFiles} files received`)
    return results
  }

  /**
   * @description 接收单个文件
   * @param {string} storePath - 存储路径
   * @param {number} index - 当前文件索引
   * @param {number} total - 文件总数
   * @returns {Promise<FileReceiveResult>} 接收结果
   */
  private async receiveFile(
    storePath: string,
    index: number,
    total: number,
  ): Promise<FileReceiveResult> {
    try {
      // 接收 DATA_START 消息（文件名和大小）
      const dataStartInfo = await this.receiveCSendInfo()
      if (dataStartInfo.m_Type !== MessageType.DATA_START) {
        throw new Error(`Expected DATA_START, got ${MessageType[dataStartInfo.m_Type]}`)
      }

      const fileName = dataStartInfo.m_cDesc
      const fileSize = dataStartInfo.m_lParameter1
      logger.info(`Receiving file ${index}/${total}: ${fileName} (${fileSize} bytes)`)

      // 创建本地文件
      const localPath = join(storePath, fileName)
      const fileHandle = await open(localPath, 'w')

      // 分块接收文件数据
      const md5Hash = createHash('md5')
      let received = 0

      try {
        while (received < fileSize) {
          const chunkSize = Math.min(CHUNK_SIZE, fileSize - received)
          const chunk = await this.receiveExactSize(chunkSize)

          md5Hash.update(chunk)
          await fileHandle.write(chunk, 0, chunk.length)
          received += chunk.length
        }
      }
      finally {
        await fileHandle.close()
      }

      // 接收 DATA_END 消息（MD5 和修改时间）
      const dataEndInfo = await this.receiveCSendInfo()
      if (dataEndInfo.m_Type !== MessageType.DATA_END) {
        throw new Error(`Expected DATA_END, got ${MessageType[dataEndInfo.m_Type]}`)
      }

      const expectedMD5 = dataEndInfo.m_md5
      const actualMD5 = md5Hash.digest('hex')

      // 验证 MD5
      if (expectedMD5 && expectedMD5 !== actualMD5) {
        logger.warn(`MD5 mismatch for ${fileName}: expected ${expectedMD5}, got ${actualMD5}`)
      }

      // 设置文件修改时间
      if (dataEndInfo.m_lParameter1 > 0) {
        const mtime = new Date(dataEndInfo.m_lParameter1 * 1000)
        try {
          const { utimes } = await import('node:fs/promises')
          await utimes(localPath, mtime, mtime)
        }
        catch {
          // 忽略设置时间失败
        }
      }

      logger.info(`File received: ${fileName}, MD5: ${actualMD5}`)

      return {
        success: true,
        fileName,
        fileSize,
        md5: actualMD5,
        localPath,
      }
    }
    catch (error) {
      const errMsg = (error as Error).message
      logger.error(`Failed to receive file: ${errMsg}`)
      return {
        success: false,
        fileName: '',
        fileSize: 0,
        md5: '',
        localPath: '',
        error: errMsg,
      }
    }
  }

  /**
   * @description 接收 CSendInfo 消息
   * @returns {Promise<SendInfo>} 消息对象
   */
  private async receiveCSendInfo(): Promise<SendInfo> {
    const encryptedData = await this.receiveExactSize(ENCRYPTED_SIZE_CSENDINFO)
    const decrypted = this.encryption.decryptWithMultiplePasswords(
      encryptedData,
      this.passwords,
    )

    if (!decrypted) {
      throw new Error('Failed to decrypt message header')
    }

    return Serializer.deserialize(decrypted.data)
  }

  /**
   * @description 接收精确大小的数据
   * @param {number} size - 数据大小
   * @returns {Promise<Buffer>} 接收到的数据
   */
  private async receiveExactSize(size: number): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = []
      let received = 0

      const cleanup = () => {
        this.socket.removeListener('data', onData)
        this.socket.removeListener('error', onError)
        this.socket.removeListener('close', onClose)
      }

      function onData(chunk: Buffer) {
        chunks.push(chunk)
        received += chunk.length

        if (received >= size) {
          cleanup()
          const data = Buffer.concat(chunks)
          resolve(data.subarray(0, size))
        }
      }

      function onError(error: Error) {
        cleanup()
        reject(error)
      }

      function onClose() {
        cleanup()
        reject(new Error('Connection closed'))
      }

      this.socket.on('data', onData)
      this.socket.on('error', onError)
      this.socket.on('close', onClose)
    })
  }
}
