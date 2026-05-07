[中文](./README.zh-CN.md)

> [!CAUTION]
> This project is under active development. Some features may be incomplete or contain bugs. Not recommended for production use.

# Ditto TypeScript SDK

TypeScript SDK for [Ditto](https://github.com/sabrogden/Ditto) clipboard manager's network communication. Enables sending and receiving clipboard data between Ditto instances over the network, compatible with the C++ Ditto client/server protocol.

## What It Does

- **DittoClient** — connects to a remote Ditto instance and sends clipboard data
- **DittoServer** — listens for incoming clipboard data from Ditto clients
- **AES encryption** — all network traffic is encrypted with a shared password

The protocol speaks the same wire format as the native C++ Ditto app, so this SDK can interoperate with it directly.

## Install

```bash
npm install @ditto-community/typescript-sdk
```

## Quick Start

**Send clipboard:**

```ts
import { ClipboardFormat, DittoClient } from '@ditto-community/typescript-sdk'

const client = new DittoClient({ password: 'secret' })
await client.connect('192.168.1.100', 23443)

await client.sendClipboard({
  description: 'Hello from TypeScript',
  formats: [ClipboardFormat.unicodeText('Hello World')]
})
```

**Receive clipboard:**

```ts
import { DittoServer } from '@ditto-community/typescript-sdk'

const server = new DittoServer({ password: 'secret', port: 23443 })

server.on('receive', (data) => {
  console.log('Got:', data.description)
})

await server.start()
```

## Build

```bash
npm run build    # Output to dist/ (ESM + CJS)
npm run dev      # Watch mode
```

## Protocol

Default port: `23443`. Communication flow:

```
Client → Server: START → DATA → DATA_START → [formats] → DATA_END → END
```

All messages are AES-encrypted using a shared password. See the source under `src/protocol/` for message structure details.

## License

GPL-3.0
