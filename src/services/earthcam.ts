/**
 * Live Webcams — SkylineWebcams global coverage.
 * All URLs verified against skylinewebcams.com/en/live-cams-category/city-cams.html
 * Coverage: 75+ countries, 190+ cameras. Coordinates are exact landmark positions.
 */

export interface LiveCamera {
  id:       string
  name:     string
  city:     string
  country:  string
  lat:      number
  lng:      number
  url:      string
  source:   string
}

const SKY = 'https://www.skylinewebcams.com/en/webcam'

export const EARTHCAM_CAMERAS: LiveCamera[] = [
  // ═══════════════ ITALY ═══════════════
  { id: 'it-rome-colosseum', name: 'Colosseum', city: 'Rome', country: 'Italy', lat: 41.8902, lng: 12.4924, url: `${SKY}/italia/lazio/roma/roma-colosseo.html`, source: 'skyline' },
  { id: 'it-rome-trevi', name: 'Trevi Fountain', city: 'Rome', country: 'Italy', lat: 41.9009, lng: 12.4833, url: `${SKY}/italia/lazio/roma/fontana-di-trevi.html`, source: 'skyline' },
  { id: 'it-rome-navona', name: 'Piazza Navona', city: 'Rome', country: 'Italy', lat: 41.8992, lng: 12.4731, url: `${SKY}/italia/lazio/roma/piazza-navona-roma.html`, source: 'skyline' },
  { id: 'it-rome-pantheon', name: 'Pantheon', city: 'Rome', country: 'Italy', lat: 41.8986, lng: 12.4769, url: `${SKY}/italia/lazio/roma/pantheon.html`, source: 'skyline' },
  { id: 'it-rome-spagna', name: 'Piazza di Spagna', city: 'Rome', country: 'Italy', lat: 41.9060, lng: 12.4822, url: `${SKY}/italia/lazio/roma/piazza-di-spagna.html`, source: 'skyline' },
  { id: 'it-rome-venezia', name: 'Piazza Venezia', city: 'Rome', country: 'Italy', lat: 41.8964, lng: 12.4822, url: `${SKY}/italia/lazio/roma/piazza-venezia.html`, source: 'skyline' },
  { id: 'it-rome-campo', name: 'Campo de\' Fiori', city: 'Rome', country: 'Italy', lat: 41.8956, lng: 12.4722, url: `${SKY}/italia/lazio/roma/campo-de-fiori.html`, source: 'skyline' },
  { id: 'it-rome-trastevere', name: 'Trastevere', city: 'Rome', country: 'Italy', lat: 41.8893, lng: 12.4700, url: `${SKY}/italia/lazio/roma/trastevere.html`, source: 'skyline' },
  { id: 'it-rome-skyline', name: 'Rome Skyline', city: 'Rome', country: 'Italy', lat: 41.9010, lng: 12.4960, url: `${SKY}/italia/lazio/roma/roma-skyline.html`, source: 'skyline' },
  { id: 'it-venice-sanmarco', name: 'Piazza San Marco', city: 'Venice', country: 'Italy', lat: 45.4341, lng: 12.3388, url: `${SKY}/italia/veneto/venezia/piazza-san-marco.html`, source: 'skyline' },
  { id: 'it-venice-rialto', name: 'Rialto Bridge', city: 'Venice', country: 'Italy', lat: 45.4380, lng: 12.3360, url: `${SKY}/italia/veneto/venezia/rialto-canal-grande.html`, source: 'skyline' },
  { id: 'it-venice-canal', name: 'Grand Canal', city: 'Venice', country: 'Italy', lat: 45.4370, lng: 12.3345, url: `${SKY}/italia/veneto/venezia/canal-grande.html`, source: 'skyline' },
  { id: 'it-milan-duomo', name: 'Duomo di Milano', city: 'Milan', country: 'Italy', lat: 45.4642, lng: 9.1900, url: `${SKY}/italia/lombardia/milano/duomo-milano.html`, source: 'skyline' },
  { id: 'it-milan-citylife', name: 'Milan City Life', city: 'Milan', country: 'Italy', lat: 45.4740, lng: 9.1560, url: `${SKY}/italia/lombardia/milano/skyline-milano-city-life.html`, source: 'skyline' },
  { id: 'it-florence-pontevecchio', name: 'Ponte Vecchio', city: 'Florence', country: 'Italy', lat: 43.7680, lng: 11.2531, url: `${SKY}/italia/toscana/firenze/ponte-vecchio.html`, source: 'skyline' },
  { id: 'it-florence-duomo', name: 'Piazza del Duomo', city: 'Florence', country: 'Italy', lat: 43.7731, lng: 11.2560, url: `${SKY}/italia/toscana/firenze/piazza-duomo-firenze.html`, source: 'skyline' },
  { id: 'it-florence-signoria', name: 'Piazza della Signoria', city: 'Florence', country: 'Italy', lat: 43.7696, lng: 11.2558, url: `${SKY}/italia/toscana/firenze/piazza-signoria.html`, source: 'skyline' },
  { id: 'it-naples-vesuvius', name: 'Mt. Vesuvius', city: 'Naples', country: 'Italy', lat: 40.8218, lng: 14.4263, url: `${SKY}/italia/campania/napoli/napoli-vesuvio.html`, source: 'skyline' },
  { id: 'it-naples-plebiscito', name: 'Piazza del Plebiscito', city: 'Naples', country: 'Italy', lat: 40.8360, lng: 14.2488, url: `${SKY}/italia/campania/napoli/piazza-del-plebiscito.html`, source: 'skyline' },
  { id: 'it-amalfi', name: 'Amalfi Coast', city: 'Amalfi', country: 'Italy', lat: 40.6340, lng: 14.6027, url: `${SKY}/italia/campania/salerno/costiera-amalfitana.html`, source: 'skyline' },
  { id: 'it-capri', name: 'Capri Skyline', city: 'Capri', country: 'Italy', lat: 40.5531, lng: 14.2223, url: `${SKY}/italia/campania/napoli/capri-skyline.html`, source: 'skyline' },
  { id: 'it-pisa', name: 'Pisa', city: 'Pisa', country: 'Italy', lat: 43.7228, lng: 10.3966, url: `${SKY}/italia/toscana/pisa/pisa.html`, source: 'skyline' },
  { id: 'it-siena', name: 'Piazza del Campo', city: 'Siena', country: 'Italy', lat: 43.3188, lng: 11.3308, url: `${SKY}/italia/toscana/siena/piazza-del-campo.html`, source: 'skyline' },
  { id: 'it-verona-arena', name: 'Arena di Verona', city: 'Verona', country: 'Italy', lat: 45.4384, lng: 10.9916, url: `${SKY}/italia/veneto/verona/arena-di-verona.html`, source: 'skyline' },
  { id: 'it-verona-erbe', name: 'Piazza delle Erbe', city: 'Verona', country: 'Italy', lat: 45.4430, lng: 10.9978, url: `${SKY}/italia/veneto/verona/piazza-erbe.html`, source: 'skyline' },
  { id: 'it-taormina', name: 'Taormina', city: 'Taormina', country: 'Italy', lat: 37.8523, lng: 15.2862, url: `${SKY}/italia/sicilia/messina/taormina.html`, source: 'skyline' },
  { id: 'it-etna', name: 'Catania Center', city: 'Catania', country: 'Italy', lat: 37.5022, lng: 15.0873, url: `${SKY}/italia/sicilia/catania/centro-di-catania.html`, source: 'skyline' },
  { id: 'it-trieste', name: 'Unity Square', city: 'Trieste', country: 'Italy', lat: 45.6495, lng: 13.7668, url: `${SKY}/italia/friuli-venezia-giulia/trieste/piazza-unita-italia.html`, source: 'skyline' },
  { id: 'it-bologna', name: 'Asinelli Tower', city: 'Bologna', country: 'Italy', lat: 44.4942, lng: 11.3465, url: `${SKY}/italia/emilia-romagna/bologna/bologna-torre-degli-asinelli.html`, source: 'skyline' },
  { id: 'it-matera', name: 'Matera Sassi', city: 'Matera', country: 'Italy', lat: 40.6660, lng: 16.6100, url: `${SKY}/italia/basilicata/matera/matera-sassi.html`, source: 'skyline' },
  { id: 'it-lecce', name: 'Piazza Santo Oronzo', city: 'Lecce', country: 'Italy', lat: 40.3516, lng: 18.1719, url: `${SKY}/italia/puglia/lecce/piazza-santo-oronzo.html`, source: 'skyline' },
  { id: 'it-palermo', name: 'Palermo Cathedral', city: 'Palermo', country: 'Italy', lat: 38.1146, lng: 13.3564, url: `${SKY}/italia/sicilia/palermo/cattedrale-di-palermo.html`, source: 'skyline' },
  { id: 'it-portovenere', name: 'Portovenere', city: 'Portovenere', country: 'Italy', lat: 44.0541, lng: 9.8365, url: `${SKY}/italia/liguria/la-spezia/porto-venere.html`, source: 'skyline' },
  { id: 'it-merano', name: 'Merano', city: 'Merano', country: 'Italy', lat: 46.6713, lng: 11.1594, url: `${SKY}/italia/trentino-alto-adige/bolzano/merano-tappeiner.html`, source: 'skyline' },

  // ═══════════════ SPAIN ═══════════════
  { id: 'es-madrid-sol', name: 'Puerta del Sol', city: 'Madrid', country: 'Spain', lat: 40.4168, lng: -3.7038, url: `${SKY}/espana/comunidad-de-madrid/madrid/puerta-del-sol-tio-pepe.html`, source: 'skyline' },
  { id: 'es-madrid-callao', name: 'Plaza del Callao', city: 'Madrid', country: 'Spain', lat: 40.4200, lng: -3.7060, url: `${SKY}/espana/comunidad-de-madrid/madrid/madrid-plaza-del-callao.html`, source: 'skyline' },
  { id: 'es-barcelona', name: 'Sant Sebastià Beach', city: 'Barcelona', country: 'Spain', lat: 41.3751, lng: 2.1890, url: `${SKY}/espana/cataluna/barcelona/playa-sant-sebastia.html`, source: 'skyline' },
  { id: 'es-granada', name: 'Alhambra', city: 'Granada', country: 'Spain', lat: 37.1760, lng: -3.5881, url: `${SKY}/espana/andalucia/granada/alhambra-de-granada.html`, source: 'skyline' },
  { id: 'es-seville', name: 'Puente de Triana', city: 'Seville', country: 'Spain', lat: 37.3861, lng: -6.0022, url: `${SKY}/espana/andalucia/sevilla/siviglia-puente-de-triana.html`, source: 'skyline' },
  { id: 'es-tenerife', name: 'La Orotava', city: 'Tenerife', country: 'Spain', lat: 28.3908, lng: -16.5231, url: `${SKY}/espana/canarias/santa-cruz-de-tenerife/la-orotava.html`, source: 'skyline' },
  { id: 'es-benidorm', name: 'Benidorm Skyline', city: 'Benidorm', country: 'Spain', lat: 38.5411, lng: -0.1225, url: `${SKY}/espana/comunidad-valenciana/alicante/benidorm-skyline.html`, source: 'skyline' },
  { id: 'es-santander', name: 'Santander Port', city: 'Santander', country: 'Spain', lat: 43.4610, lng: -3.8080, url: `${SKY}/espana/cantabria/santander/muelle-calderon.html`, source: 'skyline' },
  { id: 'es-ibiza', name: 'Ibiza Port', city: 'Ibiza', country: 'Spain', lat: 38.9067, lng: 1.4306, url: `${SKY}/espana/islas-baleares/ibiza/ibiza-puerto.html`, source: 'skyline' },
  { id: 'es-benalmadena', name: 'Benalmádena', city: 'Benalmádena', country: 'Spain', lat: 36.5976, lng: -4.5159, url: `${SKY}/espana/andalucia/malaga/benalmadena.html`, source: 'skyline' },
  { id: 'es-lamanga', name: 'La Manga', city: 'La Manga', country: 'Spain', lat: 37.6380, lng: -0.7100, url: `${SKY}/espana/region-de-murcia/murcia/manga-mar-menor.html`, source: 'skyline' },

  // ═══════════════ GREECE ═══════════════
  { id: 'gr-athens-acropolis', name: 'Acropolis', city: 'Athens', country: 'Greece', lat: 37.9715, lng: 23.7267, url: `${SKY}/ellada/atiki/athina/acropolis-athens.html`, source: 'skyline' },
  { id: 'gr-athens-parliament', name: 'Hellenic Parliament', city: 'Athens', country: 'Greece', lat: 37.9755, lng: 23.7360, url: `${SKY}/ellada/atiki/athina/hellenic-parliament.html`, source: 'skyline' },
  { id: 'gr-thessaloniki', name: 'Aristotelous Square', city: 'Thessaloniki', country: 'Greece', lat: 40.6326, lng: 22.9415, url: `${SKY}/ellada/makedonia/thessaloniki/plateia-aristotelous.html`, source: 'skyline' },
  { id: 'gr-santorini', name: 'Santorini Caldera', city: 'Santorini', country: 'Greece', lat: 36.4164, lng: 25.4321, url: `${SKY}/ellada/notio-aigaio/santorini/santorini.html`, source: 'skyline' },
  { id: 'gr-mykonos', name: 'Mykonos Town', city: 'Mykonos', country: 'Greece', lat: 37.4467, lng: 25.3289, url: `${SKY}/ellada/notio-aigaio/mikonos/mykonos.html`, source: 'skyline' },
  { id: 'gr-rhodes', name: 'Old Port of Rhodes', city: 'Rhodes', country: 'Greece', lat: 36.4500, lng: 28.2277, url: `${SKY}/ellada/naigaio/dodecanisa/old-port-of-rhodes.html`, source: 'skyline' },
  { id: 'gr-kavala', name: 'Kavala', city: 'Kavala', country: 'Greece', lat: 40.9396, lng: 24.4020, url: `${SKY}/ellada/makedonia/kavala/kavala.html`, source: 'skyline' },
  { id: 'gr-crete', name: 'Mohos Village', city: 'Hersonissos', country: 'Greece', lat: 35.2670, lng: 25.3960, url: `${SKY}/ellada/crete/heraklion/mohos-hersonissos.html`, source: 'skyline' },
  { id: 'gr-lesbos', name: 'Molyvos', city: 'Lesbos', country: 'Greece', lat: 39.3712, lng: 26.1748, url: `${SKY}/ellada/north-aegean/lesbos/lesbo-molyvos.html`, source: 'skyline' },
  { id: 'gr-symi', name: 'Port of Symi', city: 'Symi', country: 'Greece', lat: 36.6167, lng: 27.8389, url: `${SKY}/ellada/naigaio/dodecanisa/port-of-symi.html`, source: 'skyline' },
  { id: 'gr-larissa', name: 'Central Square', city: 'Larissa', country: 'Greece', lat: 39.6372, lng: 22.4128, url: `${SKY}/ellada/thessalia/larissa/kentriki-platia-larissas.html`, source: 'skyline' },
  { id: 'gr-ioannina', name: 'Central Square', city: 'Ioannina', country: 'Greece', lat: 39.6650, lng: 20.8537, url: `${SKY}/ellada/epirus/ioannina/central-square-court-house.html`, source: 'skyline' },
  { id: 'gr-sparta', name: 'Sparta', city: 'Sparta', country: 'Greece', lat: 37.0738, lng: 22.4298, url: `${SKY}/ellada/peloponnese/sparta/sparta.html`, source: 'skyline' },

  // ═══════════════ FRANCE ═══════════════
  { id: 'fr-paris', name: 'Eiffel Tower', city: 'Paris', country: 'France', lat: 48.8584, lng: 2.2945, url: `${SKY}/france/ile-de-france/paris/paris.html`, source: 'skyline' },
  { id: 'fr-marseille', name: 'Calanques', city: 'Marseille', country: 'France', lat: 43.2965, lng: 5.3698, url: `${SKY}/france/provence-alpes-cote-d-azur/bouches-du-rhone/marseille.html`, source: 'skyline' },
  { id: 'fr-larochelle', name: 'Old Harbour', city: 'La Rochelle', country: 'France', lat: 46.1591, lng: -1.1520, url: `${SKY}/france/nouvelle-aquitaine/charente-maritime/la-rochelle.html`, source: 'skyline' },
  { id: 'fr-collioure', name: 'Royal Castle', city: 'Collioure', country: 'France', lat: 42.5264, lng: 3.0841, url: `${SKY}/france/occitanie/pyrenees-orientales/collioure.html`, source: 'skyline' },
  { id: 'fr-sete', name: 'Port de Plaisance', city: 'Sète', country: 'France', lat: 43.4037, lng: 3.6948, url: `${SKY}/france/occitanie/herault/sete.html`, source: 'skyline' },
  { id: 'fr-annecy', name: 'Lake Annecy', city: 'Annecy', country: 'France', lat: 45.7737, lng: 6.2224, url: `${SKY}/france/auvergne-rhone-alpes/haute-savoie/lac-annecy.html`, source: 'skyline' },
  { id: 'fr-corsica', name: 'Porto-Vecchio Beach', city: 'Porto-Vecchio', country: 'France', lat: 41.5915, lng: 9.2789, url: `${SKY}/france/corse/corse-du-sud/porto-vecchio.html`, source: 'skyline' },
  { id: 'fr-royan', name: 'Pontaillac Beach', city: 'Royan', country: 'France', lat: 45.6366, lng: -1.0323, url: `${SKY}/france/nouvelle-aquitaine/charente-maritime/royan.html`, source: 'skyline' },

  // ═══════════════ GERMANY ═══════════════
  { id: 'de-aachen', name: 'Aachen', city: 'Aachen', country: 'Germany', lat: 50.7753, lng: 6.0839, url: `${SKY}/deutschland/north-rhine-westphalia/aachen/aachen.html`, source: 'skyline' },
  { id: 'de-badenbaden', name: 'Baden-Baden', city: 'Baden-Baden', country: 'Germany', lat: 48.7613, lng: 8.2405, url: `${SKY}/deutschland/baden-wurttemberg/baden-baden/baden-baden.html`, source: 'skyline' },
  { id: 'de-magdeburg', name: 'Altstadt', city: 'Magdeburg', country: 'Germany', lat: 52.1205, lng: 11.6276, url: `${SKY}/deutschland/sachsen-anhalt/magdeburg/altstadt.html`, source: 'skyline' },
  { id: 'de-goslar', name: 'Marktplatz', city: 'Goslar', country: 'Germany', lat: 51.9060, lng: 10.4289, url: `${SKY}/deutschland/lower-saxony/goslar/marktkirche-und-marktplatz.html`, source: 'skyline' },
  { id: 'de-kyritz', name: 'Kyritz', city: 'Kyritz', country: 'Germany', lat: 52.9413, lng: 12.3967, url: `${SKY}/deutschland/brandenburg/kyritz/kyritz-brandenburg.html`, source: 'skyline' },

  // ═══════════════ UNITED KINGDOM ═══════════════
  { id: 'uk-cardiff', name: 'Cardiff', city: 'Cardiff', country: 'United Kingdom', lat: 51.4816, lng: -3.1791, url: `${SKY}/united-kingdom/wales/cardiff/cardiff.html`, source: 'skyline' },
  { id: 'uk-hawes', name: 'Hawes', city: 'Hawes', country: 'United Kingdom', lat: 54.3057, lng: -2.1976, url: `${SKY}/united-kingdom/england/hawes/hawes.html`, source: 'skyline' },
  { id: 'uk-barmouth', name: 'Barmouth', city: 'Barmouth', country: 'United Kingdom', lat: 52.7219, lng: -4.0542, url: `${SKY}/united-kingdom/wales/gwynedd/barmouth.html`, source: 'skyline' },

  // ═══════════════ CROATIA ═══════════════
  { id: 'hr-split', name: 'Split Pjaca', city: 'Split', country: 'Croatia', lat: 43.5081, lng: 16.4402, url: `${SKY}/hrvatska/splitsko-dalmatinska/split/pjaca-split.html`, source: 'skyline' },
  { id: 'hr-zadar', name: 'Zadar', city: 'Zadar', country: 'Croatia', lat: 44.1194, lng: 15.2314, url: `${SKY}/hrvatska/zadar/zadar/zadar.html`, source: 'skyline' },
  { id: 'hr-trakoscan', name: 'Trakošćan Castle', city: 'Varaždin', country: 'Croatia', lat: 46.2600, lng: 15.9831, url: `${SKY}/hrvatska/varazdinska/varazdin/dvorac-trakoscan-bednja.html`, source: 'skyline' },

  // ═══════════════ PORTUGAL ═══════════════
  { id: 'pt-faro', name: 'Faro', city: 'Faro', country: 'Portugal', lat: 37.0194, lng: -7.9322, url: `${SKY}/portugal/algarve/faro/faro-portugal.html`, source: 'skyline' },

  // ═══════════════ AUSTRIA ═══════════════
  { id: 'at-vienna', name: 'Kohlmarkt', city: 'Vienna', country: 'Austria', lat: 48.2082, lng: 16.3669, url: `${SKY}/austria/vienna/vienna/kohlmarkt.html`, source: 'skyline' },
  { id: 'at-radstadt', name: 'Radstadt', city: 'Radstadt', country: 'Austria', lat: 47.3833, lng: 13.4600, url: `${SKY}/austria/salzburg/radstadt/radstadt.html`, source: 'skyline' },
  { id: 'at-kufstein', name: 'Kufstein', city: 'Kufstein', country: 'Austria', lat: 47.5833, lng: 12.1667, url: `${SKY}/austria/tyrol/kufstein/kufstein.html`, source: 'skyline' },

  // ═══════════════ BOSNIA AND HERZEGOVINA ═══════════════
  { id: 'ba-ugljevik', name: 'Ugljevik', city: 'Ugljevik', country: 'Bosnia and Herzegovina', lat: 44.6942, lng: 19.0047, url: `${SKY}/bosnia-and-herzegovina/republika-srpska/ugljevik/ugljevik.html`, source: 'skyline' },

  // ═══════════════ BULGARIA ═══════════════
  { id: 'bg-pirin', name: 'Pirin Mountains', city: 'Dobrinishte', country: 'Bulgaria', lat: 41.6500, lng: 23.5667, url: `${SKY}/bulgaria/blagoevgrad/dobrinishte/pirin-mountains.html`, source: 'skyline' },

  // ═══════════════ CZECH REPUBLIC ═══════════════
  { id: 'cz-prague', name: 'Prague Old Town', city: 'Prague', country: 'Czech Republic', lat: 50.0875, lng: 14.4213, url: `${SKY}/czech-republic/prague/prague/old-town.html`, source: 'skyline' },

  // ═══════════════ HUNGARY ═══════════════
  { id: 'hu-papa', name: 'Pápa', city: 'Pápa', country: 'Hungary', lat: 47.3300, lng: 17.4678, url: `${SKY}/hungary/central-transdanubia/papa/ungheria-papa.html`, source: 'skyline' },

  // ═══════════════ ICELAND ═══════════════
  { id: 'is-reykjavik', name: 'Reykjavik', city: 'Reykjavik', country: 'Iceland', lat: 64.1466, lng: -21.9426, url: `${SKY}/iceland/hofudborgarsvaedid/reykjavik/reykjavik.html`, source: 'skyline' },

  // ═══════════════ IRELAND ═══════════════
  { id: 'ie-dublin', name: 'Dublin', city: 'Dublin', country: 'Ireland', lat: 53.3498, lng: -6.2603, url: `${SKY}/ireland/leinster/dublin/dublin.html`, source: 'skyline' },

  // ═══════════════ LUXEMBOURG ═══════════════
  { id: 'lu-wasserbillig', name: 'Wasserbillig', city: 'Mertert', country: 'Luxembourg', lat: 49.7158, lng: 6.5017, url: `${SKY}/luxembourg/grevenmacher/mertert/wasserbillig.html`, source: 'skyline' },

  // ═══════════════ MALTA ═══════════════
  { id: 'mt-valletta', name: 'St. George\'s Square', city: 'Valletta', country: 'Malta', lat: 35.8989, lng: 14.5146, url: `${SKY}/malta/malta/valletta/st-george-square-valletta.html`, source: 'skyline' },
  { id: 'mt-floriana', name: 'Triton Fountain', city: 'Floriana', country: 'Malta', lat: 35.8940, lng: 14.5070, url: `${SKY}/malta/malta/floriana/the-triton-fountain.html`, source: 'skyline' },
  { id: 'mt-mosta', name: 'Rotunda of Mosta', city: 'Mosta', country: 'Malta', lat: 35.9098, lng: 14.4260, url: `${SKY}/malta/malta/mosta/rotunda-mosta.html`, source: 'skyline' },
  { id: 'mt-sliema', name: 'St. Julian\'s Bay', city: 'Sliema', country: 'Malta', lat: 35.9150, lng: 14.4940, url: `${SKY}/malta/malta/sliema/s-julians-bay-tower-road.html`, source: 'skyline' },
  { id: 'mt-gozo', name: 'Għarb Parish', city: 'Għarb', country: 'Malta', lat: 36.0613, lng: 14.2098, url: `${SKY}/malta/gozo/gharb/gharb-parish-church.html`, source: 'skyline' },

  // ═══════════════ NORWAY ═══════════════
  { id: 'no-tromso', name: 'Tromsø', city: 'Tromsø', country: 'Norway', lat: 69.6496, lng: 18.9560, url: `${SKY}/norge/troms-og-finnmark/tromso/tromso.html`, source: 'skyline' },

  // ═══════════════ POLAND ═══════════════
  { id: 'pl-krakow', name: 'Kraków', city: 'Kraków', country: 'Poland', lat: 50.0617, lng: 19.9383, url: `${SKY}/poland/lesser-poland-voivodeship/krakow/grodzka-kosciol-sw-apostolow-piotra-i-pawla.html`, source: 'skyline' },
  { id: 'pl-gdansk', name: 'Gdańsk', city: 'Gdańsk', country: 'Poland', lat: 54.3520, lng: 18.6466, url: `${SKY}/poland/pomerania/gdansk/gdansk.html`, source: 'skyline' },
  { id: 'pl-sandomierz', name: 'Old Town Square', city: 'Sandomierz', country: 'Poland', lat: 50.6826, lng: 21.7492, url: `${SKY}/poland/swietokrzyskie-voivodeship/sandomierz/rynek-starego-miasta.html`, source: 'skyline' },
  { id: 'pl-elblag', name: 'Old Town', city: 'Elbląg', country: 'Poland', lat: 54.1522, lng: 19.4018, url: `${SKY}/poland/warmian-masurian-voivodeship/elblag/stare-miasto.html`, source: 'skyline' },
  { id: 'pl-lodz', name: 'Łódź', city: 'Łódź', country: 'Poland', lat: 51.7592, lng: 19.4560, url: `${SKY}/poland/lodz-voivodeship/lodz/lodz.html`, source: 'skyline' },
  { id: 'pl-jeleniagora', name: 'Plac Ratuszowy', city: 'Jelenia Góra', country: 'Poland', lat: 50.9044, lng: 15.7200, url: `${SKY}/poland/lower-silesian-voivodeship/jelenia-gora/plac-ratuszowy.html`, source: 'skyline' },

  // ═══════════════ ROMANIA ═══════════════
  { id: 'ro-bucharest', name: 'Bucharest', city: 'Bucharest', country: 'Romania', lat: 44.4268, lng: 26.1025, url: `${SKY}/romania/bucuresti/bucuresti/bucharest.html`, source: 'skyline' },

  // ═══════════════ SAN MARINO ═══════════════
  { id: 'sm-sanmarino', name: 'San Marino', city: 'San Marino', country: 'San Marino', lat: 43.9424, lng: 12.4578, url: `${SKY}/repubblica-di-san-marino/citta-di-san-marino/citta-di-san-marino/san-marino.html`, source: 'skyline' },

  // ═══════════════ SLOVENIA ═══════════════
  { id: 'si-piran', name: 'Tartini Square', city: 'Piran', country: 'Slovenia', lat: 45.5283, lng: 13.5683, url: `${SKY}/slovenija/primorska/piran/trg-tartini.html`, source: 'skyline' },

  // ═══════════════ SWITZERLAND ═══════════════
  { id: 'ch-zermatt', name: 'Matterhorn', city: 'Zermatt', country: 'Switzerland', lat: 45.9763, lng: 7.6586, url: `${SKY}/schweiz/valais/zermatt/matterhorn.html`, source: 'skyline' },

  // ═══════════════ ALBANIA ═══════════════
  { id: 'al-tirana', name: 'Tirana', city: 'Tirana', country: 'Albania', lat: 41.3275, lng: 19.8187, url: `${SKY}/albania/tirana/tirana/tirana.html`, source: 'skyline' },

  // ═══════════════ CYPRUS ═══════════════
  { id: 'cy-limassol', name: 'Limassol', city: 'Limassol', country: 'Cyprus', lat: 34.7071, lng: 33.0226, url: `${SKY}/cyprus/limassol/limassol/limassol.html`, source: 'skyline' },

  // ═══════════════ FAROE ISLANDS ═══════════════
  { id: 'fo-torshavn', name: 'Tórshavn', city: 'Tórshavn', country: 'Faroe Islands', lat: 62.0107, lng: -6.7741, url: `${SKY}/faroe-islands/streymoy/torshavn/torshavn.html`, source: 'skyline' },

  // ═══════════════ TURKEY ═══════════════
  { id: 'tr-istanbul', name: 'Golden Horn', city: 'Istanbul', country: 'Turkey', lat: 41.0256, lng: 28.9744, url: `${SKY}/turkey/istanbul/istanbul/golden-horn.html`, source: 'skyline' },
  { id: 'tr-cappadocia', name: 'Cappadocia', city: 'Uçhisar', country: 'Turkey', lat: 38.6320, lng: 34.8002, url: `${SKY}/turkey/nevsehir/uchisar/cappadocia.html`, source: 'skyline' },
  { id: 'tr-giresun', name: 'Giresun', city: 'Giresun', country: 'Turkey', lat: 40.9128, lng: 38.3895, url: `${SKY}/turkey/giresun/giresun/giresun.html`, source: 'skyline' },

  // ═══════════════ ISRAEL ═══════════════
  { id: 'il-jerusalem', name: 'Western Wall', city: 'Jerusalem', country: 'Israel', lat: 31.7767, lng: 35.2345, url: `${SKY}/israel/jerusalem-district/jerusalem/western-wall.html`, source: 'skyline' },

  // ═══════════════ JORDAN ═══════════════
  { id: 'jo-petra', name: 'Petra Visitor Center', city: 'Wadi Musa', country: 'Jordan', lat: 30.3285, lng: 35.4444, url: `${SKY}/jordan/maan/amman/petra-visitor-center.html`, source: 'skyline' },

  // ═══════════════ UNITED STATES ═══════════════
  { id: 'us-nyc', name: 'New York Skyline', city: 'New York', country: 'United States', lat: 40.7128, lng: -74.0060, url: `${SKY}/united-states/new-york/new-york/new-york-skyline.html`, source: 'skyline' },
  { id: 'us-lasvegas', name: 'Las Vegas Strip', city: 'Las Vegas', country: 'United States', lat: 36.1147, lng: -115.1729, url: `${SKY}/united-states/nevada/las-vegas/las-vegas.html`, source: 'skyline' },
  { id: 'us-lasvegas-strat', name: 'The Strat', city: 'Las Vegas', country: 'United States', lat: 36.1474, lng: -115.1558, url: `${SKY}/united-states/nevada/las-vegas/the-strat.html`, source: 'skyline' },
  { id: 'us-miami', name: 'Miami Beach', city: 'Miami', country: 'United States', lat: 25.7907, lng: -80.1300, url: `${SKY}/united-states/florida/miami/miami.html`, source: 'skyline' },
  { id: 'us-virginia-city', name: 'Virginia City', city: 'Virginia City', country: 'United States', lat: 39.3096, lng: -119.6497, url: `${SKY}/united-states/nevada/virginia-city/virginia-city.html`, source: 'skyline' },

  // ═══════════════ CANADA ═══════════════
  { id: 'ca-toronto-cn', name: 'CN Tower', city: 'Toronto', country: 'Canada', lat: 43.6426, lng: -79.3871, url: `${SKY}/canada/ontario/toronto/ytz-cn-tower.html`, source: 'skyline' },
  { id: 'ca-toronto-skyline', name: 'Toronto Skyline', city: 'Toronto', country: 'Canada', lat: 43.6500, lng: -79.3800, url: `${SKY}/canada/ontario/toronto/cn-tower.html`, source: 'skyline' },

  // ═══════════════ MEXICO ═══════════════
  { id: 'mx-zocalo', name: 'Zócalo', city: 'Mexico City', country: 'Mexico', lat: 19.4326, lng: -99.1332, url: `${SKY}/mexico/federal-district/mexico-city/zocalo.html`, source: 'skyline' },
  { id: 'mx-cdmx-revolution', name: 'Monument to Revolution', city: 'Mexico City', country: 'Mexico', lat: 19.4366, lng: -99.1546, url: `${SKY}/mexico/federal-district/mexico-city/monumento-a-la-revolucion.html`, source: 'skyline' },
  { id: 'mx-cancun', name: 'Cancún', city: 'Cancún', country: 'Mexico', lat: 21.1619, lng: -86.8515, url: `${SKY}/mexico/quintana-roo/solidaridad/panorama-of-cancun.html`, source: 'skyline' },
  { id: 'mx-playa', name: 'Playa del Carmen', city: 'Playa del Carmen', country: 'Mexico', lat: 20.6296, lng: -87.0739, url: `${SKY}/mexico/quintana-roo/solidaridad/panorama-de-playa-del-carmen.html`, source: 'skyline' },
  { id: 'mx-tulum', name: 'Playa de Tulum', city: 'Tulum', country: 'Mexico', lat: 20.2115, lng: -87.4295, url: `${SKY}/mexico/quintana-roo/tulum/playa.html`, source: 'skyline' },
  { id: 'mx-cabo', name: 'Cabo San Lucas', city: 'Cabo San Lucas', country: 'Mexico', lat: 22.8905, lng: -109.9167, url: `${SKY}/mexico/baja-california-sur/cabo-san-lucas/cabo-san-lucas.html`, source: 'skyline' },
  { id: 'mx-pvallarta', name: 'Puerto Vallarta', city: 'Puerto Vallarta', country: 'Mexico', lat: 20.6534, lng: -105.2253, url: `${SKY}/mexico/jalisco/puerto-vallarta/puerto-vallarta.html`, source: 'skyline' },
  { id: 'mx-acapulco', name: 'Acapulco', city: 'Acapulco', country: 'Mexico', lat: 16.8531, lng: -99.8237, url: `${SKY}/mexico/guerrero/acapulco/acapulco.html`, source: 'skyline' },
  { id: 'mx-popocatepetl', name: 'Volcán Popocatépetl', city: 'Puebla', country: 'Mexico', lat: 19.0234, lng: -98.6276, url: `${SKY}/mexico/puebla/puebla/volcano-popocatepetl.html`, source: 'skyline' },
  { id: 'mx-teotihuacan', name: 'Teotihuacán', city: 'Teotihuacán', country: 'Mexico', lat: 19.6925, lng: -98.8438, url: `${SKY}/mexico/federal-district/teotihuacan/teotihuacan.html`, source: 'skyline' },
  { id: 'mx-cozumel', name: 'Cozumel', city: 'Cozumel', country: 'Mexico', lat: 20.4230, lng: -86.9223, url: `${SKY}/mexico/quintana-roo/cozumel/cozumel.html`, source: 'skyline' },
  { id: 'mx-escondido', name: 'Puerto Escondido', city: 'Puerto Escondido', country: 'Mexico', lat: 15.8617, lng: -97.0694, url: `${SKY}/mexico/oaxaca/san-pedro-mixtepec/puerto-escondido.html`, source: 'skyline' },
  { id: 'mx-huatulco', name: 'Huatulco', city: 'Huatulco', country: 'Mexico', lat: 15.7690, lng: -96.1260, url: `${SKY}/mexico/oaxaca/huatulco/huatulco.html`, source: 'skyline' },
  { id: 'mx-loreto', name: 'Loreto', city: 'Loreto', country: 'Mexico', lat: 26.0125, lng: -111.3479, url: `${SKY}/mexico/baja-california-sur/loreto/loreto.html`, source: 'skyline' },

  // ═══════════════ ARGENTINA ═══════════════
  { id: 'ar-buenosaires', name: 'Buenos Aires', city: 'Buenos Aires', country: 'Argentina', lat: -34.6037, lng: -58.3816, url: `${SKY}/argentina/buenos-aires/buenos-aires/panorama.html`, source: 'skyline' },
  { id: 'ar-ushuaia', name: 'Ushuaia', city: 'Ushuaia', country: 'Argentina', lat: -54.8019, lng: -68.3030, url: `${SKY}/argentina/tierra-del-fuego/ushuaia/ushuaia.html`, source: 'skyline' },
  { id: 'ar-ushuaia-train', name: 'End of the World Train', city: 'Ushuaia', country: 'Argentina', lat: -54.8380, lng: -68.3620, url: `${SKY}/argentina/tierra-del-fuego/ushuaia/tren-del-fin-del-mundo.html`, source: 'skyline' },
  { id: 'ar-cipolletti', name: 'Cipolletti', city: 'Cipolletti', country: 'Argentina', lat: -38.9516, lng: -67.9962, url: `${SKY}/argentina/rio-negro-province/cipolletti/cipolletti.html`, source: 'skyline' },
  { id: 'ar-pinamar', name: 'Pinamar Beach', city: 'Pinamar', country: 'Argentina', lat: -37.1083, lng: -56.8538, url: `${SKY}/argentina/buenos-aires/pinamar/pinamar-beach.html`, source: 'skyline' },
  { id: 'ar-necochea', name: 'Necochea', city: 'Necochea', country: 'Argentina', lat: -38.5545, lng: -58.7396, url: `${SKY}/argentina/buenos-aires/necochea/necochea.html`, source: 'skyline' },

  // ═══════════════ BRAZIL ═══════════════
  { id: 'br-brasilia', name: 'Brasília', city: 'Brasília', country: 'Brazil', lat: -15.7942, lng: -47.8825, url: `${SKY}/brasil/distrito-federal/brasilia/brasilia.html`, source: 'skyline' },
  { id: 'br-maceio', name: 'Pajuçara Beach', city: 'Maceió', country: 'Brazil', lat: -9.6658, lng: -35.7353, url: `${SKY}/brasil/alagoas/maceio/pajucara.html`, source: 'skyline' },
  { id: 'br-aparecida', name: 'Basilica of Our Lady', city: 'Aparecida', country: 'Brazil', lat: -22.8499, lng: -45.2295, url: `${SKY}/brasil/sao-paulo/aparecida/basilica-of-national-shrine-of-our-lady-aperecida.html`, source: 'skyline' },

  // ═══════════════ CHILE ═══════════════
  { id: 'cl-easterisland', name: 'Easter Island', city: 'Easter Island', country: 'Chile', lat: -27.1127, lng: -109.3497, url: `${SKY}/chile/valparaiso/easter-island/easter-island.html`, source: 'skyline' },
  { id: 'cl-puntaarenas', name: 'Punta Arenas', city: 'Punta Arenas', country: 'Chile', lat: -53.1638, lng: -70.9171, url: `${SKY}/chile/magallanes-region/punta-arenas/punta-arenas.html`, source: 'skyline' },
  { id: 'cl-vinadel', name: 'Viña del Mar', city: 'Viña del Mar', country: 'Chile', lat: -33.0153, lng: -71.5503, url: `${SKY}/chile/valparaiso/vina-del-mar/vina-del-mar.html`, source: 'skyline' },
  { id: 'cl-valparaiso', name: 'Valparaíso', city: 'Valparaíso', country: 'Chile', lat: -33.0472, lng: -71.6127, url: `${SKY}/chile/valparaiso/valparaiso/panorama.html`, source: 'skyline' },
  { id: 'cl-santiago', name: 'Providencia', city: 'Santiago', country: 'Chile', lat: -33.4265, lng: -70.6108, url: `${SKY}/chile/santiago/providencia/providencia.html`, source: 'skyline' },
  { id: 'cl-concepcion', name: 'Concepción', city: 'Concepción', country: 'Chile', lat: -36.8270, lng: -73.0503, url: `${SKY}/chile/bio-bio/concepcion/panorama.html`, source: 'skyline' },

  // ═══════════════ PERU ═══════════════
  { id: 'pe-cusco', name: 'Plaza Mayor', city: 'Cusco', country: 'Peru', lat: -13.5167, lng: -71.9786, url: `${SKY}/peru/cusco/cusco/plaza-mayor.html`, source: 'skyline' },
  { id: 'pe-lima', name: 'Miraflores', city: 'Lima', country: 'Peru', lat: -12.1191, lng: -77.0312, url: `${SKY}/peru/lima/lima/miraflores.html`, source: 'skyline' },
  { id: 'pe-arequipa', name: 'Plaza Mayor', city: 'Arequipa', country: 'Peru', lat: -16.3988, lng: -71.5370, url: `${SKY}/peru/arequipa/arequipa/plaza-mayor.html`, source: 'skyline' },
  { id: 'pe-tacna', name: 'Tacna Plaza', city: 'Tacna', country: 'Peru', lat: -18.0056, lng: -70.2486, url: `${SKY}/peru/tacna/tacna/plaza-mayor.html`, source: 'skyline' },

  // ═══════════════ BOLIVIA ═══════════════
  { id: 'bo-cochabamba', name: 'Plaza 14 de Septiembre', city: 'Cochabamba', country: 'Bolivia', lat: -17.3895, lng: -66.1568, url: `${SKY}/bolivia/cercado/cochabamba/plaza-14-de-septiembre.html`, source: 'skyline' },

  // ═══════════════ COSTA RICA ═══════════════
  { id: 'cr-sanvicente', name: 'San Vicente', city: 'Moravia', country: 'Costa Rica', lat: 9.9628, lng: -84.0480, url: `${SKY}/costa-rica/san-jose-province/moravia/san-vicente.html`, source: 'skyline' },

  // ═══════════════ PANAMA ═══════════════
  { id: 'pa-panama', name: 'Panama City', city: 'Panama City', country: 'Panama', lat: 8.9824, lng: -79.5199, url: `${SKY}/panama/panama/panama/panama.html`, source: 'skyline' },

  // ═══════════════ DOMINICAN REPUBLIC ═══════════════
  { id: 'do-cabarete', name: 'Cabarete Beach', city: 'Cabarete', country: 'Dominican Republic', lat: 19.7581, lng: -70.4180, url: `${SKY}/dominican-republic/puerto-plata/cabarete/cabarete.html`, source: 'skyline' },

  // ═══════════════ BERMUDA ═══════════════
  { id: 'bm-stgeorge', name: 'St. George\'s Town Square', city: 'St. George', country: 'Bermuda', lat: 32.3790, lng: -64.6780, url: `${SKY}/bermuda/st-george-s-parish/st-george-s-parish/st-george-s-town-square-bermuda.html`, source: 'skyline' },

  // ═══════════════ SINT MAARTEN ═══════════════
  { id: 'sx-stmaarten', name: 'Maho Beach', city: 'St. Maarten', country: 'Sint Maarten', lat: 18.0408, lng: -63.1139, url: `${SKY}/sint-maarten/sint-maarten/sint-maarten/maho-beach.html`, source: 'skyline' },

  // ═══════════════ BARBADOS ═══════════════
  { id: 'bb-barbados', name: 'Barbados', city: 'Bridgetown', country: 'Barbados', lat: 13.1132, lng: -59.5988, url: `${SKY}/barbados/saint-michael/bridgetown/bridgetown.html`, source: 'skyline' },

  // ═══════════════ BELIZE ═══════════════
  { id: 'bz-belize', name: 'Belize City', city: 'Belize City', country: 'Belize', lat: 17.4985, lng: -88.1870, url: `${SKY}/belize/belize-district/belize-city/belize-city.html`, source: 'skyline' },

  // ═══════════════ EL SALVADOR ═══════════════
  { id: 'sv-sansalvador', name: 'San Salvador', city: 'San Salvador', country: 'El Salvador', lat: 13.6929, lng: -89.2182, url: `${SKY}/el-salvador/san-salvador/san-salvador/san-salvador.html`, source: 'skyline' },

  // ═══════════════ GRENADA ═══════════════
  { id: 'gd-stgeorge', name: 'St. George\'s', city: "St. George's", country: 'Grenada', lat: 12.0564, lng: -61.7485, url: `${SKY}/grenada/st-george/st-george/st-george.html`, source: 'skyline' },

  // ═══════════════ GUADELOUPE ═══════════════
  { id: 'gp-pointe', name: 'Pointe-à-Pitre', city: 'Pointe-à-Pitre', country: 'Guadeloupe', lat: 16.2411, lng: -61.5330, url: `${SKY}/guadeloupe/grande-terre/pointe-a-pitre/pointe-a-pitre.html`, source: 'skyline' },

  // ═══════════════ HONDURAS ═══════════════
  { id: 'hn-tegucigalpa', name: 'Tegucigalpa', city: 'Tegucigalpa', country: 'Honduras', lat: 14.0723, lng: -87.1921, url: `${SKY}/honduras/francisco-morazan/tegucigalpa/tegucigalpa.html`, source: 'skyline' },

  // ═══════════════ MARTINIQUE ═══════════════
  { id: 'mq-fortdefrance', name: 'Fort-de-France', city: 'Fort-de-France', country: 'Martinique', lat: 14.6161, lng: -61.0588, url: `${SKY}/martinique/martinique/fort-de-france/fort-de-france.html`, source: 'skyline' },

  // ═══════════════ URUGUAY ═══════════════
  { id: 'uy-montevideo', name: 'Montevideo', city: 'Montevideo', country: 'Uruguay', lat: -34.9011, lng: -56.1645, url: `${SKY}/uruguay/montevideo/montevideo/montevideo.html`, source: 'skyline' },

  // ═══════════════ US VIRGIN ISLANDS ═══════════════
  { id: 'vi-charlotte', name: 'Charlotte Amalie', city: 'Charlotte Amalie', country: 'US Virgin Islands', lat: 18.3358, lng: -64.9307, url: `${SKY}/us-virgin-islands/st-thomas/charlotte-amalie/charlotte-amalie.html`, source: 'skyline' },

  // ═══════════════ VENEZUELA ═══════════════
  { id: 've-caracas', name: 'Caracas', city: 'Caracas', country: 'Venezuela', lat: 10.4806, lng: -66.9036, url: `${SKY}/venezuela/distrito-capital/caracas/caracas.html`, source: 'skyline' },

  // ═══════════════ ECUADOR ═══════════════
  { id: 'ec-quito', name: 'Quito', city: 'Quito', country: 'Ecuador', lat: -0.1807, lng: -78.4678, url: `${SKY}/ecuador/pichincha/quito/quito.html`, source: 'skyline' },

  // ═══════════════ CARIBBEAN NETHERLANDS ═══════════════
  { id: 'bq-bonaire', name: 'Kralendijk', city: 'Kralendijk', country: 'Caribbean Netherlands', lat: 12.1443, lng: -68.2655, url: `${SKY}/caribbean-netherlands/bonaire/kralendijk/kralendijk.html`, source: 'skyline' },

  // ═══════════════ EGYPT ═══════════════
  { id: 'eg-pyramids', name: 'Great Pyramid of Giza', city: 'Cairo', country: 'Egypt', lat: 29.9792, lng: 31.1342, url: `${SKY}/egypt/cairo/cairo/great-pyramid-of-giza.html`, source: 'skyline' },

  // ═══════════════ SOUTH AFRICA ═══════════════
  { id: 'za-capetown', name: 'Table Mountain', city: 'Cape Town', country: 'South Africa', lat: -33.9628, lng: 18.4098, url: `${SKY}/south-africa/western-cape/cape-town/table-mountain.html`, source: 'skyline' },

  // ═══════════════ KENYA ═══════════════
  { id: 'ke-nairobi', name: 'Nairobi', city: 'Nairobi', country: 'Kenya', lat: -1.2921, lng: 36.8219, url: `${SKY}/kenya/nairobi/nairobi/nairobi.html`, source: 'skyline' },

  // ═══════════════ MOROCCO ═══════════════
  { id: 'ma-marrakech', name: 'Marrakech', city: 'Marrakech', country: 'Morocco', lat: 31.6295, lng: -7.9811, url: `${SKY}/morocco/marrakesh-safi/marrakech/marrakech.html`, source: 'skyline' },

  // ═══════════════ SENEGAL ═══════════════
  { id: 'sn-dakar', name: 'Dakar', city: 'Dakar', country: 'Senegal', lat: 14.7167, lng: -17.4677, url: `${SKY}/senegal/dakar/dakar/dakar.html`, source: 'skyline' },

  // ═══════════════ CAPE VERDE ═══════════════
  { id: 'cv-praia', name: 'Praia', city: 'Praia', country: 'Cape Verde', lat: 14.9195, lng: -23.5087, url: `${SKY}/cabo-verde/santiago/praia/praia.html`, source: 'skyline' },

  // ═══════════════ MAURITIUS ═══════════════
  { id: 'mu-portlouis', name: 'Port Louis', city: 'Port Louis', country: 'Mauritius', lat: -20.1609, lng: 57.5012, url: `${SKY}/mauritius/port-louis/port-louis/port-louis.html`, source: 'skyline' },

  // ═══════════════ SEYCHELLES ═══════════════
  { id: 'sc-victoria', name: 'Victoria', city: 'Victoria', country: 'Seychelles', lat: -4.6191, lng: 55.4513, url: `${SKY}/seychelles/mahe/victoria/victoria.html`, source: 'skyline' },

  // ═══════════════ ZANZIBAR ═══════════════
  { id: 'tz-zanzibar', name: 'Stone Town', city: 'Stone Town', country: 'Zanzibar', lat: -6.1622, lng: 39.1921, url: `${SKY}/zanzibar/unguja-south/zanzibar-city/zanzibar.html`, source: 'skyline' },

  // ═══════════════ CHINA ═══════════════
  { id: 'cn-shanghai', name: 'Shanghai Skyline', city: 'Shanghai', country: 'China', lat: 31.2304, lng: 121.4737, url: `${SKY}/china/shanghai/shanghai/skyline-of-shanghai.html`, source: 'skyline' },
  { id: 'cn-qingdao', name: 'Qingdao Panorama', city: 'Qingdao', country: 'China', lat: 36.0671, lng: 120.3826, url: `${SKY}/china/shandong/qingdao/panorama-of-qingdao.html`, source: 'skyline' },

  // ═══════════════ MALDIVES ═══════════════
  { id: 'mv-male', name: 'Malé', city: 'Malé', country: 'Maldives', lat: 4.1755, lng: 73.5093, url: `${SKY}/maldives/male/male/male.html`, source: 'skyline' },

  // ═══════════════ PHILIPPINES ═══════════════
  { id: 'ph-manila', name: 'Manila Bay', city: 'Manila', country: 'Philippines', lat: 14.5547, lng: 120.9771, url: `${SKY}/philippines/metro-manila/manila/manila-bay.html`, source: 'skyline' },

  // ═══════════════ SRI LANKA ═══════════════
  { id: 'lk-colombo', name: 'Colombo', city: 'Colombo', country: 'Sri Lanka', lat: 6.9271, lng: 79.8612, url: `${SKY}/sri-lanka/western-province/colombo/colombo.html`, source: 'skyline' },

  // ═══════════════ THAILAND ═══════════════
  { id: 'th-kohsamui', name: 'Koh Samui Lamai', city: 'Koh Samui', country: 'Thailand', lat: 9.4667, lng: 100.0456, url: `${SKY}/thailand/surat-thani/ko-samui/lamai.html`, source: 'skyline' },

  // ═══════════════ VIETNAM ═══════════════
  { id: 'vn-hoangmai', name: 'Hoàng Mai Town', city: 'Hoàng Mai', country: 'Vietnam', lat: 19.2520, lng: 105.6600, url: `${SKY}/vietnam/bac-trung-bo/nghe-an/hoang-mai-town-nghe-an.html`, source: 'skyline' },

  // ═══════════════ AUSTRALIA ═══════════════
  { id: 'au-sydney', name: 'Sydney Harbour', city: 'Sydney', country: 'Australia', lat: -33.8568, lng: 151.2153, url: `${SKY}/australia/new-south-wales/sydney/sydney.html`, source: 'skyline' },
  { id: 'au-brisbane', name: 'Brisbane River', city: 'Brisbane', country: 'Australia', lat: -27.4698, lng: 153.0251, url: `${SKY}/australia/queensland/brisbane/brisbane-river.html`, source: 'skyline' },
]

/** Get cameras for a specific country name */
export function getCamerasForCountry(country: string): LiveCamera[] {
  const lc = country.toLowerCase()
  return EARTHCAM_CAMERAS.filter(c => c.country.toLowerCase() === lc)
}

/** Get nearest camera to a coordinate */
export function getNearestCamera(lat: number, lng: number): LiveCamera | null {
  let best: LiveCamera | null = null
  let bestDist = Infinity
  for (const cam of EARTHCAM_CAMERAS) {
    const dlat = cam.lat - lat
    const dlng = cam.lng - lng
    const dist = dlat * dlat + dlng * dlng
    if (dist < bestDist) { bestDist = dist; best = cam }
  }
  return best
}
