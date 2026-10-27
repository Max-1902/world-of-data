import { useState } from 'react'
import { Activity, ArrowLeftRight, BarChart3, Bookmark, BookOpen, ChevronDown, Compass, Cpu, Database, Globe2, Home, Layers, LineChart, Map, ShieldHalf, Sparkles, Users, Wind } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { GROUP_ORDER, panelsForGroup } from '../panels/registry'
import type { PanelGroup } from '../panels/types'

interface Props {
  activeGroup: PanelGroup
  onGroupChange: (g: PanelGroup) => void
  poppedOut: Set<string>
  isHome?: boolean
  onHome?: () => void
  onOpenLibrary?: () => void
  onFocusPanel?: (id: string) => void
  focusPanel?: { id: string; n: number } | null
  libraryOpen?: boolean
}

const WORKSPACE_ICONS: Record<PanelGroup, LucideIcon> = {
  overview: Activity,
  news: Sparkles,
  geo: Layers,
  security: ShieldHalf,
  markets: LineChart,
  analysis: BookOpen,
  country: Globe2,
}

const PRESETS: { label: string; icon: LucideIcon; group: PanelGroup; panel: string; title: string }[] = [
  { label: 'Global Economy', icon: BarChart3, group: 'markets', panel: 'economy', title: 'GDP, trade and macroeconomic indicators' },
  { label: 'Energy & Climate', icon: Wind, group: 'geo', panel: 'infraIndicators', title: 'Electricity, energy and environmental indicators' },
  { label: 'Health & Society', icon: Users, group: 'analysis', panel: 'countryAnalytics', title: 'Compare health and social indicators by country' },
  { label: 'Education', icon: BookOpen, group: 'country', panel: 'countryLookup', title: 'Country education and literacy data' },
  { label: 'Technology', icon: Cpu, group: 'geo', panel: 'datacenters', title: 'Data centers and technology infrastructure' },
  { label: 'Trade & Finance', icon: ArrowLeftRight, group: 'markets', panel: 'exposure', title: 'Trade connections and economic exposure' },
]

function NavItem({ icon: Icon, label, active, onClick, title }: {
  icon: LucideIcon; label: string; active: boolean; onClick: () => void; title?: string
}) {
  return <button className={`new-nav-item${active ? ' active' : ''}`} onClick={onClick} aria-current={active ? 'page' : undefined} title={title}><Icon size={17} strokeWidth={1.8} /><span>{label}</span></button>
}

export default function Sidebar({ activeGroup, onGroupChange, poppedOut, isHome = false, onHome = () => {}, onOpenLibrary = () => {}, onFocusPanel = () => {}, focusPanel, libraryOpen = false }: Props) {
  const [moreOpen, setMoreOpen] = useState(false)
  const go = (group: PanelGroup, panel?: string) => {
    onGroupChange(group)
    if (panel) onFocusPanel(panel)
  }
  const panelIs = (id: string) => focusPanel?.id === id

  return (
    <aside className="sidebar expanded new-sidebar" aria-label="Main navigation">
      <div className="new-brand">
        <div className="new-brand-mark"><Globe2 size={20} strokeWidth={1.8} /></div>
        <div><strong>World of Data</strong><small>Real data, a clearer world.</small></div>
      </div>

      <nav className="new-primary-nav" aria-label="Explore">
        <NavItem icon={Home} label="Home" active={isHome} onClick={onHome} />
        <NavItem icon={Globe2} label="Countries" active={!isHome && activeGroup === 'country'} onClick={() => go('country')} />
        <NavItem icon={Compass} label="Explore" active={!isHome && activeGroup === 'overview'} onClick={() => go('overview')} />
        <NavItem icon={Activity} label="Indicators" active={!isHome && activeGroup === 'markets'} onClick={() => go('markets')} />
        <NavItem icon={ArrowLeftRight} label="Compare" active={!isHome && activeGroup === 'analysis' && panelIs('countryAnalytics')} onClick={() => go('analysis', 'countryAnalytics')} />
        <NavItem icon={Map} label="Maps" active={!isHome && activeGroup === 'geo'} onClick={() => go('geo')} />
        <NavItem icon={LineChart} label="Visualizations" active={!isHome && activeGroup === 'analysis' && panelIs('analytics')} onClick={() => go('analysis', 'analytics')} />
        <NavItem icon={Database} label="Datasets" active={libraryOpen} onClick={onOpenLibrary} />
        <NavItem icon={Bookmark} label="Saved" active={!isHome && activeGroup === 'overview' && panelIs('watchlist')} onClick={() => go('overview', 'watchlist')} />
        <NavItem icon={BookOpen} label="Notes" active={!isHome && activeGroup === 'analysis' && panelIs('analyst')} title="Saved analyst conversations" onClick={() => go('analysis', 'analyst')} />
      </nav>

      <div className="new-sidebar-section new-presets">
        <div className="new-sidebar-label">PRESETS</div>
        {PRESETS.map(({ label, icon: Icon, group, panel, title }) => (
          <button className="new-preset-item" key={label} onClick={() => go(group, panel)} title={title}>
            <Icon size={13} strokeWidth={1.8} /><span>{label}</span>
          </button>
        ))}
      </div>

      <div className="new-sidebar-more">
        <button className="new-sidebar-more-toggle" onClick={() => setMoreOpen(v => !v)} aria-expanded={moreOpen}>
          <Layers size={14} /> More workspaces <ChevronDown size={13} className={moreOpen ? 'rotated' : ''} />
        </button>
        {moreOpen && <div className="new-more-list">
          {GROUP_ORDER.map(({ id, label }) => {
            const count = panelsForGroup(id).filter(p => !poppedOut.has(p.id)).length
            const Icon = WORKSPACE_ICONS[id]
            return <button key={id} className={`new-workspace-item${!isHome && activeGroup === id ? ' active' : ''}`} onClick={() => go(id)} aria-pressed={!isHome && activeGroup === id} aria-label={label}>
              <Icon size={13} strokeWidth={1.8} /><span>{label === 'FORECASTS & ANALYSIS' ? 'FORECASTS & ANALYSIS' : label}</span><b>{count}</b>
            </button>
          })}
        </div>}
      </div>

      <div className="new-sidebar-bottom">
        <div className="new-sidebar-note"><span className="new-live-dot" /> Research workspace</div>
      </div>
    </aside>
  )
}
