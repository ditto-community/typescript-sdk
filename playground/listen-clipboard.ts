/**
 * @fileoverview 监听来自 Ditto 的剪贴板消息 Playground
 *
 * 使用方式：
 *   npx tsx playground/listen-clipboard.ts
 *
 * 环境变量（可选）：
 *   DITTO_PASSWORD  - 加密密码（默认：LetMeIn）
 *   DITTO_PORT      - 监听端口（默认：23443）
 */

import type { ClipboardData } from '../src/index.js'
import fs from 'node:fs'
import path from 'node:path'
import {
  ClipboardFormat,
  DittoServer,
} from '../src/index.js'

// ─── 配置 ───────────────────────────────────────────────
const PASSWORD = process.env.DITTO_PASSWORD || 'LetMeIn'
const PORT = Number.parseInt(process.env.DITTO_PORT || '23443', 10)

// ─── 辅助函数 ─────────────────────────────────────────────
function formatTimestamp(): string {
  return new Date().toLocaleTimeString('zh-CN', { hour12: false })
}

function formatSize(bytes: number): string {
  if (bytes < 1024)
    return `${bytes} B`
  if (bytes < 1024 * 1024)
    return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function printClipboardData(data: ClipboardData): void {
  console.log(`\n${'═'.repeat(60)}`)
  console.log(`📋 收到剪贴板数据 [${formatTimestamp()}]`)
  console.log('═'.repeat(60))
  console.log(`📝 描述: ${data.description}`)
  console.log(`📦 格式数量: ${data.formats.length}`)
  console.log(data.formats)
  console.log('─'.repeat(60))

  for (const format of data.formats) {
    console.log(`\n  🏷️  格式: ${format.formatName} (cfType=${format.cfType})`)
    console.log(`  📏 大小: ${formatSize(format.data.length)}`)

    // 尝试显示文本内容
    if (ClipboardFormat.isTextFormat(format.cfType)) {
      const text = ClipboardFormat.decodeText(format)
      const preview = text.length > 200 ? `${text.slice(0, 200)}...` : text
      console.log(`  📄 内容: ${preview}`)
    }
  }

  console.log(`\n${'═'.repeat(60)}`)
}

// ─── 数据保存 ──────────────────────────────────────────────
const DATA_DIR = path.join(import.meta.dirname, 'data')

function saveClipboardData(data: ClipboardData): string {
  // 创建 HMS 格式的文件夹名
  const now = new Date()
  const hours = String(now.getHours()).padStart(2, '0')
  const minutes = String(now.getMinutes()).padStart(2, '0')
  const seconds = String(now.getSeconds()).padStart(2, '0')
  const folderName = `${hours}${minutes}${seconds}`

  // 创建完整路径
  const saveDir = path.join(DATA_DIR, folderName)
  fs.mkdirSync(saveDir, { recursive: true })

  // 保存元数据
  const metadata = {
    timestamp: now.toISOString(),
    description: data.description,
    formatCount: data.formats.length,
    formats: data.formats.map(f => ({
      formatName: f.formatName,
      cfType: f.cfType,
      size: f.data.length,
    })),
  }
  fs.writeFileSync(
    path.join(saveDir, 'metadata.json'),
    JSON.stringify(metadata, null, 2),
    'utf-8',
  )

  // 保存每个格式的数据
  for (const format of data.formats) {
    const formatDir = path.join(saveDir, format.formatName)
    fs.mkdirSync(formatDir, { recursive: true })

    // 保存原始二进制数据
    fs.writeFileSync(path.join(formatDir, 'raw.bin'), format.data)

    // 如果是文本格式，同时保存为可读文本
    if (ClipboardFormat.isTextFormat(format.cfType)) {
      const text = ClipboardFormat.decodeText(format)
      fs.writeFileSync(path.join(formatDir, 'content.txt'), text, 'utf-8')
    }
  }

  return saveDir
}

// ─── 主逻辑 ───────────────────────────────────────────────
let messageCount = 0

const server = new DittoServer({
  password: PASSWORD,
  port: PORT,
  allowFileTransfer: true,
})

// 监听剪贴板数据
server.on('receive', (data: ClipboardData) => {
  messageCount++
  console.log(`\n🔔 [消息 #${messageCount}] 收到远程剪贴板！`)
  printClipboardData(data)

  // 保存数据到文件
  try {
    const savedDir = saveClipboardData(data)
    console.log(`💾 数据已保存到: ${savedDir}`)
  }
  catch (err: any) {
    console.error(`❌ 保存失败: ${err.message}`)
  }
})

// 监听连接事件
server.on('connect', () => {
  console.log(`\n✅ 服务器已启动，监听端口 ${PORT}`)
  console.log(`🔑 加密密码: ${PASSWORD}`)
  console.log(`📊 日志级别: ${LOG_LEVEL}`)
  console.log('\n⏳ 等待来自 Ditto 客户端的剪贴板消息...')
  console.log('   按 Ctrl+C 停止服务器\n')
})

// 监听断开事件
server.on('disconnect', () => {
  console.log('\n⏹️  服务器已停止')
})

// 监听错误事件
server.on('error', (err: Error) => {
  console.error(`\n❌ 服务器错误: ${err.message}`)
})

// 监听文件接收事件
server.on('filesReceived', (files: any[]) => {
  console.log(`\n📁 收到 ${files.length} 个文件`)
  for (const file of files) {
    console.log(`   - ${file.fileName} (${formatSize(file.size)})`)
  }
})

// 启动服务器
async function main(): Promise<void> {
  console.log('╔══════════════════════════════════════════════════════════╗')
  console.log('║       Ditto 剪贴板监听器 Playground                      ║')
  console.log('╚══════════════════════════════════════════════════════════╝')

  try {
    await server.start()
  }
  catch (err: any) {
    console.error(`\n❌ 启动失败: ${err.message}`)
    console.error('   请检查端口是否被占用')
    process.exit(1)
  }
}

// 优雅退出
process.on('SIGINT', async () => {
  console.log('\n\n🛑 正在停止服务器...')
  await server.stop()
  console.log(`📊 共收到 ${messageCount} 条消息`)
  process.exit(0)
})

process.on('SIGTERM', async () => {
  await server.stop()
  process.exit(0)
})

main()
