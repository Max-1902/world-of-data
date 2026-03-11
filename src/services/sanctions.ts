/**
 * Economic sanctions intelligence
 * Curated dataset based on OFAC, EU, UN, UK, and other multilateral regimes.
 * Sources: US Treasury OFAC SDN list, EU sanctions map, UNSC resolutions.
 * Static data supplemented by GDELT live news fetched separately.
 */

export type SanctionRegime = 'OFAC' | 'EU' | 'UN' | 'UK' | 'AU' | 'CA' | 'SWIFT'
export type SanctionCategory = 'weapons' | 'terrorism' | 'human_rights' | 'cyber' | 'narcotics' | 'corruption' | 'nuclear' | 'financial'
export type SanctionSeverity = 'critical' | 'high' | 'medium' | 'low'

export interface SanctionedCountry {
  iso2:      string   // ISO 3166-1 alpha-2 for Mapbox layer matching
  iso3:      string   // ISO 3166-1 alpha-3
  name:      string
  regimes:   SanctionRegime[]
  categories: SanctionCategory[]
  severity:  SanctionSeverity
  summary:   string
  since?:    string   // year sanctions began
  totalDesignations?: number  // approx # of individual entities
}

export const SANCTIONED_COUNTRIES: SanctionedCountry[] = [
  // ── Critical / comprehensive ──────────────────────────────────────────────
  {
    iso2: 'IR', iso3: 'IRN', name: 'Iran',
    regimes: ['OFAC', 'EU', 'UN', 'UK'],
    categories: ['nuclear', 'terrorism', 'human_rights', 'financial'],
    severity: 'critical',
    summary: 'Comprehensive sanctions covering oil, banking, shipping, arms. JCPOA-related nuclear designations plus human rights sanctions post-2022 protests.',
    since: '1979', totalDesignations: 1400,
  },
  {
    iso2: 'KP', iso3: 'PRK', name: 'North Korea',
    regimes: ['OFAC', 'EU', 'UN', 'UK'],
    categories: ['nuclear', 'weapons', 'human_rights', 'cyber'],
    severity: 'critical',
    summary: 'UN Security Council mandatory sanctions. Comprehensive OFAC prohibitions. Covers WMD programs, ballistic missiles, coal/iron/seafood exports, luxury goods.',
    since: '2006', totalDesignations: 500,
  },
  {
    iso2: 'RU', iso3: 'RUS', name: 'Russia',
    regimes: ['OFAC', 'EU', 'UK', 'AU', 'CA'],
    categories: ['human_rights', 'cyber', 'weapons'],
    severity: 'critical',
    summary: 'Broad sectoral sanctions post-2022 Ukraine invasion: energy, finance, defense. SWIFT disconnection for major banks. Asset freezes on oligarchs and officials. 14 sanctions packages (EU).',
    since: '2014', totalDesignations: 18000,
  },
  {
    iso2: 'BY', iso3: 'BLR', name: 'Belarus',
    regimes: ['OFAC', 'EU', 'UK', 'CA'],
    categories: ['human_rights', 'weapons'],
    severity: 'critical',
    summary: 'Comprehensive sanctions post-2020 election fraud and 2021 forced landing of Ryanair flight. Aviation, finance, energy, potash sector restrictions.',
    since: '2020', totalDesignations: 1000,
  },
  {
    iso2: 'SY', iso3: 'SYR', name: 'Syria',
    regimes: ['OFAC', 'EU', 'UK'],
    categories: ['human_rights', 'weapons', 'terrorism'],
    severity: 'critical',
    summary: 'Assad-era comprehensive sanctions covering oil, banking, and individuals. Post-2011 civil war designations. Note: partial easing under review post-Assad fall (late 2024).',
    since: '2011', totalDesignations: 400,
  },
  {
    iso2: 'CU', iso3: 'CUB', name: 'Cuba',
    regimes: ['OFAC'],
    categories: ['human_rights'],
    severity: 'high',
    summary: 'US embargo since 1962. OFAC Cuban Assets Control Regulations. Limited trade and financial transactions. Other jurisdictions do not impose broad sanctions.',
    since: '1962', totalDesignations: 50,
  },
  {
    iso2: 'VE', iso3: 'VEN', name: 'Venezuela',
    regimes: ['OFAC', 'EU', 'UK', 'CA'],
    categories: ['human_rights', 'corruption', 'narcotics'],
    severity: 'high',
    summary: 'Sectoral sanctions on oil, gold, financial sector. Maduro government officials designated. Narco-sanctions on Cartel de los Soles.',
    since: '2017', totalDesignations: 250,
  },
  {
    iso2: 'MM', iso3: 'MMR', name: 'Myanmar',
    regimes: ['OFAC', 'EU', 'UK', 'CA'],
    categories: ['human_rights', 'weapons'],
    severity: 'high',
    summary: 'Post-2021 military coup sanctions. Military junta leaders and entities, state-owned oil/gas companies (Myanma Oil and Gas Enterprise), arms embargo.',
    since: '2021', totalDesignations: 350,
  },
  {
    iso2: 'SD', iso3: 'SDN', name: 'Sudan',
    regimes: ['OFAC', 'UN'],
    categories: ['human_rights', 'weapons'],
    severity: 'high',
    summary: 'Arms embargo by UN. OFAC Darfur sanctions. Post-2023 civil war between SAF and RSF — new targeted designations against both factions.',
    since: '2004', totalDesignations: 150,
  },
  {
    iso2: 'ZW', iso3: 'ZWE', name: 'Zimbabwe',
    regimes: ['OFAC', 'EU', 'UK'],
    categories: ['human_rights', 'corruption'],
    severity: 'high',
    summary: 'Targeted sanctions on ZANU-PF officials and entities. Restriction on arms and equipment enabling repression. Some EU/UK sanctions eased 2022–23.',
    since: '2002', totalDesignations: 80,
  },
  {
    iso2: 'SO', iso3: 'SOM', name: 'Somalia',
    regimes: ['UN', 'OFAC'],
    categories: ['terrorism', 'weapons'],
    severity: 'high',
    summary: 'UN arms embargo (partial). Al-Shabaab-related OFAC designations. Piracy and terrorism financing restrictions.',
    since: '1992', totalDesignations: 100,
  },
  {
    iso2: 'LY', iso3: 'LBY', name: 'Libya',
    regimes: ['UN', 'OFAC', 'EU'],
    categories: ['weapons', 'human_rights'],
    severity: 'high',
    summary: 'UN arms embargo. Sanctions on individuals and entities obstructing peace. Oil sector designations. Multiple factions designated.',
    since: '2011', totalDesignations: 80,
  },
  {
    iso2: 'CF', iso3: 'CAF', name: 'Central African Republic',
    regimes: ['UN'],
    categories: ['weapons', 'human_rights'],
    severity: 'medium',
    summary: 'UN arms embargo and targeted sanctions on armed groups. Wagner Group (now Africa Corps) activities flagged.',
    since: '2013', totalDesignations: 50,
  },
  {
    iso2: 'ML', iso3: 'MLI', name: 'Mali',
    regimes: ['UN', 'EU', 'OFAC'],
    categories: ['terrorism', 'human_rights'],
    severity: 'medium',
    summary: 'Post-coup targeted sanctions on junta members. UNSC Sanctions Committee on Mali. Terrorism-linked designations (JNIM, Wagner Group).',
    since: '2017', totalDesignations: 50,
  },
  {
    iso2: 'CD', iso3: 'COD', name: 'DR Congo',
    regimes: ['UN', 'OFAC', 'EU'],
    categories: ['weapons', 'human_rights'],
    severity: 'medium',
    summary: 'UN arms embargo. Targeted sanctions on militia leaders, M23 commanders. Eastern DRC conflict-related designations. Rwanda proxy forces named.',
    since: '2003', totalDesignations: 80,
  },
  {
    iso2: 'HT', iso3: 'HTI', name: 'Haiti',
    regimes: ['OFAC', 'UN'],
    categories: ['human_rights', 'narcotics', 'corruption'],
    severity: 'medium',
    summary: 'UN-authorized sanctions on gang leaders (Barbecue/Chérizier). OFAC Haiti-related designations. Financial flows to armed groups.',
    since: '2022', totalDesignations: 30,
  },
  {
    iso2: 'YE', iso3: 'YEM', name: 'Yemen',
    regimes: ['UN', 'OFAC', 'EU'],
    categories: ['weapons', 'terrorism', 'human_rights'],
    severity: 'high',
    summary: 'UN arms embargo. Houthi (Ansar Allah) designated as SDT by OFAC. Iran weapons pipeline sanctions. Al-Qaeda in Yemen (AQAP) designations.',
    since: '2014', totalDesignations: 120,
  },
  {
    iso2: 'NG', iso3: 'NGA', name: 'Nigeria',
    regimes: ['OFAC'],
    categories: ['terrorism', 'narcotics'],
    severity: 'low',
    summary: 'Targeted OFAC designations only — Boko Haram/ISWAP leaders, drug traffickers. No broad country sanctions. Not an SDN-listed state.',
    since: '2012', totalDesignations: 20,
  },
  {
    iso2: 'IQ', iso3: 'IRQ', name: 'Iraq',
    regimes: ['OFAC'],
    categories: ['terrorism'],
    severity: 'medium',
    summary: 'Iraq-related OFAC designations primarily target Iran-backed militias (PMF/Kata\'ib Hezbollah), ISIS-linked entities. Broad Iraq sanctions were lifted after 2003.',
    since: '2003', totalDesignations: 200,
  },
  {
    iso2: 'AF', iso3: 'AFG', name: 'Afghanistan',
    regimes: ['UN', 'OFAC', 'EU'],
    categories: ['terrorism', 'human_rights'],
    severity: 'high',
    summary: 'Taliban government sanctioned under UNSC 1988 Sanctions Committee. Narcotics trafficking designations. Hawala financial network restrictions. Women\'s rights violations flagged.',
    since: '1999', totalDesignations: 300,
  },
  {
    iso2: 'PK', iso3: 'PAK', name: 'Pakistan',
    regimes: ['OFAC'],
    categories: ['terrorism', 'weapons'],
    severity: 'low',
    summary: 'Targeted designations — LeT, JeM, and individual nuclear proliferators. FATF grey-listed (exited 2022). No broad country sanctions.',
    since: '2001', totalDesignations: 80,
  },
  {
    iso2: 'CN', iso3: 'CHN', name: 'China',
    regimes: ['OFAC', 'EU', 'UK', 'CA'],
    categories: ['human_rights', 'cyber', 'weapons'],
    severity: 'medium',
    summary: 'Targeted Xinjiang/Tibet/Hong Kong-related designations. Entity List restrictions on tech sector (Huawei, SMIC). Cyber threat actor designations. No comprehensive sanctions.',
    since: '2020', totalDesignations: 60,
  },
  {
    iso2: 'ET', iso3: 'ETH', name: 'Ethiopia',
    regimes: ['OFAC', 'EU'],
    categories: ['human_rights'],
    severity: 'low',
    summary: 'Targeted sanctions on Tigray conflict actors (TPLF leadership, Eritrean officials). US sanctions paused after 2022 peace deal. EU arms embargo eased.',
    since: '2021', totalDesignations: 15,
  },
  {
    iso2: 'NI', iso3: 'NIC', name: 'Nicaragua',
    regimes: ['OFAC', 'EU', 'UK', 'CA'],
    categories: ['human_rights', 'corruption'],
    severity: 'medium',
    summary: 'Ortega government officials designated — OFAC NICA Act, EU/UK targeted measures. Financial restrictions on state-owned entities. Opposition persecution.',
    since: '2018', totalDesignations: 120,
  },
]

// Map from ISO2 code to sanction severity color
export const SANCTION_COLORS: Record<SanctionSeverity, string> = {
  critical: '#ff1a3e',
  high:     '#ff6600',
  medium:   '#ffcc00',
  low:      '#8888ff',
}

// Map from ISO2 to country record for fast lookup
export const SANCTIONS_BY_ISO2 = Object.fromEntries(
  SANCTIONED_COUNTRIES.map(c => [c.iso2, c])
)

// Mapbox match expression value for the fill layer
// Returns array: [iso2, color, iso2, color, ..., 'transparent']
export function buildSanctionMatchExpression(): (string | string[])[] {
  const pairs: string[] = []
  for (const c of SANCTIONED_COUNTRIES) {
    pairs.push(c.iso2, SANCTION_COLORS[c.severity])
  }
  return [...pairs, 'transparent']
}

// Fetch recent sanctions news from GDELT
export async function fetchSanctionsNews(country?: string): Promise<{ title: string; url: string; domain: string; seendate: string }[]> {
  const q = country
    ? `sanctions "${country}" economy OFAC sourcelang:english`
    : 'economic sanctions OFAC treasury designation sourcelang:english'
  const url = `https://api.gdeltproject.org/api/v2/doc/doc?query=${encodeURIComponent(q)}&mode=artlist&maxrecords=30&format=json&sort=DateDesc`
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15_000) })
    if (!res.ok) return []
    const json = await res.json()
    return json.articles || []
  } catch {
    return []
  }
}
