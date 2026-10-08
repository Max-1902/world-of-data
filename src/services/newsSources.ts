/**
 * News feed configuration: which outlets the app pulls RSS from. Fetching and parsing live in news.ts;
 * ownership labels for state-owned/-directed outlets live in stateMedia.ts.
 */

// ── Global wire feeds ────────────────────────────────────────────────────────
export const RSS_FEEDS = [
  { url: 'https://feeds.bbci.co.uk/news/world/rss.xml', name: 'BBC News' },
  { url: 'https://rss.dw.com/xml/rss-en-world', name: 'DW News' },
  { url: 'https://www.aljazeera.com/xml/rss/all.xml', name: 'Al Jazeera English' },
  { url: 'https://www.france24.com/en/rss', name: 'France 24 English' },
  { url: 'https://rss.nytimes.com/services/xml/rss/nyt/World.xml', name: 'NYT World' },
  { url: 'https://www.theguardian.com/world/rss', name: 'Guardian World' },
]

// ── Per-country news sources ─────────────────────────────────────────────────
// The 5 most reliable/widely-cited outlets per country (RSS-based), used to
// let the news panel be filtered to a specific country's press. US is default.
export interface CountryNewsSource {
  name: string
  url: string
  /** ISO 639-1 language of the feed when it isn't English; those articles are machine-translated for display. */
  lang?: string
}

export interface CountryNewsEntry {
  code: string
  label: string
  sources: CountryNewsSource[]
}

export const COUNTRY_NEWS_SOURCES: CountryNewsEntry[] = [
  {
    code: 'US', label: 'United States', sources: [
      { name: 'NYT',              url: 'https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml' },
      { name: 'NPR',              url: 'https://feeds.npr.org/1001/rss.xml' },
      { name: 'BBC News',         url: 'https://feeds.bbci.co.uk/news/world/us_and_canada/rss.xml' },
      { name: 'Al Jazeera',       url: 'https://www.aljazeera.com/xml/rss/all.xml' },
      { name: 'The Guardian US',  url: 'https://www.theguardian.com/us-news/rss' },
    ],
  },
  {
    code: 'GB', label: 'United Kingdom', sources: [
      { name: 'BBC News',   url: 'https://feeds.bbci.co.uk/news/rss.xml' },
      { name: 'The Guardian', url: 'https://www.theguardian.com/uk/rss' },
      { name: 'Financial Times', url: 'https://www.ft.com/rss/home/uk' },
      { name: 'Sky News',   url: 'https://feeds.skynews.com/feeds/rss/uk.xml' },
      { name: 'DW News',    url: 'https://rss.dw.com/xml/rss-en-all' },
    ],
  },
  {
    code: 'DE', label: 'Germany', sources: [
      { name: 'DW News (EN)',  url: 'https://rss.dw.com/xml/rss-en-all' },
      { name: 'DW News (DE)',  url: 'https://rss.dw.com/rdf/rss-de-all' },
      { name: 'Der Spiegel',   url: 'https://www.spiegel.de/international/index.rss' },
      { name: 'Tagesschau',    url: 'https://www.tagesschau.de/xml/rss2' },
      { name: 'Die Zeit',      url: 'https://newsfeed.zeit.de/index' },
    ],
  },
  {
    code: 'FR', label: 'France', sources: [
      { name: 'France 24',   url: 'https://www.france24.com/en/rss' },
      { name: 'France 24 (France)', url: 'https://www.france24.com/en/france/rss' },
      { name: 'Le Monde',    url: 'https://www.lemonde.fr/rss/une.xml' },
      { name: 'RFI',         url: 'https://www.rfi.fr/en/rss' },
      { name: 'Le Figaro',   url: 'https://www.lefigaro.fr/rss/figaro_actualites.xml' },
    ],
  },
  {
    code: 'JP', label: 'Japan', sources: [
      { name: 'NHK World',      url: 'https://www3.nhk.or.jp/rss/news/cat0.xml' },
      { name: 'The Japan Times', url: 'https://www.japantimes.co.jp/feed/' },
      { name: 'Asahi Shimbun',  url: 'https://www.asahi.com/rss/asahi/newsheadlines.rdf' },
      { name: 'BBC News',       url: 'https://feeds.bbci.co.uk/news/world/asia/rss.xml' },
      { name: 'Al Jazeera',     url: 'https://www.aljazeera.com/xml/rss/all.xml' },
    ],
  },
  {
    code: 'CN', label: 'China', sources: [
      { name: 'Xinhua',    url: 'http://www.xinhuanet.com/english/rss/worldrss.xml' },
      { name: 'CGTN',      url: 'https://www.cgtn.com/subscribe/rss/section/world.xml' },
      { name: 'Global Times', url: 'https://www.globaltimes.cn/rss/outbrain.xml' },
      { name: 'South China Morning Post', url: 'https://www.scmp.com/rss/91/feed' },
      { name: 'BBC News (Asia)', url: 'https://feeds.bbci.co.uk/news/world/asia/rss.xml' },
    ],
  },
  {
    code: 'IN', label: 'India', sources: [
      { name: 'The Hindu',        url: 'https://www.thehindu.com/news/national/feeder/default.rss' },
      { name: 'Times of India',   url: 'https://timesofindia.indiatimes.com/rssfeeds/296589292.cms' },
      { name: 'NDTV',             url: 'https://feeds.feedburner.com/ndtvnews-top-stories' },
      { name: 'Hindustan Times',  url: 'https://www.hindustantimes.com/feeds/rss/india-news/rssfeed.xml' },
      { name: 'Indian Express',   url: 'https://indianexpress.com/section/india/feed/' },
    ],
  },
  {
    code: 'RU', label: 'Russia', sources: [
      { name: 'RT',          url: 'https://www.rt.com/rss/' },
      { name: 'BBC News (Europe)', url: 'https://feeds.bbci.co.uk/news/world/europe/rss.xml' },
      { name: 'Meduza (EN)', url: 'https://meduza.io/rss/en/all' },
      { name: 'The Moscow Times', url: 'https://www.themoscowtimes.com/rss/news' },
      { name: 'DW News',     url: 'https://rss.dw.com/xml/rss-en-all' },
    ],
  },
  {
    code: 'IL', label: 'Israel', sources: [
      { name: 'The Jerusalem Post', url: 'https://www.jpost.com/rss/rssfeedsfrontpage.aspx' },
      { name: 'Times of Israel',   url: 'https://www.timesofisrael.com/feed/' },
      { name: 'Ynetnews',          url: 'https://www.ynetnews.com/Integration/StoryRss3082.xml' },
      { name: 'BBC News (MidEast)', url: 'https://feeds.bbci.co.uk/news/world/middle_east/rss.xml' },
      { name: 'Al Jazeera',        url: 'https://www.aljazeera.com/xml/rss/all.xml' },
    ],
  },
  {
    code: 'AU', label: 'Australia', sources: [
      { name: 'ABC News AU', url: 'https://www.abc.net.au/news/feed/51120/rss.xml' },
      { name: 'The Guardian AU', url: 'https://www.theguardian.com/australia-news/rss' },
      { name: 'Sydney Morning Herald', url: 'https://www.smh.com.au/rss/feed.xml' },
      { name: 'BBC News (Australia)', url: 'https://feeds.bbci.co.uk/news/world/australia/rss.xml' },
      { name: 'DW News', url: 'https://rss.dw.com/xml/rss-en-all' },
    ],
  },
  {
    code: 'CA', label: 'Canada', sources: [
      { name: 'CBC News',    url: 'https://www.cbc.ca/cmlink/rss-topstories' },
      { name: 'Global News',  url: 'https://globalnews.ca/feed/' },
      { name: 'National Post', url: 'https://nationalpost.com/feed' },
      { name: 'BBC News (Canada)', url: 'https://feeds.bbci.co.uk/news/world/us_and_canada/rss.xml' },
      { name: 'DW News',      url: 'https://rss.dw.com/xml/rss-en-all' },
    ],
  },
  {
    code: 'BR', label: 'Brazil', sources: [
      { name: 'Folha de S.Paulo', url: 'https://feeds.folha.uol.com.br/emcimadahora/rss091.xml' },
      { name: 'G1',               url: 'https://g1.globo.com/rss/g1/' },
      { name: 'O Globo',          url: 'https://oglobo.globo.com/rss.xml' },
      { name: 'BBC Brasil',       url: 'https://www.bbc.com/portuguese/index.xml' },
      { name: 'BBC News (LatAm)', url: 'https://feeds.bbci.co.uk/news/world/latin_america/rss.xml' },
    ],
  },
  {
    code: 'ZA', label: 'South Africa', sources: [
      { name: 'Daily Maverick', url: 'https://www.dailymaverick.co.za/dmrss/' },
      { name: 'The Citizen',   url: 'https://www.citizen.co.za/feed/' },
      { name: 'BBC News (Africa)', url: 'https://feeds.bbci.co.uk/news/world/africa/rss.xml' },
      { name: 'Al Jazeera',    url: 'https://www.aljazeera.com/xml/rss/all.xml' },
      { name: 'DW News',       url: 'https://rss.dw.com/xml/rss-en-all' },
    ],
  },
  {
    code: 'UA', label: 'Ukraine', sources: [
      { name: 'Kyiv Post',        url: 'https://www.kyivpost.com/feed' },
      { name: 'Ukrinform',        url: 'https://www.ukrinform.net/rss/block-lastnews' },
      { name: 'Meduza (EN)',      url: 'https://meduza.io/rss/en/all' },
      { name: 'BBC News (Europe)', url: 'https://feeds.bbci.co.uk/news/world/europe/rss.xml' },
      { name: 'DW News',          url: 'https://rss.dw.com/xml/rss-en-all' },
    ],
  },
  {
    code: 'PL', label: 'Poland', sources: [
      { name: 'TVN24', url: 'https://tvn24.pl/najnowsze.xml', lang: 'pl' },
      { name: 'Polsat News', url: 'https://www.polsatnews.pl/rss/wszystkie.xml', lang: 'pl' },
      { name: 'RMF24', url: 'https://www.rmf24.pl/fakty/feed', lang: 'pl' },
      { name: 'Onet', url: 'https://wiadomosci.onet.pl/.feed', lang: 'pl' },
      { name: 'Notes from Poland', url: 'https://notesfrompoland.com/feed/' },
    ],
  },
  {
    code: 'IT', label: 'Italy', sources: [
      { name: 'La Repubblica', url: 'https://www.repubblica.it/rss/homepage/rss2.0.xml', lang: 'it' },
      { name: 'Il Fatto Quotidiano', url: 'https://www.ilfattoquotidiano.it/feed/', lang: 'it' },
      { name: 'Rai News', url: 'https://www.rainews.it/rss/tutti', lang: 'it' },
      { name: 'ANSA', url: 'https://www.ansa.it/sito/ansait_rss.xml', lang: 'it' },
      { name: 'Il Sole 24 Ore', url: 'https://www.ilsole24ore.com/rss/italia.xml', lang: 'it' },
    ],
  },
  {
    code: 'ES', label: 'Spain', sources: [
      { name: 'El País', url: 'https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/portada', lang: 'es' },
      { name: 'El Mundo', url: 'https://e00-elmundo.uecdn.es/elmundo/rss/portada.xml', lang: 'es' },
      { name: 'ABC', url: 'https://www.abc.es/rss/2.0/portada/', lang: 'es' },
      { name: '20minutos', url: 'https://www.20minutos.es/rss/', lang: 'es' },
      { name: 'La Vanguardia', url: 'https://www.lavanguardia.com/rss/home.xml', lang: 'es' },
    ],
  },
  {
    code: 'NL', label: 'Netherlands', sources: [
      { name: 'NOS', url: 'https://feeds.nos.nl/nosnieuwsalgemeen', lang: 'nl' },
      { name: 'NU.nl', url: 'https://www.nu.nl/rss/Algemeen', lang: 'nl' },
      { name: 'NRC', url: 'https://www.nrc.nl/rss/', lang: 'nl' },
      { name: 'de Volkskrant', url: 'https://www.volkskrant.nl/voorpagina/rss.xml', lang: 'nl' },
      { name: 'DutchNews.nl', url: 'https://www.dutchnews.nl/feed/' },
    ],
  },
  {
    code: 'BE', label: 'Belgium', sources: [
      { name: 'VRT NWS', url: 'https://www.vrt.be/vrtnws/nl.rss.articles.xml', lang: 'nl' },
      { name: 'RTBF', url: 'https://rss.rtbf.be/article/rss/highlight_rtbf_info.xml', lang: 'fr' },
      { name: 'BBC News (Europe)', url: 'https://feeds.bbci.co.uk/news/world/europe/rss.xml' },
    ],
  },
  {
    code: 'SE', label: 'Sweden', sources: [
      { name: 'SVT Nyheter', url: 'https://www.svt.se/nyheter/rss.xml', lang: 'sv' },
      { name: 'Dagens Nyheter', url: 'https://www.dn.se/rss/', lang: 'sv' },
      { name: 'Aftonbladet', url: 'https://rss.aftonbladet.se/rss2/small/pages/sections/senastenytt/', lang: 'sv' },
    ],
  },
  {
    code: 'NO', label: 'Norway', sources: [
      { name: 'NRK', url: 'https://www.nrk.no/toppsaker.rss', lang: 'no' },
      { name: 'VG', url: 'https://www.vg.no/rss/feed', lang: 'no' },
      { name: 'Aftenposten', url: 'https://www.aftenposten.no/rss', lang: 'no' },
    ],
  },
  {
    code: 'FI', label: 'Finland', sources: [
      { name: 'Yle Uutiset', url: 'https://yle.fi/rss/uutiset/paauutiset', lang: 'fi' },
      { name: 'BBC News (Europe)', url: 'https://feeds.bbci.co.uk/news/world/europe/rss.xml' },
    ],
  },
  {
    code: 'DK', label: 'Denmark', sources: [
      { name: 'DR Nyheder', url: 'https://www.dr.dk/nyheder/service/feeds/allenyheder', lang: 'da' },
      { name: 'Politiken', url: 'https://politiken.dk/rss/senestenyt.rss', lang: 'da' },
      { name: 'BBC News (Europe)', url: 'https://feeds.bbci.co.uk/news/world/europe/rss.xml' },
    ],
  },
  {
    code: 'CZ', label: 'Czechia', sources: [
      { name: 'iDNES.cz', url: 'https://servis.idnes.cz/rss.aspx?c=zpravodaj', lang: 'cs' },
      { name: 'Novinky.cz', url: 'https://www.novinky.cz/rss', lang: 'cs' },
      { name: 'ČT24', url: 'https://ct24.ceskatelevize.cz/rss/hlavni-zpravy', lang: 'cs' },
    ],
  },
  {
    code: 'RO', label: 'Romania', sources: [
      { name: 'Digi24', url: 'https://www.digi24.ro/rss', lang: 'ro' },
      { name: 'HotNews', url: 'https://hotnews.ro/feed', lang: 'ro' },
      { name: 'BBC News (Europe)', url: 'https://feeds.bbci.co.uk/news/world/europe/rss.xml' },
    ],
  },
  {
    code: 'HU', label: 'Hungary', sources: [
      { name: 'HVG', url: 'https://hvg.hu/rss', lang: 'hu' },
      { name: 'Hungary Today', url: 'https://hungarytoday.hu/feed/' },
      { name: 'Daily News Hungary', url: 'https://dailynewshungary.com/feed/' },
    ],
  },
  {
    code: 'GR', label: 'Greece', sources: [
      { name: 'in.gr', url: 'https://www.in.gr/feed/', lang: 'el' },
      { name: 'BBC News (Europe)', url: 'https://feeds.bbci.co.uk/news/world/europe/rss.xml' },
      { name: 'DW News', url: 'https://rss.dw.com/xml/rss-en-all' },
    ],
  },
  {
    code: 'PT', label: 'Portugal', sources: [
      { name: 'Observador', url: 'https://observador.pt/feed/', lang: 'pt' },
      { name: 'RTP Notícias', url: 'https://www.rtp.pt/noticias/rss', lang: 'pt' },
      { name: 'Público', url: 'https://feeds.feedburner.com/PublicoRSS', lang: 'pt' },
      { name: 'Portugal Resident', url: 'https://www.portugalresident.com/feed/' },
    ],
  },
  {
    code: 'AT', label: 'Austria', sources: [
      { name: 'ORF', url: 'https://rss.orf.at/news.xml', lang: 'de' },
      { name: 'Der Standard', url: 'https://www.derstandard.at/rss', lang: 'de' },
      { name: 'DW News', url: 'https://rss.dw.com/xml/rss-en-all' },
    ],
  },
  {
    code: 'CH', label: 'Switzerland', sources: [
      { name: 'SRF News', url: 'https://www.srf.ch/news/bnf/rss/1646', lang: 'de' },
      { name: 'NZZ', url: 'https://www.nzz.ch/recent.rss', lang: 'de' },
      { name: '20 Minuten', url: 'https://partner-feeds.20min.ch/rss/20minuten', lang: 'de' },
    ],
  },
  {
    code: 'IE', label: 'Ireland', sources: [
      { name: 'RTÉ News', url: 'https://www.rte.ie/feeds/rss/?index=/news/' },
      { name: 'TheJournal.ie', url: 'https://www.thejournal.ie/feed/' },
      { name: 'Irish Independent', url: 'https://www.independent.ie/rss' },
    ],
  },
  {
    code: 'LT', label: 'Lithuania', sources: [
      { name: 'LRT English', url: 'https://www.lrt.lt/en/news-in-english?rss' },
      { name: 'BBC News (Europe)', url: 'https://feeds.bbci.co.uk/news/world/europe/rss.xml' },
      { name: 'DW News', url: 'https://rss.dw.com/xml/rss-en-all' },
    ],
  },
  {
    code: 'LV', label: 'Latvia', sources: [
      { name: 'LSM English', url: 'https://eng.lsm.lv/rss/' },
      { name: 'BBC News (Europe)', url: 'https://feeds.bbci.co.uk/news/world/europe/rss.xml' },
      { name: 'DW News', url: 'https://rss.dw.com/xml/rss-en-all' },
    ],
  },
  {
    code: 'EE', label: 'Estonia', sources: [
      { name: 'ERR News', url: 'https://news.err.ee/rss' },
      { name: 'ERR', url: 'https://www.err.ee/rss', lang: 'et' },
      { name: 'BBC News (Europe)', url: 'https://feeds.bbci.co.uk/news/world/europe/rss.xml' },
    ],
  },
  {
    code: 'RS', label: 'Serbia', sources: [
      { name: 'N1', url: 'https://n1info.rs/feed/', lang: 'sr' },
      { name: 'B92', url: 'https://www.b92.net/info/rss/vesti.xml', lang: 'sr' },
      { name: 'RTS', url: 'https://www.rts.rs/page/stories/sr/rss.html', lang: 'sr' },
    ],
  },
  {
    code: 'HR', label: 'Croatia', sources: [
      { name: 'Index.hr', url: 'https://www.index.hr/rss', lang: 'hr' },
      { name: 'Total Croatia News', url: 'https://total-croatia-news.com/feed/' },
      { name: 'BBC News (Europe)', url: 'https://feeds.bbci.co.uk/news/world/europe/rss.xml' },
    ],
  },
  {
    code: 'GE', label: 'Georgia', sources: [
      { name: 'Civil.ge', url: 'https://civil.ge/feed' },
      { name: 'BBC News (Europe)', url: 'https://feeds.bbci.co.uk/news/world/europe/rss.xml' },
      { name: 'Al Jazeera', url: 'https://www.aljazeera.com/xml/rss/all.xml' },
    ],
  },
  {
    code: 'TR', label: 'Turkey', sources: [
      { name: 'Daily Sabah', url: 'https://www.dailysabah.com/rssFeed/10' },
      { name: 'Anadolu Agency', url: 'https://www.aa.com.tr/en/rss/default?cat=world' },
      { name: 'Hürriyet', url: 'https://www.hurriyet.com.tr/rss/gundem', lang: 'tr' },
      { name: 'BBC News (Europe)', url: 'https://feeds.bbci.co.uk/news/world/europe/rss.xml' },
    ],
  },
  {
    code: 'EG', label: 'Egypt', sources: [
      { name: 'Egypt Independent', url: 'https://www.egyptindependent.com/feed/' },
      { name: 'Daily News Egypt', url: 'https://www.dailynewsegypt.com/feed/' },
      { name: 'Mada Masr', url: 'https://www.madamasr.com/en/feed/' },
      { name: 'Al Jazeera', url: 'https://www.aljazeera.com/xml/rss/all.xml' },
    ],
  },
  {
    code: 'SA', label: 'Saudi Arabia', sources: [
      { name: 'Arab News', url: 'https://www.arabnews.com/rss.xml' },
      { name: 'BBC News (Middle East)', url: 'https://feeds.bbci.co.uk/news/world/middle_east/rss.xml' },
      { name: 'Al Jazeera', url: 'https://www.aljazeera.com/xml/rss/all.xml' },
    ],
  },
  {
    code: 'IR', label: 'Iran', sources: [
      { name: 'Tehran Times', url: 'https://www.tehrantimes.com/rss' },
      { name: 'BBC News (Middle East)', url: 'https://feeds.bbci.co.uk/news/world/middle_east/rss.xml' },
      { name: 'Al Jazeera', url: 'https://www.aljazeera.com/xml/rss/all.xml' },
    ],
  },
  {
    code: 'MX', label: 'Mexico', sources: [
      { name: 'La Jornada', url: 'https://www.jornada.com.mx/rss/edicion.xml', lang: 'es' },
      { name: 'Mexico News Daily', url: 'https://mexiconewsdaily.com/feed/' },
      { name: 'BBC News (LatAm)', url: 'https://feeds.bbci.co.uk/news/world/latin_america/rss.xml' },
    ],
  },
  {
    code: 'AR', label: 'Argentina', sources: [
      { name: 'Infobae', url: 'https://www.infobae.com/arc/outboundfeeds/rss/', lang: 'es' },
      { name: 'Clarín', url: 'https://www.clarin.com/rss/lo-ultimo/', lang: 'es' },
      { name: 'La Nación', url: 'https://www.lanacion.com.ar/arc/outboundfeeds/rss/', lang: 'es' },
      { name: 'Buenos Aires Times', url: 'https://www.batimes.com.ar/feed' },
    ],
  },
  {
    code: 'CO', label: 'Colombia', sources: [
      { name: 'Semana', url: 'https://www.semana.com/arc/outboundfeeds/rss/', lang: 'es' },
      { name: 'El Tiempo', url: 'https://www.eltiempo.com/rss/colombia.xml', lang: 'es' },
      { name: 'BBC News (LatAm)', url: 'https://feeds.bbci.co.uk/news/world/latin_america/rss.xml' },
    ],
  },
  {
    code: 'VE', label: 'Venezuela', sources: [
      { name: 'El Nacional', url: 'https://www.elnacional.com/feed/', lang: 'es' },
      { name: 'BBC News (LatAm)', url: 'https://feeds.bbci.co.uk/news/world/latin_america/rss.xml' },
      { name: 'Al Jazeera', url: 'https://www.aljazeera.com/xml/rss/all.xml' },
    ],
  },
  {
    code: 'PK', label: 'Pakistan', sources: [
      { name: 'Dawn', url: 'https://www.dawn.com/feeds/home' },
      { name: 'The Express Tribune', url: 'https://tribune.com.pk/feed/home' },
      { name: 'BBC News (Asia)', url: 'https://feeds.bbci.co.uk/news/world/asia/rss.xml' },
    ],
  },
  {
    code: 'ID', label: 'Indonesia', sources: [
      { name: 'Tempo', url: 'https://rss.tempo.co/', lang: 'id' },
      { name: 'BBC News (Asia)', url: 'https://feeds.bbci.co.uk/news/world/asia/rss.xml' },
      { name: 'Al Jazeera', url: 'https://www.aljazeera.com/xml/rss/all.xml' },
    ],
  },
  {
    code: 'PH', label: 'Philippines', sources: [
      { name: 'Philippine Daily Inquirer', url: 'https://www.inquirer.net/fullfeed' },
      { name: 'Rappler', url: 'https://www.rappler.com/feed/' },
      { name: 'The Philippine Star', url: 'https://www.philstar.com/rss/headlines' },
      { name: 'GMA News', url: 'https://data.gmanetwork.com/gno/rss/news/feed.xml' },
    ],
  },
  {
    code: 'TH', label: 'Thailand', sources: [
      { name: 'Bangkok Post', url: 'https://www.bangkokpost.com/rss/data/topstories.xml' },
      { name: 'BBC News (Asia)', url: 'https://feeds.bbci.co.uk/news/world/asia/rss.xml' },
      { name: 'Al Jazeera', url: 'https://www.aljazeera.com/xml/rss/all.xml' },
    ],
  },
  {
    code: 'MY', label: 'Malaysia', sources: [
      { name: 'Malay Mail', url: 'https://www.malaymail.com/feed/rss/malaysia' },
      { name: 'BBC News (Asia)', url: 'https://feeds.bbci.co.uk/news/world/asia/rss.xml' },
      { name: 'Al Jazeera', url: 'https://www.aljazeera.com/xml/rss/all.xml' },
    ],
  },
  {
    code: 'VN', label: 'Vietnam', sources: [
      { name: 'Vietnam News', url: 'https://vietnamnews.vn/rss/politics-laws.rss' },
      { name: 'BBC News (Asia)', url: 'https://feeds.bbci.co.uk/news/world/asia/rss.xml' },
      { name: 'Al Jazeera', url: 'https://www.aljazeera.com/xml/rss/all.xml' },
    ],
  },
  {
    code: 'SG', label: 'Singapore', sources: [
      { name: 'The Straits Times', url: 'https://www.straitstimes.com/news/world/rss.xml' },
      { name: 'CNA', url: 'https://www.channelnewsasia.com/api/v1/rss-outbound-feed?_format=xml' },
      { name: 'BBC News (Asia)', url: 'https://feeds.bbci.co.uk/news/world/asia/rss.xml' },
    ],
  },
  {
    code: 'TW', label: 'Taiwan', sources: [
      { name: 'Taipei Times', url: 'https://www.taipeitimes.com/xml/index.rss' },
      { name: 'BBC News (Asia)', url: 'https://feeds.bbci.co.uk/news/world/asia/rss.xml' },
      { name: 'Al Jazeera', url: 'https://www.aljazeera.com/xml/rss/all.xml' },
    ],
  },
  {
    code: 'KR', label: 'South Korea', sources: [
      { name: 'Yonhap', url: 'https://en.yna.co.kr/RSS/news.xml' },
      { name: 'The Korea Times', url: 'https://feed.koreatimes.co.kr/k/world.xml' },
      { name: 'Chosun Ilbo', url: 'https://www.chosun.com/arc/outboundfeeds/rss/?outputType=xml', lang: 'ko' },
      { name: 'BBC News (Asia)', url: 'https://feeds.bbci.co.uk/news/world/asia/rss.xml' },
    ],
  },
  {
    code: 'KZ', label: 'Kazakhstan', sources: [
      { name: 'The Astana Times', url: 'https://astanatimes.com/feed/' },
      { name: 'BBC News (Asia)', url: 'https://feeds.bbci.co.uk/news/world/asia/rss.xml' },
      { name: 'Al Jazeera', url: 'https://www.aljazeera.com/xml/rss/all.xml' },
    ],
  },
  {
    code: 'NZ', label: 'New Zealand', sources: [
      { name: 'RNZ', url: 'https://www.rnz.co.nz/rss/national.xml' },
      { name: 'NZ Herald', url: 'https://www.nzherald.co.nz/arc/outboundfeeds/rss/section/nz/?outputType=xml' },
      { name: 'Stuff', url: 'https://www.stuff.co.nz/rss' },
    ],
  },
  {
    code: 'NG', label: 'Nigeria', sources: [
      { name: 'Punch', url: 'https://rss.punchng.com/v1/category/latest_news' },
      { name: 'Premium Times', url: 'https://www.premiumtimesng.com/feed' },
      { name: 'Vanguard', url: 'https://www.vanguardngr.com/feed/' },
      { name: 'Channels TV', url: 'https://www.channelstv.com/feed/' },
    ],
  },
  {
    code: 'KE', label: 'Kenya', sources: [
      { name: 'Nation', url: 'https://nation.africa/kenya/rss.xml' },
      { name: 'The Standard', url: 'https://www.standardmedia.co.ke/rss/headlines.php' },
      { name: 'BBC News (Africa)', url: 'https://feeds.bbci.co.uk/news/world/africa/rss.xml' },
    ],
  },
  {
    code: 'GH', label: 'Ghana', sources: [
      { name: 'Graphic Online', url: 'https://www.graphic.com.gh/news/general-news.feed?type=rss' },
      { name: 'MyJoyOnline', url: 'https://www.myjoyonline.com/feed/' },
      { name: 'BBC News (Africa)', url: 'https://feeds.bbci.co.uk/news/world/africa/rss.xml' },
    ],
  },
]

export function getCountryNewsSources(code: string): CountryNewsSource[] {
  return (COUNTRY_NEWS_SOURCES.find(c => c.code === code) ?? COUNTRY_NEWS_SOURCES[0]).sources
}

// ── CrisisWatch (International Crisis Group) ──────────────────────────────────
// Monthly conflict monitoring across 70+ countries — no API key required
export const CRISISWATCH_FEEDS = [
  { url: 'https://www.crisisgroup.org/rss.xml',          name: 'CrisisWatch',     region: 'Global'  },
  { url: 'https://www.crisisgroup.org/rss/1',            name: 'ICG Africa',      region: 'Africa'  },
  { url: 'https://www.crisisgroup.org/rss/30',           name: 'ICG Asia',        region: 'Asia'    },
  { url: 'https://www.crisisgroup.org/rss/56',           name: 'ICG Europe',      region: 'Europe'  },
  { url: 'https://www.crisisgroup.org/rss/81',           name: 'ICG MENA',        region: 'MENA'    },
  { url: 'https://www.crisisgroup.org/rss/73',           name: 'ICG LatAm',       region: 'LatAm'   },
]
