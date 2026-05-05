import { ClipboardFormat, DittoClient, DittoServer, logger, setLogLevel } from '../src/index.js'

setLogLevel('info')

async function testClient() {
  const client = new DittoClient({
    password: 'LetMeIn',
    computerName: 'TestComputer',
    localIP: '192.168.1.100',
  })

  client.on('connect', () => {
    logger.info('Connected to server')
  })

  client.on('disconnect', () => {
    logger.info('Disconnected from server')
  })

  client.on('error', (err: Error) => {
    logger.error('Error:', err.message)
  })

  try {
    await client.connect('192.168.76.46', 23443)
    // await client.connect('127.0.0.1', 23443);
    logger.info('Sending clipboard...')

    await client.sendClipboard({
      description: 'Test clipboard from SDK playground',
      formats: [ClipboardFormat.unicodeText(`Hello from Ditto SDK ${Date.now()}!!!啊`)],
    })

    logger.info('Clipboard sent successfully')
    await client.disconnect()
  }
  catch (err: any) {
    logger.error('Failed:', err.message)
  }
}

async function testServer() {
  const server = new DittoServer({
    password: 'testPassword',
    port: 23443,
  })

  server.on('connection', (info: any) => {
    logger.info('New connection from:', info.computerName)
  })

  server.on('receive', (data) => {
    logger.info('Received clipboard:', data.description)
    logger.info('Formats:', data.formats.map((f: any) => f.formatName))
  })

  server.on('error', (err: Error) => {
    logger.error('Server error:', err.message)
  })

  try {
    await server.start()
    logger.info('Server started on port 23443')
  }
  catch (err: any) {
    logger.error('Failed to start server:', err.message)
  }
}

const mode = process.argv[2] || 'client'

if (mode === 'server') {
  testServer()
}
else {
  testClient()
}
