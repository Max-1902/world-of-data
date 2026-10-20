/**
 * Which codes are countries. The one place that decides it, so a source's aggregates ("Euro area", "FCV situations",
 * "Sub-Saharan Africa (WB)") cannot be ranked, mapped or forecast as if they were a country.
 *
 * World Bank: `src/data/wb-economies.json` is a snapshot of the API's own `/country` metadata, where every aggregate has
 * `region: "Aggregates"`. A World Bank row counts only if its ISO3 is one of the snapshot's economies. That is an
 * allowlist, so a new or renamed aggregate code (FCS became FCV, which ranked 5th on military spending) is dropped
 * rather than shown. The cost: an economy the World Bank adds after the snapshot is missing until it is refreshed.
 *
 * OWID / Ember: aggregates and former states carry `OWID_…` or `WB_…` codes or none; real countries carry ISO 3166
 * alpha-3. Kosovo (`OWID_KOS`) is the one OWID-coded current country.
 */
import snapshot from '../data/wb-economies.json'

export const WB_ECONOMY_ISO3: ReadonlySet<string> = new Set(snapshot.economies.map(e => e[0]))
/** Every aggregate code the snapshot lists, plus retired ones the API used to return. */
export const WB_AGGREGATE_ISO3: ReadonlySet<string> = new Set([...snapshot.aggregates.map(a => a[0]), ...snapshot.retired.map(a => a[0])])

/** True only for a World Bank economy (country or territory), never for a region, income group or lending group. */
export const isWbEconomy = (iso3: unknown): iso3 is string => typeof iso3 === 'string' && WB_ECONOMY_ISO3.has(iso3)

const OWID_COUNTRY_CODES: ReadonlySet<string> = new Set(['OWID_KOS'])

/** True for an OWID/Ember row that is a current country: an ISO alpha-3 code that is not a World Bank aggregate, or Kosovo. */
export function isOwidCountry(code: unknown): code is string {
  if (typeof code !== 'string') return false
  if (OWID_COUNTRY_CODES.has(code)) return true
  return /^[A-Z]{3}$/.test(code) && !WB_AGGREGATE_ISO3.has(code)
}
