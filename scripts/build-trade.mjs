#!/usr/bin/env node
/**
 * Builds src/data/trade-profiles.json — the figures behind the trade profiles
 * in src/services/tradeStats.ts.
 *
 * Sources (all free and keyless):
 *  - UN Comtrade public preview API (https://comtradeapi.un.org/public/v1/preview)
 *    — goods trade as reported by each country: top partners (share of total
 *    exports / imports), top HS chapters, and the goods trade balance. The most
 *    recent year with reported data is used per country and stored with it.
 *  - World Bank Open Data — trade % of GDP (NE.TRD.GNFS.ZS), current account
 *    % of GDP (BN.CAB.XOKA.GD.ZS), most recent value with its year, and the
 *    World Bank income classification.
 *
 * Nothing here is hand-typed except display names: short labels abbreviating
 * the official HS chapter titles (HS_SHORT) and common names for a few partners
 * whose Comtrade names are formal (DISPLAY_NAME, e.g. "USA" → "United States").
 *
 * Usage: node scripts/build-trade.mjs
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const OUT = 'src/data/trade-profiles.json'
const CT = 'https://comtradeapi.un.org/public/v1/preview/C/A/HS'
const CT_REF = 'https://comtradeapi.un.org/files/v1/app/reference'
const WB = 'https://api.worldbank.org/v2'
const UA = 'WorldOfData-trade-snapshot/1.0 (open research dashboard build script)'
const YEARS = [2025, 2024, 2023, 2022, 2021, 2020, 2019, 2018]

// Reporters, by ISO 3166-1 alpha-2. Taiwan is not a UN Comtrade reporter, so
// it cannot be profiled from this source and is left out.
const REPORTERS = [
  'US', 'CN', 'DE', 'JP', 'GB', 'IN', 'RU', 'SA', 'BR', 'AU', 'KR', 'SG', 'TR', 'AE', 'ZA', 'NG',
  'FR', 'IT', 'CA', 'MX', 'ID', 'TH', 'VN', 'MY', 'PH', 'NL', 'CH', 'ES', 'PL', 'SE', 'NO', 'IL',
  'EG', 'IR', 'PK', 'BD', 'CL', 'CO', 'AR', 'QA', 'KW', 'KE', 'ET', 'GH', 'UA',
]

// Short display names abbreviating the official HS 2-digit chapter titles.
const HS_SHORT = {
  '01': 'Live animals', '02': 'Meat', '03': 'Fish & seafood', '04': 'Dairy, eggs & honey', '05': 'Other animal products',
  '06': 'Live plants & flowers', '07': 'Vegetables', '08': 'Fruit & nuts', '09': 'Coffee, tea & spices', '10': 'Cereals',
  '11': 'Milling products', '12': 'Oil seeds (incl. soybeans)', '13': 'Gums & resins', '14': 'Other vegetable products',
  '15': 'Animal & vegetable fats/oils', '16': 'Meat & fish preparations', '17': 'Sugar', '18': 'Cocoa', '19': 'Cereal preparations',
  '20': 'Fruit & vegetable preparations', '21': 'Misc. food preparations', '22': 'Beverages', '23': 'Animal feed & food residues',
  '24': 'Tobacco', '25': 'Salt, stone & cement', '26': 'Ores, slag & ash', '27': 'Mineral fuels, oil & gas',
  '28': 'Inorganic chemicals', '29': 'Organic chemicals', '30': 'Pharmaceuticals', '31': 'Fertilizers', '32': 'Dyes & paints',
  '33': 'Cosmetics & perfumes', '34': 'Soaps & lubricants', '35': 'Glues & enzymes', '36': 'Explosives', '37': 'Photographic goods',
  '38': 'Misc. chemical products', '39': 'Plastics', '40': 'Rubber', '41': 'Hides & leather', '42': 'Leather goods',
  '43': 'Furskins', '44': 'Wood', '45': 'Cork', '46': 'Basketware', '47': 'Wood pulp', '48': 'Paper & paperboard',
  '49': 'Printed matter', '50': 'Silk', '51': 'Wool', '52': 'Cotton', '53': 'Other vegetable fibres', '54': 'Man-made filaments',
  '55': 'Man-made staple fibres', '56': 'Wadding & cordage', '57': 'Carpets', '58': 'Special fabrics', '59': 'Coated fabrics',
  '60': 'Knitted fabrics', '61': 'Apparel (knitted)', '62': 'Apparel (not knitted)', '63': 'Other textile articles',
  '64': 'Footwear', '65': 'Headgear', '66': 'Umbrellas', '67': 'Feathers & artificial flowers', '68': 'Stone & cement articles',
  '69': 'Ceramics', '70': 'Glass', '71': 'Precious metals & stones (incl. gold)', '72': 'Iron & steel', '73': 'Iron & steel articles',
  '74': 'Copper', '75': 'Nickel', '76': 'Aluminium', '78': 'Lead', '79': 'Zinc', '80': 'Tin', '81': 'Other base metals',
  '82': 'Tools & cutlery', '83': 'Misc. base-metal articles', '84': 'Machinery & computers', '85': 'Electrical machinery & electronics',
  '86': 'Railway equipment', '87': 'Vehicles & parts', '88': 'Aircraft & spacecraft', '89': 'Ships & boats',
  '90': 'Optical & medical instruments', '91': 'Clocks & watches', '92': 'Musical instruments', '93': 'Arms & ammunition',
  '94': 'Furniture & lighting', '95': 'Toys & sports goods', '96': 'Misc. manufactured articles', '97': 'Works of art & antiques',
  '99': 'Commodities not specified',
}

const sleep = ms => new Promise(r => setTimeout(r, ms))

async function getJson(url, attempt = 0) {
  let res
  try {
    res = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(60_000) })
  } catch (err) {
    if (attempt < 5) { await sleep(3000 * (attempt + 1)); return getJson(url, attempt + 1) }
    throw err
  }
  if ((res.status === 429 || res.status >= 500) && attempt < 5) {
    if (process.env.VERBOSE) console.warn(`HTTP ${res.status}, retry ${attempt + 1}: ${url}`)
    await sleep(3000 * (attempt + 1))
    return getJson(url, attempt + 1)
  }
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`)
  return res.json()
}

// Responses are cached in the OS temp dir so a run interrupted by the preview's
// hourly call quota can resume without spending calls again.
const CACHE = join(tmpdir(), 'comtrade-preview-cache')

async function comtrade(params) {
  const url = `${CT}?${new URLSearchParams(params)}`
  const file = join(CACHE, createHash('sha1').update(url).digest('hex') + '.json')
  let json
  try {
    json = JSON.parse(await readFile(file, 'utf8'))
  } catch {
    for (;;) {
      await sleep(2500) // the public preview answers HTTP 429 at ~1 request/second
      const res = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(60_000) }).catch(() => null)
      if (!res) continue
      if (res.status === 403) {
        // "Out of call volume quota. Quota will be replenished in 00:45:18."
        const m = /(\d+):(\d+):(\d+)/.exec(await res.text())
        const wait = m ? ((+m[1] * 60 + +m[2]) * 60 + +m[3] + 15) * 1000 : 10 * 60_000
        console.warn(`quota exhausted — waiting ${Math.round(wait / 60000)} min`)
        await sleep(wait)
        continue
      }
      if (res.status === 429 || res.status >= 500) { await sleep(5000); continue }
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`)
      json = await res.json()
      await mkdir(CACHE, { recursive: true })
      await writeFile(file, JSON.stringify(json))
      break
    }
  }
  // Keep only the plain totals: no second partner, all transport modes, all customs procedures
  return (json.data ?? []).filter(r => r.partner2Code === 0 && r.motCode === 0 && r.customsCode === 'C00')
}

const round1 = x => Math.round(x * 10) / 10
const current = r => !r.isGroup && !r.entryExpiredDate

const [{ results: reporterRef }, { results: partnerRef }] = await Promise.all([
  getJson(`${CT_REF}/Reporters.json`),
  getJson(`${CT_REF}/partnerAreas.json`),
])
// Current codes only — e.g. US has a retired 841 ("USA and Puerto Rico (...1980)") beside 842.
const reporterCode = new Map(reporterRef.filter(current).map(r => [r.reporterCodeIsoAlpha2, r.reporterCode]))
// Only real countries/territories (those with an ISO alpha-2 code) count as partners —
// "Areas, nes", bunkers, free zones and regional residuals are dropped.
// Code 490 "Other Asia, nes" is kept: in Comtrade it is where most trade with Taiwan is recorded.
const DISPLAY_NAME = {
  842: 'United States', 410: 'South Korea', 344: 'Hong Kong', 643: 'Russia', 704: 'Vietnam', 792: 'Turkey',
  784: 'UAE', 826: 'United Kingdom', 251: 'France', 699: 'India', 757: 'Switzerland', 579: 'Norway',
  490: 'Other Asia nes (Taiwan)',
}
const partnerName = new Map([
  ...partnerRef.filter(p => p.PartnerCodeIsoAlpha2 && current(p)).map(p => [p.PartnerCode, p.text]),
  [490, 'Other Asia, nes'],
].map(([code, text]) => [code, DISPLAY_NAME[code] ?? text]))

/** Most recent year this reporter has reported both export and import totals for. */
async function latestYear(code) {
  for (const year of YEARS) { // the preview accepts one period per request
    const rows = await comtrade({ reporterCode: code, period: year, partnerCode: 0, cmdCode: 'TOTAL', flowCode: 'X,M' })
    const x = rows.find(r => r.flowCode === 'X'), m = rows.find(r => r.flowCode === 'M')
    if (x && m) return { year, exports: x.primaryValue, imports: m.primaryValue }
  }
  return null
}

function top(rows, flow, total, n, keyOf, labelOf) {
  return rows
    .filter(r => r.flowCode === flow && keyOf(r) != null)
    .sort((a, b) => b.primaryValue - a.primaryValue)
    .slice(0, n)
    .map(r => ({ ...labelOf(r), pct: round1((r.primaryValue / total) * 100) }))
}

async function wbLatest(indicator) {
  const json = await getJson(`${WB}/country/${REPORTERS.join(';')}/indicator/${indicator}?format=json&mrv=1&per_page=500`)
  const out = {}
  for (const r of json[1] ?? []) if (r.value != null) out[r.country.id] = { value: round1(r.value), year: Number(r.date) }
  return out
}

const INCOME = { HIC: 'high', UMC: 'upper-middle', LMC: 'lower-middle', LIC: 'low' }
const [tradeToGDP, currentAccount, countryMeta] = await Promise.all([
  wbLatest('NE.TRD.GNFS.ZS'),
  wbLatest('BN.CAB.XOKA.GD.ZS'),
  getJson(`${WB}/country/${REPORTERS.join(';')}?format=json&per_page=500`),
])
const income = Object.fromEntries((countryMeta[1] ?? []).map(c => [c.iso2Code, INCOME[c.incomeLevel?.id]]))

const profiles = {}
for (const iso2 of REPORTERS) {
  const code = reporterCode.get(iso2)
  if (code == null) { console.warn(`skip ${iso2}: not a Comtrade reporter`); continue }
  const totals = await latestYear(code)
  if (!totals) { console.warn(`skip ${iso2}: no reported totals ${YEARS.at(-1)}–${YEARS[0]}`); continue }
  const { year, exports, imports } = totals
  const byPartner = await comtrade({ reporterCode: code, period: year, cmdCode: 'TOTAL', flowCode: 'X,M' })
  const byChapter = await comtrade({ reporterCode: code, period: year, partnerCode: 0, cmdCode: 'AG2', flowCode: 'X,M' })
  const partner = r => (partnerName.has(r.partnerCode) ? r.partnerCode : null)
  const chapter = r => (HS_SHORT[r.cmdCode] ? r.cmdCode : null)
  profiles[iso2] = {
    comtradeReporter: code,
    year,
    exportsUsdBn: round1(exports / 1e9),
    importsUsdBn: round1(imports / 1e9),
    tradeBalanceUsdBn: round1((exports - imports) / 1e9),
    topExportPartners: top(byPartner, 'X', exports, 6, partner, r => ({ country: partnerName.get(r.partnerCode) })),
    topImportPartners: top(byPartner, 'M', imports, 6, partner, r => ({ country: partnerName.get(r.partnerCode) })),
    topExports: top(byChapter, 'X', exports, 8, chapter, r => ({ product: HS_SHORT[r.cmdCode], hs: r.cmdCode })),
    topImports: top(byChapter, 'M', imports, 6, chapter, r => ({ product: HS_SHORT[r.cmdCode], hs: r.cmdCode })),
    tradeToGDP: tradeToGDP[iso2] ?? null,
    currentAccount: currentAccount[iso2] ?? null,
    incomeGroup: income[iso2] ?? null,
  }
  console.log(`${iso2}: ${year}`)
}

const out = {
  sources: {
    trade: { name: 'UN Comtrade (reporter data, HS)', url: 'https://comtradeplus.un.org/' },
    macro: { name: 'World Bank Open Data', url: 'https://data.worldbank.org/', indicators: ['NE.TRD.GNFS.ZS', 'BN.CAB.XOKA.GD.ZS'] },
  },
  retrieved: new Date().toISOString().slice(0, 10),
  profiles,
}
await mkdir('src/data', { recursive: true })
await writeFile(OUT, JSON.stringify(out, null, 2) + '\n')
console.log(`wrote ${OUT}: ${Object.keys(profiles).length} profiles`)
