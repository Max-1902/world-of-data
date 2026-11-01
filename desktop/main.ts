// Electron main process for the World of Data desktop app.
//
// The page is the same Vite build as the website (dist-desktop/web), served from a private app://
// scheme rather than a local HTTP server: no port is opened, so no other program or website on the
// machine can reach the api/ handlers or the keys behind them. /api/* goes to desktop/apiBridge.ts.
//
// Keys come from the user: the key window (keys-window/) saves them to the app's data folder, encrypted
// with the OS keychain via safeStorage when the system offers it, and can import them from a .env file.
// Run from the repo (npm run desktop), the app uses the repo's .env until keys are saved in the window.
import { app, BrowserWindow, Menu, dialog, ipcMain, net, protocol, safeStorage, shell, type MenuItemConstructorOptions } from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { handleApi } from './apiBridge'
import { KEY_FIELDS, applyServerEnv, clientEnv, parseEnvFile, sanitizeKeys, type KeyValues } from './keys'

// Names the data folder (~/Library/Application Support/World of Data on macOS) instead of the npm package name.
app.setName('World of Data')

const SCHEME = 'app'
const ORIGIN = `${SCHEME}://world-of-data`
const WEB_ROOT = path.join(app.getAppPath(), 'dist-desktop', 'web')
const KEYS_PAGE = path.join(__dirname, 'keys-window', 'keys.html')

protocol.registerSchemesAsPrivileged([
  { scheme: SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true } },
])

// ── Key storage ──────────────────────────────────────────────────────────────
const encryptedFile = () => path.join(app.getPath('userData'), 'keys.enc')
const plainFile = () => path.join(app.getPath('userData'), 'keys.json')

let keys: KeyValues = {}

function loadKeys(): KeyValues {
  try {
    if (fs.existsSync(encryptedFile())) return sanitizeKeys(JSON.parse(safeStorage.decryptString(fs.readFileSync(encryptedFile()))))
    if (fs.existsSync(plainFile())) {
      const values = sanitizeKeys(JSON.parse(fs.readFileSync(plainFile(), 'utf8')))
      // A plain file (saved where the keychain was missing, or placed by hand) moves into the keychain once one is available.
      if (safeStorage.isEncryptionAvailable()) saveKeys(values)
      return values
    }
    // Unpackaged only: an installed app never looks for a .env of its own.
    const repoEnv = path.join(app.getAppPath(), '.env')
    if (!app.isPackaged && fs.existsSync(repoEnv)) return parseEnvFile(fs.readFileSync(repoEnv, 'utf8'))
  } catch (err) {
    console.error('[keys] could not read saved keys:', err instanceof Error ? err.message : err)
  }
  return {}
}

/** Returns whether the keys were encrypted (false where the OS has no keychain, e.g. some Linux desktops). */
function saveKeys(values: KeyValues): boolean {
  fs.mkdirSync(app.getPath('userData'), { recursive: true })
  const text = JSON.stringify(values)
  if (safeStorage.isEncryptionAvailable()) {
    fs.writeFileSync(encryptedFile(), safeStorage.encryptString(text), { mode: 0o600 })
    fs.rmSync(plainFile(), { force: true })
    return true
  }
  fs.writeFileSync(plainFile(), text, { mode: 0o600 })
  fs.rmSync(encryptedFile(), { force: true })
  return false
}

// ── app:// scheme ────────────────────────────────────────────────────────────
function isFile(p: string) { try { return fs.statSync(p).isFile() } catch { return false } }

function serveStatic(url: URL): Promise<Response> | Response {
  const file = path.normalize(path.join(WEB_ROOT, decodeURIComponent(url.pathname)))
  if (!file.startsWith(WEB_ROOT + path.sep)) return new Response('Not found', { status: 404 })
  // Unknown paths get the app shell, as a static host would for a single-page app.
  return net.fetch(pathToFileURL(isFile(file) ? file : path.join(WEB_ROOT, 'index.html')).toString())
}

function handleScheme(req: Request): Promise<Response> | Response {
  const url = new URL(req.url)
  if (`${url.protocol}//${url.host}` !== ORIGIN) return new Response('Not found', { status: 404 })
  return url.pathname.startsWith('/api/') ? handleApi(req) : serveStatic(url)
}

// ── Windows ──────────────────────────────────────────────────────────────────
let mainWindow: BrowserWindow | null = null
let keysWindow: BrowserWindow | null = null

/** Links to the web open in the user's browser; nothing else may replace the app page. */
function keepNavigationInside(win: BrowserWindow, allowedPrefix: string) {
  const openOutside = (target: string) => { if (/^https?:\/\//.test(target)) void shell.openExternal(target) }
  win.webContents.setWindowOpenHandler(({ url }) => { openOutside(url); return { action: 'deny' } })
  win.webContents.on('will-navigate', (e, url) => {
    if (url.startsWith(allowedPrefix)) return
    e.preventDefault()
    openOutside(url)
  })
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1440, height: 900, minWidth: 1024, minHeight: 640,
    title: 'World of Data',
    backgroundColor: '#050b12',
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, sandbox: true, nodeIntegration: false },
  })
  keepNavigationInside(mainWindow, `${ORIGIN}/`)
  mainWindow.on('closed', () => { mainWindow = null })
  void mainWindow.loadURL(`${ORIGIN}/`)
}

function openKeysWindow() {
  if (keysWindow) { keysWindow.focus(); return }
  keysWindow = new BrowserWindow({
    width: 640, height: 760, minWidth: 480, minHeight: 480,
    title: 'API keys — World of Data',
    backgroundColor: '#050b12',
    parent: mainWindow ?? undefined,
    webPreferences: { preload: path.join(__dirname, 'keys-preload.cjs'), contextIsolation: true, sandbox: true, nodeIntegration: false },
  })
  keysWindow.setMenuBarVisibility(false)
  keepNavigationInside(keysWindow, pathToFileURL(KEYS_PAGE).toString())
  keysWindow.on('closed', () => { keysWindow = null })
  void keysWindow.loadFile(KEYS_PAGE)
}

function buildMenu() {
  const keysItem: MenuItemConstructorOptions = { label: 'API Keys…', accelerator: 'CmdOrCtrl+Shift+K', click: openKeysWindow }
  const template: MenuItemConstructorOptions[] = process.platform === 'darwin'
    ? [
        { label: app.name, submenu: [{ role: 'about' }, { type: 'separator' }, keysItem, { type: 'separator' }, { role: 'hide' }, { role: 'hideOthers' }, { role: 'unhide' }, { type: 'separator' }, { role: 'quit' }] },
        { role: 'editMenu' }, { role: 'viewMenu' }, { role: 'windowMenu' },
      ]
    : [
        { label: 'File', submenu: [keysItem, { type: 'separator' }, { role: 'quit' }] },
        { role: 'editMenu' }, { role: 'viewMenu' }, { role: 'windowMenu' },
      ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

// ── IPC ──────────────────────────────────────────────────────────────────────
/** Key reads and writes are only answered for the key window's own page. */
function fromKeysPage(e: Electron.IpcMainInvokeEvent) {
  return e.senderFrame?.url === pathToFileURL(KEYS_PAGE).toString()
}

ipcMain.on('desktop:client-env', (e) => { e.returnValue = clientEnv(keys) })
ipcMain.on('desktop:open-keys', () => openKeysWindow())
ipcMain.handle('keys:load', (e) => {
  if (!fromKeysPage(e)) throw new Error('not allowed')
  return { fields: KEY_FIELDS, values: keys, encryption: safeStorage.isEncryptionAvailable() }
})
ipcMain.handle('keys:save', (e, input: unknown) => {
  if (!fromKeysPage(e)) throw new Error('not allowed')
  keys = sanitizeKeys(input)
  const encrypted = saveKeys(keys)
  applyServerEnv(keys)
  if (mainWindow) mainWindow.webContents.reload()
  else createMainWindow()
  return { encrypted }
})
/** Lets the user pick a .env file; its known keys come back to fill the form, unsaved. */
ipcMain.handle('keys:import-env', async (e) => {
  if (!fromKeysPage(e)) throw new Error('not allowed')
  const win = BrowserWindow.fromWebContents(e.sender)
  const opts: Electron.OpenDialogOptions = { title: 'Import keys from a .env file', properties: ['openFile', 'showHiddenFiles'] }
  const picked = win ? await dialog.showOpenDialog(win, opts) : await dialog.showOpenDialog(opts)
  if (picked.canceled || !picked.filePaths[0]) return null
  return parseEnvFile(fs.readFileSync(picked.filePaths[0], 'utf8'))
})
ipcMain.on('keys:open-url', (e, url: unknown) => {
  if (e.senderFrame?.url !== pathToFileURL(KEYS_PAGE).toString()) return
  if (typeof url === 'string' && KEY_FIELDS.some(f => f.url === url)) void shell.openExternal(url)
})

// ── Lifecycle ────────────────────────────────────────────────────────────────
if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (!mainWindow) return
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.focus()
  })

  void app.whenReady().then(() => {
    keys = loadKeys()
    applyServerEnv(keys)
    protocol.handle(SCHEME, handleScheme)
    buildMenu()
    createMainWindow()
    // First run: without a Mapbox token there is no map, so ask for keys straight away.
    if (!keys.VITE_MAPBOX_TOKEN) openKeysWindow()

    app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createMainWindow() })
  })

  app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })
}
