import http from 'http'
import fs from 'fs'
import path from 'path'
import { handleApiRequest } from './apiHandler'
import { handleDataRequest } from './dataHandler'

/**
 * Standalone production HTTP server for FreqScope.
 *
 * Serves the built client from `distDir` and proxies `/api/*` to the shared
 * route handler. Used by the desktop (Electron) build and by `npm run serve`.
 * The Vite dev server is unaffected — it keeps using the dev plugin.
 */

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.cjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.wasm': 'application/wasm',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.ico': 'image/x-icon',
  '.bmp': 'image/bmp',
  '.ktx2': 'image/ktx2',
  '.glb': 'model/gltf-binary',
  '.gltf': 'model/gltf+json',
  '.bin': 'application/octet-stream',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.csv': 'text/csv; charset=utf-8',
  '.geojson': 'application/geo+json',
  '.czml': 'application/json; charset=utf-8',
  '.topojson': 'application/json; charset=utf-8',
}

function contentType(filePath: string): string {
  return MIME_TYPES[path.extname(filePath).toLowerCase()] ?? 'application/octet-stream'
}

function sendFile(res: http.ServerResponse, filePath: string, statusCode = 200): void {
  res.statusCode = statusCode
  res.setHeader('Content-Type', contentType(filePath))
  const stream = fs.createReadStream(filePath)
  stream.on('error', () => {
    if (!res.headersSent) {
      res.statusCode = 500
      res.setHeader('Content-Type', 'text/plain; charset=utf-8')
    }
    res.end('Internal server error')
  })
  stream.pipe(res)
}

/**
 * Resolves a request pathname to a safe absolute path inside distDir.
 * Returns null when the path would escape distDir (traversal attempt).
 */
function resolveWithinDist(distDir: string, pathname: string): string | null {
  const decoded = decodeURIComponent(pathname.split('?')[0])
  const resolved = path.normalize(path.join(distDir, decoded))
  const rel = path.relative(distDir, resolved)
  if (rel.startsWith('..') || path.isAbsolute(rel)) return null
  return resolved
}

function serveStatic(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  distDir: string,
): void {
  const url = req.url ?? '/'
  const pathname = url.split('?')[0]
  const indexPath = path.join(distDir, 'index.html')

  if (pathname === '/' || pathname === '') {
    sendFile(res, indexPath)
    return
  }

  const resolved = resolveWithinDist(distDir, pathname)
  if (resolved && fs.existsSync(resolved) && fs.statSync(resolved).isFile()) {
    // Long-cache hashed/static assets; never cache index.html.
    res.setHeader('Cache-Control', 'public, max-age=86400')
    sendFile(res, resolved)
    return
  }

  // SPA fallback: unknown non-asset paths (e.g. /scope/KJFK) render the app.
  // A path that looks like a missing asset (has an extension) is a real 404.
  if (path.extname(pathname)) {
    res.statusCode = 404
    res.setHeader('Content-Type', 'text/plain; charset=utf-8')
    res.end('Not found')
    return
  }

  sendFile(res, indexPath)
}

export type StartServerOptions = {
  /** Absolute path to the built client (the Vite `dist` directory). */
  distDir: string
  /** Defaults to 127.0.0.1 (loopback only). */
  host?: string
  /** Defaults to 0 (an OS-assigned ephemeral port). */
  port?: number
}

export type RunningServer = {
  server: http.Server
  host: string
  port: number
  url: string
  close: () => Promise<void>
}

export function startServer(options: StartServerOptions): Promise<RunningServer> {
  const { distDir } = options
  const host = options.host ?? '127.0.0.1'
  const port = options.port ?? 0

  const server = http.createServer((req, res) => {
    void (async () => {
      try {
        const url = req.url ?? ''
        if (url.startsWith('/api/')) {
          const handled = await handleApiRequest(req, res)
          if (!handled) {
            res.statusCode = 404
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ error: 'Not found' }))
          }
          return
        }
        if (url.startsWith('/data/')) {
          const handled = await handleDataRequest(req, res)
          if (!handled) {
            res.statusCode = 404
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ error: 'Not found' }))
          }
          return
        }
        serveStatic(req, res, distDir)
      } catch (err) {
        console.error('[freqscope-server]', err)
        if (!res.headersSent) {
          res.statusCode = 500
          res.setHeader('Content-Type', 'application/json')
        }
        res.end(JSON.stringify({ error: 'Internal server error' }))
      }
    })()
  })

  return new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(port, host, () => {
      server.off('error', reject)
      const address = server.address()
      const boundPort = typeof address === 'object' && address ? address.port : port
      resolve({
        server,
        host,
        port: boundPort,
        url: `http://${host}:${boundPort}`,
        close: () =>
          new Promise<void>((res, rej) =>
            server.close((err) => (err ? rej(err) : res())),
          ),
      })
    })
  })
}
