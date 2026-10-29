import { Bookmark, Globe2, Menu, RefreshCw, Settings2, X } from 'lucide-react'
import type { MapViewMode, PanelState } from '../types'
import SmartSearch from './SmartSearch'
import SourceHealth from './SourceHealth'
import { useWatchlist } from '../hooks/useWatchlist'

interface Props {
  viewMode: MapViewMode
  onViewMode: (m: MapViewMode) => void
  searchQuery: string
  onSearch: (q: string) => void
  onOpenPanel: (id: string) => void
  onOpenLibrary?: () => void
  onToggleLayer: (id: keyof PanelState) => void
  onColorCountries?: (indicatorId: string) => void
  onSettingsOpen?: () => void
  onReloadAll?: () => void
  reloading?: boolean
  onHome: () => void
  /** phones: toggles the navigation drawer (the button is hidden on wider screens) */
  onMenu?: () => void
  menuOpen?: boolean
  /** the Saved page is showing (the sidebar's Saved entry is the destination; this button is its shortcut) */
  savedActive?: boolean
}

export default function TopBar({ viewMode, onViewMode, searchQuery, onSearch, onOpenPanel, onOpenLibrary, onToggleLayer, onColorCountries, onSettingsOpen, onReloadAll, reloading, onHome, onMenu, menuOpen = false, savedActive = false }: Props) {
  const unread = useWatchlist().alerts.filter(a => !a.read).length
  const savedLabel = unread > 0 ? `Saved countries, ${unread} new alert${unread === 1 ? '' : 's'}` : 'Saved countries'
  return (
    <header className="topbar new-topbar">
      <button className="new-icon-button new-menu-button" onClick={onMenu} aria-label={menuOpen ? 'Close navigation menu' : 'Open navigation menu'} aria-expanded={menuOpen} aria-controls="main-navigation">
        {menuOpen ? <X size={18} /> : <Menu size={18} />}
      </button>
      <button className="new-mobile-brand" onClick={onHome} aria-label="World of Data home">
        <span className="new-brand-mark"><Globe2 size={17} /></span>
        <span><strong>World of Data</strong><small>Real data, a clearer world.</small></span>
      </button>
      <div className="new-search-shell">
        <SmartSearch
          searchQuery={searchQuery}
          onSearch={onSearch}
          onOpenPanel={onOpenPanel}
          onOpenLibrary={onOpenLibrary}
          onToggleLayer={onToggleLayer}
          onColorCountries={onColorCountries}
          onViewMode={onViewMode}
        />
        <kbd>⌘ K</kbd>
      </div>
      <div className="new-header-actions">
        <SourceHealth />
        <button onClick={onReloadAll} disabled={reloading} className="new-icon-button" title="Reload data" aria-label="Reload data">
          <RefreshCw size={16} className={reloading ? 'animate-spin' : ''} />
        </button>
        <button onClick={() => onOpenPanel('watchlist')} className={`new-icon-button${savedActive ? ' active' : ''}`} title={`${savedLabel} (shortcut to Saved)`} aria-label={savedLabel} aria-current={savedActive ? 'page' : undefined}>
          <Bookmark size={16} />
          {unread > 0 && <span className="new-icon-badge" aria-hidden="true">{unread > 9 ? '9+' : unread}</span>}
        </button>
        <button onClick={onSettingsOpen} className="new-icon-button" title="Settings" aria-label="Settings"><Settings2 size={17} /></button>
        <div className="new-avatar" aria-label="User profile">W</div>
      </div>
    </header>
  )
}
