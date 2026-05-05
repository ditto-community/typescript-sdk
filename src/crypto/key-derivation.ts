/**
 * @fileoverview 密钥派生实现
 * @module crypto/keyDerivation
 */

import { Buffer } from 'node:buffer'
import crypto from 'node:crypto'

/**
 * @description TD_TLHEADER 结构大小（字节）
 * 对应 C++ 中的 sizeof(TD_TLHEADER) = 140
 * 结构体使用 #pragma pack(1)，无对齐填充
 * 计算: 32(aHeaderHash) + 4(dwSignature1) + 4(dwSignature2) + 16(aMasterSeed) +
 *        16(aEncryptionIV) + 32(aContentsHash) + 32(aMasterSeed2) + 4(dwKeyEncRounds) = 140
 */
export const HEADER_SIZE = 140

/**
 * @description 签名常量
 * 对应 C++ 中的 TD_TLSIG_1 和 TD_TLSIG_2
 */
export const TD_TLSIG_1 = 0x139C5AFE
export const TD_TLSIG_2 = 0xBF3562DA

/**
 * @description 默认密钥加密轮数
 * 对应 C++ 中的 dwKeyEncRounds 默认值
 */
export const DEFAULT_KEY_ENC_ROUNDS = 100000

/**
 * @description SHA-256 哈希函数
 * @param {Buffer} data - 输入数据
 * @returns {Buffer} 256 位哈希结果
 */
export function sha256(data: Buffer): Buffer {
  return crypto.createHash('sha256').update(data).digest()
}

/**
 * @description 从密码派生主密钥
 * @param {string} password - 网络密码
 * @returns {Buffer} 256 位主密钥
 */
export function deriveMasterKey(password: string): Buffer {
  const passwordBuffer = Buffer.from(password, 'utf8')
  return sha256(passwordBuffer)
}

/**
 * @description 生成随机字节
 * @param {number} length - 字节长度
 * @returns {Buffer} 随机字节数组
 */
export function generateRandomBytes(length: number): Buffer {
  return crypto.randomBytes(length)
}

/**
 * @description 转换主密钥（多次 AES-ECB 加密）
 * 对应 C++ 中的 _TransformMasterKey 函数
 *
 * 算法:
 * 1. 使用 pKeySeed (aMasterSeed2) 作为 AES-ECB 密钥
 * 2. 对 m_pMasterKey (输入/输出缓冲区) 进行 rounds 轮 AES-ECB blockEncrypt
 * 3. 最后对结果进行一次 SHA-256 哈希
 *
 * @param {Buffer} keySeed - 密钥转换盐 (aMasterSeed2, 32字节)
 * @param {Buffer} masterKey - 主密钥 (32字节)
 * @param {number} rounds - 加密轮数（默认 100000）
 * @returns {Buffer} 转换后的密钥
 */
export function transformMasterKey(keySeed: Buffer, masterKey: Buffer, rounds: number = DEFAULT_KEY_ENC_ROUNDS): Buffer {
  // 使用 keySeed 作为 AES-ECB 密钥初始化加密器
  const cipher = crypto.createCipheriv('aes-256-ecb', keySeed, null)
  cipher.setAutoPadding(false)

  // 复制主密钥到工作缓冲区
  const workingKey = Buffer.from(masterKey)

  // 执行 rounds 轮 AES-ECB 加密
  // 每轮使用同一个 cipher 实例对 32 字节数据进行加密
  for (let i = 0; i < rounds; i++) {
    const encrypted = cipher.update(workingKey)
    encrypted.copy(workingKey)
  }

  // 最终 SHA-256 哈希
  const transformed = sha256(workingKey)
  return transformed
}

/**
 * @description TD_TLHEADER 结构接口
 * 对应 C++ 中的 _TD_TLHEADER 结构体
 */
export interface TLHeader {
  /**
   * 头部哈希: SHA-256(其余头部字段)
   * 对应结构体中的 aHeaderHash[32]
   */
  aHeaderHash: Buffer

  /**
   * 签名1: 0x139C5AFE
   * 对应结构体中的 dwSignature1
   */
  dwSignature1: number

  /**
   * 签名2: 0xBF3562DA
   * 对应结构体中的 dwSignature2
   */
  dwSignature2: number

  /**
   * 主密钥盐 (随机, 16字节)
   * 对应结构体中的 aMasterSeed[16]
   */
  aMasterSeed: Buffer

  /**
   * AES 加密 IV (随机, 16字节)
   * 对应结构体中的 aEncryptionIV[16]
   */
  aEncryptionIV: Buffer

  /**
   * 内容哈希: SHA-256(原始数据)
   * 对应结构体中的 aContentsHash[32]
   */
  aContentsHash: Buffer

  /**
   * 密钥转换盐 (随机, 32字节)
   * 对应结构体中的 aMasterSeed2[32]
   */
  aMasterSeed2: Buffer

  /**
   * 密钥加密轮数 (默认 100000)
   * 对应结构体中的 dwKeyEncRounds
   */
  dwKeyEncRounds: number
}

/**
 * @description 创建默认的 TLHeader
 * @returns {TLHeader} 默认头
 */
export function createDefaultHeader(): TLHeader {
  return {
    aHeaderHash: Buffer.alloc(32),
    dwSignature1: TD_TLSIG_1,
    dwSignature2: TD_TLSIG_2,
    dwKeyEncRounds: DEFAULT_KEY_ENC_ROUNDS,
    aMasterSeed: Buffer.alloc(16),
    aEncryptionIV: Buffer.alloc(16),
    aContentsHash: Buffer.alloc(32),
    aMasterSeed2: Buffer.alloc(32),
  }
}

/**
 * @description 将 TLHeader 序列化为 140 字节的 Buffer
 * 结构: aHeaderHash(32) + dwSignature1(4) + dwSignature2(4) + aMasterSeed(16) +
 *       aEncryptionIV(16) + aContentsHash(32) + aMasterSeed2(32) + dwKeyEncRounds(4)
 * @param {TLHeader} header - 头部对象
 * @returns {Buffer} 序列化的头部
 */
export function serializeHeader(header: TLHeader): Buffer {
  const buffer = Buffer.alloc(HEADER_SIZE)
  let offset = 0

  header.aHeaderHash.copy(buffer, offset)
  offset += 32

  buffer.writeUInt32LE(header.dwSignature1, offset)
  offset += 4

  buffer.writeUInt32LE(header.dwSignature2, offset)
  offset += 4

  header.aMasterSeed.copy(buffer, offset)
  offset += 16

  header.aEncryptionIV.copy(buffer, offset)
  offset += 16

  header.aContentsHash.copy(buffer, offset)
  offset += 32

  header.aMasterSeed2.copy(buffer, offset)
  offset += 32

  buffer.writeUInt32LE(header.dwKeyEncRounds, offset)
  offset += 4

  return buffer
}

/**
 * @description 从 Buffer 反序列化 TLHeader
 * @param {Buffer} buffer - 140 字节的 Buffer
 * @returns {TLHeader} 反序列化的头部
 */
export function deserializeHeader(buffer: Buffer): TLHeader {
  if (buffer.length < HEADER_SIZE) {
    throw new Error(`Invalid header buffer size: ${buffer.length}, expected ${HEADER_SIZE}`)
  }

  let offset = 0

  const header: TLHeader = {
    aHeaderHash: Buffer.alloc(0),
    dwSignature1: 0,
    dwSignature2: 0,
    aMasterSeed: Buffer.alloc(0),
    aEncryptionIV: Buffer.alloc(0),
    aContentsHash: Buffer.alloc(0),
    aMasterSeed2: Buffer.alloc(0),
    dwKeyEncRounds: 0,
  }

  header.aHeaderHash = buffer.slice(offset, offset + 32)
  offset += 32

  header.dwSignature1 = buffer.readUInt32LE(offset)
  offset += 4

  header.dwSignature2 = buffer.readUInt32LE(offset)
  offset += 4

  header.aMasterSeed = buffer.slice(offset, offset + 16)
  offset += 16

  header.aEncryptionIV = buffer.slice(offset, offset + 16)
  offset += 16

  header.aContentsHash = buffer.slice(offset, offset + 32)
  offset += 32

  header.aMasterSeed2 = buffer.slice(offset, offset + 32)
  offset += 32

  header.dwKeyEncRounds = buffer.readUInt32LE(offset)

  return header
}
