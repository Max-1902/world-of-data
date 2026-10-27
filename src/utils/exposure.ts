/**
 * Shock exposure: which economies a shock reaches, by how much, and through which link. Pure, no network.
 *
 * Every result carries its path, step by step, and every step says what kind of claim it is (`EvidenceKind`):
 * observed figures from a named source, or an assumption the shock itself makes. Nothing here is estimated, so no step is
 * "statistical"; the numbers are arithmetic on reported figures.
 *
 * Links used (all already in the app, all sourced):
 *  - partner shares of each reporter's goods exports / imports — UN Comtrade, top 6 partners per reporter, 45 reporters
 *  - goods exports / imports in US$ and the HS 27 ("mineral fuels, oil & gas") share of each — UN Comtrade
 *  - GDP in current US$ — World Bank (NY.GDP.MKTP.CD)
 *  - oil flow through each chokepoint — U.S. EIA, World Oil Transit Chokepoints
 *
 * What the data cannot say, and so the results never claim: which country's cargo passes which chokepoint (EIA gives one
 * total per strait), services trade, value added (gross flows count re-exports), second-round effects, or substitution.
 * A partner outside a reporter's top 6 is only known to take less than the 6th-largest share, so it is an upper bound.
 */
import type { TradeProfile } from '../services/tradeStats'
import type { Chokepoint } from '../services/chokepoints'
import type { EvidenceKind } from './evidence'
import type { Sensitivity } from './sensitivity'

export interface Step {
  kind: EvidenceKind
  text: string
  source?: string
  year?: string
}

export interface ExposureRow {
  iso2: string
  name: string
  /** exposure as % of GDP: the value, or the range it is known to lie in */
  lo: number
  hi: number
  /** true when lo/hi differ: a share outside the top-6 partners or products is only bounded */
  bounded: boolean
  /** oil shocks: whether a higher oil price costs (net fuel importer) or pays (net exporter) */
  direction?: 'loss' | 'gain' | 'unclear'
  /** oil shocks: signed net fuel trade, % of GDP (positive = net exporter) */
  net?: { lo: number; hi: number }
  /** first-order effect of the assumed shock size, % of GDP (range when bounded); absent without a size */
  effect?: { lo: number; hi: number }
  /**
   * demand shocks with a size and macro data: implied change in GDP growth, pp, through the country's estimated
   * export sensitivity — central value and the range spanned by its 95% interval (and any bounded share)
   */
  growth?: { mid: number; lo: number; hi: number; crossesZero: boolean }
  path: Step[]
}

export interface ExposureResult {
  title: string
  /** steps every row shares (the shock itself and its assumptions) */
  shared: Step[]
  /** ranked, most exposed first (by the midpoint of each range) */
  rows: ExposureRow[]
  /** reporters that could not be scored, with why */
  skipped: { name: string; reason: string }[]
  caveats: string[]
}

export type Shock =
  | { kind: 'demand'; partner: string; sizePct?: number }
  | { kind: 'supply'; partner: string; sizePct?: number }
  | { kind: 'oil'; chokepoint: Chokepoint; pricePct?: number }

export interface Gdp { usd: number; year: string }

/** Optional inputs for the statistical step of a demand scenario. */
export interface Macro {
  sensitivity: ReadonlyMap<string, Sensitivity>
  /** exports of goods and services, current US$ (World Bank NE.EXP.GNFS.CD), by ISO2 */
  totalExports: ReadonlyMap<string, Gdp>
}

const COMTRADE = 'UN Comtrade'
const WB_GDP = 'World Bank (GDP, current US$)'
const FUELS_HS = '27'

const r1 = (v: number) => Math.round(v * 10) / 10
const fmt = (v: number) => (Math.abs(v) < 0.05 ? '0' : `${v < 0 ? '−' : ''}${Math.abs(v) >= 10 ? Math.round(Math.abs(v)) : r1(Math.abs(v))}`)
export const fmtRange = (lo: number, hi: number, unit = '%') => (Math.abs(hi - lo) < 0.05 ? `${fmt(lo)}${unit}` : `${fmt(lo)}${lo < 0 || hi < 0 ? ' to ' : '–'}${fmt(hi)}${unit}`)

/** Every partner name that appears in any reporter's top-6 lists, for the shock picker. */
export function partnerNames(profiles: readonly TradeProfile[]): string[] {
  const names = new Set<string>()
  for (const p of profiles) for (const x of [...p.topExportPartners, ...p.topImportPartners]) names.add(x.country)
  for (const p of profiles) names.add(p.name)
  return [...names].sort((a, b) => a.localeCompare(b))
}

/** A share from a top-N list: exact if listed, else known only to be at most the smallest listed share. */
function shareOf(list: readonly { pct: number }[], hit: { pct: number } | undefined): { lo: number; hi: number; exact: boolean; cutoff: number } {
  const cutoff = list.length ? Math.min(...list.map(x => x.pct)) : 0
  return hit ? { lo: hit.pct, hi: hit.pct, exact: true, cutoff } : { lo: 0, hi: cutoff, exact: false, cutoff }
}

function gdpStep(p: TradeProfile, g: Gdp): Step {
  const gap = Math.abs(Number(g.year) - p.year)
  return { kind: 'observed', text: `GDP US$${fmt(g.usd / 1e9)}bn${gap > 1 ? ` (${g.year}; trade figures are ${p.year}, so the ratio mixes years)` : ''}`, source: WB_GDP, year: g.year }
}

const rank = (rows: ExposureRow[]) => rows.sort((a, b) => (b.lo + b.hi) - (a.lo + a.hi) || a.name.localeCompare(b.name))

const TRADE_CAVEATS = [
  'Goods only: services trade is not in the data.',
  'Gross flows, not value added: re-export hubs (Netherlands, Singapore, Hong Kong, UAE) look more exposed than the final buyer or seller.',
  'First-order only: no second-round effects, rerouting or substitution to other partners.',
  'Only the top 6 partners of each reporter are known; anything below is shown as an upper bound.',
]

/** Exposure of each reporter to a fall in `partner`'s purchases (demand) or to a cut in supply from `partner`. */
function partnerShock(shock: Extract<Shock, { kind: 'demand' | 'supply' }>, profiles: readonly TradeProfile[], gdp: ReadonlyMap<string, Gdp>, macro?: Macro): ExposureResult {
  const demand = shock.kind === 'demand'
  const flow = demand ? 'exports' : 'imports'
  const size = shock.sizePct && shock.sizePct > 0 ? shock.sizePct : undefined
  const shared: Step[] = [
    { kind: 'assumption', text: demand ? `${shock.partner} buys less from the world.` : `Supply from ${shock.partner} is disrupted.` },
  ]
  if (size) shared.push({ kind: 'assumption', text: demand
    ? `${shock.partner}'s imports fall by ${size}%, and every country's sales to it fall by the same share.`
    : `Goods from ${shock.partner} fall by ${size}%, for every buyer alike.` })

  const rows: ExposureRow[] = []
  const skipped: ExposureResult['skipped'] = []
  for (const p of profiles) {
    if (p.name === shock.partner) continue
    const g = gdp.get(p.iso2)
    if (!g || !(g.usd > 0)) { skipped.push({ name: p.name, reason: 'no World Bank GDP figure' }); continue }
    const list = demand ? p.topExportPartners : p.topImportPartners
    const s = shareOf(list, list.find(x => x.country === shock.partner))
    const total = demand ? p.exportsUsdBn : p.importsUsdBn
    const ofGdp = (total * 1e9 / g.usd) * 100
    const lo = s.lo / 100 * ofGdp, hi = s.hi / 100 * ofGdp
    const path: Step[] = [
      s.exact
        ? { kind: 'observed', text: `${shock.partner} ${demand ? 'takes' : 'supplies'} ${s.lo}% of ${p.name}'s goods ${flow}.`, source: COMTRADE, year: String(p.year) }
        : { kind: 'observed', text: `${shock.partner} is not among ${p.name}'s top 6 ${demand ? 'export markets' : 'suppliers'}, so its share is below ${s.cutoff}%.`, source: COMTRADE, year: String(p.year) },
      { kind: 'observed', text: `${p.name}'s goods ${flow}: US$${fmt(total)}bn, ${fmt(ofGdp)}% of GDP.`, source: COMTRADE, year: String(p.year) },
      gdpStep(p, g),
      { kind: 'observed', text: `${demand ? 'Sales to' : 'Purchases from'} ${shock.partner}: ${fmtRange(lo, hi)} of ${p.name}'s GDP (the two shares multiplied).` },
    ]
    const row: ExposureRow = { iso2: p.iso2, name: p.name, lo, hi, bounded: !s.exact, path }
    if (size) {
      row.effect = { lo: -lo * size / 100, hi: -hi * size / 100 }
      path.push({ kind: 'assumption', text: `With the assumed ${size}% fall: ${demand ? 'lost sales' : 'lost supply'} of ${fmtRange(lo * size / 100, hi * size / 100)} of GDP, before any rerouting.` })
      if (demand && macro) growthSteps(row, p, s, size, macro)
    }
    rows.push(row)
  }
  const caveats = demand && size && macro ? [...TRADE_CAVEATS, GROWTH_CAVEAT] : TRADE_CAVEATS
  return {
    title: demand ? `Who sells most to ${shock.partner}, relative to their own economy` : `Who buys most from ${shock.partner}, relative to their own economy`,
    shared, rows: rank(rows), skipped, caveats,
  }
}

const GROWTH_CAVEAT = 'GDP growth effects use each country\'s historical association between export growth and GDP growth. Global booms and recessions move both together, so the association is likely larger than the effect of exports alone; read it as an upper-end guide, not a forecast.'

const pp = (v: number) => `${v < 0 ? '−' : v > 0 ? '+' : ''}${Math.abs(Math.round(v * 100) / 100).toFixed(2)} pp`

/** The statistical half of a sized demand shock: fall in export growth → GDP growth, through the estimated sensitivity. */
function growthSteps(row: ExposureRow, p: TradeProfile, s: { lo: number; hi: number; exact: boolean }, size: number, macro: Macro) {
  const total = macro.totalExports.get(p.iso2)
  const sens = macro.sensitivity.get(p.iso2)
  if (!total || !(total.usd > 0)) { row.path.push({ kind: 'statistical', text: `No World Bank total for ${p.name}'s exports of goods and services, so the effect on GDP growth is not estimated.` }); return }
  if (!sens) { row.path.push({ kind: 'statistical', text: `Fewer than 15 years of export and GDP growth for ${p.name}, so its sensitivity is not estimated.` }); return }
  // fall in real export growth, pp: lost goods sales ÷ all exports of goods and services
  const lost = (share: number) => (share / 100) * p.exportsUsdBn * 1e9 * (size / 100)
  const dxLo = -lost(s.hi) / total.usd * 100, dxHi = -lost(s.lo) / total.usd * 100
  row.path.push({ kind: 'assumption', text: `Prices hold, so the lost sales lower ${p.name}'s real export growth by ${fmtRange(-dxLo, -dxHi, ' pp')} (lost sales ÷ its exports of goods and services, US$${fmt(total.usd / 1e9)}bn in ${total.year}).` })
  row.path.push({ kind: 'statistical', text: `${sens.from}–${sens.to}: ${p.name}'s GDP growth moved ${pp(sens.slope)} per 1 pp of export growth (95% interval ${pp(sens.ci[0])} to ${pp(sens.ci[1])}; R² ${sens.r2.toFixed(2)}; ${sens.n} years). An association that includes shared global swings, not a measured cause.`, source: 'World Bank (GDP growth, export volume growth); least squares computed here', year: String(sens.to) })
  const combos = [dxLo, dxHi].flatMap(dx => sens.ci.map(b => b * dx))
  const mid = sens.slope * (dxLo + dxHi) / 2
  const g = { mid, lo: Math.min(...combos), hi: Math.max(...combos), crossesZero: Math.min(...combos) < 0 && Math.max(...combos) > 0 }
  row.growth = g
  row.path.push({ kind: 'statistical', text: g.crossesZero
    ? `Implied change in GDP growth: about ${pp(mid)}, but the range (${pp(g.lo)} to ${pp(g.hi)}) includes zero, so the effect is not distinguishable from none.`
    : `Implied change in GDP growth: about ${pp(mid)} (range ${pp(g.lo)} to ${pp(g.hi)} from the sensitivity's interval${s.exact ? '' : ' and the bounded share'}).` })
}

/** Exposure to an oil disruption at a chokepoint, through the world oil price: each reporter's net fuel trade as % of GDP. */
function oilShock(shock: Extract<Shock, { kind: 'oil' }>, profiles: readonly TradeProfile[], gdp: ReadonlyMap<string, Gdp>, worldMaritimeOilMbd: number, eiaSource: string, eiaYear: number): ExposureResult {
  const c = shock.chokepoint
  const price = shock.pricePct && shock.pricePct !== 0 ? shock.pricePct : undefined
  const shared: Step[] = []
  if (c.oilFlowMbd != null) shared.push({ kind: 'observed', text: `${fmt(c.oilFlowMbd)} million barrels a day of oil passed through the ${c.name}, ${fmt(c.oilFlowMbd / worldMaritimeOilMbd * 100)}% of world maritime oil trade.`, source: eiaSource, year: String(eiaYear) })
  shared.push({ kind: 'assumption', text: `A disruption here raises the world oil price for every buyer. Which country's cargo uses this route is not in the data, so countries are ranked by the price channel alone, and the ranking is the same for any oil chokepoint.` })
  if (price) shared.push({ kind: 'assumption', text: `Fuel import and export prices rise ${price}%, with volumes unchanged.` })

  const rows: ExposureRow[] = []
  const skipped: ExposureResult['skipped'] = []
  for (const p of profiles) {
    const g = gdp.get(p.iso2)
    if (!g || !(g.usd > 0)) { skipped.push({ name: p.name, reason: 'no World Bank GDP figure' }); continue }
    const ex = shareOf(p.topExports, p.topExports.find(x => x.hs === FUELS_HS))
    const im = shareOf(p.topImports, p.topImports.find(x => x.hs === FUELS_HS))
    const toGdp = (bn: number) => (bn * 1e9 / g.usd) * 100
    const exLo = toGdp(p.exportsUsdBn * ex.lo / 100), exHi = toGdp(p.exportsUsdBn * ex.hi / 100)
    const imLo = toGdp(p.importsUsdBn * im.lo / 100), imHi = toGdp(p.importsUsdBn * im.hi / 100)
    // net fuel position, % of GDP: positive = net exporter
    const lo = exLo - imHi, hi = exHi - imLo
    const direction = hi < 0 ? 'loss' : lo > 0 ? 'gain' : 'unclear'
    const listed = (s: typeof ex, what: string) => s.exact
      ? `${s.lo}% of ${p.name}'s goods ${what} are mineral fuels (HS 27: oil, gas, coal, refined products)`
      : `Mineral fuels are not among ${p.name}'s top ${what === 'exports' ? p.topExports.length : p.topImports.length} ${what} chapters, so below ${s.cutoff}%`
    const path: Step[] = [
      { kind: 'observed', text: `${listed(im, 'imports')}: ${fmtRange(imLo, imHi)} of GDP.`, source: COMTRADE, year: String(p.year) },
      { kind: 'observed', text: `${listed(ex, 'exports')}: ${fmtRange(exLo, exHi)} of GDP.`, source: COMTRADE, year: String(p.year) },
      gdpStep(p, g),
      { kind: 'observed', text: `Net fuel trade: ${fmtRange(lo, hi)} of GDP (exports minus imports)${direction === 'loss' ? ', a net importer: a higher price costs it' : direction === 'gain' ? ', a net exporter: a higher price pays it' : ', too uncertain to say which way a higher price cuts'}.` },
    ]
    // magnitude ranks the list (a big exporter is as exposed as a big importer, in the other direction)
    const mag = { lo: Math.min(Math.abs(lo), Math.abs(hi)) * (direction === 'unclear' ? 0 : 1), hi: Math.max(Math.abs(lo), Math.abs(hi)) }
    const row: ExposureRow = { iso2: p.iso2, name: p.name, lo: mag.lo, hi: mag.hi, bounded: !ex.exact || !im.exact, direction, net: { lo, hi }, path }
    if (price) {
      row.effect = { lo: lo * price / 100, hi: hi * price / 100 }
      path.push({ kind: 'assumption', text: `With fuel prices ${price > 0 ? 'up' : 'down'} ${Math.abs(price)}%: ${fmtRange(lo * price / 100, hi * price / 100)} of GDP on the trade balance, before any change in volumes.` })
    }
    rows.push(row)
  }
  return {
    title: `Who gains or loses most from a higher oil price, relative to their own economy`,
    shared, rows: rank(rows), skipped,
    caveats: [
      'HS 27 covers all mineral fuels (crude, refined products, gas, coal), not crude oil alone, and gas and coal prices do not move one-for-one with oil.',
      'Price channel only: physical shortages for countries whose supply uses this route are not modelled, because the route split is not in the data.',
      'Only products in each reporter\'s top 8 export and top 6 import chapters are known; a missing fuels chapter is shown as a range.',
      'First-order trade-balance effect: no demand response, no second-round effects on growth or inflation.',
    ],
  }
}

export function traceExposure(shock: Shock, profiles: readonly TradeProfile[], gdp: ReadonlyMap<string, Gdp>, eia: { worldMaritimeOilMbd: number; name: string; year: number }, macro?: Macro): ExposureResult {
  return shock.kind === 'oil' ? oilShock(shock, profiles, gdp, eia.worldMaritimeOilMbd, eia.name, eia.year) : partnerShock(shock, profiles, gdp, macro)
}

/** World Bank GDP rows (ISO3) → by ISO2, the key the trade profiles use. */
export function gdpByIso2(rows: readonly { iso3: string; value: number; year: string }[], iso3ToIso2: ReadonlyMap<string, string>): Map<string, Gdp> {
  const out = new Map<string, Gdp>()
  for (const r of rows) { const iso2 = iso3ToIso2.get(r.iso3); if (iso2) out.set(iso2, { usd: r.value, year: r.year }) }
  return out
}

/** Plain-text version for the AI analyst: computed here, so the model can cite it rather than recall figures. */
export function summarizeExposure(res: ExposureResult, top = 8): string {
  const rows = res.rows.slice(0, top).map(r => {
    const dir = r.direction === 'loss' ? ' (net fuel importer)' : r.direction === 'gain' ? ' (net fuel exporter)' : ''
    const eff = (r.effect ? `; assumed-shock effect ${fmtRange(r.effect.lo, r.effect.hi)} of GDP` : '') + (r.growth ? `; implied GDP growth change ${pp(r.growth.mid)} (range ${pp(r.growth.lo)} to ${pp(r.growth.hi)}${r.growth.crossesZero ? ', not distinguishable from zero' : ''}; statistical association, not a cause)` : '')
    return `${r.name}: ${fmtRange(r.lo, r.hi)} of GDP${r.bounded ? ' (bounded: share outside the top-6 lists)' : ''}${dir}${eff}`
  })
  return [
    res.title + '.',
    ...res.shared.map(s => `[${s.kind}] ${s.text}${s.source ? ` (${s.source}${s.year ? `, ${s.year}` : ''})` : ''}`),
    'Most exposed: ' + (rows.join('; ') || 'none'),
    'Caveats: ' + res.caveats.join(' '),
  ].join('\n')
}

/**
 * The rows the map can shade: exact values only (a bounded share has no single value to draw), as % of GDP. Oil shocks
 * map the signed net fuel position, so importers and exporters land at opposite ends of the scale.
 */
export function mapRows(res: ExposureResult, iso2ToIso3: ReadonlyMap<string, string>, year: (iso2: string) => string): { iso3: string; name: string; value: number; year: string }[] {
  const out: { iso3: string; name: string; value: number; year: string }[] = []
  for (const r of res.rows) {
    const iso3 = iso2ToIso3.get(r.iso2)
    if (!iso3 || r.bounded) continue
    out.push({ iso3, name: r.name, value: r.net ? r.net.lo : r.lo, year: year(r.iso2) })
  }
  return out
}
