import { stateMediaInfo, stateMediaTitle } from '../services/stateMedia'

/** Small "STATE" tag after an outlet name when that outlet is state-owned or state-directed; renders nothing otherwise. */
export function StateMediaBadge({ source }: { source: string | undefined | null }) {
  const info = stateMediaInfo(source)
  if (!info) return null
  return <span className="state-media-tag" title={stateMediaTitle(info)}>STATE · {info.country.toUpperCase()}</span>
}
