/**
 * @fileoverview AES-256-CBC 加密实现
 * @module crypto/aes
 */

import type {
  TLHeader,
} from './key-derivation.js'
import { Buffer } from 'node:buffer'
import crypto from 'node:crypto'
import {
  DEFAULT_KEY_ENC_ROUNDS,
  deriveMasterKey,
  deserializeHeader,
  generateRandomBytes,
  HEADER_SIZE,
  serializeHeader,
  sha256,
  TD_TLSIG_1,
  TD_TLSIG_2,
  transformMasterKey,
} from './key-derivation.js'
import { logger } from './logger.js'

/**
 * @description 加密结果
 */
export interface EncryptionResult {
  /**
   * 加密后的数据（包含头部）
   */
  data: Buffer

  /**
   * 加密后的数据长度
   */
  length: number
}

/**
 * @description 解密结果
 */
export interface DecryptionResult {
  /**
   * 解密后的数据
   */
  data: Buffer

  /**
   * 解密后的数据长度
   */
  length: number
}

/**
 * @description AES-256-CBC 加密器类
 * 实现 Ditto 协议的加密功能
 *
 * 加密流程（对应 C++ 的 CEncryption::Encrypt）:
 * 1. 生成随机值: aMasterSeed(16), aEncryptionIV(16), aMasterSeed2(32)
 * 2. 派生主密钥: SHA-256(password) -> 32 字节
 * 3. 密钥转换: 使用 aMasterSeed2 作为密钥，对 masterKey 进行 100000 轮 AES-ECB 加密
 * 4. 推导最终密钥: FinalKey = SHA-256(aMasterSeed + transformedKey)
 * 5. 计算内容哈希: ContentsHash = SHA-256(原始数据)
 * 6. 设置头部字段: 签名、轮数
 * 7. 计算头部哈希: HeaderHash = SHA-256(从 dwSignature1 开始的字段)
 * 8. AES-CBC 加密数据（带 PKCS7 填充）
 */
export class AESEncryption {
  /**
   * @description 使用密码加密数据
   * @param {Buffer} input - 原始数据
   * @param {string} password - 网络密码
   * @returns {EncryptionResult} 加密结果
   */
  encrypt(input: Buffer, password: string): EncryptionResult {
    // Step 1: 生成随机值
    const masterSeed = generateRandomBytes(16)
    const encryptionIV = generateRandomBytes(16)
    const masterSeed2 = generateRandomBytes(32)

    // Step 2: 派生主密钥 (SHA-256(password))
    const masterKey = deriveMasterKey(password)

    // Step 3: 密钥转换 (使用 masterSeed2 作为密钥)
    const transformedKey = transformMasterKey(masterSeed2, masterKey, DEFAULT_KEY_ENC_ROUNDS)

    // Step 4: 推导最终密钥 (FinalKey = SHA-256(masterSeed + transformedKey))
    const finalKey = sha256(Buffer.concat([masterSeed, transformedKey]))

    // Step 5: 计算内容哈希 (SHA-256(原始数据))
    const contentsHash = sha256(input)

    // Step 6: 构建头部
    const header: TLHeader = {
      aHeaderHash: Buffer.alloc(32),
      dwSignature1: TD_TLSIG_1,
      dwSignature2: TD_TLSIG_2,
      dwKeyEncRounds: DEFAULT_KEY_ENC_ROUNDS,
      aMasterSeed: masterSeed,
      aEncryptionIV: encryptionIV,
      aMasterSeed2: masterSeed2,
      aContentsHash: contentsHash,
    }

    // Step 7: 计算头部哈希
    // 头部哈希 = SHA-256(从 dwSignature1 开始的所有字段，即除去 aHeaderHash 的部分)
    // 对应 C++ 中: sha256_hash(((unsigned char*)&hdr) + 32, sizeof(TD_TLHEADER) - 32, &sha32)
    const headerWithoutHash = serializeHeader(header).slice(32)
    header.aHeaderHash = sha256(headerWithoutHash)

    // Step 8: AES-CBC 加密（带 PKCS7 填充）
    const cipher = crypto.createCipheriv('aes-256-cbc', finalKey, encryptionIV)
    cipher.setAutoPadding(true)

    const encrypted = Buffer.concat([
      cipher.update(input),
      cipher.final(),
    ])

    // 组合头部和加密数据
    const headerData = serializeHeader(header)
    const result = Buffer.concat([headerData, encrypted])

    logger.debug(`Encrypted ${input.length} bytes to ${result.length} bytes`)

    return {
      data: result,
      length: result.length,
    }
  }

  /**
   * @description 使用密码解密数据
   *
   * 解密流程（对应 C++ 的 CEncryption::Decrypt）:
   * 1. 提取头部（140 字节）
   * 2. 验证头部哈希
   * 3. 验证签名
   * 4. 派生主密钥
   * 5. 获取密钥转换轮数并转换密钥
   * 6. 推导最终密钥
   * 7. AES-CBC 解密
   * 8. 验证内容哈希
   *
   * @param {Buffer} input - 加密数据
   * @param {string} password - 网络密码
   * @returns {DecryptionResult | null} 解密结果，失败返回 null
   */
  decrypt(input: Buffer, password: string): DecryptionResult | null {
    if (input.length <= HEADER_SIZE) {
      logger.debug('Input too small for header')
      return null
    }

    try {
      // Step 1: 提取头部
      const headerBuffer = input.slice(0, HEADER_SIZE)
      const encryptedData = input.slice(HEADER_SIZE)

      const header = deserializeHeader(headerBuffer)

      // Step 2: 验证头部哈希
      // 重新计算头部哈希并比对
      // 对应 C++ 中: sha256_hash(((unsigned char*)&hdr) + 32, sizeof(TD_TLHEADER) - 32, &sha32)
      const headerWithoutHash = headerBuffer.slice(32)
      const computedHeaderHash = sha256(headerWithoutHash)

      if (!computedHeaderHash.equals(header.aHeaderHash)) {
        logger.debug('Header hash mismatch')
        return null
      }

      // Step 3: 验证签名
      if (header.dwSignature1 !== TD_TLSIG_1 || header.dwSignature2 !== TD_TLSIG_2) {
        logger.debug('Invalid header signatures')
        return null
      }

      // Step 4: 派生主密钥
      const masterKey = deriveMasterKey(password)

      // Step 5: 密钥转换
      const transformedKey = transformMasterKey(header.aMasterSeed2, masterKey, header.dwKeyEncRounds)

      // Step 6: 推导最终密钥
      const finalKey = sha256(Buffer.concat([header.aMasterSeed, transformedKey]))

      // Step 7: AES-CBC 解密
      const decipher = crypto.createDecipheriv('aes-256-cbc', finalKey, header.aEncryptionIV)
      decipher.setAutoPadding(true)

      const decrypted = Buffer.concat([
        decipher.update(encryptedData),
        decipher.final(),
      ])

      // Step 8: 验证内容哈希
      const contentHash = sha256(decrypted)
      if (!contentHash.equals(header.aContentsHash)) {
        logger.debug('Content hash mismatch')
        return null
      }

      logger.debug(`Decrypted ${input.length} bytes to ${decrypted.length} bytes`)

      return {
        data: decrypted,
        length: decrypted.length,
      }
    }
    catch (error) {
      logger.debug(`Decryption failed: ${error}`)
      return null
    }
  }

  /**
   * @description 使用多个密码尝试解密
   * 对应 C++ 中的多密码尝试机制
   * @param {Buffer} input - 加密数据
   * @param {string[]} passwords - 密码数组（按优先级排序）
   * @returns {DecryptionResult | null} 成功返回结果，否则返回 null
   */
  decryptWithMultiplePasswords(
    input: Buffer,
    passwords: string[],
  ): DecryptionResult | null {
    for (let i = 0; i < passwords.length; i++) {
      const result = this.decrypt(input, passwords[i])
      if (result !== null) {
        logger.debug(`Successfully decrypted with password at index ${i}`)
        return result
      }
    }

    logger.debug('Failed to decrypt with all passwords')
    return null
  }
}

/**
 * @description 默认的加密器实例
 */
export const defaultEncryption = new AESEncryption()
