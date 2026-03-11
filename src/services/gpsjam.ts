/**
 * GPS Jamming & Spoofing — Known interference zones.
 * Sources: Eurocontrol GPS interference reports, OPSGROUP advisories,
 * C4ADS "Above Us Only Stars" report, aviation NOTAMs, OSINT monitoring.
 *
 * Data represents persistent/recurring interference zones as of 2024-2025.
 * Severity: intensity of interference (high = denial of service, medium = degraded accuracy).
 * Radius in km.
 */

export interface GPSJamZone {
  id:        string
  name:      string
  lat:       number
  lng:       number
  radius:    number   // km
  severity:  'high' | 'medium' | 'low'
  type:      'jamming' | 'spoofing' | 'both'
  source:    string   // attribution
  region:    string
  notes:     string
  active:    boolean
}

export const SEVERITY_COLORS: Record<GPSJamZone['severity'], string> = {
  high:   '#ff2244',
  medium: '#ff8800',
  low:    '#ffcc00',
}

export const TYPE_LABELS: Record<GPSJamZone['type'], string> = {
  jamming:  'JAMMING',
  spoofing: 'SPOOFING',
  both:     'JAM + SPOOF',
}

// ── Comprehensive global GPS interference zones ─────────────────────────────
export const GPS_JAM_ZONES: GPSJamZone[] = [
  // ═══════════════ EASTERN MEDITERRANEAN / BLACK SEA ═══════════════
  {
    id: 'ru-kaliningrad', name: 'Kaliningrad', lat: 54.71, lng: 20.51, radius: 450,
    severity: 'high', type: 'both', source: 'Eurocontrol / Baltic NOTAM',
    region: 'Baltic', notes: 'Persistent Russian EW systems. Affects Baltic airspace, Poland, Lithuania, Latvia. Active since 2018.', active: true,
  },
  {
    id: 'ru-stpetersburg', name: 'St. Petersburg / Kremlin Zone', lat: 59.93, lng: 30.32, radius: 350,
    severity: 'high', type: 'spoofing', source: 'C4ADS / OPSGROUP',
    region: 'Russia', notes: 'GPS spoofing around government facilities. Aircraft report false positions near airports.', active: true,
  },
  {
    id: 'ru-moscow', name: 'Moscow', lat: 55.75, lng: 37.62, radius: 400,
    severity: 'high', type: 'spoofing', source: 'C4ADS "Above Us Only Stars"',
    region: 'Russia', notes: 'Systematic spoofing around the Kremlin. Aircraft GNSS shows positions at Vnukovo airport.', active: true,
  },
  {
    id: 'ua-east', name: 'Eastern Ukraine', lat: 48.50, lng: 37.80, radius: 600,
    severity: 'high', type: 'both', source: 'Eurocontrol / OPSGROUP',
    region: 'Ukraine', notes: 'Active conflict zone. Dense Russian and Ukrainian EW activity. Full GPS denial in frontline areas.', active: true,
  },
  {
    id: 'ua-crimea', name: 'Crimea / Black Sea', lat: 44.95, lng: 34.10, radius: 500,
    severity: 'high', type: 'both', source: 'Eurocontrol / NATO',
    region: 'Black Sea', notes: 'Russian military GPS denial. Affects maritime and aviation. Extends over Black Sea.', active: true,
  },
  {
    id: 'tr-cyprus-east', name: 'Eastern Mediterranean / Cyprus', lat: 35.20, lng: 33.90, radius: 450,
    severity: 'high', type: 'spoofing', source: 'Eurocontrol / EASA SIB 2019-01',
    region: 'E. Mediterranean', notes: 'Spoofing events affecting Nicosia FIR. Aircraft GPS shows false position in Lebanon/Syria. Persistent since 2019.', active: true,
  },
  {
    id: 'sy-northwest', name: 'Northwest Syria / Khmeimim', lat: 35.41, lng: 35.95, radius: 500,
    severity: 'high', type: 'both', source: 'Eurocontrol / OPSGROUP',
    region: 'Syria', notes: 'Russian Krasukha-4 and other EW systems at Khmeimim AB. Major interference source for Eastern Med.', active: true,
  },
  {
    id: 'sy-damascus', name: 'Damascus', lat: 33.51, lng: 36.28, radius: 280,
    severity: 'medium', type: 'jamming', source: 'Eurocontrol',
    region: 'Syria', notes: 'Government military EW. Affects Beirut FIR approaches.', active: true,
  },
  {
    id: 'il-north', name: 'Northern Israel / Golan', lat: 33.00, lng: 35.75, radius: 350,
    severity: 'high', type: 'spoofing', source: 'OPSGROUP / Israeli NOTAM',
    region: 'Middle East', notes: 'IDF GPS spoofing for drone defense. Ben Gurion approaches affected. Aircraft GPS shows Cairo/Beirut.', active: true,
  },
  {
    id: 'il-south', name: 'Southern Israel / Gaza', lat: 31.35, lng: 34.35, radius: 300,
    severity: 'high', type: 'both', source: 'OPSGROUP',
    region: 'Middle East', notes: 'Active conflict zone. IDF EW + militant GPS interference. Affects Sinai overflight.', active: true,
  },
  {
    id: 'iq-baghdad', name: 'Baghdad / Central Iraq', lat: 33.31, lng: 44.37, radius: 380,
    severity: 'medium', type: 'jamming', source: 'OPSGROUP / US CENTCOM',
    region: 'Middle East', notes: 'Intermittent jamming from militia and state actors. Affects overflying traffic.', active: true,
  },
  {
    id: 'ir-west', name: 'Western Iran', lat: 33.50, lng: 48.35, radius: 500,
    severity: 'medium', type: 'both', source: 'OPSGROUP',
    region: 'Middle East', notes: 'IRGC GPS spoofing capability. Used for drone capture. Affects Iraq/Persian Gulf FIR.', active: true,
  },
  {
    id: 'ir-hormuz', name: 'Strait of Hormuz', lat: 26.56, lng: 56.25, radius: 400,
    severity: 'high', type: 'spoofing', source: 'US Maritime Admin / NATO',
    region: 'Persian Gulf', notes: 'IRGC spoofing of maritime vessels. Ships report GPS positions on land/in Iran. Well-documented.', active: true,
  },

  // ═══════════════ NORTH AFRICA / SAHEL ═══════════════
  {
    id: 'ly-tripoli', name: 'Tripoli / Western Libya', lat: 32.90, lng: 13.18, radius: 450,
    severity: 'high', type: 'both', source: 'Eurocontrol / UN Panel of Experts',
    region: 'N. Africa', notes: 'Russian Wagner Group / LNA forces EW. Affects Central Med aviation. Active since 2019 civil war.', active: true,
  },
  {
    id: 'ly-east', name: 'Eastern Libya / Benghazi', lat: 32.10, lng: 20.07, radius: 380,
    severity: 'medium', type: 'jamming', source: 'UN / OPSGROUP',
    region: 'N. Africa', notes: 'LNA military EW near Benghazi and Al Jufra AB. Intermittent.', active: true,
  },
  {
    id: 'eg-sinai', name: 'Sinai Peninsula', lat: 29.90, lng: 33.80, radius: 320,
    severity: 'medium', type: 'jamming', source: 'Egyptian MoD / OPSGROUP',
    region: 'Middle East', notes: 'Egyptian military counter-terrorism EW. Affects Sharm el-Sheikh approaches.', active: true,
  },
  {
    id: 'dz-south', name: 'Southern Algeria / Sahel', lat: 27.88, lng: 0.28, radius: 500,
    severity: 'low', type: 'jamming', source: 'OPSGROUP',
    region: 'N. Africa', notes: 'Military operations against militant groups. Sporadic interference.', active: true,
  },

  // ═══════════════ CAUCASUS / CENTRAL ASIA ═══════════════
  {
    id: 'ge-south', name: 'South Ossetia / Georgia', lat: 42.23, lng: 43.97, radius: 250,
    severity: 'medium', type: 'jamming', source: 'Georgian MoD',
    region: 'Caucasus', notes: 'Russian military EW near occupied territories. Affects Tbilisi FIR.', active: true,
  },
  {
    id: 'am-az', name: 'Armenia-Azerbaijan border', lat: 40.10, lng: 44.50, radius: 300,
    severity: 'medium', type: 'jamming', source: 'OPSGROUP',
    region: 'Caucasus', notes: 'Military EW from both sides. Nagorno-Karabakh conflict legacy. Intermittent.', active: true,
  },

  // ═══════════════ EAST ASIA ═══════════════
  {
    id: 'kp-pyongyang', name: 'North Korea / DMZ', lat: 38.90, lng: 125.75, radius: 500,
    severity: 'high', type: 'jamming', source: 'South Korean MoD / US Forces Korea',
    region: 'East Asia', notes: 'DPRK GPS jamming from Kaesong/Haeju. Affects Seoul Incheon. 100+ incidents documented since 2010.', active: true,
  },
  {
    id: 'cn-south-sea', name: 'South China Sea / Spratly', lat: 10.50, lng: 114.00, radius: 700,
    severity: 'medium', type: 'spoofing', source: 'C4ADS / SkyTruth',
    region: 'East Asia', notes: 'Chinese military spoofing near artificial islands. Affects maritime navigation and fishing fleets.', active: true,
  },
  {
    id: 'cn-shanghai', name: 'Shanghai Port', lat: 31.23, lng: 121.47, radius: 180,
    severity: 'medium', type: 'spoofing', source: 'C4ADS / US Maritime Admin',
    region: 'East Asia', notes: 'Mysterious spoofing circles at Huangpu River. Ships report GPS position jumping in circles. Since 2019.', active: true,
  },
  {
    id: 'tw-strait', name: 'Taiwan Strait', lat: 24.50, lng: 118.50, radius: 450,
    severity: 'medium', type: 'jamming', source: 'Taiwan MoD / OPSGROUP',
    region: 'East Asia', notes: 'PLA EW exercises. Intermittent during military drills. Increasing frequency since 2022.', active: true,
  },

  // ═══════════════ SOUTH / SOUTHEAST ASIA ═══════════════
  {
    id: 'in-kashmir', name: 'Kashmir / LoC', lat: 34.10, lng: 74.80, radius: 380,
    severity: 'medium', type: 'jamming', source: 'Indian MoD',
    region: 'South Asia', notes: 'Indian and Pakistani military EW along Line of Control. Affects Srinagar approaches.', active: true,
  },
  {
    id: 'in-ladakh', name: 'Ladakh / LAC', lat: 34.55, lng: 77.60, radius: 350,
    severity: 'medium', type: 'jamming', source: 'Indian MoD / OPSGROUP',
    region: 'South Asia', notes: 'India-China border standoff. PLA and Indian Army EW. Intermittent since 2020.', active: true,
  },
  {
    id: 'mm-north', name: 'Northern Myanmar', lat: 23.50, lng: 97.50, radius: 350,
    severity: 'low', type: 'jamming', source: 'OPSGROUP',
    region: 'Southeast Asia', notes: 'Myanmar military EW in civil war zones. Affects overflying traffic.', active: true,
  },

  // ═══════════════ EUROPE ═══════════════
  {
    id: 'no-finnmark', name: 'Northern Norway / Finnmark', lat: 70.07, lng: 25.05, radius: 400,
    severity: 'high', type: 'jamming', source: 'Norwegian MoD / NATO',
    region: 'Arctic', notes: 'Russian jamming from Kola Peninsula. Affects Norwegian/Finnish Arctic airspace. NATO exercises disrupted.', active: true,
  },
  {
    id: 'fi-east', name: 'Eastern Finland', lat: 63.50, lng: 29.00, radius: 350,
    severity: 'medium', type: 'jamming', source: 'Finnish Transport Agency',
    region: 'Nordic', notes: 'Spillover from Russian EW. Affects Finnish eastern border aviation.', active: true,
  },
  {
    id: 'ee-east', name: 'Estonia / Latvia border', lat: 57.90, lng: 27.50, radius: 280,
    severity: 'medium', type: 'jamming', source: 'Estonian MoD / NATO',
    region: 'Baltic', notes: 'Russian EW from Pskov. Intermittent jamming affecting Baltic approaches.', active: true,
  },
  {
    id: 'pl-east', name: 'Eastern Poland', lat: 51.90, lng: 23.50, radius: 320,
    severity: 'medium', type: 'jamming', source: 'Polish MoD / Eurocontrol',
    region: 'Europe', notes: 'Spillover from Belarus/Kaliningrad Russian EW. Affects Lublin/Rzeszow approaches.', active: true,
  },

  // ═══════════════ AFRICA ═══════════════
  {
    id: 'ml-north', name: 'Northern Mali', lat: 18.00, lng: -1.00, radius: 500,
    severity: 'medium', type: 'jamming', source: 'French MoD / MINUSMA',
    region: 'Sahel', notes: 'Wagner Group / Malian military EW. Formerly French Barkhane AO. Affects Sahel overflights.', active: true,
  },
  {
    id: 'sd-khartoum', name: 'Sudan / Khartoum', lat: 15.50, lng: 32.56, radius: 400,
    severity: 'medium', type: 'jamming', source: 'OPSGROUP',
    region: 'E. Africa', notes: 'Civil war EW. Both SAF and RSF using jamming. Affects overflying traffic.', active: true,
  },
  {
    id: 'et-tigray', name: 'Tigray / Northern Ethiopia', lat: 13.50, lng: 39.50, radius: 350,
    severity: 'low', type: 'jamming', source: 'OPSGROUP',
    region: 'E. Africa', notes: 'Residual interference from Tigray conflict. Reduced since 2022 ceasefire.', active: false,
  },

  // ═══════════════ AMERICAS ═══════════════
  {
    id: 'mx-cartel', name: 'Western Mexico / Sinaloa-Jalisco', lat: 23.00, lng: -105.00, radius: 380,
    severity: 'low', type: 'jamming', source: 'Mexican MoD / FAA',
    region: 'N. America', notes: 'Cartel GPS jamming to defeat surveillance drones. Affects Mazatlan/Guadalajara approaches.', active: true,
  },
  {
    id: 'co-border', name: 'Colombia-Venezuela border', lat: 7.50, lng: -72.50, radius: 300,
    severity: 'low', type: 'jamming', source: 'Colombian Air Force',
    region: 'S. America', notes: 'Counter-narcotics and guerrilla EW. Sporadic.', active: true,
  },
]
