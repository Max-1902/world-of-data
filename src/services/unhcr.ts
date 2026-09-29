// ── UNHCR / HDX Humanitarian Data Service ────────────────────────────────────
// Combines UNHCR Population Statistics API with curated static datasets for:
//   • Population of Concern (refugees, IDPs, asylum-seekers, stateless)
//   • UNHCR Country Operations (office presence)
//   • Border Crossing Points
//   • Population Reference Points / Refugee Camps (admin2-level)
// ────────────────────────────────────────────────────────────────────────────

export interface UNHCRStat {
  iso3:          string
  iso2:          string
  country:       string
  refugees:      number
  asylum_seekers: number
  idps:          number
  stateless:     number
  total:         number
  role:          'hosting' | 'origin'
}

export type OfficeType = 'hq' | 'regional' | 'country' | 'sub-office' | 'liaison'

export interface UNHCROffice {
  id:      string
  name:    string
  city:    string
  country: string
  lat:     number
  lng:     number
  type:    OfficeType
}

export type CrossingStatus = 'open' | 'restricted' | 'closed' | 'unknown'

export interface BorderCrossing {
  id:       string
  name:     string
  country1: string
  country2: string
  lat:      number
  lng:      number
  status:   CrossingStatus
  bearing:  number   // compass heading (deg) of the crossing road/axis, country1 → country2
}

export type CampType = 'camp' | 'settlement' | 'informal' | 'poc_site' | 'transit'

export interface RefugeeCamp {
  id:         string
  name:       string
  country:    string
  lat:        number
  lng:        number
  population: number
  type:       CampType
  notes?:     string
}

// ── Global Totals (UNHCR Global Trends 2023 report) ───────────────────────────
export const UNHCR_GLOBAL_2023 = {
  year:                     2023,
  total_forcibly_displaced: 117_300_000,
  refugees_unhcr:            29_600_000,
  refugees_unrwa:             5_900_000,
  idps:                      62_500_000,
  asylum_seekers:             6_900_000,
  stateless:                  4_400_000,
  returnees:                  6_900_000,
  others_of_concern:          5_500_000,
}

// ── Top Countries of Asylum / Hosting (2023) ──────────────────────────────────
export const TOP_HOSTING: UNHCRStat[] = [
  { iso3:'IRN', iso2:'IR', country:'Iran',            refugees:3_800_000, asylum_seekers:0,       idps:0,          stateless:0, total:3_800_000, role:'hosting' },
  { iso3:'TUR', iso2:'TR', country:'Turkey',           refugees:3_600_000, asylum_seekers:200_000, idps:0,          stateless:0, total:3_800_000, role:'hosting' },
  { iso3:'COL', iso2:'CO', country:'Colombia',         refugees:300_000,   asylum_seekers:200_000, idps:6_800_000,  stateless:0, total:7_300_000, role:'hosting' },
  { iso3:'DEU', iso2:'DE', country:'Germany',          refugees:2_600_000, asylum_seekers:351_000, idps:0,          stateless:0, total:2_951_000, role:'hosting' },
  { iso3:'PAK', iso2:'PK', country:'Pakistan',         refugees:2_100_000, asylum_seekers:0,       idps:0,          stateless:0, total:2_100_000, role:'hosting' },
  { iso3:'RUS', iso2:'RU', country:'Russia',           refugees:1_200_000, asylum_seekers:65_000,  idps:0,          stateless:0, total:1_265_000, role:'hosting' },
  { iso3:'UGA', iso2:'UG', country:'Uganda',           refugees:1_700_000, asylum_seekers:9_000,   idps:40_000,     stateless:0, total:1_749_000, role:'hosting' },
  { iso3:'ETH', iso2:'ET', country:'Ethiopia',         refugees:1_050_000, asylum_seekers:8_000,   idps:3_860_000,  stateless:0, total:4_918_000, role:'hosting' },
  { iso3:'BGD', iso2:'BD', country:'Bangladesh',       refugees:980_000,   asylum_seekers:0,       idps:400_000,    stateless:0, total:1_380_000, role:'hosting' },
  { iso3:'POL', iso2:'PL', country:'Poland',           refugees:960_000,   asylum_seekers:18_000,  idps:0,          stateless:0, total:978_000,   role:'hosting' },
  { iso3:'SDN', iso2:'SD', country:'Sudan',            refugees:1_100_000, asylum_seekers:14_000,  idps:8_200_000,  stateless:0, total:9_314_000, role:'hosting' },
  { iso3:'KEN', iso2:'KE', country:'Kenya',            refugees:760_000,   asylum_seekers:14_000,  idps:0,          stateless:0, total:774_000,   role:'hosting' },
  { iso3:'TZA', iso2:'TZ', country:'Tanzania',         refugees:302_000,   asylum_seekers:9_000,   idps:0,          stateless:0, total:311_000,   role:'hosting' },
  { iso3:'CHD', iso2:'TD', country:'Chad',             refugees:1_000_000, asylum_seekers:3_000,   idps:430_000,    stateless:0, total:1_433_000, role:'hosting' },
  { iso3:'USA', iso2:'US', country:'United States',    refugees:340_000,   asylum_seekers:1_450_000,idps:0,         stateless:0, total:1_790_000, role:'hosting' },
  { iso3:'FRA', iso2:'FR', country:'France',           refugees:380_000,   asylum_seekers:184_000, idps:0,          stateless:0, total:564_000,   role:'hosting' },
  { iso3:'CAN', iso2:'CA', country:'Canada',           refugees:310_000,   asylum_seekers:202_000, idps:0,          stateless:0, total:512_000,   role:'hosting' },
  { iso3:'SWE', iso2:'SE', country:'Sweden',           refugees:300_000,   asylum_seekers:37_000,  idps:0,          stateless:0, total:337_000,   role:'hosting' },
  { iso3:'NLD', iso2:'NL', country:'Netherlands',      refugees:200_000,   asylum_seekers:94_000,  idps:0,          stateless:0, total:294_000,   role:'hosting' },
  { iso3:'SSD', iso2:'SS', country:'South Sudan',      refugees:369_000,   asylum_seekers:0,       idps:2_100_000,  stateless:0, total:2_469_000, role:'hosting' },
]

// ── Top Countries of Origin (2023) ────────────────────────────────────────────
export const TOP_ORIGINS: UNHCRStat[] = [
  { iso3:'VEN', iso2:'VE', country:'Venezuela',        refugees:6_500_000, asylum_seekers:1_200_000, idps:200_000,    stateless:0,       total:7_900_000, role:'origin' },
  { iso3:'SYR', iso2:'SY', country:'Syria',            refugees:6_400_000, asylum_seekers:900_000,   idps:6_800_000,  stateless:160_000, total:14_260_000,role:'origin' },
  { iso3:'AFG', iso2:'AF', country:'Afghanistan',      refugees:5_700_000, asylum_seekers:900_000,   idps:6_400_000,  stateless:0,       total:13_000_000,role:'origin' },
  { iso3:'UKR', iso2:'UA', country:'Ukraine',          refugees:5_900_000, asylum_seekers:1_100_000, idps:3_700_000,  stateless:0,       total:10_700_000,role:'origin' },
  { iso3:'SSD', iso2:'SS', country:'South Sudan',      refugees:2_300_000, asylum_seekers:60_000,    idps:2_100_000,  stateless:0,       total:4_460_000, role:'origin' },
  { iso3:'MMR', iso2:'MM', country:'Myanmar',          refugees:1_300_000, asylum_seekers:80_000,    idps:2_600_000,  stateless:600_000, total:4_580_000, role:'origin' },
  { iso3:'COD', iso2:'CD', country:'DR Congo',         refugees:990_000,   asylum_seekers:68_000,    idps:6_900_000,  stateless:0,       total:7_958_000, role:'origin' },
  { iso3:'SDN', iso2:'SD', country:'Sudan',            refugees:860_000,   asylum_seekers:68_000,    idps:8_200_000,  stateless:0,       total:9_128_000, role:'origin' },
  { iso3:'SOM', iso2:'SO', country:'Somalia',          refugees:780_000,   asylum_seekers:62_000,    idps:3_800_000,  stateless:0,       total:4_642_000, role:'origin' },
  { iso3:'ERI', iso2:'ER', country:'Eritrea',          refugees:580_000,   asylum_seekers:53_000,    idps:0,          stateless:0,       total:633_000,   role:'origin' },
  { iso3:'NGA', iso2:'NG', country:'Nigeria',          refugees:110_000,   asylum_seekers:37_000,    idps:3_700_000,  stateless:0,       total:3_847_000, role:'origin' },
  { iso3:'ETH', iso2:'ET', country:'Ethiopia',         refugees:160_000,   asylum_seekers:28_000,    idps:3_860_000,  stateless:0,       total:4_048_000, role:'origin' },
  { iso3:'IRQ', iso2:'IQ', country:'Iraq',             refugees:310_000,   asylum_seekers:28_000,    idps:1_100_000,  stateless:0,       total:1_438_000, role:'origin' },
  { iso3:'CAF', iso2:'CF', country:'Central Afr. Rep.',refugees:730_000,   asylum_seekers:19_000,    idps:700_000,    stateless:0,       total:1_449_000, role:'origin' },
  { iso3:'BGD', iso2:'BD', country:'Bangladesh',       refugees:0,         asylum_seekers:2_000,     idps:400_000,    stateless:860_000, total:1_262_000, role:'origin' },
]

// ── UNHCR Presence / Country Operations ──────────────────────────────────────
export const UNHCR_OFFICES: UNHCROffice[] = [
  // Headquarters & Global Liaison
  { id:'HQ',    name:'UNHCR Headquarters',              city:'Geneva',        country:'Switzerland', lat:46.2044,  lng:6.1432,   type:'hq'       },
  { id:'NY',    name:'UNHCR Liaison Office – UN NY',    city:'New York',      country:'USA',         lat:40.7128,  lng:-74.0060, type:'liaison'  },
  { id:'WDC',   name:'UNHCR Washington',                city:'Washington DC', country:'USA',         lat:38.9072,  lng:-77.0369, type:'liaison'  },
  { id:'BRX',   name:'UNHCR Brussels',                  city:'Brussels',      country:'Belgium',     lat:50.8503,  lng:4.3517,   type:'liaison'  },

  // Regional Bureaux
  { id:'RROA',  name:'Regional Bureau for East Africa', city:'Nairobi',       country:'Kenya',       lat:-1.2921,  lng:36.8219,  type:'regional' },
  { id:'RRWA',  name:'Regional Bureau for West Africa', city:'Dakar',         country:'Senegal',     lat:14.6928,  lng:-17.4467, type:'regional' },
  { id:'RRCA',  name:'Regional Bureau Central Africa',  city:'Yaoundé',       country:'Cameroon',    lat:3.8480,   lng:11.5021,  type:'regional' },
  { id:'RRSA',  name:'Regional Bureau South Africa',    city:'Pretoria',      country:'S. Africa',   lat:-25.7479, lng:28.2293,  type:'regional' },
  { id:'RRNA',  name:'Regional Bureau North Africa',    city:'Cairo',         country:'Egypt',       lat:30.0444,  lng:31.2357,  type:'regional' },
  { id:'RRME',  name:'Regional Bureau MENA',            city:'Cairo',         country:'Egypt',       lat:30.0800,  lng:31.2800,  type:'regional' },
  { id:'RRAS',  name:'Regional Bureau Asia-Pacific',    city:'Bangkok',       country:'Thailand',    lat:13.7563,  lng:100.5018, type:'regional' },
  { id:'RREU',  name:'Regional Bureau Europe',          city:'Vienna',        country:'Austria',     lat:48.2082,  lng:16.3738,  type:'regional' },
  { id:'RRAM',  name:'Regional Bureau Americas',        city:'Panama City',   country:'Panama',      lat:8.9936,   lng:-79.5197, type:'regional' },

  // Africa Country Operations
  { id:'ETH',   name:'UNHCR Ethiopia',                  city:'Addis Ababa',   country:'Ethiopia',    lat:9.0320,   lng:38.7469,  type:'country'  },
  { id:'UGA',   name:'UNHCR Uganda',                    city:'Kampala',       country:'Uganda',      lat:0.3476,   lng:32.5825,  type:'country'  },
  { id:'SDN',   name:'UNHCR Sudan',                     city:'Khartoum',      country:'Sudan',       lat:15.5007,  lng:32.5599,  type:'country'  },
  { id:'SSD',   name:'UNHCR South Sudan',               city:'Juba',          country:'S. Sudan',    lat:4.8594,   lng:31.5713,  type:'country'  },
  { id:'COD',   name:'UNHCR DR Congo',                  city:'Kinshasa',      country:'DRC',         lat:-4.3217,  lng:15.3222,  type:'country'  },
  { id:'TCD',   name:'UNHCR Chad',                      city:"N'Djamena",     country:'Chad',        lat:12.1048,  lng:15.0445,  type:'country'  },
  { id:'CMR',   name:'UNHCR Cameroon',                  city:'Yaoundé',       country:'Cameroon',    lat:3.8480,   lng:11.5021,  type:'country'  },
  { id:'KEN',   name:'UNHCR Kenya',                     city:'Nairobi',       country:'Kenya',       lat:-1.2921,  lng:36.8219,  type:'country'  },
  { id:'TZA',   name:'UNHCR Tanzania',                  city:'Dar es Salaam', country:'Tanzania',    lat:-6.7924,  lng:39.2083,  type:'country'  },
  { id:'RWA',   name:'UNHCR Rwanda',                    city:'Kigali',        country:'Rwanda',      lat:-1.9441,  lng:30.0619,  type:'country'  },
  { id:'LBY',   name:'UNHCR Libya',                     city:'Tripoli',       country:'Libya',       lat:32.9033,  lng:13.1802,  type:'country'  },
  { id:'EGY',   name:'UNHCR Egypt',                     city:'Cairo',         country:'Egypt',       lat:30.0444,  lng:31.2357,  type:'country'  },
  { id:'NGA',   name:'UNHCR Nigeria',                   city:'Abuja',         country:'Nigeria',     lat:9.0765,   lng:7.3986,   type:'country'  },
  { id:'CAF',   name:'UNHCR Central African Rep.',      city:'Bangui',        country:'CAR',         lat:4.3612,   lng:18.5550,  type:'country'  },
  { id:'SOM',   name:'UNHCR Somalia',                   city:'Mogadishu',     country:'Somalia',     lat:2.0469,   lng:45.3182,  type:'country'  },
  { id:'DJI',   name:'UNHCR Djibouti',                  city:'Djibouti',      country:'Djibouti',    lat:11.5720,  lng:43.1450,  type:'country'  },
  { id:'MOZ',   name:'UNHCR Mozambique',                city:'Maputo',        country:'Mozambique',  lat:-25.9692, lng:32.5732,  type:'country'  },
  { id:'ZWE',   name:'UNHCR Zimbabwe',                  city:'Harare',        country:'Zimbabwe',    lat:-17.8252, lng:31.0335,  type:'country'  },
  { id:'MRT',   name:'UNHCR Mauritania',                city:'Nouakchott',    country:'Mauritania',  lat:18.0858,  lng:-15.9785, type:'country'  },
  { id:'MLI',   name:'UNHCR Mali',                      city:'Bamako',        country:'Mali',        lat:12.6392,  lng:-8.0029,  type:'country'  },
  { id:'NER',   name:'UNHCR Niger',                     city:'Niamey',        country:'Niger',       lat:13.5137,  lng:2.1098,   type:'country'  },
  { id:'BFA',   name:'UNHCR Burkina Faso',              city:'Ouagadougou',   country:'Burkina Faso',lat:12.3569,  lng:-1.5353,  type:'country'  },

  // Middle East & North Africa
  { id:'SYR',   name:'UNHCR Syria',                     city:'Damascus',      country:'Syria',       lat:33.5138,  lng:36.2765,  type:'country'  },
  { id:'IRQ',   name:'UNHCR Iraq',                      city:'Baghdad',       country:'Iraq',        lat:33.3152,  lng:44.3661,  type:'country'  },
  { id:'JOR',   name:'UNHCR Jordan',                    city:'Amman',         country:'Jordan',      lat:31.9454,  lng:35.9284,  type:'country'  },
  { id:'LBN',   name:'UNHCR Lebanon',                   city:'Beirut',        country:'Lebanon',     lat:33.8938,  lng:35.5018,  type:'country'  },
  { id:'TUR',   name:'UNHCR Turkey',                    city:'Ankara',        country:'Turkey',      lat:39.9334,  lng:32.8597,  type:'country'  },
  { id:'YEM',   name:'UNHCR Yemen',                     city:"Sana'a",        country:'Yemen',       lat:15.3694,  lng:44.1910,  type:'country'  },
  { id:'SAU',   name:'UNHCR Saudi Arabia',              city:'Riyadh',        country:'Saudi Arabia',lat:24.6877,  lng:46.7219,  type:'country'  },

  // Asia-Pacific
  { id:'AFG',   name:'UNHCR Afghanistan',               city:'Kabul',         country:'Afghanistan', lat:34.5553,  lng:69.2075,  type:'country'  },
  { id:'PAK',   name:'UNHCR Pakistan',                  city:'Islamabad',     country:'Pakistan',    lat:33.6844,  lng:73.0479,  type:'country'  },
  { id:'IRN',   name:'UNHCR Iran',                      city:'Tehran',        country:'Iran',        lat:35.6892,  lng:51.3890,  type:'country'  },
  { id:'BGD',   name:'UNHCR Bangladesh',                city:'Dhaka',         country:'Bangladesh',  lat:23.8103,  lng:90.4125,  type:'country'  },
  { id:'MMR',   name:'UNHCR Myanmar',                   city:'Yangon',        country:'Myanmar',     lat:16.8661,  lng:96.1951,  type:'country'  },
  { id:'THA',   name:'UNHCR Thailand',                  city:'Bangkok',       country:'Thailand',    lat:13.7563,  lng:100.5018, type:'country'  },
  { id:'IDN',   name:'UNHCR Indonesia',                 city:'Jakarta',       country:'Indonesia',   lat:-6.2088,  lng:106.8456, type:'country'  },
  { id:'IND',   name:'UNHCR India',                     city:'New Delhi',     country:'India',       lat:28.6139,  lng:77.2090,  type:'country'  },
  { id:'MYS',   name:'UNHCR Malaysia',                  city:'Kuala Lumpur',  country:'Malaysia',    lat:3.1390,   lng:101.6869, type:'country'  },
  { id:'CHN',   name:'UNHCR China',                     city:'Beijing',       country:'China',       lat:39.9042,  lng:116.4074, type:'country'  },

  // Europe
  { id:'UKR',   name:'UNHCR Ukraine',                   city:'Kyiv',          country:'Ukraine',     lat:50.4501,  lng:30.5234,  type:'country'  },
  { id:'DEU',   name:'UNHCR Germany',                   city:'Berlin',        country:'Germany',     lat:52.5200,  lng:13.4050,  type:'country'  },
  { id:'GRC',   name:'UNHCR Greece',                    city:'Athens',        country:'Greece',      lat:37.9838,  lng:23.7275,  type:'country'  },
  { id:'ITA',   name:'UNHCR Italy',                     city:'Rome',          country:'Italy',       lat:41.9028,  lng:12.4964,  type:'country'  },
  { id:'HUN',   name:'UNHCR Hungary',                   city:'Budapest',      country:'Hungary',     lat:47.4979,  lng:19.0402,  type:'country'  },
  { id:'SRB',   name:'UNHCR Serbia',                    city:'Belgrade',      country:'Serbia',      lat:44.7866,  lng:20.4489,  type:'country'  },
  { id:'MDA',   name:'UNHCR Moldova',                   city:'Chișinău',      country:'Moldova',     lat:47.0105,  lng:28.8638,  type:'country'  },

  // Americas
  { id:'COL',   name:'UNHCR Colombia',                  city:'Bogotá',        country:'Colombia',    lat:4.7110,   lng:-74.0721, type:'country'  },
  { id:'VEN',   name:'UNHCR Venezuela',                 city:'Caracas',       country:'Venezuela',   lat:10.4806,  lng:-66.9036, type:'country'  },
  { id:'ECU',   name:'UNHCR Ecuador',                   city:'Quito',         country:'Ecuador',     lat:-0.1807,  lng:-78.4678, type:'country'  },
  { id:'PER',   name:'UNHCR Peru',                      city:'Lima',          country:'Peru',        lat:-12.0464, lng:-77.0428, type:'country'  },
  { id:'MEX',   name:'UNHCR Mexico',                    city:'Mexico City',   country:'Mexico',      lat:19.4326,  lng:-99.1332, type:'country'  },
  { id:'GTM',   name:'UNHCR Guatemala',                 city:'Guatemala City',country:'Guatemala',   lat:14.6349,  lng:-90.5069, type:'country'  },
  { id:'BRA',   name:'UNHCR Brazil',                    city:'Brasília',      country:'Brazil',      lat:-15.7975, lng:-47.8919, type:'country'  },
  { id:'ARG',   name:'UNHCR Argentina',                 city:'Buenos Aires',  country:'Argentina',   lat:-34.6037, lng:-58.3816, type:'country'  },
  { id:'CHL',   name:'UNHCR Chile',                     city:'Santiago',      country:'Chile',       lat:-33.4489, lng:-70.6693, type:'country'  },
]

// ── Border Crossing Points ────────────────────────────────────────────────────
export const BORDER_CROSSINGS: BorderCrossing[] = [
  // Syria region
  { id:'BAB_HAWA',    name:'Bab al-Hawa',             country1:'Syria',       country2:'Turkey',      lat:36.6133, lng:36.7575,  status:'open',       bearing:5   },
  { id:'BAB_SALAM',   name:'Bab al-Salameh',           country1:'Syria',       country2:'Turkey',      lat:36.6388, lng:37.1231,  status:'open',       bearing:355 },
  { id:'NASSIB',      name:'Nassib / Jaber',           country1:'Syria',       country2:'Jordan',      lat:33.0082, lng:36.0079,  status:'open',       bearing:190 },
  { id:'MASNAA',      name:'Masnaa',                   country1:'Syria',       country2:'Lebanon',     lat:33.6722, lng:35.9058,  status:'restricted', bearing:260 },
  { id:'AL_TANF',     name:'Al-Tanf / Turaybil',       country1:'Syria',       country2:'Iraq',        lat:33.5270, lng:38.6400,  status:'restricted', bearing:100 },
  // Gaza / Palestine
  { id:'RAFAH',       name:'Rafah',                    country1:'Gaza',        country2:'Egypt',       lat:31.2822, lng:34.2436,  status:'closed',     bearing:220 },
  { id:'KEREM_SHLM',  name:'Kerem Shalom/Karem Abu Salem', country1:'Israel', country2:'Gaza',         lat:31.2193, lng:34.3293,  status:'restricted', bearing:315 },
  { id:'EREZ',        name:'Erez / Beit Hanoun',       country1:'Israel',      country2:'Gaza',        lat:31.5194, lng:34.5080,  status:'closed',     bearing:250 },
  // Afghanistan-Pakistan
  { id:'TORKHAM',     name:'Torkham',                  country1:'Afghanistan', country2:'Pakistan',    lat:34.0900, lng:71.1100,  status:'restricted', bearing:130 },
  { id:'CHAMAN',      name:'Chaman / Spin Boldak',     country1:'Pakistan',    country2:'Afghanistan', lat:30.9200, lng:66.4500,  status:'restricted', bearing:310 },
  // South Sudan / Uganda
  { id:'NIMULE',      name:'Nimule',                   country1:'S. Sudan',    country2:'Uganda',      lat:3.5988,  lng:32.0582,  status:'open',       bearing:170 },
  { id:'METEMA',      name:'Metema / Gallabat',        country1:'Ethiopia',    country2:'Sudan',       lat:12.9568, lng:36.2029,  status:'open',       bearing:280 },
  // Chad-Sudan (humanitarian crisis)
  { id:'ADRE',        name:'Adre',                     country1:'Chad',        country2:'Sudan',       lat:13.4678, lng:22.1957,  status:'restricted', bearing:95  },
  { id:'TINE',        name:'Tine',                     country1:'Chad',        country2:'Sudan',       lat:14.9600, lng:21.7700,  status:'restricted', bearing:80  },
  // Myanmar-Bangladesh
  { id:'TEKNAF',      name:'Teknaf / Naf River',       country1:'Bangladesh',  country2:'Myanmar',     lat:20.8648, lng:92.3063,  status:'closed',     bearing:105 },
  { id:'SHAHPORI',    name:'Shahpori Island',           country1:'Bangladesh',  country2:'Myanmar',     lat:20.9360, lng:92.3020,  status:'closed',     bearing:120 },
  // Libya crossing points (Mediterranean corridor)
  { id:'RAS_JDIR',    name:'Ras Jdir',                 country1:'Libya',       country2:'Tunisia',     lat:33.1408, lng:11.5286,  status:'open',       bearing:290 },
  { id:'SALLOUM',     name:'Salloum / Musaed',         country1:'Egypt',       country2:'Libya',       lat:31.5347, lng:25.1624,  status:'open',       bearing:250 },
  // Colombia-Venezuela (Venezuelan mass exodus)
  { id:'CUCUTA',      name:'Cúcuta / San Antonio',     country1:'Colombia',    country2:'Venezuela',   lat:7.8891,  lng:-72.5027, status:'open',       bearing:70  },
  { id:'PARAGUACHON', name:'Paraguachón',               country1:'Colombia',    country2:'Venezuela',   lat:11.5200, lng:-72.4400, status:'open',       bearing:60  },
  // Ukraine-Poland (largest refugee exodus in Europe)
  { id:'MEDYKA',      name:'Medyka / Shehyni',         country1:'Poland',      country2:'Ukraine',     lat:49.8179, lng:22.8439,  status:'open',       bearing:95  },
  { id:'KORCZOWA',    name:'Korczowa / Krakovets',     country1:'Poland',      country2:'Ukraine',     lat:49.9888, lng:22.7833,  status:'open',       bearing:100 },
  { id:'SIRET',       name:'Siret / Porubnoe',         country1:'Romania',     country2:'Ukraine',     lat:47.9430, lng:25.9290,  status:'open',       bearing:15  },
  { id:'PALANCA',     name:'Palanca',                  country1:'Moldova',     country2:'Ukraine',     lat:45.9060, lng:29.7100,  status:'open',       bearing:50  },
  // Iran-Afghanistan
  { id:'ISLAM_QALA',  name:'Islam Qala',               country1:'Afghanistan', country2:'Iran',        lat:34.6600, lng:61.2700,  status:'restricted', bearing:280 },
  { id:'ZARANJ',      name:'Zaranj / Milak',           country1:'Afghanistan', country2:'Iran',        lat:30.9644, lng:61.8738,  status:'restricted', bearing:270 },
  // Kenya-South Sudan
  { id:'NADAPAL',     name:'Nadapal',                  country1:'Kenya',       country2:'S. Sudan',    lat:4.6550,  lng:35.7660,  status:'open',       bearing:340 },
  // Niger-Mali (Sahel)
  { id:'TILLABERY',   name:'Tillabéry',                country1:'Niger',       country2:'Mali',        lat:14.2088, lng:1.4518,   status:'restricted', bearing:280 },
  // DRC corridors
  { id:'BUNAGANA',    name:'Bunagana',                 country1:'DRC',         country2:'Uganda',      lat:-1.2611, lng:29.4614,  status:'restricted', bearing:100 },
]

// ── Population Reference Points / Major Refugee Camps (Admin2 level) ─────────
export const REFUGEE_CAMPS: RefugeeCamp[] = [
  // Bangladesh
  { id:'KUTUPALONG', name:'Kutupalong–Balukhali', country:'Bangladesh', lat:21.2107, lng:92.1485, population:900_000, type:'camp',       notes:'Largest refugee settlement in the world' },
  // Kenya
  { id:'KAKUMA',     name:'Kakuma',               country:'Kenya',      lat:3.7170,  lng:34.8580, population:278_000, type:'settlement', notes:'Est. 1992, hosting refugees from 20+ countries' },
  { id:'DADAAB',     name:'Dadaab Complex',        country:'Kenya',      lat:1.7604,  lng:40.3151, population:218_000, type:'camp',       notes:'3-camp complex: Hagadera, Dagahaley, Ifo' },
  { id:'KALOBEYEI',  name:'Kalobeyei',             country:'Kenya',      lat:3.7818,  lng:34.7959, population:48_000,  type:'settlement', notes:'Integrated settlement model' },
  // Jordan
  { id:'ZAATARI',    name:"Za'atari",              country:'Jordan',     lat:32.2983, lng:36.3306, population:80_000,  type:'camp',       notes:'4th largest camp in world; Syrian refugees' },
  { id:'AZRAQ',      name:'Azraq',                 country:'Jordan',     lat:31.8550, lng:36.8380, population:42_000,  type:'camp',       notes:'Syrian refugees; fully solar-powered' },
  // Uganda
  { id:'BIDI_BIDI',  name:'Bidi Bidi',             country:'Uganda',     lat:3.4960,  lng:31.3240, population:270_000, type:'settlement', notes:'Largest settlement in Uganda; South Sudanese' },
  { id:'NAKIVALE',   name:'Nakivale',              country:'Uganda',     lat:-0.9827, lng:30.9953, population:135_000, type:'settlement', notes:'Est. 1958; oldest refugee settlement in Africa' },
  { id:'RHINO_CAMP', name:'Rhino Camp',            country:'Uganda',     lat:3.2280,  lng:31.4280, population:125_000, type:'settlement' },
  { id:'KYAKA_II',   name:'Kyaka II',              country:'Uganda',     lat:-0.4120, lng:30.5350, population:120_000, type:'settlement' },
  // Ethiopia
  { id:'GAMBELLA',   name:'Gambella Region',       country:'Ethiopia',   lat:8.2497,  lng:34.5898, population:420_000, type:'settlement', notes:'Multiple camps; primarily South Sudanese' },
  { id:'DOLLO_ADO',  name:'Dollo Ado Complex',     country:'Ethiopia',   lat:4.1963,  lng:42.0640, population:208_000, type:'camp',       notes:'Somali refugee complex' },
  { id:'BAMBASI',    name:'Bambasi / Sherkole',    country:'Ethiopia',   lat:9.7558,  lng:34.7369, population:115_000, type:'camp',       notes:'Sudanese & South Sudanese refugees' },
  { id:'MAI_TSEBRI', name:'Mai-Tsebri',            country:'Ethiopia',   lat:13.6500, lng:38.0000, population:28_000,  type:'camp',       notes:'Tigray conflict displaced' },
  // South Sudan
  { id:'BENTIU',     name:'Bentiu PoC',            country:'S. Sudan',   lat:9.2285,  lng:29.8249, population:112_000, type:'poc_site',   notes:'UN Protection of Civilians site' },
  { id:'MALAKAL',    name:'Malakal PoC',           country:'S. Sudan',   lat:9.5330,  lng:31.6610, population:47_000,  type:'poc_site',   notes:'UN Protection of Civilians site' },
  // Tanzania
  { id:'NYARUGUSU',  name:'Nyarugusu',             country:'Tanzania',   lat:-4.6300, lng:30.2840, population:136_000, type:'camp',       notes:'Congolese & Burundian refugees' },
  { id:'NDUTA',      name:'Nduta',                 country:'Tanzania',   lat:-3.6120, lng:30.7100, population:89_000,  type:'camp',       notes:'Burundian refugees' },
  { id:'MTENDELI',   name:'Mtendeli',              country:'Tanzania',   lat:-3.7820, lng:30.5960, population:72_000,  type:'camp',       notes:'Burundian refugees' },
  // Chad
  { id:'BREDJING',   name:'Bredjing',              country:'Chad',       lat:13.9750, lng:22.5630, population:94_000,  type:'camp',       notes:'Sudanese refugees from Darfur' },
  { id:'DJABAL',     name:'Djabal',                country:'Chad',       lat:13.8447, lng:22.4503, population:37_000,  type:'camp',       notes:'Sudanese refugees from Darfur' },
  { id:'TOULOUM',    name:'Touloum',               country:'Chad',       lat:15.1383, lng:22.2800, population:33_000,  type:'camp',       notes:'Sudanese refugees' },
  { id:'GAGA',       name:'Gaga',                  country:'Chad',       lat:13.3430, lng:21.6820, population:69_000,  type:'camp',       notes:'Sudanese/CAR refugees' },
  // Rwanda
  { id:'MAHAMA',     name:'Mahama',                country:'Rwanda',     lat:-1.9740, lng:30.7290, population:58_000,  type:'camp',       notes:'Burundian refugees' },
  // DRC
  { id:'KIZIBA',     name:'Kiziba',                country:'DRC',        lat:-1.8060, lng:29.0890, population:17_000,  type:'camp',       notes:'Rwandan refugees' },
  // Cameroon
  { id:'MINAWAO',    name:'Minawao',               country:'Cameroon',   lat:10.8270, lng:14.0670, population:74_000,  type:'camp',       notes:'Nigerian refugees' },
  // Iraq
  { id:'DOMIZ1',     name:'Domiz 1',               country:'Iraq',       lat:36.9750, lng:42.8450, population:32_000,  type:'camp',       notes:'Syrian Kurdish refugees' },
  { id:'KAWERGOSK',  name:'Kawergosk',             country:'Iraq',       lat:36.3000, lng:43.9000, population:12_000,  type:'camp',       notes:'Syrian refugees' },
  // Pakistan
  { id:'JALOZAI',    name:'Jalozai',               country:'Pakistan',   lat:34.0150, lng:71.8050, population:130_000, type:'camp',       notes:'Afghan refugees' },
  // Colombia (Venezuelan displacement)
  { id:'CUCUTA_COL', name:'Venezuelan Migrants – Cúcuta', country:'Colombia', lat:7.8939, lng:-72.5078, population:80_000, type:'transit', notes:'Transit & informal settlements' },
  // Greece
  { id:'MAVROVOUNI', name:'Mavrovouni / Lesbos',   country:'Greece',     lat:39.1500, lng:26.4900, population:7_000,   type:'camp',       notes:'EU hotspot; mixed nationalities' },
  // Malaysia
  { id:'KUALA_L',    name:'Urban Refugees KL',     country:'Malaysia',   lat:3.1390,  lng:101.6869,population:160_000, type:'informal',   notes:'Urban unregistered; Rohingya & others' },
  // Egypt
  { id:'CAIRO_REF',  name:'Urban Refugees Cairo',  country:'Egypt',      lat:30.0444, lng:31.2357, population:350_000, type:'informal',   notes:'Sudanese, Syrian & others; mostly urban' },
  // Libya (transit)
  { id:'TRIPOLI_DT', name:'Libya Detention Centers', country:'Libya',    lat:32.9033, lng:13.1802, population:6_000,   type:'transit',    notes:'Irregular migrants in detention' },
]

// ── UNHCR API — Live Population Statistics ────────────────────────────────────
// Fetches aggregate data from api.unhcr.org for the most recent available year
const UNHCR_API = 'https://api.unhcr.org/population/v1'

export async function fetchUNHCRPopulation(): Promise<UNHCRStat[]> {
  try {
    const year = new Date().getFullYear() - 1   // use last calendar year
    const url  = `${UNHCR_API}/population/?yearFrom=${year}&yearTo=${year}&coa_all=true&limit=300`
    const res  = await fetch(url, { signal: AbortSignal.timeout(10_000) })
    if (!res.ok) return TOP_HOSTING

    const json = await res.json()
    const items: { coa: string; coa_name: string; refugees?: number; asylum_seekers?: number; idps?: number; stateless?: number }[] = json.items ?? []
    if (!items.length) return TOP_HOSTING

    // Aggregate by country of asylum
    const agg: Record<string, UNHCRStat> = {}
    for (const row of items) {
      if (!row.coa) continue
      if (!agg[row.coa]) {
        agg[row.coa] = {
          iso3: row.coa, iso2: '', country: row.coa_name,
          refugees: 0, asylum_seekers: 0, idps: 0, stateless: 0, total: 0, role: 'hosting',
        }
      }
      const s = agg[row.coa]
      s.refugees        += row.refugees      ?? 0
      s.asylum_seekers  += row.asylum_seekers ?? 0
      s.idps            += row.idps           ?? 0
      s.stateless       += row.stateless      ?? 0
    }
    const stats = Object.values(agg)
      .map(s => { s.total = s.refugees + s.asylum_seekers + s.idps + s.stateless; return s })
      .sort((a, b) => b.total - a.total)
      .slice(0, 20)

    return stats.length ? stats : TOP_HOSTING
  } catch {
    return TOP_HOSTING   // graceful fallback to 2023 static data
  }
}

export const CROSSING_STATUS_COLORS: Record<CrossingStatus, string> = {
  open:       '#00ff88',
  restricted: '#ffaa00',
  closed:     '#ff1a3e',
  unknown:    '#4a6a8a',
}

export const OFFICE_TYPE_COLORS: Record<OfficeType, string> = {
  hq:         '#00c8ff',
  regional:   '#4488ff',
  country:    '#0066cc',
  'sub-office':'#004499',
  liaison:    '#aaccff',
}

// ── Refugee Flow Corridors (major origin → host arcs) ───────────────────────
export interface RefugeeFlow {
  origin:  [number, number]  // [lng, lat]
  dest:    [number, number]
  label:   string
  count:   number
}

export const REFUGEE_FLOWS: RefugeeFlow[] = [
  // Syria → neighbours & Europe
  { origin: [38.99, 34.80], dest: [35.24, 38.96], label: 'Syria → Turkey',       count: 3_600_000 },
  { origin: [38.99, 34.80], dest: [35.86, 33.85], label: 'Syria → Lebanon',      count: 1_500_000 },
  { origin: [38.99, 34.80], dest: [36.23, 31.95], label: 'Syria → Jordan',       count: 670_000 },
  { origin: [38.99, 34.80], dest: [44.36, 33.31], label: 'Syria → Iraq',         count: 310_000 },
  { origin: [38.99, 34.80], dest: [10.45, 51.16], label: 'Syria → Germany',      count: 800_000 },
  // Ukraine → Europe
  { origin: [31.16, 48.38], dest: [19.14, 51.91], label: 'Ukraine → Poland',     count: 960_000 },
  { origin: [31.16, 48.38], dest: [10.45, 51.16], label: 'Ukraine → Germany',    count: 1_100_000 },
  { origin: [31.16, 48.38], dest: [25.01, 45.94], label: 'Ukraine → Romania',    count: 100_000 },
  { origin: [31.16, 48.38], dest: [28.86, 47.01], label: 'Ukraine → Moldova',    count: 110_000 },
  // Afghanistan → neighbours
  { origin: [67.71, 33.94], dest: [69.35, 30.38], label: 'Afghanistan → Pakistan',  count: 2_100_000 },
  { origin: [67.71, 33.94], dest: [53.69, 32.43], label: 'Afghanistan → Iran',      count: 3_800_000 },
  // Venezuela → Latin America
  { origin: [-66.59, 6.42], dest: [-74.30, 4.57], label: 'Venezuela → Colombia',    count: 2_900_000 },
  { origin: [-66.59, 6.42], dest: [-75.02,-9.19], label: 'Venezuela → Peru',        count: 1_500_000 },
  { origin: [-66.59, 6.42], dest: [-78.18,-1.83], label: 'Venezuela → Ecuador',     count: 500_000 },
  { origin: [-66.59, 6.42], dest: [-51.93,-14.24],label: 'Venezuela → Brazil',      count: 400_000 },
  // South Sudan → neighbours
  { origin: [31.57, 6.88], dest: [32.29, 1.37],  label: 'S. Sudan → Uganda',       count: 950_000 },
  { origin: [31.57, 6.88], dest: [37.91, 8.62],  label: 'S. Sudan → Ethiopia',     count: 400_000 },
  { origin: [31.57, 6.88], dest: [15.83, 12.13], label: 'S. Sudan → Chad',         count: 120_000 },
  // Myanmar → Bangladesh
  { origin: [96.68, 21.91], dest: [90.36, 23.68], label: 'Myanmar → Bangladesh',    count: 980_000 },
  // Somalia → Kenya/Ethiopia
  { origin: [46.20, 5.15], dest: [36.82, -1.29], label: 'Somalia → Kenya',         count: 300_000 },
  { origin: [46.20, 5.15], dest: [38.75, 9.03],  label: 'Somalia → Ethiopia',      count: 250_000 },
  // Sudan → Chad
  { origin: [30.22, 12.86], dest: [18.73, 15.45], label: 'Sudan → Chad',            count: 1_000_000 },
  // DRC → neighbours
  { origin: [21.76, -4.04], dest: [32.58, 0.35],  label: 'DRC → Uganda',            count: 500_000 },
  { origin: [21.76, -4.04], dest: [30.06, -1.94], label: 'DRC → Rwanda',            count: 80_000 },
]

// ── ISO3 → country totals for choropleth (combined hosting + origin) ────────
// Maps ISO3 codes used in Mapbox country-boundaries tileset to displacement totals
export const COUNTRY_DISPLACEMENT: Record<string, { hosting: number; origin: number; iso2: string }> = {
  IRN: { hosting: 3_800_000, origin: 0, iso2: 'IR' },
  TUR: { hosting: 3_800_000, origin: 0, iso2: 'TR' },
  COL: { hosting: 7_300_000, origin: 0, iso2: 'CO' },
  DEU: { hosting: 2_951_000, origin: 0, iso2: 'DE' },
  PAK: { hosting: 2_100_000, origin: 0, iso2: 'PK' },
  UGA: { hosting: 1_749_000, origin: 0, iso2: 'UG' },
  ETH: { hosting: 4_918_000, origin: 4_048_000, iso2: 'ET' },
  BGD: { hosting: 1_380_000, origin: 1_262_000, iso2: 'BD' },
  POL: { hosting: 978_000, origin: 0, iso2: 'PL' },
  SDN: { hosting: 9_314_000, origin: 9_128_000, iso2: 'SD' },
  KEN: { hosting: 774_000, origin: 0, iso2: 'KE' },
  TZA: { hosting: 311_000, origin: 0, iso2: 'TZ' },
  TCD: { hosting: 1_433_000, origin: 0, iso2: 'TD' },
  USA: { hosting: 1_790_000, origin: 0, iso2: 'US' },
  SSD: { hosting: 2_469_000, origin: 4_460_000, iso2: 'SS' },
  RUS: { hosting: 1_265_000, origin: 0, iso2: 'RU' },
  VEN: { hosting: 0, origin: 7_900_000, iso2: 'VE' },
  SYR: { hosting: 0, origin: 14_260_000, iso2: 'SY' },
  AFG: { hosting: 0, origin: 13_000_000, iso2: 'AF' },
  UKR: { hosting: 0, origin: 10_700_000, iso2: 'UA' },
  MMR: { hosting: 0, origin: 4_580_000, iso2: 'MM' },
  COD: { hosting: 0, origin: 7_958_000, iso2: 'CD' },
  SOM: { hosting: 0, origin: 4_642_000, iso2: 'SO' },
  ERI: { hosting: 0, origin: 633_000, iso2: 'ER' },
  NGA: { hosting: 0, origin: 3_847_000, iso2: 'NG' },
  IRQ: { hosting: 0, origin: 1_438_000, iso2: 'IQ' },
  CAF: { hosting: 0, origin: 1_449_000, iso2: 'CF' },
  LBN: { hosting: 1_500_000, origin: 0, iso2: 'LB' },
  JOR: { hosting: 670_000, origin: 0, iso2: 'JO' },
  RWA: { hosting: 130_000, origin: 0, iso2: 'RW' },
  CMR: { hosting: 400_000, origin: 0, iso2: 'CM' },
  FRA: { hosting: 564_000, origin: 0, iso2: 'FR' },
  SWE: { hosting: 337_000, origin: 0, iso2: 'SE' },
  PER: { hosting: 1_500_000, origin: 0, iso2: 'PE' },
  ECU: { hosting: 500_000, origin: 0, iso2: 'EC' },
  BRA: { hosting: 400_000, origin: 0, iso2: 'BR' },
  GRC: { hosting: 100_000, origin: 0, iso2: 'GR' },
  MDA: { hosting: 110_000, origin: 0, iso2: 'MD' },
  ROM: { hosting: 100_000, origin: 0, iso2: 'RO' },
}
