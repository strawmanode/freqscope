import { spawn } from 'child_process'
import net from 'net'
import path from 'path'
import { fileURLToPath } from 'url'
import { createRequire } from 'module'

/**
 * One-command Electron dev launcher:
 *   1. Bundles the Electron main process.
 *   2. Starts the Vite dev server.
 *   3. Waits for Vite to listen, then launches Electron pointed at it.
 *
 * The window loads the live Vite server (HMR), and the /api routes are served
 * by Vite's dev plugin — same as `npm run dev` in a browser.
 */
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const require = createRequire(import.meta.url)
const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm'

const VITE_HOST = '127.0.0.1'
const VITE_PORT = 5173
const children = []

function run(cmd, args, opts = {}) {
  const child = spawn(cmd, args, { stdio: 'inherit', cwd: root, ...opts })
  children.push(child)
  return child
}

function waitForPort(host, port, timeoutMs = 30000) {
  const start = Date.now()
  return new Promise((resolve, reject) => {
    const tryConnect = () => {
      const socket = net.connect(port, host)
      socket.once('connect', () => {
        socket.destroy()
        resolve()
      })
      socket.once('error', () => {
        socket.destroy()
        if (Date.now() - start > timeoutMs) {
          reject(new Error(`Timed out waiting for ${host}:${port}`))
        } else {
          setTimeout(tryConnect, 300)
        }
      })
    }
    tryConnect()
  })
}

function shutdown(code = 0) {
  for (const child of children) {
    if (!child.killed) child.kill()
  }
  process.exit(code)
}

process.on('SIGINT', () => shutdown(0))
process.on('SIGTERM', () => shutdown(0))

async function main() {
  // 1. Build the Electron main bundle.
  await new Promise((resolve, reject) => {
    const b = run(npmCmd, ['run', 'build:electron'])
    b.once('exit', (code) =>
      code === 0 ? resolve() : reject(new Error(`build:electron exited ${code}`)),
    )
  })

  // 2. Start Vite, bound explicitly to IPv4 loopback so both the port probe
  //    below and the Electron window (http://127.0.0.1:5173) hit the same
  //    address. Without this, Vite may bind to IPv6 ::1 and neither finds it.
  run(npmCmd, [
    'run',
    'dev',
    '--',
    '--host',
    VITE_HOST,
    '--port',
    String(VITE_PORT),
    '--strictPort',
  ])

  // 3. Wait for Vite (generous timeout — Cesium's first dep prebundle is slow),
  //    then launch Electron.
  await waitForPort(VITE_HOST, VITE_PORT, 180_000)
  const electronPath = require('electron')
  const electron = run(electronPath, ['.'], {
    env: {
      ...process.env,
      ELECTRON_RENDERER_URL: `http://${VITE_HOST}:${VITE_PORT}`,
    },
  })
  electron.once('exit', (code) => shutdown(code ?? 0))
}

main().catch((err) => {
  console.error(err)
  shutdown(1)
})
