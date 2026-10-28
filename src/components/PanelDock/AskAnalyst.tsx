import { Sparkles } from 'lucide-react'
import type { PanelGroup } from '../../panels/types'
import { useAnalystWindow } from '../panels/aiAnalyst/AnalystWindow'

/** Dock banners that offer the analyst: the forecasts and the shock-exposure tool, where the questions come up. */
const OFFERED_AT: Partial<Record<PanelGroup, string>> = { analysis: 'forecasts', markets: 'exposure' }

export const offersAnalyst = (group: PanelGroup, sectionId: string) => OFFERED_AT[group] === sectionId

/** Opens the one shared analyst as a floating window over the dashboard (or brings its separate window forward). */
export function AskAnalyst() {
  const analyst = useAnalystWindow()
  if (!analyst) return null
  const open = () => (analyst.mode === 'window' ? analyst.reveal() : analyst.popOut())
  return (
    <button className="dock-section-action" onClick={open} title="Ask a language model about the data on this dashboard. Its answers are inference, not evidence.">
      <Sparkles size={12} /> Ask the AI analyst
    </button>
  )
}
