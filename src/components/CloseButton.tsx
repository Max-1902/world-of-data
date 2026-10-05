import { X } from 'lucide-react'
import type { CSSProperties } from 'react'

interface Props {
  onClick: () => void
  /** Accessible name — say what is being closed ("Close Signals panel"). */
  label?: string
  size?: number
  /** Pin to the top-right corner of the nearest positioned parent. */
  corner?: boolean
  style?: CSSProperties
}

/** The one close (✕) control used by every box and window, so they look and behave the same. */
export default function CloseButton({ onClick, label = 'Close', size = 13, corner = false, style }: Props) {
  return (
    <button
      type="button"
      className={`close-x${corner ? ' close-x-corner' : ''}`}
      aria-label={label}
      title={label}
      style={style}
      // Keep a click on ✕ from reaching a parent that opens/drags/selects (rows, draggable headers, backdrops).
      onMouseDown={e => e.stopPropagation()}
      onClick={e => { e.stopPropagation(); onClick() }}
    >
      <X size={size} strokeWidth={2.25} />
    </button>
  )
}
