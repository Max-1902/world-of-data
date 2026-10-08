/**
 * Oil & gas reserves and production by country, for the map's Oil & Gas layer.
 *
 * Every number comes from the CIA World Factbook (Energy section, public
 * domain) and keeps the Factbook's own reference year — reserves are mostly
 * 2021 estimates, production mostly 2023. The values are generated, not
 * hand-typed: scripts/build-oilgas.mjs → src/data/oilgas-factbook.json.
 * A metric the Factbook does not report is 0 here and has no year.
 *
 * Hand-entered below: which countries are shown, their label positions
 * (country centroids, not field locations) and the region grouping.
 *
 * Units: oil reserves in billion barrels (Gbbl), gas reserves in trillion
 * cubic metres (Tcm), petroleum production in million bbl/day (all liquids,
 * not crude only), gas production in billion m³/year. See DATA_PROVENANCE.md.
 */
import factbook from '../data/oilgas-factbook.json'

export type OilGasMetric = 'oilReserves' | 'gasReserves' | 'oilProduction' | 'gasProduction'

export interface OilGasCountry {
  iso2:       string
  name:       string
  lat:        number
  lng:        number
  oilReserves:  number  // billion barrels
  gasReserves:  number  // trillion cubic metres
  oilProduction: number // million bbl/day, all petroleum liquids
  gasProduction: number // billion m³/year
  region:     string
  /** Factbook reference year of each metric that has a value. */
  years:      Partial<Record<OilGasMetric, number>>
}

export const OIL_GAS_SOURCE = {
  name: 'CIA World Factbook — Energy',
  url: factbook.url,
  retrieved: factbook.retrieved,
} as const

export const METRIC_LABELS: Record<OilGasMetric, string> = {
  oilReserves:   'Oil Reserves (Gbbl)',
  gasReserves:   'Gas Reserves (Tcm)',
  oilProduction: 'Petroleum Production (Mbbl/d)',
  gasProduction: 'Gas Production (Gm³/yr)',
}

export const METRIC_COLORS: Record<OilGasMetric, string> = {
  oilReserves:   '#ff6600',
  gasReserves:   '#00aaff',
  oilProduction: '#ff8833',
  gasProduction: '#44ccff',
}

const METRICS: OilGasMetric[] = ['oilReserves', 'gasReserves', 'oilProduction', 'gasProduction']

type Placement = Pick<OilGasCountry, 'iso2' | 'name' | 'lat' | 'lng' | 'region'>
type FactbookRow = Partial<Record<OilGasMetric, { value: number; year: number }>>

// Display placement only — no figures here.
const PLACEMENTS: Placement[] = [
  // ── Middle East ──
  { iso2: 'SA', name: 'Saudi Arabia', lat: 23.88, lng: 45.08, region: 'Middle East' },
  { iso2: 'IR', name: 'Iran', lat: 32.43, lng: 53.69, region: 'Middle East' },
  { iso2: 'IQ', name: 'Iraq', lat: 33.22, lng: 43.68, region: 'Middle East' },
  { iso2: 'KW', name: 'Kuwait', lat: 29.31, lng: 47.48, region: 'Middle East' },
  { iso2: 'AE', name: 'UAE', lat: 23.42, lng: 53.85, region: 'Middle East' },
  { iso2: 'QA', name: 'Qatar', lat: 25.35, lng: 51.18, region: 'Middle East' },
  { iso2: 'OM', name: 'Oman', lat: 21.47, lng: 55.98, region: 'Middle East' },
  { iso2: 'SY', name: 'Syria', lat: 34.80, lng: 38.99, region: 'Middle East' },
  { iso2: 'YE', name: 'Yemen', lat: 15.55, lng: 48.52, region: 'Middle East' },
  { iso2: 'BH', name: 'Bahrain', lat: 26.07, lng: 50.55, region: 'Middle East' },
  { iso2: 'JO', name: 'Jordan', lat: 30.59, lng: 36.24, region: 'Middle East' },
  { iso2: 'IL', name: 'Israel', lat: 31.05, lng: 34.85, region: 'Middle East' },
  // ── Eurasia ──
  { iso2: 'RU', name: 'Russia', lat: 61.52, lng: 105.32, region: 'Eurasia' },
  { iso2: 'KZ', name: 'Kazakhstan', lat: 48.02, lng: 66.92, region: 'Eurasia' },
  { iso2: 'AZ', name: 'Azerbaijan', lat: 40.14, lng: 47.58, region: 'Eurasia' },
  { iso2: 'TM', name: 'Turkmenistan', lat: 38.97, lng: 59.56, region: 'Eurasia' },
  { iso2: 'UZ', name: 'Uzbekistan', lat: 41.38, lng: 64.59, region: 'Eurasia' },
  { iso2: 'GE', name: 'Georgia', lat: 42.32, lng: 43.36, region: 'Eurasia' },
  { iso2: 'TJ', name: 'Tajikistan', lat: 38.86, lng: 71.28, region: 'Eurasia' },
  { iso2: 'KG', name: 'Kyrgyzstan', lat: 41.20, lng: 74.77, region: 'Eurasia' },
  { iso2: 'BY', name: 'Belarus', lat: 53.71, lng: 27.95, region: 'Eurasia' },
  { iso2: 'UA', name: 'Ukraine', lat: 48.38, lng: 31.17, region: 'Eurasia' },
  // ── Africa ──
  { iso2: 'LY', name: 'Libya', lat: 26.34, lng: 17.23, region: 'Africa' },
  { iso2: 'NG', name: 'Nigeria', lat: 9.08, lng: 7.49, region: 'Africa' },
  { iso2: 'DZ', name: 'Algeria', lat: 28.03, lng: 1.66, region: 'Africa' },
  { iso2: 'AO', name: 'Angola', lat: -11.20, lng: 17.87, region: 'Africa' },
  { iso2: 'EG', name: 'Egypt', lat: 26.82, lng: 30.80, region: 'Africa' },
  { iso2: 'SS', name: 'South Sudan', lat: 6.88, lng: 31.31, region: 'Africa' },
  { iso2: 'SD', name: 'Sudan', lat: 15.50, lng: 32.56, region: 'Africa' },
  { iso2: 'CG', name: 'Congo (Brazzaville)', lat: -4.27, lng: 15.28, region: 'Africa' },
  { iso2: 'GA', name: 'Gabon', lat: -0.80, lng: 11.61, region: 'Africa' },
  { iso2: 'GQ', name: 'Equatorial Guinea', lat: 1.65, lng: 10.27, region: 'Africa' },
  { iso2: 'TD', name: 'Chad', lat: 15.45, lng: 18.73, region: 'Africa' },
  { iso2: 'GH', name: 'Ghana', lat: 7.95, lng: -1.02, region: 'Africa' },
  { iso2: 'MZ', name: 'Mozambique', lat: -18.67, lng: 35.53, region: 'Africa' },
  { iso2: 'TN', name: 'Tunisia', lat: 33.89, lng: 9.54, region: 'Africa' },
  { iso2: 'CM', name: 'Cameroon', lat: 7.37, lng: 12.35, region: 'Africa' },
  { iso2: 'CD', name: 'DR Congo', lat: -4.04, lng: 21.76, region: 'Africa' },
  { iso2: 'NE', name: 'Niger', lat: 17.61, lng: 8.08, region: 'Africa' },
  { iso2: 'SN', name: 'Senegal', lat: 14.50, lng: -14.45, region: 'Africa' },
  { iso2: 'MR', name: 'Mauritania', lat: 21.01, lng: -10.94, region: 'Africa' },
  { iso2: 'TZ', name: 'Tanzania', lat: -6.37, lng: 34.89, region: 'Africa' },
  { iso2: 'ZA', name: 'South Africa', lat: -30.56, lng: 22.94, region: 'Africa' },
  { iso2: 'ET', name: 'Ethiopia', lat: 9.15, lng: 40.49, region: 'Africa' },
  { iso2: 'NA', name: 'Namibia', lat: -22.96, lng: 18.49, region: 'Africa' },
  { iso2: 'UG', name: 'Uganda', lat: 1.37, lng: 32.29, region: 'Africa' },
  { iso2: 'SO', name: 'Somalia', lat: 5.15, lng: 46.20, region: 'Africa' },
  { iso2: 'BJ', name: 'Benin', lat: 9.31, lng: 2.32, region: 'Africa' },
  // ── North America ──
  { iso2: 'CA', name: 'Canada', lat: 56.13, lng: -106.35, region: 'North America' },
  { iso2: 'US', name: 'United States', lat: 37.09, lng: -95.71, region: 'North America' },
  { iso2: 'MX', name: 'Mexico', lat: 23.63, lng: -102.55, region: 'North America' },
  // ── Latin America ──
  { iso2: 'VE', name: 'Venezuela', lat: 6.42, lng: -66.59, region: 'Latin America' },
  { iso2: 'BR', name: 'Brazil', lat: -14.24, lng: -51.93, region: 'Latin America' },
  { iso2: 'GY', name: 'Guyana', lat: 4.86, lng: -58.93, region: 'Latin America' },
  { iso2: 'EC', name: 'Ecuador', lat: -1.83, lng: -78.18, region: 'Latin America' },
  { iso2: 'CO', name: 'Colombia', lat: 4.57, lng: -74.30, region: 'Latin America' },
  { iso2: 'AR', name: 'Argentina', lat: -38.42, lng: -63.62, region: 'Latin America' },
  { iso2: 'TT', name: 'Trinidad & Tobago', lat: 10.69, lng: -61.22, region: 'Latin America' },
  { iso2: 'PE', name: 'Peru', lat: -9.19, lng: -75.02, region: 'Latin America' },
  { iso2: 'BO', name: 'Bolivia', lat: -16.29, lng: -63.59, region: 'Latin America' },
  { iso2: 'SR', name: 'Suriname', lat: 3.92, lng: -56.03, region: 'Latin America' },
  { iso2: 'CU', name: 'Cuba', lat: 21.52, lng: -77.78, region: 'Latin America' },
  { iso2: 'CL', name: 'Chile', lat: -35.68, lng: -71.54, region: 'Latin America' },
  { iso2: 'GT', name: 'Guatemala', lat: 15.78, lng: -90.23, region: 'Latin America' },
  { iso2: 'BZ', name: 'Belize', lat: 17.19, lng: -88.50, region: 'Latin America' },
  { iso2: 'BB', name: 'Barbados', lat: 13.19, lng: -59.54, region: 'Latin America' },
  // ── Europe ──
  { iso2: 'NO', name: 'Norway', lat: 60.47, lng: 8.47, region: 'Europe' },
  { iso2: 'GB', name: 'United Kingdom', lat: 55.38, lng: -3.44, region: 'Europe' },
  { iso2: 'RO', name: 'Romania', lat: 45.94, lng: 24.97, region: 'Europe' },
  { iso2: 'IT', name: 'Italy', lat: 41.87, lng: 12.57, region: 'Europe' },
  { iso2: 'NL', name: 'Netherlands', lat: 52.13, lng: 5.29, region: 'Europe' },
  { iso2: 'DK', name: 'Denmark', lat: 56.26, lng: 9.50, region: 'Europe' },
  { iso2: 'DE', name: 'Germany', lat: 51.17, lng: 10.45, region: 'Europe' },
  { iso2: 'PL', name: 'Poland', lat: 51.92, lng: 19.15, region: 'Europe' },
  { iso2: 'AL', name: 'Albania', lat: 41.15, lng: 20.17, region: 'Europe' },
  { iso2: 'HR', name: 'Croatia', lat: 45.10, lng: 15.20, region: 'Europe' },
  { iso2: 'RS', name: 'Serbia', lat: 44.02, lng: 21.01, region: 'Europe' },
  { iso2: 'HU', name: 'Hungary', lat: 47.16, lng: 19.50, region: 'Europe' },
  { iso2: 'FR', name: 'France', lat: 46.23, lng: 2.21, region: 'Europe' },
  { iso2: 'AT', name: 'Austria', lat: 47.52, lng: 14.55, region: 'Europe' },
  { iso2: 'ES', name: 'Spain', lat: 40.46, lng: -3.75, region: 'Europe' },
  { iso2: 'TR', name: 'Turkey', lat: 38.96, lng: 35.24, region: 'Europe' },
  { iso2: 'GR', name: 'Greece', lat: 39.07, lng: 21.82, region: 'Europe' },
  { iso2: 'BG', name: 'Bulgaria', lat: 42.73, lng: 25.49, region: 'Europe' },
  { iso2: 'CZ', name: 'Czech Republic', lat: 49.82, lng: 15.47, region: 'Europe' },
  { iso2: 'LT', name: 'Lithuania', lat: 55.17, lng: 23.88, region: 'Europe' },
  // ── Asia-Pacific ──
  { iso2: 'CN', name: 'China', lat: 35.86, lng: 104.20, region: 'Asia-Pacific' },
  { iso2: 'IN', name: 'India', lat: 20.59, lng: 78.96, region: 'Asia-Pacific' },
  { iso2: 'AU', name: 'Australia', lat: -25.27, lng: 133.78, region: 'Asia-Pacific' },
  { iso2: 'MY', name: 'Malaysia', lat: 4.21, lng: 101.98, region: 'Asia-Pacific' },
  { iso2: 'ID', name: 'Indonesia', lat: -0.79, lng: 113.92, region: 'Asia-Pacific' },
  { iso2: 'VN', name: 'Vietnam', lat: 14.06, lng: 108.28, region: 'Asia-Pacific' },
  { iso2: 'BN', name: 'Brunei', lat: 4.54, lng: 114.73, region: 'Asia-Pacific' },
  { iso2: 'TH', name: 'Thailand', lat: 15.87, lng: 100.99, region: 'Asia-Pacific' },
  { iso2: 'MM', name: 'Myanmar', lat: 21.91, lng: 95.96, region: 'Asia-Pacific' },
  { iso2: 'PK', name: 'Pakistan', lat: 30.38, lng: 69.35, region: 'Asia-Pacific' },
  { iso2: 'BD', name: 'Bangladesh', lat: 23.68, lng: 90.36, region: 'Asia-Pacific' },
  { iso2: 'PG', name: 'Papua New Guinea', lat: -6.31, lng: 143.96, region: 'Asia-Pacific' },
  { iso2: 'NZ', name: 'New Zealand', lat: -40.90, lng: 174.89, region: 'Asia-Pacific' },
  { iso2: 'PH', name: 'Philippines', lat: 12.88, lng: 121.77, region: 'Asia-Pacific' },
  { iso2: 'JP', name: 'Japan', lat: 36.20, lng: 138.25, region: 'Asia-Pacific' },
  { iso2: 'KR', name: 'South Korea', lat: 35.91, lng: 127.77, region: 'Asia-Pacific' },
  { iso2: 'TL', name: 'Timor-Leste', lat: -8.87, lng: 125.73, region: 'Asia-Pacific' },
  { iso2: 'MN', name: 'Mongolia', lat: 46.86, lng: 103.85, region: 'Asia-Pacific' },
  { iso2: 'AF', name: 'Afghanistan', lat: 33.94, lng: 67.71, region: 'Asia-Pacific' },
]

const rows = factbook.countries as Record<string, FactbookRow>

export const OIL_GAS_DATA: OilGasCountry[] = PLACEMENTS
  .filter(p => rows[p.iso2] && METRICS.some(m => rows[p.iso2][m]))
  .map(p => {
    const r = rows[p.iso2]
    const years: OilGasCountry['years'] = {}
    for (const m of METRICS) if (r[m]) years[m] = r[m]!.year
    return {
      ...p,
      oilReserves: r.oilReserves?.value ?? 0,
      gasReserves: r.gasReserves?.value ?? 0,
      oilProduction: r.oilProduction?.value ?? 0,
      gasProduction: r.gasProduction?.value ?? 0,
      years,
    }
  })

export function getMaxValue(metric: OilGasMetric): number {
  return Math.max(...OIL_GAS_DATA.map(c => c[metric]))
}

/** Aggregate by region */
export function getRegionTotals(metric: OilGasMetric): { region: string; total: number }[] {
  const map = new Map<string, number>()
  for (const c of OIL_GAS_DATA) {
    map.set(c.region, (map.get(c.region) || 0) + c[metric])
  }
  return [...map.entries()]
    .map(([region, total]) => ({ region, total }))
    .sort((a, b) => b.total - a.total)
}

/** Format a value with appropriate unit suffix */
export function formatValue(val: number, metric: OilGasMetric): string {
  if (val === 0) return '—'
  if (metric === 'oilReserves') return val >= 1 ? val.toFixed(1) + ' Gbbl' : (val * 1000).toFixed(0) + ' Mbbl'
  if (metric === 'gasReserves') return val >= 1 ? val.toFixed(1) + ' Tcm' : (val * 1000).toFixed(0) + ' Gcm'
  if (metric === 'oilProduction') return val >= 1 ? val.toFixed(1) + ' Mbbl/d' : val >= 0.001 ? (val * 1000).toFixed(0) + ' kbbl/d' : (val * 1e6).toFixed(0) + ' bbl/d'
  return val >= 1 ? val.toFixed(0) + ' Gm³/yr' : (val * 1000).toFixed(0) + ' Mm³/yr'
}
