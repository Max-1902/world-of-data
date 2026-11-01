// Preload for the app window: hands the page its browser-visible keys before any app code runs
// (read by src/runtimeEnv.ts) and a way to open the key window. Server keys never reach this page.
import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('__WOD_ENV__', ipcRenderer.sendSync('desktop:client-env'))
contextBridge.exposeInMainWorld('desktop', { openKeys: () => ipcRenderer.send('desktop:open-keys') })
