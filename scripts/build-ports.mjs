#!/usr/bin/env node
/**
 * Builds src/data/ports-portwatch.json — location and activity for the ports
 * in src/services/ports.ts.
 *
 * Source: IMF PortWatch (https://portwatch.imf.org) — free, keyless ArcGIS
 * feature services built from AIS by the IMF and the University of Oxford:
 *  - "PortWatch ports database": coordinates, UN/LOCODE, top industries.
 *  - "Daily Port Activity Data and Trade Estimates": port calls and estimated
 *    import/export volumes (metric tonnes), summed over one calendar year.
 * Nothing here is hand-typed except which PortWatch port each of our ports is
 * (PORTWATCH_ID below — matched by name and distance, ambiguous ones checked
 * by hand).
 *
 * Usage: node scripts/build-ports.mjs [year]   (default: last full year)
 */
import { mkdir, writeFile } from 'node:fs/promises'

const BASE = 'https://services9.arcgis.com/weJ1QsnbMYJlCHdG/arcgis/rest/services'
const DB = `${BASE}/PortWatch_ports_database/FeatureServer/0/query`
const DAILY = `${BASE}/Daily_Ports_Data/FeatureServer/0/query`
const OUT = 'src/data/ports-portwatch.json'
const YEAR = Number(process.argv[2]) || new Date().getUTCFullYear() - 1

// Our port id → PortWatch portid
const PORTWATCH_ID = {
  'ae-fujairah': 'port362', 'ae-jebel': 'port744', 'ae-khor': 'port561', 'ar-buenosaires': 'port184',
  'ar-rosario': 'port1108', 'au-brisbane': 'port174', 'au-dampier': 'port276', 'au-fremantle': 'port361',
  'au-gladstone': 'port398', 'au-melbourne': 'port729', 'au-porthedland': 'port955',
  'au-sydney': 'port1243', 'bd-chittagong': 'port241', 'be-antwerp': 'port57',
  'be-zeebrugge': 'port1424', 'bg-varna': 'port1355', 'br-itaqui': 'port506', 'br-paranagua': 'port885',
  'br-riodejaneiro': 'port1103', 'br-santos': 'port1160', 'ca-montreal': 'port766',
  'ca-princerobert': 'port1021', 'ca-vancouver': 'port1350', 'ci-abidjan': 'port4',
  'cl-sanantonio': 'port1058', 'cl-valparaiso': 'port89', 'cn-dalian': 'port273',
  'cn-guangzhou': 'port425', 'cn-ningbo': 'port824', 'cn-qingdao': 'port1069', 'cn-shanghai': 'port1188',
  'cn-shenzhen': 'port1414', 'cn-tangshan': 'port1266', 'cn-tianjin': 'port1297',
  'cn-xiamen': 'port1404', 'co-buenaventura': 'port183', 'co-cartagena': 'port218',
  'cy-limassol': 'port647', 'de-bremerhaven': 'port168', 'de-hamburg': 'port446',
  'de-wilhelmshaven': 'port1396', 'dj-doraleh': 'port294', 'dk-copenhagen': 'port582',
  'do-caucedo': 'port51', 'dz-algiers': 'port32', 'ee-tallinn': 'port1258', 'eg-ainsukhna': 'port828',
  'eg-alexandria': 'port23', 'eg-said': 'port192', 'es-algeciras': 'port31', 'es-barcelona': 'port118',
  'es-valencia': 'port1348', 'fi-helsinki': 'port460', 'fr-lehavre': 'port985',
  'fr-marseille': 'port712', 'gb-felixstowe': 'port343', 'gb-london': 'port659', 'gb-milford': 'port740',
  'gb-southampton': 'port1216', 'ge-batumi': 'port127', 'gh-tema': 'port1282', 'gr-piraeus': 'port908',
  'hk-hongkong': 'port474', 'id-surabaya': 'port1237', 'id-tanjungpriok': 'port514',
  'il-ashdod': 'port73', 'il-haifa': 'port435', 'in-chennai': 'port235', 'in-kandla': 'port540',
  'in-mundra': 'port777', 'in-nhavasheva': 'port776', 'in-visakhapatnam': 'port1367',
  'iq-basra': 'port2479', 'ir-bandar': 'port107', 'ir-kharg': 'port2164', 'it-genoa': 'port387',
  'it-gioia': 'port395', 'it-trieste': 'port1318', 'jm-kingston': 'port572', 'jp-chiba': 'port239',
  'jp-kobe': 'port581', 'jp-nagoya': 'port786', 'jp-osaka': 'port862', 'jp-tokyo': 'port1305',
  'jp-yokohama': 'port1417', 'ke-mombasa': 'port757', 'kh-sihanoukville': 'port535',
  'kr-busan': 'port1065', 'kr-incheon': 'port494', 'kr-ulsan': 'port1338', 'kw-shuwaikh': 'port25',
  'lb-beirut': 'port132', 'lk-colombo': 'port254', 'lt-klaipeda': 'port579', 'lv-riga': 'port1100',
  'ma-tangier': 'port1265', 'mg-toamasina': 'port1301', 'mm-yangon': 'port1086',
  'mt-marsaxlokk': 'port711', 'mx-lazaro': 'port637', 'mx-manzanillo': 'port699',
  'mx-veracruz': 'port1358', 'my-portklang': 'port960', 'my-tanjung': 'port1269', 'mz-maputo': 'port702',
  'ng-bonny': 'port155', 'ng-lagos': 'port626', 'nl-amsterdam': 'port45', 'nl-rotterdam': 'port1114',
  'no-bergen': 'port147', 'nz-auckland': 'port79', 'nz-tauranga': 'port1278', 'om-salalah': 'port746',
  'om-sohar': 'port988', 'pa-balboa': 'port101', 'pa-colon': 'port1035', 'pe-callao': 'port1045',
  'ph-manila': 'port694', 'pk-gwadar': 'port431', 'pk-karachi': 'port543', 'pl-gdansk': 'port380',
  'pt-sines': 'port1200', 'qa-hamad': 'port2026', 'qa-raslaffan': 'port1090', 'ro-constanta': 'port260',
  'ru-novorossiysk': 'port833', 'ru-primorsk': 'port1020', 'ru-stpetersburg': 'port1150',
  'ru-ustluga': 'port1095', 'ru-vladivostok': 'port1369', 'sa-dammam': 'port275', 'sa-jeddah': 'port518',
  'sa-ras': 'port1091', 'sa-yanbu': 'port1408', 'se-gothenburg': 'port408', 'sg-singapore': 'port1201',
  'sn-dakar': 'port272', 'so-berbera': 'port146', 'th-bangkok': 'port111', 'th-laemchabang': 'port1197',
  'tn-rades': 'port2047', 'tr-ambarli': 'port2049', 'tr-ceyhan': 'port162', 'tr-izmir': 'port510',
  'tr-mersin': 'port735', 'tt-pointlisas': 'port917', 'tw-kaohsiung': 'port541', 'tw-taipei': 'port238',
  'tz-darsalaam': 'port278', 'ua-odesa': 'port843', 'us-charleston': 'port231',
  'us-corpuschristi': 'port264', 'us-houston': 'port481', 'us-losangeles': 'port664',
  'us-neworleans': 'port1214', 'us-newyork': 'port815', 'us-norfolk': 'port826',
  'us-savannah': 'port1170', 'us-seattle': 'port1175', 'vn-haiphong': 'port434',
  'vn-hochiminh': 'port2085', 'ye-aden': 'port9', 'za-capetown': 'port215', 'za-durban': 'port311',
  'za-richards': 'port1099',
}

async function query(url, params) {
  const body = new URLSearchParams({ f: 'json', ...params })
  const res = await fetch(url, { method: 'POST', body })
  if (!res.ok) throw new Error(`PortWatch HTTP ${res.status}`)
  const json = await res.json()
  if (json.error) throw new Error(`PortWatch error: ${JSON.stringify(json.error)}`)
  return json.features.map(f => f.attributes)
}

const ids = [...new Set(Object.values(PORTWATCH_ID))]
const inList = `portid IN (${ids.map(i => `'${i}'`).join(',')})`

const meta = new Map((await query(DB, {
  where: inList,
  outFields: 'portid,portname,country,lat,lon,LOCODE,industry_top1,industry_top2,industry_top3',
  returnGeometry: 'false',
  resultRecordCount: '2000',
})).map(r => [r.portid, r]))

const stat = (type, field, name) => ({ statisticType: type, onStatisticField: field, outStatisticFieldName: name })
const activity = new Map((await query(DAILY, {
  where: `year=${YEAR} AND ${inList}`,
  groupByFieldsForStatistics: 'portid',
  outStatistics: JSON.stringify([
    stat('sum', 'portcalls', 'calls'),
    stat('sum', 'portcalls_container', 'containerCalls'),
    stat('sum', 'portcalls_tanker', 'tankerCalls'),
    stat('sum', 'import', 'importT'),
    stat('sum', 'export', 'exportT'),
    stat('count', 'portcalls', 'days'),
  ]),
})).map(r => [r.portid, r]))

const ports = {}
for (const [id, portid] of Object.entries(PORTWATCH_ID)) {
  const m = meta.get(portid)
  if (!m) throw new Error(`${id}: PortWatch port ${portid} not found`)
  const a = activity.get(portid)
  ports[id] = {
    portid,
    portwatchName: m.portname,
    locode: m.LOCODE || null,
    lat: Math.round(m.lat * 1e4) / 1e4,
    lng: Math.round(m.lon * 1e4) / 1e4,
    topIndustries: [m.industry_top1, m.industry_top2, m.industry_top3].filter(Boolean),
    activity: a ? {
      days: a.days,
      portCalls: a.calls,
      containerCalls: a.containerCalls,
      tankerCalls: a.tankerCalls,
      tradeMt: Math.round(((a.importT + a.exportT) / 1e6) * 10) / 10,
    } : null,
  }
}

const out = {
  source: 'IMF PortWatch — ports database and Daily Port Activity Data and Trade Estimates',
  url: 'https://portwatch.imf.org/pages/ports',
  year: YEAR,
  retrieved: new Date().toISOString().slice(0, 10),
  ports,
}
await mkdir('src/data', { recursive: true })
await writeFile(OUT, JSON.stringify(out, null, 2) + '\n')
console.log(`wrote ${OUT}: ${Object.keys(ports).length} ports, year ${YEAR}`)
