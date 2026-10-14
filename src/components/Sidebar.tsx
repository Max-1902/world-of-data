import { BookOpen, LayoutDashboard, LineChart, Radio, ShieldHalf, Network, SearchCheck } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { GROUP_ORDER, SIDEBAR_SECTIONS, panelsForGroup } from '../panels/registry'
import type { PanelGroup } from '../panels/types'

const GROUP_ICONS: Record<PanelGroup, LucideIcon> = {
  overview: LayoutDashboard,
  news:     Radio,
  geo:      Network,
  security: ShieldHalf,
  markets:  LineChart,
  analysis: BookOpen,
  country:  SearchCheck,
}

const GROUP_HINTS: Record<PanelGroup, string> = {
  overview: 'Global situation and active risk',
  news: 'Reporting, search briefings and live media/webcam sources',
  geo: 'Connectivity, disasters, humanitarian, energy and data-center sites',
  security: 'Sanctions, bases, force size, nuclear sites, airspace, trafficking',
  markets: 'Markets, trade partners & products, resources, economic indicators',
  analysis: 'Backtested forecasts, the AI analyst and open-ended data analytics',
  country: 'One country in depth: World Bank record, ECB/Eurostat for Europe, economic analysis',
}

/** Sidebar-only break points (soft hyphen) for labels too long for the column; the canonical label stays searchable. */
const LABEL_BREAKS: Partial<Record<PanelGroup, string>> = {
  geo: 'INFRA\u00ADSTRUCTURE',
}

interface Props {
  activeGroup: PanelGroup
  onGroupChange: (g: PanelGroup) => void
  poppedOut: Set<string>
}

export default function Sidebar({ activeGroup, onGroupChange, poppedOut }: Props) {
  return (
    <div className="sidebar expanded">
      <div className="sidebar-heading">WORKSPACES</div>
      {SIDEBAR_SECTIONS.map(section => (
        <div key={section.label} className="sidebar-section" role="group" aria-label={section.label}>
          <div className="sidebar-heading sidebar-subheading">{section.label}</div>
          {GROUP_ORDER.filter(g => section.groups.includes(g.id)).map(g => {
            const Icon = GROUP_ICONS[g.id]
            const isActive = g.id === activeGroup
            const count = panelsForGroup(g.id).filter(p => !poppedOut.has(p.id)).length
            return (
              <button
                key={g.id}
                onClick={() => onGroupChange(g.id)}
                className={`sidebar-item${isActive ? ' active' : ''}`}
                title={GROUP_HINTS[g.id]}
                aria-pressed={isActive}
              >
                <Icon size={14} strokeWidth={1.8} />
                <span className="sidebar-label" lang="en">{LABEL_BREAKS[g.id] ?? g.label}</span>
                <span className="count">{count}</span>
              </button>
            )
          })}
        </div>
      ))}
    </div>
  )
}
