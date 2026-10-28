import { useState } from 'react'
import { ArrowLeftRight, Bookmark, Compass, ChevronDown, Database, Layers, MapPinned, Network, Newspaper, Radar, ShieldHalf, TrendingUp, Globe2, Activity, Telescope } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { PanelGroup } from '../panels/types'

interface Props {
  activeGroup: PanelGroup
  onGroupChange: (g: PanelGroup) => void
  isHome?: boolean
  onHome?: () => void
  /** the map destination is showing (it is not one of the dock workspaces) */
  isMap?: boolean
  onMap?: () => void
  onOpenLibrary?: () => void
  onFocusPanel?: (id: string) => void
  focusPanel?: { id: string; n: number } | null
  libraryOpen?: boolean
}

/** The six entries of the main navigation, plus the four context workspaces folded under "More". */
export type NavSection =
  | 'outlook' | 'forecasts' | 'drivers' | 'countries' | 'map' | 'explore' | 'saved'
  | 'risk' | 'security' | 'infrastructure' | 'news'

/** Dock panels that belong to Drivers: the trade and resource links that shocks travel along. */
const DRIVER_PANELS = new Set(['drivers', 'exposure', 'tradePartnersByCountry', 'tradeProductsByCountry', 'resources', 'resourcesByCountry'])
/** Panels in the forecasting workspace that are open-ended exploration rather than forecasts. */
const EXPLORE_ANALYSIS_PANELS = new Set(['countryAnalytics', 'analytics'])

const MORE: { section: NavSection; label: string; icon: LucideIcon; group: PanelGroup }[] = [
  { section: 'risk', label: 'Risk monitor', icon: Radar, group: 'overview' },
  { section: 'security', label: 'Security & defence', icon: ShieldHalf, group: 'security' },
  { section: 'infrastructure', label: 'Infrastructure & hazards', icon: Layers, group: 'geo' },
  { section: 'news', label: 'News', icon: Newspaper, group: 'news' },
]

/**
 * Which navigation entry the current view belongs to. The focused panel outlives a workspace switch, so it only
 * counts for the workspace it lives in.
 */
export function navSection(isHome: boolean, group: PanelGroup, focusId?: string, isMap = false): NavSection {
  if (isHome) return 'outlook'
  if (isMap) return 'map'
  switch (group) {
    case 'analysis': return focusId && EXPLORE_ANALYSIS_PANELS.has(focusId) ? 'explore' : 'forecasts'
    case 'markets': return focusId && DRIVER_PANELS.has(focusId) ? 'drivers' : 'explore'
    case 'country': return 'countries'
    case 'overview': return focusId === 'watchlist' ? 'saved' : 'risk'
    case 'security': return 'security'
    case 'geo': return 'infrastructure'
    case 'news': return 'news'
  }
}

function NavItem({ icon: Icon, label, active, onClick, title, sub = false }: {
  icon: LucideIcon; label: string; active: boolean; onClick: () => void; title?: string; sub?: boolean
}) {
  return <button className={`new-nav-item${sub ? ' sub' : ''}${active ? ' active' : ''}`} onClick={onClick} aria-current={active ? 'page' : undefined} title={title}><Icon size={sub ? 14 : 17} strokeWidth={1.8} /><span>{label}</span></button>
}

export default function Sidebar({ activeGroup, onGroupChange, isHome = false, onHome = () => {}, isMap = false, onMap = () => {}, onOpenLibrary = () => {}, onFocusPanel = () => {}, focusPanel, libraryOpen = false }: Props) {
  const [moreOpen, setMoreOpen] = useState(false)
  const go = (group: PanelGroup, panel?: string) => {
    onGroupChange(group)
    if (panel) onFocusPanel(panel)
  }
  const current = navSection(isHome, activeGroup, focusPanel?.id, isMap)
  const inMore = MORE.some(m => m.section === current)
  // never hide the entry you are standing on
  const showMore = moreOpen || inMore

  return (
    <aside className="sidebar expanded new-sidebar" aria-label="Main navigation">
      <div className="new-brand">
        <div className="new-brand-mark"><Globe2 size={20} strokeWidth={1.8} /></div>
        <div><strong>World of Data</strong><small>Real data, a clearer world.</small></div>
      </div>

      {/* Ordered by what the dashboard is for: the outlook, the forecasts, what drives them, then the countries and the raw data */}
      <nav className="new-primary-nav" aria-label="Main">
        <NavItem icon={Compass} label="Outlook" title="The world's economic outlook at a glance" active={current === 'outlook'} onClick={onHome} />
        <NavItem icon={TrendingUp} label="Forecasts" title="GDP-growth forecast and this quarter's nowcast, backtested, beside the IMF's" active={current === 'forecasts'} onClick={() => go('analysis', 'predictions')} />
        <NavItem icon={Network} label="Drivers" title="Which indicators improve the GDP forecast (tested out of sample), and the trade links a shock travels along" active={current === 'drivers'} onClick={() => go('markets', 'drivers')} />
        <NavItem icon={Globe2} label="Countries" title="One country's full record" active={current === 'countries'} onClick={() => go('country', 'countries')} />
        <NavItem icon={MapPinned} label="Map" title="Only the map: click a country for its overview, a city or region for its local outlook" active={current === 'map'} onClick={onMap} />
        <NavItem icon={Telescope} label="Explore" title="Indicators, country comparison and every dataset" active={current === 'explore'} onClick={() => go('markets', 'economy')} />
        {current === 'explore' && (
          <div className="new-nav-subgroup">
            <NavItem sub icon={Activity} label="Indicators" active={activeGroup === 'markets'} onClick={() => go('markets', 'economy')} />
            <NavItem sub icon={ArrowLeftRight} label="Compare" active={activeGroup === 'analysis'} onClick={() => go('analysis', 'countryAnalytics')} />
            <NavItem sub icon={Database} label="Datasets" title="Every panel, searchable" active={libraryOpen} onClick={onOpenLibrary} />
          </div>
        )}
        <NavItem icon={Bookmark} label="Saved" title="Countries you watch, with alerts" active={current === 'saved'} onClick={() => go('overview', 'watchlist')} />
      </nav>

      <div className="new-sidebar-more">
        <button className="new-sidebar-more-toggle" onClick={() => setMoreOpen(v => !v)} aria-expanded={showMore}>
          <Layers size={14} /> More <ChevronDown size={13} className={showMore ? 'rotated' : ''} />
        </button>
        {showMore && <div className="new-more-list">
          {MORE.map(({ section, label, icon, group }) => (
            <NavItem sub key={section} icon={icon} label={label} active={current === section} onClick={() => go(group)} />
          ))}
        </div>}
      </div>
    </aside>
  )
}
