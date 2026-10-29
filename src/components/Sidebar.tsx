import { useEffect } from 'react'
import { ArrowLeftRight, Bookmark, Compass, Database, Layers, MapPinned, Network, Newspaper, Radar, ShieldHalf, TrendingUp, Globe2, Flag, Activity, Telescope } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { PanelGroup } from '../panels/types'
import { DEFAULT_VIEW, viewOf } from '../panels/destinations'

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
  /** phones only: the sidebar is an off-canvas drawer, opened from the top bar's menu button */
  mobileOpen?: boolean
  onMobileClose?: () => void
}

/** The six entries of the main navigation, plus the four context workspaces folded under "More". */
export type NavSection =
  | 'outlook' | 'forecasts' | 'drivers' | 'countries' | 'map' | 'explore' | 'saved'
  | 'risk' | 'security' | 'infrastructure' | 'news'

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
    case 'analysis':
    case 'markets': return (focusId && viewOf(group, focusId)) || DEFAULT_VIEW[group]!
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

export default function Sidebar({ activeGroup, onGroupChange, isHome = false, onHome = () => {}, isMap = false, onMap = () => {}, onOpenLibrary = () => {}, onFocusPanel = () => {}, focusPanel, libraryOpen = false, mobileOpen = false, onMobileClose = () => {} }: Props) {
  // choosing a destination closes the phone drawer; on wider screens there is no drawer state to close
  const then = (fn: () => void) => () => { fn(); onMobileClose() }
  const go = (group: PanelGroup, panel?: string, keepOpen = false) => () => {
    onGroupChange(group)
    if (panel) onFocusPanel(panel)
    if (!keepOpen) onMobileClose()
  }
  useEffect(() => {
    if (!mobileOpen) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onMobileClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [mobileOpen, onMobileClose])
  const current = navSection(isHome, activeGroup, focusPanel?.id, isMap)

  return (
    <>
    {mobileOpen && <button className="new-nav-scrim" onClick={onMobileClose} aria-label="Close menu" />}
    <aside id="main-navigation" className={`sidebar expanded new-sidebar${mobileOpen ? ' mobile-open' : ''}`} aria-label="Main navigation">
      <div className="new-brand">
        <div className="new-brand-mark"><Globe2 size={20} strokeWidth={1.8} /></div>
        <div><strong>World of Data</strong><small>Real data, a clearer world.</small></div>
      </div>

      {/* Ordered by what the dashboard is for: the outlook, the forecasts, what drives them, then the countries and the raw data */}
      <nav className="new-primary-nav" aria-label="Main">
        <NavItem icon={Compass} label="Outlook" title="The world's economic outlook at a glance" active={current === 'outlook'} onClick={then(onHome)} />
        <NavItem icon={TrendingUp} label="Forecasts" title="GDP-growth forecast and this quarter's nowcast, backtested, beside the IMF's" active={current === 'forecasts'} onClick={go('analysis', 'predictions')} />
        <NavItem icon={Network} label="Drivers" title="Which indicators improve the GDP forecast (tested out of sample), and the trade links a shock travels along" active={current === 'drivers'} onClick={go('markets', 'drivers')} />
        <NavItem icon={Flag} label="Countries" title="One country's full record" active={current === 'countries'} onClick={go('country', 'countries')} />
        <NavItem icon={MapPinned} label="Map" title="Only the map: click a country for its overview, a city or region for its local outlook" active={current === 'map'} onClick={then(onMap)} />
        <NavItem icon={Telescope} label="Explore" title="Indicators, country comparison and every dataset" active={current === 'explore'} onClick={go('markets', 'economy', true)} />
        <div className="new-nav-subgroup">
          <NavItem sub icon={Activity} label="Indicators" active={current === 'explore' && activeGroup === 'markets'} onClick={go('markets', 'economy')} />
          <NavItem sub icon={ArrowLeftRight} label="Analysis" active={current === 'explore' && activeGroup === 'analysis'} onClick={go('analysis', 'countryAnalytics')} />
          <NavItem sub icon={Database} label="Datasets" title="Every panel, searchable" active={libraryOpen} onClick={then(onOpenLibrary)} />
        </div>
        <NavItem icon={Bookmark} label="Saved" title="Countries you watch, with alerts" active={current === 'saved'} onClick={go('overview', 'watchlist')} />
      </nav>

      <div className="new-sidebar-more">
        <div className="new-sidebar-more-label"><Layers size={14} /> More</div>
        <div className="new-more-list">
          {MORE.map(({ section, label, icon, group }) => (
            <NavItem sub key={section} icon={icon} label={label} active={current === section} onClick={go(group)} />
          ))}
        </div>
      </div>
    </aside>
    </>
  )
}
