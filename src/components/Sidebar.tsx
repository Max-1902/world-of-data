import { Radio, MapPinned, ShieldHalf, LineChart, Sparkles } from 'lucide-react'
import { GROUP_ORDER, panelsForGroup } from '../panels/registry'
import type { PanelGroup } from '../panels/types'

const GROUP_ICONS: Record<PanelGroup, typeof Radio> = {
  intel: Radio,
  geo:   MapPinned,
  mil:   ShieldHalf,
  fin:   LineChart,
  ai:    Sparkles,
}

interface Props {
  activeGroup: PanelGroup
  onGroupChange: (g: PanelGroup) => void
  poppedOut: Set<string>
}

export default function Sidebar({ activeGroup, onGroupChange, poppedOut }: Props) {
  return (
    <div className="sidebar expanded">
      {GROUP_ORDER.map(g => {
        const Icon = GROUP_ICONS[g.id]
        const isActive = g.id === activeGroup
        const count = panelsForGroup(g.id).filter(p => !poppedOut.has(p.id)).length
        return (
          <button
            key={g.id}
            onClick={() => onGroupChange(g.id)}
            className={`sidebar-item${isActive ? ' active' : ''}`}
            title={g.label}
          >
            <Icon size={15} strokeWidth={2} />
            <span>{g.label}</span>
            <span className="count">{count}</span>
          </button>
        )
      })}
    </div>
  )
}
