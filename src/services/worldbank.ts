/**
 * World Bank Open Data API — free, no key required.
 * Fetches key economic indicators per country (GDP, population, GNI, inflation, etc.)
 * https://api.worldbank.org/v2/
 *
 * Caches per country for 1 hour to avoid redundant fetches.
 */

const WB_BASE = 'https://api.worldbank.org/v2'

/** One row of a World Bank v2 indicator response (`[meta, rows]`). Any field can be null or missing in practice. */
export interface WorldBankObservation {
  country?: { id?: string; value?: string }
  countryiso3code?: string
  date?: string
  value?: number | null
}

// Indicators we fetch (most recent year available)
const INDICATORS = {
  'NY.GDP.MKTP.CD':       'GDP (current US$)',
  'NY.GDP.PCAP.CD':       'GDP per capita (US$)',
  'NY.GDP.MKTP.KD.ZG':    'GDP growth (%)',
  'SP.POP.TOTL':          'Population',
  'SP.POP.GROW':          'Population growth (%)',
  'FP.CPI.TOTL.ZG':       'Inflation, CPI (%)',
  'SL.UEM.TOTL.ZS':       'Unemployment (%)',
  'BN.CAB.XOKA.CD':       'Current account (US$)',
  'GC.DOD.TOTL.GD.ZS':    'Gov. debt (% GDP)',
  'NE.EXP.GNFS.CD':       'Exports (US$)',
  'NE.IMP.GNFS.CD':       'Imports (US$)',
  'NE.TRD.GNFS.ZS':       'Trade (% GDP)',
  'TG.VAL.TOTL.GD.ZS':    'Merchandise trade (% GDP)',
  'BX.KLT.DINV.CD.WD':    'FDI inflows (US$)',
  'BM.KLT.DINV.CD.WD':    'FDI outflows (US$)',
  'BX.TRF.PWKR.CD.DT':    'Remittances received (US$)',
  'IC.BUS.EASE.XQ':        'Ease of business score',
  'TX.VAL.TECH.MF.ZS':     'High-tech exports (%)',
  'TM.TAX.MRCH.WM.AR.ZS':  'Tariff rate, applied (%)',
  'MS.MIL.XPND.GD.ZS':   'Military spending (% GDP)',
  'MS.MIL.TOTL.P1':      'Armed forces personnel (total)',
  'MS.MIL.TOTL.TF.ZS':   'Armed forces personnel (% labor force)',
  'EG.USE.PCAP.KG.OE':    'Energy use (kg oil eq/cap)',
  'SP.DYN.LE00.IN':       'Life expectancy (years)',
  'SE.ADT.LITR.ZS':       'Literacy rate (%)',
  'SI.POV.GINI':          'GINI index',
} as const

export type IndicatorId = keyof typeof INDICATORS

export interface EconIndicator {
  id: IndicatorId
  label: string
  value: number | null
  year: string
}

export interface CountryEconData {
  iso2: string
  iso3: string
  countryName: string
  indicators: EconIndicator[]
  fetchedAt: number
}

// ── Cache ────────────────────────────────────────────────────────────────────
const cache = new Map<string, CountryEconData>()
const CACHE_TTL = 60 * 60 * 1000 // 1 hour

// ── Country name → ISO2 mapping (common names + variants) ────────────────────
const NAME_TO_ISO2: Record<string, string> = {
  'afghanistan':'AF','albania':'AL','algeria':'DZ','angola':'AO','argentina':'AR',
  'armenia':'AM','australia':'AU','austria':'AT','azerbaijan':'AZ','bahrain':'BH',
  'bangladesh':'BD','belarus':'BY','belgium':'BE','benin':'BJ','bolivia':'BO',
  'bosnia':'BA','bosnia and herzegovina':'BA','botswana':'BW','brazil':'BR','brunei':'BN',
  'bulgaria':'BG','burkina faso':'BF','burundi':'BI','cambodia':'KH','cameroon':'CM',
  'canada':'CA','chad':'TD','chile':'CL','china':'CN','colombia':'CO',
  'congo':'CD','dr congo':'CD','democratic republic of the congo':'CD','costa rica':'CR',
  'croatia':'HR','cuba':'CU','cyprus':'CY','czech republic':'CZ','czechia':'CZ',
  'denmark':'DK','djibouti':'DJ','dominican republic':'DO','ecuador':'EC','egypt':'EG',
  'el salvador':'SV','eritrea':'ER','estonia':'EE','ethiopia':'ET','fiji':'FJ',
  'finland':'FI','france':'FR','gabon':'GA','georgia':'GE','germany':'DE',
  'ghana':'GH','greece':'GR','guatemala':'GT','guinea':'GN','haiti':'HT',
  'honduras':'HN','hungary':'HU','iceland':'IS','india':'IN','indonesia':'ID',
  'iran':'IR','iraq':'IQ','ireland':'IE','israel':'IL','italy':'IT',
  'ivory coast':'CI','jamaica':'JM','japan':'JP','jordan':'JO','kazakhstan':'KZ',
  'kenya':'KE','kosovo':'XK','kuwait':'KW','kyrgyzstan':'KG','laos':'LA',
  'latvia':'LV','lebanon':'LB','libya':'LY','lithuania':'LT','luxembourg':'LU',
  'madagascar':'MG','malaysia':'MY','mali':'ML','malta':'MT','mauritania':'MR',
  'mexico':'MX','moldova':'MD','mongolia':'MN','montenegro':'ME','morocco':'MA',
  'mozambique':'MZ','myanmar':'MM','namibia':'NA','nepal':'NP','netherlands':'NL',
  'new zealand':'NZ','nicaragua':'NI','niger':'NE','nigeria':'NG','north korea':'KP',
  'north macedonia':'MK','norway':'NO','oman':'OM','pakistan':'PK','palestine':'PS',
  'panama':'PA','papua new guinea':'PG','paraguay':'PY','peru':'PE','philippines':'PH',
  'poland':'PL','portugal':'PT','qatar':'QA','romania':'RO','russia':'RU',
  'rwanda':'RW','saudi arabia':'SA','senegal':'SN','serbia':'RS','sierra leone':'SL',
  'singapore':'SG','slovakia':'SK','slovenia':'SI','somalia':'SO','south africa':'ZA',
  's.africa':'ZA','south korea':'KR','s.korea':'KR','south sudan':'SS','spain':'ES',
  'sri lanka':'LK','sudan':'SD','sweden':'SE','switzerland':'CH','syria':'SY',
  'taiwan':'TW','tajikistan':'TJ','tanzania':'TZ','thailand':'TH','togo':'TG',
  'tunisia':'TN','turkey':'TR','turkmenistan':'TM','uganda':'UG','ukraine':'UA',
  'united arab emirates':'AE','uae':'AE','united kingdom':'GB','uk':'GB',
  'united states':'US','us':'US','usa':'US','uruguay':'UY','uzbekistan':'UZ',
  'venezuela':'VE','vietnam':'VN','yemen':'YE','zambia':'ZM','zimbabwe':'ZW',
  // ISO 3166-1 alpha-2 names the map's country picker can return that the list above lacked
  'andorra':'AD','antigua and barbuda':'AG','bahamas':'BS','the bahamas':'BS','barbados':'BB','belize':'BZ','bhutan':'BT',
  'burma':'MM','cape verde':'CV','cabo verde':'CV','central african republic':'CF','comoros':'KM',
  'republic of the congo':'CG','republic of congo':'CG',"cote d'ivoire":'CI',"côte d'ivoire":'CI','dominica':'DM',
  'equatorial guinea':'GQ','eswatini':'SZ','swaziland':'SZ','gambia':'GM','the gambia':'GM','greenland':'GL','grenada':'GD',
  'guinea-bissau':'GW','guyana':'GY','hong kong':'HK','kiribati':'KI','lesotho':'LS','liberia':'LR','liechtenstein':'LI',
  'macao':'MO','macau':'MO','malawi':'MW','maldives':'MV','marshall islands':'MH','mauritius':'MU','micronesia':'FM',
  'monaco':'MC','nauru':'NR','palau':'PW','puerto rico':'PR','saint kitts and nevis':'KN','saint lucia':'LC',
  'saint vincent and the grenadines':'VC','samoa':'WS','san marino':'SM','sao tome and principe':'ST','são tomé and príncipe':'ST',
  'seychelles':'SC','solomon islands':'SB','suriname':'SR','timor-leste':'TL','east timor':'TL','tonga':'TO',
  'trinidad and tobago':'TT','tuvalu':'TV','türkiye':'TR','turkiye':'TR','vanuatu':'VU','western sahara':'EH',
  'slovak republic':'SK','russian federation':'RU','republic of serbia':'RS','the netherlands':'NL',
  'falklands':'FK','gibraltar':'GI','bermuda':'BM','ascension is.':'SH',
  's.china sea':'CN','n.korea':'KP',
}

export function resolveISO2(countryName: string): string | null {
  const lc = countryName.toLowerCase().trim()
  // Direct match
  if (NAME_TO_ISO2[lc]) return NAME_TO_ISO2[lc]
  // 2-letter code already
  if (/^[A-Z]{2}$/.test(countryName)) return countryName
  // Partial match — blank/very short input would otherwise be a substring of every name
  if (lc.length < 3) return null
  for (const [name, code] of Object.entries(NAME_TO_ISO2)) {
    if (lc.includes(name) || name.includes(lc)) return code
  }
  return null
}

// Aliases too ambiguous in free text ("tell us", "us and them") to treat as a country mention.
const AMBIGUOUS_ALIASES = new Set(['us', 'niger', 'georgia', 'jordan', 'chad', 'turkey', 'congo'])

/**
 * Find the first country named in free text (a chat message, say) — earliest mention
 * wins (longest name on a tie, so "South Sudan" beats "Sudan"), whole words only. Returns a display name `resolveISO2` accepts, or null.
 * Names that double as common words/first names (Georgia, Jordan, Chad…) only
 * count when capitalised in the text; "us" never counts.
 */
export function findCountryInText(text: string): string | null {
  const lc = text.toLowerCase()
  let best: { alias: string; index: number } | null = null
  for (const alias of Object.keys(NAME_TO_ISO2)) {
    if (alias === 'us') continue
    const re = new RegExp(`(?<![\\p{L}])${alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\p{L}])`, 'u')
    const m = re.exec(lc)
    if (!m) continue
    if (AMBIGUOUS_ALIASES.has(alias)) {
      const original = text.substr(m.index, alias.length)
      if (original[0] !== original[0].toUpperCase() || original[0] === original[0].toLowerCase()) continue
    }
    if (!best || m.index < best.index || (m.index === best.index && alias.length > best.alias.length)) {
      best = { alias, index: m.index }
    }
  }
  if (!best) return null
  if (best.alias.length <= 3) {
    // uk / uae / usa -> proper English name
    const iso = NAME_TO_ISO2[best.alias]
    try { return new Intl.DisplayNames(['en'], { type: 'region' }).of(iso) ?? null } catch { return null }
  }
  return best.alias.replace(/\b([a-z])/g, c => c.toUpperCase()).replace(/\b(And|Of|The)\b/g, w => w.toLowerCase())
}

// ── Fetch multiple indicators in one batch ───────────────────────────────────
// World Bank API allows semicolon-separated indicator IDs
const econInFlight = new Map<string, Promise<CountryEconData | null>>()

export function fetchCountryEcon(countryName: string): Promise<CountryEconData | null> {
  const iso2 = resolveISO2(countryName)
  if (!iso2) return Promise.resolve(null)

  // Check cache
  const cached = cache.get(iso2)
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL) return Promise.resolve(cached)

  // The country drawer and the country brief both ask on the same click — share one set of requests.
  const pending = econInFlight.get(iso2)
  if (pending) return pending
  const run = loadCountryEcon(countryName, iso2)
  econInFlight.set(iso2, run)
  void run.then(() => econInFlight.delete(iso2), () => econInFlight.delete(iso2))
  return run
}

async function loadCountryEcon(countryName: string, iso2: string): Promise<CountryEconData | null> {

  const indicatorIds = Object.keys(INDICATORS) as IndicatorId[]
  const indicators: EconIndicator[] = []

  // Fetch all indicators in parallel (individual requests — more reliable than semicolon batch)
  const fetches = indicatorIds.map(async (id) => {
    try {
      const url = `${WB_BASE}/country/${iso2}/indicator/${id}?format=json&date=2018:2024&per_page=10&MRV=1`
      const res = await fetch(url, { signal: AbortSignal.timeout(8000) })
      if (!res.ok) return null
      const json = await res.json()
      // Response is [metadata, dataArray]
      const data = Array.isArray(json) && json.length === 2 ? json[1] : null
      if (!data || !Array.isArray(data) || data.length === 0) return null
      // Find most recent non-null value
      const entry = (data as WorldBankObservation[]).find(d => d.value != null)
      if (!entry) return null
      return {
        id,
        label: INDICATORS[id],
        value: entry.value as number,
        year: entry.date as string,
      }
    } catch {
      return null
    }
  })

  const results = await Promise.all(fetches)
  for (const r of results) {
    if (r) indicators.push(r)
  }

  if (indicators.length === 0) return null

  // Extract country info from any successful response
  const firstId = indicatorIds[0]
  let iso3 = iso2
  let name = countryName
  try {
    const url = `${WB_BASE}/country/${iso2}/indicator/${firstId}?format=json&date=2023&per_page=1`
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) })
    if (res.ok) {
      const json = await res.json()
      if (Array.isArray(json) && json[1]?.[0]) {
        iso3 = json[1][0].countryiso3code || iso2
        name = json[1][0].country?.value || countryName
      }
    }
  } catch { /* use defaults */ }

  const result: CountryEconData = {
    iso2,
    iso3,
    countryName: name,
    indicators,
    fetchedAt: Date.now(),
  }

  cache.set(iso2, result)
  return result
}

// ── Country profile (capital, region, income group) ─────────────────────────
export interface CountryProfile {
  iso2: string
  capital: string
  region: string
  incomeLevel: string
}

const profileCache = new Map<string, { at: number; data: CountryProfile | null }>()

/** Capital / region / income group from the World Bank country endpoint (free, no key). null when unavailable. */
export async function fetchCountryProfile(countryName: string): Promise<CountryProfile | null> {
  const iso2 = resolveISO2(countryName)
  if (!iso2) return null
  const hit = profileCache.get(iso2)
  if (hit && Date.now() - hit.at < CACHE_TTL) return hit.data

  let data: CountryProfile | null = null
  try {
    const res = await fetch(`${WB_BASE}/country/${iso2}?format=json`, { signal: AbortSignal.timeout(8000) })
    if (res.ok) {
      const json = await res.json()
      const c = Array.isArray(json) && Array.isArray(json[1]) ? json[1][0] : null
      if (c) {
        data = {
          iso2,
          capital: typeof c.capitalCity === 'string' ? c.capitalCity.trim() : '',
          region: c.region?.value ?? '',
          incomeLevel: c.incomeLevel?.value ?? '',
        }
      }
    }
  } catch { /* leave null; retried next time */ }
  if (data) profileCache.set(iso2, { at: Date.now(), data })
  return data
}

// ── Format helpers ───────────────────────────────────────────────────────────
export function formatEconValue(id: IndicatorId, val: number): string {
  // Currency values
  if (id.includes('.CD') || id.includes('XOKA')) {
    const abs = Math.abs(val)
    if (abs >= 1e12) return `$${(val / 1e12).toFixed(2)}T`
    if (abs >= 1e9) return `$${(val / 1e9).toFixed(1)}B`
    if (abs >= 1e6) return `$${(val / 1e6).toFixed(0)}M`
    if (abs >= 1e3) return `$${(val / 1e3).toFixed(0)}K`
    return `$${val.toFixed(0)}`
  }
  // Population / personnel counts
  if (id === 'SP.POP.TOTL' || id === 'MS.MIL.TOTL.P1') {
    if (val >= 1e9) return `${(val / 1e9).toFixed(2)}B`
    if (val >= 1e6) return `${(val / 1e6).toFixed(1)}M`
    if (val >= 1e3) return `${(val / 1e3).toFixed(0)}K`
    return val.toFixed(0)
  }
  // Percentages
  if (id.includes('.ZS') || id.includes('.ZG') || id.includes('CPI')) {
    return `${val.toFixed(1)}%`
  }
  // Energy, life expectancy, GINI, etc.
  if (val >= 1000) return val.toFixed(0)
  return val.toFixed(1)
}

// Group indicators into logical sections for display
export function groupIndicators(indicators: EconIndicator[]): Record<string, EconIndicator[]> {
  const groups: Record<string, EconIndicator[]> = {
    'ECONOMY': [],
    'DEMOGRAPHICS': [],
    'TRADE': [],
    'SECURITY & ENERGY': [],
  }

  for (const ind of indicators) {
    if (['NY.GDP.MKTP.CD', 'NY.GDP.PCAP.CD', 'NY.GDP.MKTP.KD.ZG', 'FP.CPI.TOTL.ZG', 'SL.UEM.TOTL.ZS', 'GC.DOD.TOTL.GD.ZS', 'SI.POV.GINI'].includes(ind.id)) {
      groups['ECONOMY'].push(ind)
    } else if (['SP.POP.TOTL', 'SP.POP.GROW', 'SP.DYN.LE00.IN', 'SE.ADT.LITR.ZS'].includes(ind.id)) {
      groups['DEMOGRAPHICS'].push(ind)
    } else if (['NE.EXP.GNFS.CD', 'NE.IMP.GNFS.CD', 'BN.CAB.XOKA.CD', 'NE.TRD.GNFS.ZS', 'TG.VAL.TOTL.GD.ZS', 'BX.KLT.DINV.CD.WD', 'BM.KLT.DINV.CD.WD', 'BX.TRF.PWKR.CD.DT', 'IC.BUS.EASE.XQ', 'TX.VAL.TECH.MF.ZS', 'TM.TAX.MRCH.WM.AR.ZS'].includes(ind.id)) {
      groups['TRADE'].push(ind)
    } else {
      groups['SECURITY & ENERGY'].push(ind)
    }
  }

  // Remove empty groups
  for (const key of Object.keys(groups)) {
    if (groups[key].length === 0) delete groups[key]
  }

  return groups
}
