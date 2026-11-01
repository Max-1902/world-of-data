// Browser-visible keys. The desktop app (desktop/preload.ts) hands the page the keys its user entered
// at launch, as window.__WOD_ENV__; those win over the ones Vite bundled from .env, so an installer
// built with no .env still gets a map. Each fallback is a static `import.meta.env.VITE_X` reference so
// Vite inlines only these three values (see the note in SettingsModal.tsx).
const desktop: Record<string, string | undefined> = (globalThis as { __WOD_ENV__?: Record<string, string> }).__WOD_ENV__ ?? {}

export const MAPBOX_TOKEN: string = desktop.VITE_MAPBOX_TOKEN || import.meta.env.VITE_MAPBOX_TOKEN || ''
export const NEWSAPI_KEY: string = desktop.VITE_NEWSAPI_KEY || import.meta.env.VITE_NEWSAPI_KEY || ''
export const AISSTREAM_KEY: string = desktop.VITE_AISSTREAM_KEY || import.meta.env.VITE_AISSTREAM_KEY || ''

/** The desktop shell's bridge, when the page runs inside it (desktop/preload.ts). */
export const desktopBridge: { openKeys: () => void } | undefined = (globalThis as { desktop?: { openKeys: () => void } }).desktop
