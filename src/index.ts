/**
 * @fileoverview Ditto SDK 主入口
 * @module ditto-sdk
 *
 * @example
 * // 发送端示例
 * import { DittoClient, ClipboardFormat } from 'ditto-sdk';
 *
 * const client = new DittoClient({ password: 'myPassword' });
 * await client.connect('192.168.1.100', 23443);
 * await client.sendClipboard({
 *   description: 'Hello from TypeScript',
 *   formats: [ClipboardFormat.unicodeText('Hello World')]
 * });
 *
 * @example
 * // 接收端示例
 * import { DittoServer } from 'ditto-sdk';
 *
 * const server = new DittoServer({
 *   password: 'myPassword',
 *   port: 23443
 * });
 *
 * server.on('receive', (data) => {
 *   console.log('Received:', data.description);
 * });
 *
 * await server.start();
 */

// 核心类
export { ConnectionState, DittoClient } from './client/ditto-client.js'
export type { DittoEvent, EventCallback } from './events/event-emitter.js'

export type { FileReceiveResult } from './protocol/file-receiver.js'
// 文件传输结果类型（sendFiles / receive 事件的返回值）
export type { FileSendResult } from './protocol/file-sender.js'
export { DittoServer, ServerState } from './server/ditto-server.js'
export type { ClipboardData, ClipboardFormatData, ClipboardFormatName } from './types/clipboard-format.js'
export { ClipboardFormat, ClipboardFormatType } from './types/clipboard-format.js'

// 核心类型
export type { ConnectionOptions, ServerOptions } from './types/connection-options.js'
export { getMessageTypeName, MessageType } from './types/message-type.js'
