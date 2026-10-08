#!/usr/bin/env node
/**
 * Builds src/data/oilgas-factbook.json — oil & gas reserves and production per
 * country for the map's Oil & Gas layer (src/services/oilgas.ts).
 *
 * Source: CIA World Factbook, Energy section (public domain), read from the
 * factbook/factbook.json mirror on GitHub (keyless). Every value keeps the
 * year the Factbook gives for it ("(2021 est.)" → 2021). Nothing here is
 * hand-typed; countries are mapped by Factbook (GEC) file, not by name.
 *
 * Fields used:
 *   Petroleum › crude oil estimated reserves  → oilReserves   (billion bbl)
 *   Natural gas › proven reserves             → gasReserves   (trillion m³)
 *   Petroleum › total petroleum production    → oilProduction (million bbl/day, all liquids)
 *   Natural gas › production                  → gasProduction (billion m³/yr)
 *
 * Usage: node scripts/build-oilgas.mjs
 */
import { mkdir, writeFile } from 'node:fs/promises'

const RAW = 'https://raw.githubusercontent.com/factbook/factbook.json/master/'
const OUT = 'src/data/oilgas-factbook.json'

// ISO 3166-1 alpha-2 → Factbook file (Factbook uses GEC codes, e.g. Germany = gm).
const FILES = {
  AE: 'middle-east/ae.json', AF: 'south-asia/af.json', AL: 'europe/al.json', AO: 'africa/ao.json',
  AR: 'south-america/ar.json', AT: 'europe/au.json', AU: 'australia-oceania/as.json',
  AZ: 'central-asia/aj.json', BB: 'central-america-n-caribbean/bb.json', BD: 'south-asia/bg.json',
  BG: 'europe/bu.json', BH: 'middle-east/ba.json', BJ: 'africa/bn.json',
  BN: 'east-n-southeast-asia/bx.json', BO: 'south-america/bl.json', BR: 'south-america/br.json',
  BY: 'europe/bo.json', BZ: 'central-america-n-caribbean/bh.json', CA: 'north-america/ca.json',
  CD: 'africa/cg.json', CG: 'africa/cf.json', CL: 'south-america/ci.json', CM: 'africa/cm.json',
  CN: 'east-n-southeast-asia/ch.json', CO: 'south-america/co.json',
  CU: 'central-america-n-caribbean/cu.json', CZ: 'europe/ez.json', DE: 'europe/gm.json',
  DK: 'europe/da.json', DZ: 'africa/ag.json', EC: 'south-america/ec.json', EG: 'africa/eg.json',
  ES: 'europe/sp.json', ET: 'africa/et.json', FR: 'europe/fr.json', GA: 'africa/gb.json',
  GB: 'europe/uk.json', GE: 'central-asia/gg.json', GH: 'africa/gh.json', GQ: 'africa/ek.json',
  GR: 'europe/gr.json', GT: 'central-america-n-caribbean/gt.json', GY: 'south-america/gy.json',
  HR: 'europe/hr.json', HU: 'europe/hu.json', ID: 'east-n-southeast-asia/id.json',
  IL: 'middle-east/is.json', IN: 'south-asia/in.json', IQ: 'middle-east/iz.json',
  IR: 'middle-east/ir.json', IT: 'europe/it.json', JO: 'middle-east/jo.json',
  JP: 'east-n-southeast-asia/ja.json', KE: 'africa/ke.json', KG: 'central-asia/kg.json',
  KR: 'east-n-southeast-asia/ks.json', KW: 'middle-east/ku.json', KZ: 'central-asia/kz.json',
  LB: 'middle-east/le.json', LR: 'africa/li.json', LT: 'europe/lh.json', LY: 'africa/ly.json',
  MG: 'africa/ma.json', MM: 'east-n-southeast-asia/bm.json', MN: 'east-n-southeast-asia/mg.json',
  MR: 'africa/mr.json', MX: 'north-america/mx.json', MY: 'east-n-southeast-asia/my.json',
  MZ: 'africa/mz.json', NA: 'africa/wa.json', NE: 'africa/ng.json', NG: 'africa/ni.json',
  NL: 'europe/nl.json', NO: 'europe/no.json', NZ: 'australia-oceania/nz.json',
  OM: 'middle-east/mu.json', PE: 'south-america/pe.json', PG: 'east-n-southeast-asia/pp.json',
  PH: 'east-n-southeast-asia/rp.json', PK: 'south-asia/pk.json', PL: 'europe/pl.json',
  QA: 'middle-east/qa.json', RO: 'europe/ro.json', RS: 'europe/ri.json', RU: 'central-asia/rs.json',
  SA: 'middle-east/sa.json', SD: 'africa/su.json', SN: 'africa/sg.json', SO: 'africa/so.json',
  SR: 'south-america/ns.json', SS: 'africa/od.json', SY: 'middle-east/sy.json', TD: 'africa/cd.json',
  TH: 'east-n-southeast-asia/th.json', TJ: 'central-asia/ti.json',
  TL: 'east-n-southeast-asia/tt.json', TM: 'central-asia/tx.json', TN: 'africa/ts.json',
  TR: 'middle-east/tu.json', TT: 'central-america-n-caribbean/td.json', TZ: 'africa/tz.json',
  UA: 'europe/up.json', UG: 'africa/ug.json', US: 'north-america/us.json',
  UZ: 'central-asia/uz.json', VE: 'south-america/ve.json', VN: 'east-n-southeast-asia/vm.json',
  YE: 'middle-east/ym.json', ZA: 'africa/sf.json',
}

const SCALE = { trillion: 1e12, billion: 1e9, million: 1e6, '': 1 }

/** "48.363 billion barrels (2021 est.)" → { value: 48.363e9, year: 2021 } */
export function parseQuantity(text) {
  const m = /^([\d.,]+)\s*(trillion|billion|million)?\s*(barrels|bbl\/day|cubic meters)\s*\((\d{4})/.exec(text ?? '')
  if (!m) return null
  return { value: Number(m[1].replace(/,/g, '')) * SCALE[m[2] ?? ''], year: Number(m[4]) }
}

const FIELDS = [
  ['oilReserves', 'Petroleum', 'crude oil estimated reserves', 1e9],
  ['gasReserves', 'Natural gas', 'proven reserves', 1e12],
  ['oilProduction', 'Petroleum', 'total petroleum production', 1e6],
  ['gasProduction', 'Natural gas', 'production', 1e9],
]

const countries = {}
for (const [iso2, file] of Object.entries(FILES)) {
  const res = await fetch(RAW + file)
  if (!res.ok) throw new Error(`${file}: HTTP ${res.status}`)
  const energy = (await res.json()).Energy ?? {}
  const row = { factbookFile: file }
  for (const [key, section, field, unit] of FIELDS) {
    const q = parseQuantity(energy[section]?.[field]?.text)
    if (q) row[key] = { value: Number((q.value / unit).toPrecision(5)), year: q.year }
  }
  countries[iso2] = row
}

const out = {
  source: 'CIA World Factbook — Energy (public domain), via github.com/factbook/factbook.json',
  url: 'https://github.com/factbook/factbook.json',
  retrieved: new Date().toISOString().slice(0, 10),
  units: { oilReserves: 'billion bbl', gasReserves: 'trillion m³', oilProduction: 'million bbl/day (all petroleum liquids)', gasProduction: 'billion m³/yr' },
  countries,
}
await mkdir('src/data', { recursive: true })
await writeFile(OUT, JSON.stringify(out, null, 2) + '\n')
console.log(`wrote ${OUT}: ${Object.keys(countries).length} countries`)
