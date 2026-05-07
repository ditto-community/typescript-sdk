[English](./README.md)

> [!CAUTION]
> 本项目仍在开发中，部分功能尚未完善或可能存在 Bug，不建议在生产环境中使用。

# Ditto TypeScript SDK

[Ditto](https://github.com/sabrogden/Ditto) 剪贴板管理器的 TypeScript 网络通信 SDK。用于在 Ditto 实例之间收发剪贴板数据，与 C++ 版 Ditto 客户端/服务端协议兼容。

## 功能

- **DittoClient** — 连接远程 Ditto 实例，发送剪贴板数据
- **DittoServer** — 监听并接收来自 Ditto 客户端的剪贴板数据
- **AES 加密** — 所有网络通信均通过共享密码加密

协议与原生 C++ 版 Ditto 完全兼容，可直接互通。

## 安装

```bash
npm install @ditto-community/typescript-sdk
```

## 快速上手

**发送剪贴板：**

```ts
import { ClipboardFormat, DittoClient } from '@ditto-community/typescript-sdk'

const client = new DittoClient({ password: 'secret' })
await client.connect('192.168.1.100', 23443)

await client.sendClipboard({
  description: 'Hello from TypeScript',
  formats: [ClipboardFormat.unicodeText('Hello World')]
})
```

**接收剪贴板：**

```ts
import { DittoServer } from '@ditto-community/typescript-sdk'

const server = new DittoServer({ password: 'secret', port: 23443 })

server.on('receive', (data) => {
  console.log('收到:', data.description)
})

await server.start()
```

## 构建

```bash
npm run build    # 输出到 dist/（ESM + CJS）
npm run dev      # 监听模式
```

## 协议

默认端口：`23443`，通信流程：

```
客户端 → 服务端: START → DATA → DATA_START → [格式数据] → DATA_END → END
```

所有消息通过共享密码进行 AES 加密。消息结构详见 `src/protocol/` 源码。

## 许可证

GPL-3.0
