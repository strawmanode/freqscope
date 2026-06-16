import path from 'path'
import { app, BrowserWindow, shell } from 'electron'
import { autoUpdater } from 'electron-updater'
import { loadEnvLocal } from '../server/feedConfig'
import { startServer, type RunningServer } from '../server/standaloneServer'
import { applyDownloadedDataDir, checkForDataUpdate } from './dataUpdate'

/**
 * FreqScope desktop (Electron) entry point.
 *
 * On launch it:
 *   1. Points feed-identity config at a writable per-user directory.
 *   2. Loads any saved name/email from that directory.
 *   3. Starts the embedded production server on a loopback ephemeral port.
 *   4. Opens a window pointing at it.
 *
 * In development (`npm run electron:dev`) it instead loads the Vite dev server
 * via the ELECTRON_RENDERER_URL env var and does not start the embedded server.
 */

// In dev, dev.mjs sets this to the Vite URL (e.g. http://localhost:5173).
const RENDERER_URL = process.env.ELECTRON_RENDERER_URL?.trim() || null
const isDev = RENDERER_URL != null

// Feed identity (.env.local) must live somewhere writable. In a packaged app
// the install directory is read-only, so use Electron's per-user data dir.
process.env.FREQSCOPE_CONFIG_DIR ??= app.getPath('userData')

let mainWindow: BrowserWindow | null = null
let running: RunningServer | null = null

/**
 * Checks GitHub Releases for a newer signed build, downloads it in the
 * background, and installs it on quit. Only runs in a packaged app — in dev
 * there is no update feed (app-update.yml), so calling it would just error.
 */
function initAutoUpdate(): void {
  if (!app.isPackaged) return

  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true
  // Never block launch on an update problem (offline, no release yet, etc.).
  autoUpdater.on('error', (err) => {
    console.error('[freqscope] auto-update error', err)
  })

  void autoUpdater.checkForUpdatesAndNotify().catch((err) => {
    console.error('[freqscope] update check failed', err)
  })
}

function resolveDistDir(): string {
  // Packaged: dist is copied into the app's resources (see electron-builder.yml).
  // Unpackaged: dist sits next to the bundled main at <project>/dist.
  return app.isPackaged
    ? path.join(process.resourcesPath, 'dist')
    : path.join(__dirname, '..', 'dist')
}

function resolveBundledDataDir(): string {
  // Packaged: src/data is shipped to resources/data-bundled (electron-builder.yml).
  // Unpackaged: it sits at <project>/src/data.
  return app.isPackaged
    ? path.join(process.resourcesPath, 'data-bundled')
    : path.join(__dirname, '..', 'src', 'data')
}

async function prepareReferenceData(): Promise<void> {
  if (RENDERER_URL || !app.isPackaged) return
  process.env.FREQSCOPE_BUNDLED_DATA_DIR ??= resolveBundledDataDir()
  applyDownloadedDataDir()
  // Fresh installs: fetch data-latest before the window opens so the first
  // screen already has new airports/airspace when the user is online.
  await checkForDataUpdate()
}

async function resolveStartUrl(): Promise<string> {
  if (RENDERER_URL) return RENDERER_URL
  loadEnvLocal()
  process.env.FREQSCOPE_BUNDLED_DATA_DIR ??= resolveBundledDataDir()
  applyDownloadedDataDir()
  running = await startServer({ distDir: resolveDistDir() })
  return running.url
}

async function createWindow(): Promise<void> {
  const startUrl = await resolveStartUrl()

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#0f0a00',
    show: false,
    title: 'FreqScope',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })

  mainWindow.once('ready-to-show', () => mainWindow?.show())

  // The LiveATC "Listen" handoff (and any other external link) opens in the
  // user's real browser rather than a bare Electron window.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http:') || url.startsWith('https:')) {
      void shell.openExternal(url)
    }
    return { action: 'deny' }
  })

  // Keep in-app navigation on our own origin; send off-site nav to the browser.
  mainWindow.webContents.on('will-navigate', (event, url) => {
    const target = new URL(url)
    const here = new URL(startUrl)
    if (target.origin !== here.origin) {
      event.preventDefault()
      void shell.openExternal(url)
    }
  })

  await mainWindow.loadURL(startUrl)

  if (isDev) mainWindow.webContents.openDevTools({ mode: 'detach' })

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
  })

  app.whenReady()
    .then(async () => {
      await prepareReferenceData()
      await createWindow()
      initAutoUpdate()
      // Catch bundles published while the app was open; reload if one lands.
      if (app.isPackaged) {
        void checkForDataUpdate().then((updated) => {
          if (updated && mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.reload()
          }
        })
      }
    })
    .catch((err) => {
      console.error('[freqscope] failed to start', err)
      app.quit()
    })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) void createWindow()
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })

  app.on('will-quit', () => {
    void running?.close().catch(() => undefined)
  })
}
