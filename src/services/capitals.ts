// Capital city of each country by ISO 3166-1 alpha-2 code, used when a story names only a country: the pin
// goes to the capital (a real, labelled place) rather than the country's geometric middle, which is often
// open land or sea. Names only — coordinates still come from the geocoder.
// Source: UN member-state capitals / CIA World Factbook. Left out on purpose: states whose capital is disputed
// or split (IL, PS, BO, LK, YE, XK, EH, TW is included as Taipei) and micro-states the geocoder can't place reliably.
export const CAPITALS: Record<string, string> = {
  AF: 'Kabul', AL: 'Tirana', DZ: 'Algiers', AD: 'Andorra la Vella', AO: 'Luanda', AR: 'Buenos Aires', AM: 'Yerevan',
  AU: 'Canberra', AT: 'Vienna', AZ: 'Baku', BS: 'Nassau', BH: 'Manama', BD: 'Dhaka', BB: 'Bridgetown', BY: 'Minsk',
  BE: 'Brussels', BZ: 'Belmopan', BJ: 'Porto-Novo', BT: 'Thimphu', BA: 'Sarajevo', BW: 'Gaborone', BR: 'Brasilia',
  BN: 'Bandar Seri Begawan', BG: 'Sofia', BF: 'Ouagadougou', CV: 'Praia', KH: 'Phnom Penh', CM: 'Yaounde', CA: 'Ottawa',
  CF: 'Bangui', TD: "N'Djamena", CL: 'Santiago', CN: 'Beijing', CO: 'Bogota', KM: 'Moroni', CG: 'Brazzaville',
  CD: 'Kinshasa', CR: 'San Jose', CI: 'Yamoussoukro', HR: 'Zagreb', CU: 'Havana', CY: 'Nicosia', CZ: 'Prague',
  DK: 'Copenhagen', DJ: 'Djibouti', DO: 'Santo Domingo', EC: 'Quito', EG: 'Cairo', SV: 'San Salvador', GQ: 'Malabo',
  ER: 'Asmara', EE: 'Tallinn', SZ: 'Mbabane', ET: 'Addis Ababa', FJ: 'Suva', FI: 'Helsinki', FR: 'Paris', GA: 'Libreville',
  GM: 'Banjul', GE: 'Tbilisi', DE: 'Berlin', GH: 'Accra', GR: 'Athens', GT: 'Guatemala City', GN: 'Conakry', GW: 'Bissau',
  GY: 'Georgetown', HT: 'Port-au-Prince', HN: 'Tegucigalpa', HU: 'Budapest', IS: 'Reykjavik', IN: 'New Delhi',
  ID: 'Jakarta', IR: 'Tehran', IQ: 'Baghdad', IE: 'Dublin', IT: 'Rome', JM: 'Kingston', JP: 'Tokyo', JO: 'Amman',
  KZ: 'Astana', KE: 'Nairobi', KP: 'Pyongyang', KR: 'Seoul', KW: 'Kuwait City', KG: 'Bishkek', LA: 'Vientiane',
  LV: 'Riga', LB: 'Beirut', LS: 'Maseru', LR: 'Monrovia', LY: 'Tripoli', LT: 'Vilnius', LU: 'Luxembourg',
  MG: 'Antananarivo', MW: 'Lilongwe', MY: 'Kuala Lumpur', ML: 'Bamako', MT: 'Valletta', MR: 'Nouakchott',
  MU: 'Port Louis', MX: 'Mexico City', MD: 'Chisinau', MN: 'Ulaanbaatar', ME: 'Podgorica', MA: 'Rabat', MZ: 'Maputo',
  MM: 'Naypyidaw', NA: 'Windhoek', NP: 'Kathmandu', NL: 'Amsterdam', NZ: 'Wellington', NI: 'Managua', NE: 'Niamey',
  NG: 'Abuja', MK: 'Skopje', NO: 'Oslo', OM: 'Muscat', PK: 'Islamabad', PA: 'Panama City', PG: 'Port Moresby',
  PY: 'Asuncion', PE: 'Lima', PH: 'Manila', PL: 'Warsaw', PT: 'Lisbon', QA: 'Doha', RO: 'Bucharest', RU: 'Moscow',
  RW: 'Kigali', SA: 'Riyadh', SN: 'Dakar', RS: 'Belgrade', SL: 'Freetown', SG: 'Singapore', SK: 'Bratislava',
  SI: 'Ljubljana', SO: 'Mogadishu', ZA: 'Pretoria', SS: 'Juba', ES: 'Madrid', SD: 'Khartoum', SR: 'Paramaribo',
  SE: 'Stockholm', CH: 'Bern', SY: 'Damascus', TW: 'Taipei', TJ: 'Dushanbe', TZ: 'Dodoma', TH: 'Bangkok', TL: 'Dili',
  TG: 'Lome', TT: 'Port of Spain', TN: 'Tunis', TR: 'Ankara', TM: 'Ashgabat', UG: 'Kampala', UA: 'Kyiv',
  AE: 'Abu Dhabi', GB: 'London', US: 'Washington', UY: 'Montevideo', UZ: 'Tashkent', VE: 'Caracas', VN: 'Hanoi',
  ZM: 'Lusaka', ZW: 'Harare',
}
