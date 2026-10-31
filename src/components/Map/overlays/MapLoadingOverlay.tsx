import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'

/** How long a retrieval must run before the overlay appears, so quick loads don't flash it. */
export const LOADING_OVERLAY_DELAY_MS = 1000

/** Centred "Loading map data" pill, shown only once `busy` has stayed true for LOADING_OVERLAY_DELAY_MS. */
export default function MapLoadingOverlay({ busy }: { busy: boolean }) {
  const [shown, setShown] = useState(false)
  useEffect(() => {
    if (!busy) { setShown(false); return }
    const timer = setTimeout(() => setShown(true), LOADING_OVERLAY_DELAY_MS)
    return () => clearTimeout(timer)
  }, [busy])
  if (!shown) return null
  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position:'absolute', top:'50%', left:'50%', transform:'translate(-50%, -50%)', zIndex:5, pointerEvents:'none',
        display:'flex', alignItems:'center', gap:8, padding:'8px 14px',
        background:'var(--surface)', color:'var(--text2)', border:'1px solid var(--border)',
        borderRadius:'var(--r-pill)', boxShadow:'var(--shadow-md)', fontSize:12,
      }}
    >
      <Loader2 size={14} strokeWidth={1.8} className="ai-spin" aria-hidden />
      Loading map data…
    </div>
  )
}
