// Single-country equity funds listed in the US, used as a tradeable stand-in for each country's stock market, and the
// world fund they are compared against. Every symbol and fund name below was checked against Yahoo Finance's chart
// metadata (longName, first trading day) on 2026-11-01; the funds are the issuers' own MSCI country funds (iShares by
// BlackRock, Global X, VanEck). A country with no such fund (e.g. Pakistan, Colombia, Bangladesh) is left out rather
// than given a regional proxy.
//
// All of them trade on US exchanges in US dollars during US hours, so they share one calendar with the benchmark and a
// disaster's first full trading day is the same for both.

export interface CountryFund {
  /** country name as GDACS spells it; `aliases` covers GDACS's other spellings */
  country: string
  aliases?: string[]
  symbol: string
  fund: string
  /** first trading day, as Yahoo Finance reports it (2008-01-02 means "on or before": history requested from 2008) */
  since: string
}

export const BENCHMARK = { symbol: 'ACWI', fund: 'iShares MSCI ACWI ETF', since: '2008-03-28' } as const

export const FUNDS_CHECKED = '2026-11-01'

export const COUNTRY_FUNDS: CountryFund[] = [
  { country: 'Argentina', symbol: 'ARGT', fund: 'Global X MSCI Argentina ETF', since: '2011-03-03' },
  { country: 'Australia', symbol: 'EWA', fund: 'iShares MSCI Australia ETF', since: '2008-01-02' },
  { country: 'Brazil', symbol: 'EWZ', fund: 'iShares MSCI Brazil ETF', since: '2008-01-02' },
  { country: 'Canada', symbol: 'EWC', fund: 'iShares MSCI Canada ETF', since: '2008-01-02' },
  { country: 'Chile', symbol: 'ECH', fund: 'iShares MSCI Chile ETF', since: '2008-01-02' },
  { country: 'China', symbol: 'MCHI', fund: 'iShares MSCI China ETF', since: '2011-03-31' },
  { country: 'France', symbol: 'EWQ', fund: 'iShares MSCI France ETF', since: '2008-01-02' },
  { country: 'Germany', symbol: 'EWG', fund: 'iShares MSCI Germany ETF', since: '2008-01-02' },
  { country: 'Greece', symbol: 'GREK', fund: 'Global X MSCI Greece ETF', since: '2011-12-08' },
  { country: 'Hong Kong', symbol: 'EWH', fund: 'iShares MSCI Hong Kong ETF', since: '2008-01-02' },
  { country: 'India', symbol: 'INDA', fund: 'iShares MSCI India ETF', since: '2012-02-03' },
  { country: 'Indonesia', symbol: 'EIDO', fund: 'iShares MSCI Indonesia ETF', since: '2010-05-07' },
  { country: 'Israel', symbol: 'EIS', fund: 'iShares MSCI Israel ETF', since: '2008-03-28' },
  { country: 'Italy', symbol: 'EWI', fund: 'iShares MSCI Italy ETF', since: '2008-01-02' },
  { country: 'Japan', symbol: 'EWJ', fund: 'iShares MSCI Japan ETF', since: '2008-01-02' },
  { country: 'Malaysia', symbol: 'EWM', fund: 'iShares MSCI Malaysia ETF', since: '2008-01-02' },
  { country: 'Mexico', symbol: 'EWW', fund: 'iShares MSCI Mexico ETF', since: '2008-01-02' },
  { country: 'New Zealand', symbol: 'ENZL', fund: 'iShares MSCI New Zealand ETF', since: '2010-09-02' },
  { country: 'Peru', symbol: 'EPU', fund: 'iShares MSCI Peru ETF', since: '2009-06-22' },
  { country: 'Philippines', symbol: 'EPHE', fund: 'iShares MSCI Philippines ETF', since: '2010-09-29' },
  { country: 'Poland', symbol: 'EPOL', fund: 'iShares MSCI Poland ETF', since: '2010-05-26' },
  { country: 'Singapore', symbol: 'EWS', fund: 'iShares MSCI Singapore ETF', since: '2008-01-02' },
  { country: 'South Africa', symbol: 'EZA', fund: 'iShares MSCI South Africa ETF', since: '2008-01-02' },
  { country: 'South Korea', aliases: ['Republic of Korea', 'Korea, Republic of'], symbol: 'EWY', fund: 'iShares MSCI South Korea ETF', since: '2008-01-02' },
  { country: 'Spain', symbol: 'EWP', fund: 'iShares MSCI Spain ETF', since: '2008-01-02' },
  { country: 'Switzerland', symbol: 'EWL', fund: 'iShares MSCI Switzerland ETF', since: '2008-01-02' },
  { country: 'Taiwan', symbol: 'EWT', fund: 'iShares MSCI Taiwan ETF', since: '2008-01-02' },
  { country: 'Thailand', symbol: 'THD', fund: 'iShares MSCI Thailand ETF', since: '2008-04-01' },
  { country: 'Türkiye', aliases: ['Turkey'], symbol: 'TUR', fund: 'iShares MSCI Turkey ETF', since: '2008-03-28' },
  { country: 'United Kingdom', symbol: 'EWU', fund: 'iShares MSCI United Kingdom ETF', since: '2008-01-02' },
  { country: 'Viet Nam', aliases: ['Vietnam'], symbol: 'VNM', fund: 'VanEck Vietnam ETF', since: '2009-08-14' },
]

const BY_NAME = new Map<string, CountryFund>()
for (const f of COUNTRY_FUNDS) for (const n of [f.country, ...(f.aliases ?? [])]) BY_NAME.set(n.toLowerCase(), f)

/** The country fund for a GDACS country name, if there is one. */
export function fundFor(country: string): CountryFund | undefined {
  return BY_NAME.get(country.trim().toLowerCase())
}
