import { app, BrowserWindow, Menu, dialog, ipcMain, session } from 'electron'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { getDb, closeDb } from './db'
import { registerIpcHandlers, loadCredentials } from './ipc'
import { setCredentials, startSyncInterval, sync } from './sync/engine'
import { CalDavCredentials } from "./sync/caldav.ts";


createRequire(import.meta.url)
const __dirname = path.dirname(fileURLToPath(import.meta.url))

// The built directory structure
//
// ├─┬─┬ dist
// │ │ └── index.html
// │ │
// │ ├─┬ dist-electron
// │ │ ├── main.js
// │ │ └── preload.mjs
// │
process.env.APP_ROOT = path.join(__dirname, '..')

// 🚧 Use ['ENV_NAME'] avoid vite:define plugin - Vite@2.x
export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, 'public') : RENDERER_DIST

let win: BrowserWindow | null

function createWindow() {
  win = new BrowserWindow({
    icon: path.join(process.env.VITE_PUBLIC, 'icon.ico'),
    frame: false,
    webPreferences: {
      preload:          path.join(__dirname, 'preload.mjs'),
      contextIsolation: true,
      nodeIntegration:  false,
      sandbox:          true,
    },
  })

  win.on('maximize',   () => win?.webContents.send('window:maximized', true))
  win.on('unmaximize', () => win?.webContents.send('window:maximized', false))

  const menu = Menu.buildFromTemplate([
    {
      label: 'File',
      submenu: [
        {
          label: 'New Journal Entry',
          accelerator: 'CmdOrCtrl+Shift+J',
          click: () => win?.webContents.send('menu-action', 'new-journal'),
        },
        {
          label: 'New Note',
          accelerator: 'CmdOrCtrl+Shift+N',
          click: () => win?.webContents.send('menu-action', 'new-note'),
        },
        {
          label: 'New Task',
          accelerator: 'CmdOrCtrl+Shift+T',
          click: () => win?.webContents.send('menu-action', 'new-task'),
        },
        { type: 'separator' },
        {
          label: 'Quit',
          accelerator: 'CmdOrCtrl+Q',
          click: () => app.quit(),
        },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { label: 'Undo', accelerator: 'CmdOrCtrl+Z', role: 'undo' },
        { label: 'Redo', accelerator: 'CmdOrCtrl+Y', role: 'redo' },
        { type: 'separator' },
        { label: 'Cut', accelerator: 'CmdOrCtrl+X', role: 'cut' },
        { label: 'Copy', accelerator: 'CmdOrCtrl+C', role: 'copy' },
        { label: 'Paste', accelerator: 'CmdOrCtrl+V', role: 'paste' },
        { label: 'Select All', accelerator: 'CmdOrCtrl+A', role: 'selectAll' },
      ],
    },
    {
      label: 'View',
      submenu: [
        {
          label: 'Sync Now',
          accelerator: 'CmdOrCtrl+Shift+S',
          click: () => win?.webContents.send('menu-action', 'sync-now'),
        },
        ...(!app.isPackaged ? [
          { type: 'separator' as const },
          { label: 'Reload', accelerator: 'CmdOrCtrl+R', role: 'reload' as const },
          { label: 'Force Reload', accelerator: 'CmdOrCtrl+Shift+R', role: 'forceReload' as const },
          { label: 'Toggle DevTools', accelerator: 'CmdOrCtrl+Shift+I', role: 'toggleDevTools' as const },
        ] : []),
      ],
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'About JTX Desktop',
          click: () => {
            dialog.showMessageBox({
              type: 'info',
              title: 'About JTX Desktop',
              message: 'JTX Desktop',
              detail: `Version ${app.getVersion()}\nA desktop companion for jtx Board.`,
            })
          },
        },
      ],
    },
  ])
  Menu.setApplicationMenu(menu)

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL)
  } else {
    win.loadFile(path.join(RENDERER_DIST, 'index.html'))
  }

    win.webContents.on('did-finish-load', () => {
        win?.webContents.send('main-process-message', (new Date).toLocaleString())
        sync().catch(err => console.error('startup sync error:', err))
    })
}

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
    win = null
  }
})

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

app.whenReady().then(async () => {
    // Only enforce CSP in production — Vite dev server needs 'unsafe-eval' for HMR/source maps
    if (!VITE_DEV_SERVER_URL) {
        session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
            callback({
                responseHeaders: {
                    ...details.responseHeaders,
                    'Content-Security-Policy': [
                        "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://*.tile.openstreetmap.org; connect-src 'self' https:; font-src 'self' data:; object-src 'none'; base-uri 'self';"
                    ],
                },
            })
        })
    }

    getDb()
    registerIpcHandlers()

    ipcMain.handle('window:minimize',    () => win?.minimize())
    ipcMain.handle('window:maximize',    () => win?.isMaximized() ? win?.unmaximize() : win?.maximize())
    ipcMain.handle('window:close',       () => win?.close())
    ipcMain.handle('window:isMaximized', () => win?.isMaximized() ?? false)

    createWindow()

    // Autoload saved credentials and start sync
    const savedCreds = loadCredentials()
    if (savedCreds) {
        setCredentials(savedCreds as unknown as CalDavCredentials)
        startSyncInterval()
    }
})

app.on('before-quit', () => {
    closeDb()     // close database cleanly on exit
})
