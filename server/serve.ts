import path from 'path'
import { loadEnvLocal } from './feedConfig'
import { startServer } from './standaloneServer'

/**
 * Headless production server entry point (no Electron window).
 *
 * Useful for self-hosting or for testing the production build in a browser.
 * Build the client first (`npm run build`), then run `npm run serve`.
 *
 * Env:
 *   HOST  — bind address (default 127.0.0.1)
 *   PORT  — bind port    (default 4173)
 *   FREQSCOPE_CONFIG_DIR — where .env.local lives (default cwd)
 */
loadEnvLocal()

const distDir = path.resolve(process.cwd(), 'dist')
const host = process.env.HOST?.trim() || '127.0.0.1'
const port = Number(process.env.PORT) || 4173

startServer({ distDir, host, port })
  .then((running) => {
    console.log(`FreqScope is running at ${running.url}`)
    console.log('Press Ctrl+C to stop.')
    const shutdown = () => {
      void running.close().then(() => process.exit(0))
    }
    process.on('SIGINT', shutdown)
    process.on('SIGTERM', shutdown)
  })
  .catch((err) => {
    console.error('Failed to start FreqScope server:', err)
    process.exit(1)
  })
