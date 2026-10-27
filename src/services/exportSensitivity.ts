/**
 * Each trade-profile economy's export → GDP growth sensitivity (utils/sensitivity.ts), estimated once per session from
 * World Bank GDP growth and export volume growth for all 45 economies. Shared by the Shock Exposure panel
 * and the analyst's exposure tool. Rejects on a failed request; a later call retries.
 */
import { TRADE_PROFILES } from './tradeStats'
import { fetchSeriesForCountries } from './countryLookup'
import { exportSensitivity, SENS_FROM, type Sensitivity } from '../utils/sensitivity'

const BATCH = 15
const TIMEOUT_MS = 45_000

let load: Promise<Map<string, Sensitivity>> | null = null

export function loadSensitivities(): Promise<Map<string, Sensitivity>> {
  load ??= (async () => {
    const iso2s = TRADE_PROFILES.map(p => p.iso2)
    // the World Bank takes 12–14 s for all 45 economies in one request (measured 2026-10-27), so ask in batches, with
    // room to spare: one series at a time, its three batches in parallel
    const batches: string[][] = []
    for (let i = 0; i < iso2s.length; i += BATCH) batches.push(iso2s.slice(i, i + BATCH))
    const series = async (id: string) => Object.assign({}, ...await Promise.all(batches.map(b => fetchSeriesForCountries(b, id, SENS_FROM, TIMEOUT_MS)))) as Awaited<ReturnType<typeof fetchSeriesForCountries>>
    const gdp = await series('NY.GDP.MKTP.KD.ZG')
    const exp = await series('NE.EXP.GNFS.KD.ZG')
    const out = new Map<string, Sensitivity>()
    for (const c of iso2s) {
      const s = exportSensitivity(gdp[c]?.points ?? [], exp[c]?.points ?? [])
      if (s) out.set(c, s)
    }
    return out
  })().catch(e => { load = null; throw e })
  return load
}
