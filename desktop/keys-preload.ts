// Preload for the key window (keys-window/keys.html), the only page allowed to read or save keys.
import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('keyStore', {
  load: () => ipcRenderer.invoke('keys:load'),
  save: (values: Record<string, string>) => ipcRenderer.invoke('keys:save', values),
  importEnv: () => ipcRenderer.invoke('keys:import-env'),
  openUrl: (url: string) => ipcRenderer.send('keys:open-url', url),
})
