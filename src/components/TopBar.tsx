import { Bookmark, Globe2, RefreshCw, Settings2 } from 'lucide-react'
import type { MapViewMode, PanelState } from '../types'
import SmartSearch from './SmartSearch'
import SourceHealth from './SourceHealth'

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
}

export default function TopBar({ viewMode, onViewMode, searchQuery, onSearch, onOpenPanel, onOpenLibrary, onToggleLayer, onColorCountries, onSettingsOpen, onReloadAll, reloading, onHome }: Props) {
  return (
    <header className="topbar new-topbar">
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
        <button onClick={() => onOpenPanel('watchlist')} className="new-icon-button" title="Saved countries" aria-label="Saved countries"><Bookmark size={16} /></button>
        <button onClick={onSettingsOpen} className="new-icon-button" title="Settings" aria-label="Settings"><Settings2 size={17} /></button>
        <div className="new-avatar" aria-label="User profile">W</div>
      </div>
    </header>
  )
}
