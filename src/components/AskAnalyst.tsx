import { createContext, useContext } from 'react'
import { Sparkles } from 'lucide-react'

/**
 * How a forecast or a country view hands a question to the AI Analyst: the app opens the analyst with that text in its
 * input, unsent. Outside the app (tests, previews) there is no provider and the button is not drawn.
 */
export const AskAnalystContext = createContext<((draft: string) => void) | null>(null)

export function AskAnalystButton({ draft, className = 'cy-btn' }: { draft: string; className?: string }) {
  const ask = useContext(AskAnalystContext)
  if (!ask) return null
  return (
    <button className={className} onClick={() => ask(draft)}
      title="Opens the AI Analyst with a question ready to edit. Nothing is sent until you press Send. Its answers are inference, not evidence.">
      <Sparkles size={12} /> Ask the analyst
    </button>
  )
}
