import {
  BookOpen, LayoutDashboard, LineChart, Radio, ShieldHalf, Network,
  Swords, Radiation, Factory, Pickaxe, Users, ArrowLeftRight, Package, Landmark,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { GROUP_ORDER, panelsForGroup } from '../panels/registry'
import type { PanelGroup } from '../panels/types'

const GROUP_ICONS: Record<PanelGroup, LucideIcon> = {
  overview: LayoutDashboard,
  news:     Radio,
  geo:      Network,
  security: ShieldHalf,
  markets:  LineChart,
  analysis: BookOpen,
  militaryInstallations:  Swords,
  nuclearFacilities:      Radiation,
  infrastructureSites:    Factory,
  resourcesByCountry:     Pickaxe,
  forceSize:              Users,
  tradePartnersByCountry: ArrowLeftRight,
  tradeProductsByCountry: Package,
  economicData:           Landmark,
}

const GROUP_HINTS: Record<PanelGroup, string> = {
  overview: 'Global situation and active risk',
  news: 'Reporting and live media/webcam sources',
  geo: 'Connectivity, overlays, and humanitarian data',
  security: 'Military, airspace, sanctions, and trafficking',
  markets: 'Trade, markets, and resource production',
  analysis: 'Briefings and regional outlook',
  militaryInstallations: 'Military bases by country — click to fly to',
  nuclearFacilities: 'Reactors & weapons sites by country — click to fly to',
  infrastructureSites: 'Dams, pipelines, LNG, power plants by country',
  resourcesByCountry: 'Critical minerals & commodities by country',
  forceSize: 'Armed forces personnel ranked by country (World Bank)',
  tradePartnersByCountry: 'Top export/import partner countries by country',
  tradeProductsByCountry: 'Top exported/imported product categories by country',
  economicData: 'World Bank economic indicators by country',
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
      {GROUP_ORDER.map(g => {
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
            <span className="sidebar-label">{g.label}</span>
            <span className="count">{count}</span>
          </button>
        )
      })}
    </div>
  )
}
