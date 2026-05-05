/**
 * @fileoverview Winston 日志配置
 * @module crypto/logger
 */

import process from 'node:process'
import winston from 'winston'

/**
 * @description 创建日志格式
 */
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ level, message, timestamp }) => {
    return `${timestamp} [${level}]: ${message}`
  }),
)

/**
 * @description Winston 日志实例
 */
export const logger = winston.createLogger({
  level: process.env.DITTO_SDK_LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.colorize(),
    logFormat,
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        logFormat,
      ),
    }),
  ],
})

/**
 * @description 设置日志级别
 * @param {string} level - 日志级别 ('error' | 'warn' | 'info' | 'debug')
 */
export function setLogLevel(level: string): void {
  logger.level = level
}

/**
 * @description 添加文件日志输出
 * @param {string} filename - 日志文件名
 */
export function addFileTransport(filename: string): void {
  logger.add(
    new winston.transports.File({
      filename,
      format: logFormat,
    }),
  )
}
