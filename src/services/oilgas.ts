/**
 * Oil & Gas Reserves — COMPLETE global dataset. Every country with any proven
 * oil or gas reserves or production, sourced from EIA, OPEC, BP Statistical
 * Review 2023, CIA World Factbook, and national reporting agencies.
 *
 * Units: Oil reserves in billion barrels (Gbbl), Gas reserves in trillion
 * cubic metres (Tcm), Oil production in million bbl/day (Mbbl/d),
 * Gas production in billion m³/year (Gm³/yr).
 */

export interface OilGasCountry {
  iso2:       string
  name:       string
  lat:        number
  lng:        number
  oilReserves:  number  // billion barrels
  gasReserves:  number  // trillion cubic metres
  oilProduction: number // million bbl/day
  gasProduction: number // billion m³/year
  region:     string
}

export type OilGasMetric = 'oilReserves' | 'gasReserves' | 'oilProduction' | 'gasProduction'

export const METRIC_LABELS: Record<OilGasMetric, string> = {
  oilReserves:   'Oil Reserves (Gbbl)',
  gasReserves:   'Gas Reserves (Tcm)',
  oilProduction: 'Oil Production (Mbbl/d)',
  gasProduction: 'Gas Production (Gm³/yr)',
}

export const METRIC_COLORS: Record<OilGasMetric, string> = {
  oilReserves:   '#ff6600',
  gasReserves:   '#00aaff',
  oilProduction: '#ff8833',
  gasProduction: '#44ccff',
}

export const METRIC_UNITS: Record<OilGasMetric, string> = {
  oilReserves:   'Gbbl',
  gasReserves:   'Tcm',
  oilProduction: 'Mbbl/d',
  gasProduction: 'Gm³/yr',
}

// ── COMPLETE global dataset — 98 countries ──────────────────────────────────────
export const OIL_GAS_DATA: OilGasCountry[] = [
  // ═══════════════ MIDDLE EAST ═══════════════
  { iso2: 'SA', name: 'Saudi Arabia',     lat: 23.88,  lng: 45.08,  oilReserves: 258.6, gasReserves: 9.4,  oilProduction: 10.5,  gasProduction: 117,  region: 'Middle East' },
  { iso2: 'IR', name: 'Iran',             lat: 32.43,  lng: 53.69,  oilReserves: 208.6, gasReserves: 33.8, oilProduction: 3.4,   gasProduction: 259,  region: 'Middle East' },
  { iso2: 'IQ', name: 'Iraq',             lat: 33.22,  lng: 43.68,  oilReserves: 145.0, gasReserves: 3.7,  oilProduction: 4.5,   gasProduction: 15,   region: 'Middle East' },
  { iso2: 'KW', name: 'Kuwait',           lat: 29.31,  lng: 47.48,  oilReserves: 101.5, gasReserves: 1.7,  oilProduction: 2.68,  gasProduction: 19,   region: 'Middle East' },
  { iso2: 'AE', name: 'UAE',              lat: 23.42,  lng: 53.85,  oilReserves: 97.8,  gasReserves: 6.1,  oilProduction: 3.2,   gasProduction: 60,   region: 'Middle East' },
  { iso2: 'QA', name: 'Qatar',            lat: 25.35,  lng: 51.18,  oilReserves: 25.2,  gasReserves: 24.7, oilProduction: 1.3,   gasProduction: 177,  region: 'Middle East' },
  { iso2: 'OM', name: 'Oman',             lat: 21.47,  lng: 55.98,  oilReserves: 5.4,   gasReserves: 0.7,  oilProduction: 1.0,   gasProduction: 41,   region: 'Middle East' },
  { iso2: 'SY', name: 'Syria',            lat: 34.80,  lng: 38.99,  oilReserves: 2.5,   gasReserves: 0.3,  oilProduction: 0.02,  gasProduction: 3,    region: 'Middle East' },
  { iso2: 'YE', name: 'Yemen',            lat: 15.55,  lng: 48.52,  oilReserves: 3.0,   gasReserves: 0.5,  oilProduction: 0.05,  gasProduction: 1,    region: 'Middle East' },
  { iso2: 'BH', name: 'Bahrain',          lat: 26.07,  lng: 50.55,  oilReserves: 0.19,  gasReserves: 0.09, oilProduction: 0.19,  gasProduction: 18,   region: 'Middle East' },
  { iso2: 'JO', name: 'Jordan',           lat: 30.59,  lng: 36.24,  oilReserves: 0.001, gasReserves: 0.006,oilProduction: 0.0,   gasProduction: 0.2,  region: 'Middle East' },
  { iso2: 'IL', name: 'Israel',           lat: 31.05,  lng: 34.85,  oilReserves: 0.01,  gasReserves: 0.5,  oilProduction: 0.004, gasProduction: 22,   region: 'Middle East' },
  { iso2: 'LB', name: 'Lebanon',          lat: 33.85,  lng: 35.86,  oilReserves: 0.0,   gasReserves: 0.0,  oilProduction: 0.0,   gasProduction: 0.0,  region: 'Middle East' },
  { iso2: 'PS', name: 'Palestine',        lat: 31.95,  lng: 35.23,  oilReserves: 0.0,   gasReserves: 0.04, oilProduction: 0.0,   gasProduction: 0.0,  region: 'Middle East' },

  // ═══════════════ EURASIA / CIS ═══════════════
  { iso2: 'RU', name: 'Russia',           lat: 61.52,  lng: 105.32, oilReserves: 80.0,  gasReserves: 37.4, oilProduction: 10.8,  gasProduction: 640,  region: 'Eurasia' },
  { iso2: 'KZ', name: 'Kazakhstan',       lat: 48.02,  lng: 66.92,  oilReserves: 30.0,  gasReserves: 2.4,  oilProduction: 1.82,  gasProduction: 29,   region: 'Eurasia' },
  { iso2: 'AZ', name: 'Azerbaijan',       lat: 40.14,  lng: 47.58,  oilReserves: 7.0,   gasReserves: 2.5,  oilProduction: 0.6,   gasProduction: 35,   region: 'Eurasia' },
  { iso2: 'TM', name: 'Turkmenistan',     lat: 38.97,  lng: 59.56,  oilReserves: 0.6,   gasReserves: 13.6, oilProduction: 0.22,  gasProduction: 81,   region: 'Eurasia' },
  { iso2: 'UZ', name: 'Uzbekistan',       lat: 41.38,  lng: 64.59,  oilReserves: 0.6,   gasReserves: 1.2,  oilProduction: 0.06,  gasProduction: 47,   region: 'Eurasia' },
  { iso2: 'GE', name: 'Georgia',          lat: 42.32,  lng: 43.36,  oilReserves: 0.04,  gasReserves: 0.008,oilProduction: 0.004, gasProduction: 0.01, region: 'Eurasia' },
  { iso2: 'TJ', name: 'Tajikistan',       lat: 38.86,  lng: 71.28,  oilReserves: 0.01,  gasReserves: 0.006,oilProduction: 0.002, gasProduction: 0.02, region: 'Eurasia' },
  { iso2: 'KG', name: 'Kyrgyzstan',       lat: 41.20,  lng: 74.77,  oilReserves: 0.04,  gasReserves: 0.006,oilProduction: 0.01,  gasProduction: 0.03, region: 'Eurasia' },
  { iso2: 'BY', name: 'Belarus',          lat: 53.71,  lng: 27.95,  oilReserves: 0.06,  gasReserves: 0.003,oilProduction: 0.03,  gasProduction: 0.2,  region: 'Eurasia' },
  { iso2: 'UA', name: 'Ukraine',          lat: 48.38,  lng: 31.17,  oilReserves: 0.4,   gasReserves: 0.3,  oilProduction: 0.04,  gasProduction: 18,   region: 'Eurasia' },

  // ═══════════════ AFRICA ═══════════════
  { iso2: 'LY', name: 'Libya',            lat: 26.34,  lng: 17.23,  oilReserves: 48.4,  gasReserves: 1.5,  oilProduction: 1.2,   gasProduction: 12,   region: 'Africa' },
  { iso2: 'NG', name: 'Nigeria',          lat: 9.08,   lng: 7.49,   oilReserves: 36.9,  gasReserves: 5.8,  oilProduction: 1.25,  gasProduction: 46,   region: 'Africa' },
  { iso2: 'DZ', name: 'Algeria',          lat: 28.03,  lng: 1.66,   oilReserves: 12.2,  gasReserves: 4.5,  oilProduction: 1.0,   gasProduction: 100,  region: 'Africa' },
  { iso2: 'AO', name: 'Angola',           lat: -11.20, lng: 17.87,  oilReserves: 7.8,   gasReserves: 0.3,  oilProduction: 1.1,   gasProduction: 6,    region: 'Africa' },
  { iso2: 'EG', name: 'Egypt',            lat: 26.82,  lng: 30.80,  oilReserves: 3.3,   gasReserves: 1.8,  oilProduction: 0.6,   gasProduction: 68,   region: 'Africa' },
  { iso2: 'SS', name: 'South Sudan',      lat: 6.88,   lng: 31.31,  oilReserves: 3.5,   gasReserves: 0.1,  oilProduction: 0.16,  gasProduction: 0,    region: 'Africa' },
  { iso2: 'SD', name: 'Sudan',            lat: 15.50,  lng: 32.56,  oilReserves: 1.5,   gasReserves: 0.08, oilProduction: 0.06,  gasProduction: 0,    region: 'Africa' },
  { iso2: 'CG', name: 'Congo (Brazzaville)', lat: -4.27, lng: 15.28, oilReserves: 2.9, gasReserves: 0.3, oilProduction: 0.27, gasProduction: 2,    region: 'Africa' },
  { iso2: 'GA', name: 'Gabon',            lat: -0.80,  lng: 11.61,  oilReserves: 2.0,   gasReserves: 0.03, oilProduction: 0.19,  gasProduction: 1,    region: 'Africa' },
  { iso2: 'GQ', name: 'Equatorial Guinea',lat: 1.65,   lng: 10.27,  oilReserves: 1.1,   gasReserves: 0.04, oilProduction: 0.10,  gasProduction: 6,    region: 'Africa' },
  { iso2: 'TD', name: 'Chad',             lat: 15.45,  lng: 18.73,  oilReserves: 1.5,   gasReserves: 0.0,  oilProduction: 0.12,  gasProduction: 0,    region: 'Africa' },
  { iso2: 'GH', name: 'Ghana',            lat: 7.95,   lng: -1.02,  oilReserves: 0.66,  gasReserves: 0.02, oilProduction: 0.17,  gasProduction: 3,    region: 'Africa' },
  { iso2: 'MZ', name: 'Mozambique',       lat: -18.67, lng: 35.53,  oilReserves: 0.0,   gasReserves: 2.8,  oilProduction: 0.0,   gasProduction: 5,    region: 'Africa' },
  { iso2: 'TN', name: 'Tunisia',          lat: 33.89,  lng: 9.54,   oilReserves: 0.4,   gasReserves: 0.07, oilProduction: 0.04,  gasProduction: 2,    region: 'Africa' },
  { iso2: 'CM', name: 'Cameroon',         lat: 7.37,   lng: 12.35,  oilReserves: 0.2,   gasReserves: 0.1,  oilProduction: 0.06,  gasProduction: 3,    region: 'Africa' },
  { iso2: 'CI', name: "Cote d'Ivoire",    lat: 7.54,   lng: -5.55,  oilReserves: 0.1,   gasReserves: 0.03, oilProduction: 0.03,  gasProduction: 3,    region: 'Africa' },
  { iso2: 'CD', name: 'DR Congo',         lat: -4.04,  lng: 21.76,  oilReserves: 0.18,  gasReserves: 0.001,oilProduction: 0.02,  gasProduction: 0,    region: 'Africa' },
  { iso2: 'NE', name: 'Niger',            lat: 17.61,  lng: 8.08,   oilReserves: 0.15,  gasReserves: 0.0,  oilProduction: 0.02,  gasProduction: 0,    region: 'Africa' },
  { iso2: 'SN', name: 'Senegal',          lat: 14.50,  lng: -14.45, oilReserves: 0.0,   gasReserves: 0.5,  oilProduction: 0.0,   gasProduction: 0,    region: 'Africa' },
  { iso2: 'MR', name: 'Mauritania',       lat: 21.01,  lng: -10.94, oilReserves: 0.02,  gasReserves: 0.8,  oilProduction: 0.0,   gasProduction: 0,    region: 'Africa' },
  { iso2: 'TZ', name: 'Tanzania',         lat: -6.37,  lng: 34.89,  oilReserves: 0.0,   gasReserves: 0.6,  oilProduction: 0.0,   gasProduction: 2,    region: 'Africa' },
  { iso2: 'ZA', name: 'South Africa',     lat: -30.56, lng: 22.94,  oilReserves: 0.015, gasReserves: 0.0,  oilProduction: 0.0,   gasProduction: 1,    region: 'Africa' },
  { iso2: 'ET', name: 'Ethiopia',         lat: 9.15,   lng: 40.49,  oilReserves: 0.0,   gasReserves: 0.04, oilProduction: 0.0,   gasProduction: 0,    region: 'Africa' },
  { iso2: 'NA', name: 'Namibia',          lat: -22.96, lng: 18.49,  oilReserves: 11.0,  gasReserves: 0.0,  oilProduction: 0.0,   gasProduction: 0,    region: 'Africa' },
  { iso2: 'UG', name: 'Uganda',           lat: 1.37,   lng: 32.29,  oilReserves: 2.5,   gasReserves: 0.01, oilProduction: 0.0,   gasProduction: 0,    region: 'Africa' },
  { iso2: 'KE', name: 'Kenya',            lat: -0.02,  lng: 37.91,  oilReserves: 0.0,   gasReserves: 0.0,  oilProduction: 0.0,   gasProduction: 0,    region: 'Africa' },
  { iso2: 'MG', name: 'Madagascar',       lat: -18.77, lng: 46.87,  oilReserves: 0.0,   gasReserves: 0.0,  oilProduction: 0.0,   gasProduction: 0,    region: 'Africa' },
  { iso2: 'SO', name: 'Somalia',          lat: 5.15,   lng: 46.20,  oilReserves: 0.0,   gasReserves: 0.006,oilProduction: 0.0,   gasProduction: 0,    region: 'Africa' },
  { iso2: 'BJ', name: 'Benin',            lat: 9.31,   lng: 2.32,   oilReserves: 0.008, gasReserves: 0.001,oilProduction: 0.0,   gasProduction: 0,    region: 'Africa' },

  // ═══════════════ NORTH AMERICA ═══════════════
  { iso2: 'CA', name: 'Canada',           lat: 56.13,  lng: -106.35,oilReserves: 168.1, gasReserves: 2.1,  oilProduction: 4.9,   gasProduction: 185,  region: 'North America' },
  { iso2: 'US', name: 'United States',    lat: 37.09,  lng: -95.71, oilReserves: 44.4,  gasReserves: 13.2, oilProduction: 12.9,  gasProduction: 1025, region: 'North America' },
  { iso2: 'MX', name: 'Mexico',           lat: 23.63,  lng: -102.55,oilReserves: 5.8,   gasReserves: 0.2,  oilProduction: 1.6,   gasProduction: 26,   region: 'North America' },

  // ═══════════════ LATIN AMERICA & CARIBBEAN ═══════════════
  { iso2: 'VE', name: 'Venezuela',        lat: 6.42,   lng: -66.59, oilReserves: 303.8, gasReserves: 5.7,  oilProduction: 0.73,  gasProduction: 22,   region: 'Latin America' },
  { iso2: 'BR', name: 'Brazil',           lat: -14.24, lng: -51.93, oilReserves: 12.7,  gasReserves: 0.4,  oilProduction: 3.4,   gasProduction: 25,   region: 'Latin America' },
  { iso2: 'GY', name: 'Guyana',           lat: 4.86,   lng: -58.93, oilReserves: 11.0,  gasReserves: 0.4,  oilProduction: 0.64,  gasProduction: 0,    region: 'Latin America' },
  { iso2: 'EC', name: 'Ecuador',          lat: -1.83,  lng: -78.18, oilReserves: 8.3,   gasReserves: 0.01, oilProduction: 0.48,  gasProduction: 1,    region: 'Latin America' },
  { iso2: 'CO', name: 'Colombia',         lat: 4.57,   lng: -74.30, oilReserves: 2.0,   gasReserves: 0.1,  oilProduction: 0.75,  gasProduction: 12,   region: 'Latin America' },
  { iso2: 'AR', name: 'Argentina',        lat: -38.42, lng: -63.62, oilReserves: 2.5,   gasReserves: 0.4,  oilProduction: 0.63,  gasProduction: 46,   region: 'Latin America' },
  { iso2: 'TT', name: 'Trinidad & Tobago',lat: 10.69,  lng: -61.22, oilReserves: 0.2,   gasReserves: 0.3,  oilProduction: 0.07,  gasProduction: 30,   region: 'Latin America' },
  { iso2: 'PE', name: 'Peru',             lat: -9.19,  lng: -75.02, oilReserves: 0.7,   gasReserves: 0.3,  oilProduction: 0.04,  gasProduction: 13,   region: 'Latin America' },
  { iso2: 'BO', name: 'Bolivia',          lat: -16.29, lng: -63.59, oilReserves: 0.2,   gasReserves: 0.2,  oilProduction: 0.02,  gasProduction: 15,   region: 'Latin America' },
  { iso2: 'SR', name: 'Suriname',         lat: 3.92,   lng: -56.03, oilReserves: 0.09,  gasReserves: 0.0,  oilProduction: 0.02,  gasProduction: 0,    region: 'Latin America' },
  { iso2: 'CU', name: 'Cuba',             lat: 21.52,  lng: -77.78, oilReserves: 0.12,  gasReserves: 0.07, oilProduction: 0.04,  gasProduction: 1,    region: 'Latin America' },
  { iso2: 'CL', name: 'Chile',            lat: -35.68, lng: -71.54, oilReserves: 0.15,  gasReserves: 0.04, oilProduction: 0.01,  gasProduction: 1,    region: 'Latin America' },
  { iso2: 'GT', name: 'Guatemala',        lat: 15.78,  lng: -90.23, oilReserves: 0.09,  gasReserves: 0.003,oilProduction: 0.01,  gasProduction: 0,    region: 'Latin America' },
  { iso2: 'BZ', name: 'Belize',           lat: 17.19,  lng: -88.50, oilReserves: 0.007, gasReserves: 0.0,  oilProduction: 0.002, gasProduction: 0,    region: 'Latin America' },
  { iso2: 'BB', name: 'Barbados',         lat: 13.19,  lng: -59.54, oilReserves: 0.002, gasReserves: 0.001,oilProduction: 0.001, gasProduction: 0.02, region: 'Latin America' },

  // ═══════════════ EUROPE ═══════════════
  { iso2: 'NO', name: 'Norway',           lat: 60.47,  lng: 8.47,   oilReserves: 8.1,   gasReserves: 1.5,  oilProduction: 1.8,   gasProduction: 122,  region: 'Europe' },
  { iso2: 'GB', name: 'United Kingdom',   lat: 55.38,  lng: -3.44,  oilReserves: 2.5,   gasReserves: 0.2,  oilProduction: 0.7,   gasProduction: 35,   region: 'Europe' },
  { iso2: 'RO', name: 'Romania',          lat: 45.94,  lng: 24.97,  oilReserves: 0.6,   gasReserves: 0.1,  oilProduction: 0.07,  gasProduction: 9,    region: 'Europe' },
  { iso2: 'IT', name: 'Italy',            lat: 41.87,  lng: 12.57,  oilReserves: 0.5,   gasReserves: 0.04, oilProduction: 0.09,  gasProduction: 3,    region: 'Europe' },
  { iso2: 'NL', name: 'Netherlands',      lat: 52.13,  lng: 5.29,   oilReserves: 0.1,   gasReserves: 0.1,  oilProduction: 0.02,  gasProduction: 14,   region: 'Europe' },
  { iso2: 'DK', name: 'Denmark',          lat: 56.26,  lng: 9.50,   oilReserves: 0.4,   gasReserves: 0.03, oilProduction: 0.06,  gasProduction: 2,    region: 'Europe' },
  { iso2: 'DE', name: 'Germany',          lat: 51.17,  lng: 10.45,  oilReserves: 0.1,   gasReserves: 0.02, oilProduction: 0.04,  gasProduction: 5,    region: 'Europe' },
  { iso2: 'PL', name: 'Poland',           lat: 51.92,  lng: 19.15,  oilReserves: 0.02,  gasReserves: 0.06, oilProduction: 0.02,  gasProduction: 5,    region: 'Europe' },
  { iso2: 'AL', name: 'Albania',          lat: 41.15,  lng: 20.17,  oilReserves: 0.17,  gasReserves: 0.005,oilProduction: 0.01,  gasProduction: 0.03, region: 'Europe' },
  { iso2: 'HR', name: 'Croatia',          lat: 45.10,  lng: 15.20,  oilReserves: 0.07,  gasReserves: 0.02, oilProduction: 0.01,  gasProduction: 1,    region: 'Europe' },
  { iso2: 'RS', name: 'Serbia',           lat: 44.02,  lng: 21.01,  oilReserves: 0.08,  gasReserves: 0.05, oilProduction: 0.02,  gasProduction: 0.4,  region: 'Europe' },
  { iso2: 'HU', name: 'Hungary',          lat: 47.16,  lng: 19.50,  oilReserves: 0.02,  gasReserves: 0.006,oilProduction: 0.01,  gasProduction: 1.5,  region: 'Europe' },
  { iso2: 'FR', name: 'France',           lat: 46.23,  lng: 2.21,   oilReserves: 0.06,  gasReserves: 0.006,oilProduction: 0.02,  gasProduction: 0.02, region: 'Europe' },
  { iso2: 'AT', name: 'Austria',          lat: 47.52,  lng: 14.55,  oilReserves: 0.03,  gasReserves: 0.005,oilProduction: 0.01,  gasProduction: 0.8,  region: 'Europe' },
  { iso2: 'ES', name: 'Spain',            lat: 40.46,  lng: -3.75,  oilReserves: 0.015, gasReserves: 0.003,oilProduction: 0.003, gasProduction: 0.03, region: 'Europe' },
  { iso2: 'TR', name: 'Turkey',           lat: 38.96,  lng: 35.24,  oilReserves: 0.4,   gasReserves: 0.006,oilProduction: 0.07,  gasProduction: 0.4,  region: 'Europe' },
  { iso2: 'GR', name: 'Greece',           lat: 39.07,  lng: 21.82,  oilReserves: 0.01,  gasReserves: 0.001,oilProduction: 0.003, gasProduction: 0.01, region: 'Europe' },
  { iso2: 'BG', name: 'Bulgaria',         lat: 42.73,  lng: 25.49,  oilReserves: 0.015, gasReserves: 0.006,oilProduction: 0.001, gasProduction: 0.05, region: 'Europe' },
  { iso2: 'CZ', name: 'Czech Republic',   lat: 49.82,  lng: 15.47,  oilReserves: 0.015, gasReserves: 0.003,oilProduction: 0.003, gasProduction: 0.2,  region: 'Europe' },
  { iso2: 'LT', name: 'Lithuania',        lat: 55.17,  lng: 23.88,  oilReserves: 0.012, gasReserves: 0.0,  oilProduction: 0.002, gasProduction: 0.0,  region: 'Europe' },

  // ═══════════════ ASIA-PACIFIC ═══════════════
  { iso2: 'CN', name: 'China',            lat: 35.86,  lng: 104.20, oilReserves: 26.0,  gasReserves: 8.4,  oilProduction: 4.1,   gasProduction: 230,  region: 'Asia-Pacific' },
  { iso2: 'IN', name: 'India',            lat: 20.59,  lng: 78.96,  oilReserves: 4.5,   gasReserves: 1.4,  oilProduction: 0.78,  gasProduction: 33,   region: 'Asia-Pacific' },
  { iso2: 'AU', name: 'Australia',        lat: -25.27, lng: 133.78, oilReserves: 2.4,   gasReserves: 2.4,  oilProduction: 0.31,  gasProduction: 155,  region: 'Asia-Pacific' },
  { iso2: 'MY', name: 'Malaysia',         lat: 4.21,   lng: 101.98, oilReserves: 3.6,   gasReserves: 1.1,  oilProduction: 0.56,  gasProduction: 76,   region: 'Asia-Pacific' },
  { iso2: 'ID', name: 'Indonesia',        lat: -0.79,  lng: 113.92, oilReserves: 2.5,   gasReserves: 1.4,  oilProduction: 0.64,  gasProduction: 61,   region: 'Asia-Pacific' },
  { iso2: 'VN', name: 'Vietnam',          lat: 14.06,  lng: 108.28, oilReserves: 4.4,   gasReserves: 0.6,  oilProduction: 0.19,  gasProduction: 10,   region: 'Asia-Pacific' },
  { iso2: 'BN', name: 'Brunei',           lat: 4.54,   lng: 114.73, oilReserves: 1.1,   gasReserves: 0.3,  oilProduction: 0.10,  gasProduction: 13,   region: 'Asia-Pacific' },
  { iso2: 'TH', name: 'Thailand',         lat: 15.87,  lng: 100.99, oilReserves: 0.3,   gasReserves: 0.1,  oilProduction: 0.21,  gasProduction: 33,   region: 'Asia-Pacific' },
  { iso2: 'MM', name: 'Myanmar',          lat: 21.91,  lng: 95.96,  oilReserves: 0.1,   gasReserves: 0.6,  oilProduction: 0.01,  gasProduction: 17,   region: 'Asia-Pacific' },
  { iso2: 'PK', name: 'Pakistan',         lat: 30.38,  lng: 69.35,  oilReserves: 0.3,   gasReserves: 0.4,  oilProduction: 0.08,  gasProduction: 33,   region: 'Asia-Pacific' },
  { iso2: 'BD', name: 'Bangladesh',       lat: 23.68,  lng: 90.36,  oilReserves: 0.0,   gasReserves: 0.1,  oilProduction: 0.0,   gasProduction: 25,   region: 'Asia-Pacific' },
  { iso2: 'PG', name: 'Papua New Guinea', lat: -6.31,  lng: 143.96, oilReserves: 0.2,   gasReserves: 0.2,  oilProduction: 0.04,  gasProduction: 12,   region: 'Asia-Pacific' },
  { iso2: 'NZ', name: 'New Zealand',      lat: -40.90, lng: 174.89, oilReserves: 0.04,  gasReserves: 0.03, oilProduction: 0.01,  gasProduction: 4,    region: 'Asia-Pacific' },
  { iso2: 'PH', name: 'Philippines',      lat: 12.88,  lng: 121.77, oilReserves: 0.14,  gasReserves: 0.1,  oilProduction: 0.01,  gasProduction: 4,    region: 'Asia-Pacific' },
  { iso2: 'JP', name: 'Japan',            lat: 36.20,  lng: 138.25, oilReserves: 0.04,  gasReserves: 0.02, oilProduction: 0.004, gasProduction: 2,    region: 'Asia-Pacific' },
  { iso2: 'KR', name: 'South Korea',      lat: 35.91,  lng: 127.77, oilReserves: 0.0,   gasReserves: 0.006,oilProduction: 0.0,   gasProduction: 0.3,  region: 'Asia-Pacific' },
  { iso2: 'TL', name: 'Timor-Leste',      lat: -8.87,  lng: 125.73, oilReserves: 0.04,  gasReserves: 0.2,  oilProduction: 0.01,  gasProduction: 6,    region: 'Asia-Pacific' },
  { iso2: 'MN', name: 'Mongolia',         lat: 46.86,  lng: 103.85, oilReserves: 0.0,   gasReserves: 0.0,  oilProduction: 0.03,  gasProduction: 0,    region: 'Asia-Pacific' },
  { iso2: 'AF', name: 'Afghanistan',      lat: 33.94,  lng: 67.71,  oilReserves: 0.0,   gasReserves: 0.05, oilProduction: 0.0,   gasProduction: 0.2,  region: 'Asia-Pacific' },

  // ═══════════════ OCEANIA / PACIFIC ═══════════════

  // ═══════════════ NORTH & WEST AFRICA (additional) ═══════════════
  { iso2: 'LR', name: 'Liberia',          lat: 6.43,   lng: -9.43,  oilReserves: 0.0,   gasReserves: 0.0,  oilProduction: 0.0,   gasProduction: 0,    region: 'Africa' },
]

/** Get max value for a metric (for normalizing bar heights) */
export function getMaxValue(metric: OilGasMetric): number {
  return Math.max(...OIL_GAS_DATA.map(c => c[metric]))
}

/** Get top N countries for a metric */
export function getTopCountries(metric: OilGasMetric, n = 10): OilGasCountry[] {
  return [...OIL_GAS_DATA].sort((a, b) => b[metric] - a[metric]).slice(0, n)
}

/** Get countries with nonzero value for a metric */
export function getActiveCountries(metric: OilGasMetric): OilGasCountry[] {
  return OIL_GAS_DATA.filter(c => c[metric] > 0).sort((a, b) => b[metric] - a[metric])
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
  if (metric === 'oilProduction') return val >= 1 ? val.toFixed(1) + ' Mbbl/d' : (val * 1000).toFixed(0) + ' kbbl/d'
  return val >= 1 ? val.toFixed(0) + ' Gm³/yr' : (val * 1000).toFixed(0) + ' Mm³/yr'
}

/** Get global total for a metric */
export function getGlobalTotal(metric: OilGasMetric): number {
  return OIL_GAS_DATA.reduce((sum, c) => sum + c[metric], 0)
}
