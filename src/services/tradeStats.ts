/**
 * Trade Statistics — structural trade profiles for 45 economies.
 *
 * Partner shares, product mix, trade balance and macro ratios are generated
 * from UN Comtrade (reporter data) and World Bank Open Data — not hand-typed.
 * See scripts/build-trade.mjs → src/data/trade-profiles.json. Each profile
 * keeps the Comtrade reporting year it was built from.
 *
 * Hand-entered below: `currency`, `tradeBlocs` (current treaty/organisation
 * membership, not a measured figure) and `dependencies` (editorial,
 * qualitative — like `risks` in chokepoints.ts). Taiwan is not a UN Comtrade
 * reporter and has no profile here. See DATA_PROVENANCE.md.
 */
import generated from '../data/trade-profiles.json'
import { resolveISO2 } from './worldbank'

export interface TradeProfile {
  iso2: string
  name: string
  year: number // Comtrade reporting year this profile's trade figures are from
  // Top export/import partners (% of total)
  topExportPartners: { country: string; pct: number }[]
  topImportPartners: { country: string; pct: number }[]
  // Top exported/imported product categories (HS2-level descriptions)
  topExports: { product: string; pct: number }[]
  topImports: { product: string; pct: number }[]
  // Key metrics
  tradeBalance?: number     // US$ billions (positive = surplus)
  tradeToGDP?: number       // trade openness (%), World Bank NE.TRD.GNFS.ZS
  currentAccount?: number   // % of GDP, World Bank BN.CAB.XOKA.GD.ZS
  // Trade agreements — current membership, hand-maintained
  tradeBlocs: string[]
  // Currency
  currency: string
  // World Bank income classification
  incomeGroup: 'high' | 'upper-middle' | 'lower-middle' | 'low'
  // Key dependencies / vulnerabilities — editorial, qualitative
  dependencies?: string[]
}

export const TRADE_SOURCE = generated.sources

interface CountryMeta {
  name: string
  currency: string
  tradeBlocs: string[]
  dependencies?: string[]
}

// Hand-maintained: currency and current treaty/organisation membership (facts,
// not figures) plus editorial dependency notes. Checked 2026-10 against each
// organisation's current member list.
const META: Record<string, CountryMeta> = {
  US: { name: 'United States', currency: 'USD', tradeBlocs: ['USMCA', 'WTO', 'APEC'], dependencies: ['Rare earth minerals from China', 'TSMC semiconductors', 'OPEC+ oil pricing'] },
  CN: { name: 'China', currency: 'CNY (RMB)', tradeBlocs: ['RCEP', 'WTO', 'APEC', 'SCO', 'BRICS'], dependencies: ['Taiwan semiconductors', 'Middle East oil', 'Australian iron ore', 'US consumer market'] },
  DE: { name: 'Germany', currency: 'EUR', tradeBlocs: ['EU', 'WTO', 'Eurozone'], dependencies: ['Russian gas (transitioning)', 'Chinese EV batteries', 'US defense umbrella'] },
  JP: { name: 'Japan', currency: 'JPY', tradeBlocs: ['RCEP', 'CPTPP', 'WTO', 'APEC'], dependencies: ['Middle East oil/LNG', 'China supply chains', 'US security alliance'] },
  GB: { name: 'United Kingdom', currency: 'GBP', tradeBlocs: ['WTO', 'CPTPP'], dependencies: ['Norwegian gas', 'EU single market access (post-Brexit)', 'US defense/intel'] },
  IN: { name: 'India', currency: 'INR', tradeBlocs: ['WTO', 'BRICS', 'SCO', 'SAARC'], dependencies: ['Middle East oil (85% imported)', 'China electronics', 'US tech services market'] },
  RU: { name: 'Russia', currency: 'RUB', tradeBlocs: ['EAEU', 'BRICS', 'SCO', 'WTO', 'OPEC+'], dependencies: ['Oil/gas revenue (>40% budget)', 'China for tech imports', 'Western sanctions pressure'] },
  SA: { name: 'Saudi Arabia', currency: 'SAR', tradeBlocs: ['OPEC', 'OPEC+', 'WTO', 'GCC', 'BRICS'], dependencies: ['Oil price (>60% gov revenue)', 'Asian demand', 'Vision 2030 diversification'] },
  BR: { name: 'Brazil', currency: 'BRL', tradeBlocs: ['Mercosur', 'BRICS', 'WTO'], dependencies: ['China commodity demand', 'Imported fertilizers (Russia/Belarus)', 'US tech'] },
  AU: { name: 'Australia', currency: 'AUD', tradeBlocs: ['RCEP', 'CPTPP', 'WTO', 'APEC'], dependencies: ['China iron ore demand', 'Energy export prices', 'US security alliance'] },
  KR: { name: 'South Korea', currency: 'KRW', tradeBlocs: ['RCEP', 'WTO', 'APEC', 'KORUS FTA'], dependencies: ['Semiconductor cycle', 'Middle East energy', 'China market access', 'North Korea risk'] },
  SG: { name: 'Singapore', currency: 'SGD', tradeBlocs: ['ASEAN', 'RCEP', 'CPTPP', 'WTO', 'APEC'], dependencies: ['Entrepot trade flows', 'Water imports (Malaysia)', 'Global semiconductor demand'] },
  TR: { name: 'Turkey', currency: 'TRY', tradeBlocs: ['WTO', 'G20', 'EU customs union'], dependencies: ['Russian/Azeri gas', 'Imported oil', 'EU market access', 'Lira instability'] },
  AE: { name: 'UAE', currency: 'AED', tradeBlocs: ['GCC', 'OPEC', 'WTO', 'BRICS'], dependencies: ['Oil prices', 'Re-export/transit hub status', 'South Asian labor'] },
  ZA: { name: 'South Africa', currency: 'ZAR', tradeBlocs: ['BRICS', 'SADC', 'AU', 'WTO', 'AfCFTA'], dependencies: ['Eskom power grid reliability', 'PGM/mining demand', 'Chinese mineral demand'] },
  NG: { name: 'Nigeria', currency: 'NGN', tradeBlocs: ['ECOWAS', 'OPEC', 'AU', 'WTO', 'AfCFTA'], dependencies: ['Oil revenue (90% exports)', 'Imported refined fuel', 'Food imports', 'FX reserves pressure'] },
  FR: { name: 'France', currency: 'EUR', tradeBlocs: ['EU', 'WTO', 'Eurozone'], dependencies: ['Russian gas (declining)', 'US tech platforms', 'Chinese rare earths'] },
  IT: { name: 'Italy', currency: 'EUR', tradeBlocs: ['EU', 'WTO', 'Eurozone'], dependencies: ['North African gas pipeline', 'Chinese textile supply chains'] },
  CA: { name: 'Canada', currency: 'CAD', tradeBlocs: ['USMCA', 'WTO', 'CPTPP', 'APEC'], dependencies: ['US market concentration (75% exports)', 'Trans Mountain pipeline capacity'] },
  MX: { name: 'Mexico', currency: 'MXN', tradeBlocs: ['USMCA', 'WTO', 'Pacific Alliance'], dependencies: ['US market (80% exports)', 'Chinese electronics components', 'Nearshoring boom'] },
  ID: { name: 'Indonesia', currency: 'IDR', tradeBlocs: ['ASEAN', 'RCEP', 'WTO', 'G20', 'BRICS'], dependencies: ['China demand for commodities', 'Nickel processing (EV batteries)', 'Palm oil price volatility'] },
  TH: { name: 'Thailand', currency: 'THB', tradeBlocs: ['ASEAN', 'RCEP', 'WTO'], dependencies: ['Japanese auto investment', 'Energy imports', 'Tourism revenue'] },
  VN: { name: 'Vietnam', currency: 'VND', tradeBlocs: ['ASEAN', 'RCEP', 'CPTPP', 'WTO'], dependencies: ['Samsung operations (32% of exports)', 'China supply chain', 'US market access'] },
  MY: { name: 'Malaysia', currency: 'MYR', tradeBlocs: ['ASEAN', 'RCEP', 'CPTPP', 'WTO'], dependencies: ['Semiconductor OSAT (13% global)', 'Palm oil price', 'Penang tech cluster'] },
  PH: { name: 'Philippines', currency: 'PHP', tradeBlocs: ['ASEAN', 'RCEP', 'WTO'], dependencies: ['Remittances (10% GDP)', 'Electronics assembly', 'Rice imports'] },
  NL: { name: 'Netherlands', currency: 'EUR', tradeBlocs: ['EU', 'WTO', 'Eurozone'], dependencies: ['ASML EUV monopoly', 'Rotterdam port (Europe\'s largest)', 'Natural gas transition'] },
  CH: { name: 'Switzerland', currency: 'CHF', tradeBlocs: ['EFTA', 'WTO'], dependencies: ['Pharma concentration (Novartis, Roche)', 'Gold refining hub', 'EU bilateral agreements'] },
  ES: { name: 'Spain', currency: 'EUR', tradeBlocs: ['EU', 'WTO', 'Eurozone'] },
  PL: { name: 'Poland', currency: 'PLN', tradeBlocs: ['EU', 'WTO', 'NATO'], dependencies: ['German auto supply chain', 'Russian energy transition', 'EU structural funds'] },
  SE: { name: 'Sweden', currency: 'SEK', tradeBlocs: ['EU', 'WTO'] },
  NO: { name: 'Norway', currency: 'NOK', tradeBlocs: ['EEA', 'EFTA', 'WTO'], dependencies: ['Oil/gas price (64% of exports)', 'Sovereign wealth fund ($1.4T)'] },
  IL: { name: 'Israel', currency: 'ILS', tradeBlocs: ['WTO', 'US FTA', 'EU Association'], dependencies: ['US military aid ($3.8B/yr)', 'Tech sector (Unit 8200 pipeline)', 'Natural gas from Leviathan'] },
  EG: { name: 'Egypt', currency: 'EGP', tradeBlocs: ['WTO', 'African Union', 'COMESA', 'BRICS'], dependencies: ['Suez Canal revenue', 'Wheat imports (world\'s largest)', 'Gulf remittances', 'Tourism'] },
  IR: { name: 'Iran', currency: 'IRR', tradeBlocs: ['ECO', 'OPEC', 'BRICS'], dependencies: ['Sanctions evasion via China/UAE', 'Oil price (55% exports)', 'SWIFT exclusion'] },
  PK: { name: 'Pakistan', currency: 'PKR', tradeBlocs: ['WTO', 'ECO'], dependencies: ['CPEC (China-Pakistan Economic Corridor)', 'IMF bailouts', 'Energy imports', 'Remittances'] },
  BD: { name: 'Bangladesh', currency: 'BDT', tradeBlocs: ['WTO', 'SAARC'], dependencies: ['Garment industry (84% exports)', 'Remittances', 'Climate vulnerability'] },
  CL: { name: 'Chile', currency: 'CLP', tradeBlocs: ['Pacific Alliance', 'CPTPP', 'WTO'], dependencies: ['Copper price (50% exports)', 'Lithium nationalization debate', 'China demand'] },
  CO: { name: 'Colombia', currency: 'COP', tradeBlocs: ['Pacific Alliance', 'WTO', 'Andean Community'], dependencies: ['Oil price', 'US market (26% exports)', 'Coal phase-out risk'] },
  AR: { name: 'Argentina', currency: 'ARS', tradeBlocs: ['Mercosur', 'WTO', 'G20', 'BRICS'], dependencies: ['Soy price', 'Vaca Muerta shale development', 'IMF debt restructuring', 'Lithium triangle potential'] },
  QA: { name: 'Qatar', currency: 'QAR', tradeBlocs: ['GCC', 'WTO'], dependencies: ['LNG price (55% exports)', 'North Field expansion', 'Asian LNG demand'] },
  KW: { name: 'Kuwait', currency: 'KWD', tradeBlocs: ['GCC', 'OPEC', 'WTO'], dependencies: ['Oil (82% exports)', 'Sovereign wealth fund ($800B+)'] },
  KE: { name: 'Kenya', currency: 'KES', tradeBlocs: ['EAC', 'AfCFTA', 'COMESA', 'WTO'], dependencies: ['Tea/flower prices', 'East African hub role', 'Chinese BRI loans'] },
  ET: { name: 'Ethiopia', currency: 'ETB', tradeBlocs: ['AfCFTA', 'AU', 'IGAD', 'BRICS'], dependencies: ['Coffee price', 'Chinese infrastructure loans', 'Nile dam geopolitics'] },
  GH: { name: 'Ghana', currency: 'GHS', tradeBlocs: ['AfCFTA', 'ECOWAS', 'WTO'], dependencies: ['Gold/cocoa/oil prices', 'IMF program', 'Debt restructuring'] },
  UA: { name: 'Ukraine', currency: 'UAH', tradeBlocs: ['WTO', 'EU Association'], dependencies: ['War economy', 'Western military/financial aid', 'Black Sea grain corridor', 'Energy infrastructure'] },
}

interface GeneratedProfile {
  comtradeReporter: number
  year: number
  exportsUsdBn: number
  importsUsdBn: number
  tradeBalanceUsdBn: number
  topExportPartners: { country: string; pct: number }[]
  topImportPartners: { country: string; pct: number }[]
  topExports: { product: string; hs: string; pct: number }[]
  topImports: { product: string; hs: string; pct: number }[]
  tradeToGDP: { value: number; year: number } | null
  currentAccount: { value: number; year: number } | null
  incomeGroup: TradeProfile['incomeGroup'] | null
}

const profiles = generated.profiles as unknown as Record<string, GeneratedProfile>

export const TRADE_PROFILES: TradeProfile[] = Object.entries(profiles)
  .filter(([iso2]) => META[iso2])
  .map(([iso2, g]) => {
    const meta = META[iso2]
    return {
      iso2,
      name: meta.name,
      year: g.year,
      topExportPartners: g.topExportPartners,
      topImportPartners: g.topImportPartners,
      topExports: g.topExports.map(({ product, pct }) => ({ product, pct })),
      topImports: g.topImports.map(({ product, pct }) => ({ product, pct })),
      tradeBalance: Math.round(g.tradeBalanceUsdBn),
      tradeToGDP: g.tradeToGDP?.value,
      currentAccount: g.currentAccount?.value,
      tradeBlocs: meta.tradeBlocs,
      currency: meta.currency,
      incomeGroup: g.incomeGroup ?? 'high',
      dependencies: meta.dependencies,
    }
  })
  .sort((a, b) => a.name.localeCompare(b.name))

// ── Lookup by ISO2 ──────────────────────────────────────────────────────────
const PROFILE_MAP = new Map(TRADE_PROFILES.map(p => [p.iso2, p]))

// Name-based lookup
const NAME_TO_ISO2: Record<string, string> = {}
for (const p of TRADE_PROFILES) {
  NAME_TO_ISO2[p.name.toLowerCase()] = p.iso2
}
// Common aliases
Object.assign(NAME_TO_ISO2, {
  'usa': 'US', 'united states of america': 'US', 'america': 'US',
  'uk': 'GB', 'england': 'GB', 'britain': 'GB', 'great britain': 'GB',
  'south korea': 'KR', 's.korea': 'KR', 'republic of korea': 'KR', // bare "korea" is ambiguous: no profile
  'uae': 'AE', 'emirates': 'AE', 'united arab emirates': 'AE',
  's.africa': 'ZA', 'south africa': 'ZA',
  'holland': 'NL', 'the netherlands': 'NL',
  'ivory coast': 'CI',
  'czech republic': 'CZ', 'czechia': 'CZ',
  'myanmar': 'MM', 'burma': 'MM',
})

export function getTradeProfile(countryName: string): TradeProfile | null {
  const lc = countryName.toLowerCase().trim()
  const iso = NAME_TO_ISO2[lc] ?? (/^[A-Z]{2}$/.test(countryName) ? countryName : resolveISO2(countryName))
  return iso ? PROFILE_MAP.get(iso) ?? null : null
}
