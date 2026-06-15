import type { Plugin } from 'vite'
import { handleApiRequest } from './apiHandler'
import { handleDataRequest } from './dataHandler'

/**
 * Vite dev-server plugin that serves FreqScope's /api/* routes. The actual
 * route logic lives in ./apiHandler so it can be shared with the standalone
 * production server used by the desktop (Electron) build.
 */
export function aircraftApiPlugin(): Plugin {
  return {
    name: 'aircraft-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        try {
          const handled =
            (await handleApiRequest(req, res)) ||
            (await handleDataRequest(req, res))
          if (!handled) next()
        } catch (err) {
          console.error('[aircraft-api] unhandled error', err)
          if (!res.headersSent) {
            res.statusCode = 500
            res.setHeader('Content-Type', 'application/json')
          }
          res.end(JSON.stringify({ error: 'Internal server error' }))
        }
      })
    },
  }
}
