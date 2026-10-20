import { useEffect, useState } from 'react'
import { fetchDisplacement, type DisplacementSnapshot } from '../services/displacement'
import { fetchDtm, type DtmResult } from '../services/dtm'
import { onGlobalReload } from '../utils/reloadBus'

export type DisplacementState =
  | { status: 'loading' }
  | { status: 'ok'; snap: DisplacementSnapshot }
  | { status: 'error' }

/** UNHCR corridors + country totals. Pass `enabled=false` to skip fetching (e.g. layer hidden). */
export function useDisplacement(enabled = true): DisplacementState {
  const [state, setState] = useState<DisplacementState>({ status: 'loading' })
  useEffect(() => {
    if (!enabled) return
    let alive = true
    const load = () => fetchDisplacement().then(snap => {
      if (alive) setState(snap ? { status: 'ok', snap } : { status: 'error' })
    })
    load()
    const unsub = onGlobalReload(load)
    return () => { alive = false; unsub() }
  }, [enabled])
  return state
}

/** IOM DTM rounds for one country; `null` while loading or when no country is given. */
export function useDtm(iso3: string | null): DtmResult | null {
  const [result, setResult] = useState<DtmResult | null>(null)
  useEffect(() => {
    setResult(null)
    if (!iso3) return
    let alive = true
    fetchDtm(iso3).then(r => { if (alive) setResult(r) })
    return () => { alive = false }
  }, [iso3])
  return result
}
