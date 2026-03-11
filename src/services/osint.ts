// ── OSINT lookup service ───────────────────────────────────────────────────
// Detects query type and queries public APIs / generates search links.
// Email: EmailRep.io (free, proxied via /api/emailrep)
// Phone: client-side country-code parsing (no external API needed)
// Name:  generates links to public people-search directories

export type OSINTQueryType = 'email' | 'phone' | 'name'

export function detectQueryType(q: string): OSINTQueryType {
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(q)) return 'email'
  if (/^[\+\d\s\-\.\(\)]{6,20}$/.test(q))   return 'phone'
  return 'name'
}

// ── Email lookup ───────────────────────────────────────────────────────────
export interface EmailRepResult {
  email: string
  reputation: string  // 'high' | 'medium' | 'low' | 'none'
  suspicious: boolean
  references: number
  details: {
    blacklisted:               boolean
    malicious_activity:        boolean
    malicious_activity_recent: boolean
    credentials_leaked:        boolean
    credentials_leaked_recent: boolean
    data_breach:               boolean
    first_seen:                string
    last_seen:                 string
    domain_exists:             boolean
    domain_reputation:         string
    new_domain:                boolean
    days_since_domain_creation:number
    suspicious_tld:            boolean
    spam:                      boolean
    free_provider:             boolean
    disposable:                boolean
    deliverable:               boolean
    accept_all:                boolean
    valid_mx:                  boolean
    primary_mx:                string
    spam_list:                 boolean
    profiles:                  string[]
  }
}

export async function lookupEmail(email: string): Promise<EmailRepResult | null> {
  try {
    const res = await fetch(`/api/emailrep/${encodeURIComponent(email.toLowerCase())}`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(8_000),
    })
    if (!res.ok) return null
    return (await res.json()) as EmailRepResult
  } catch {
    return null
  }
}

// ── Phone parsing ──────────────────────────────────────────────────────────
export interface PhoneInfo {
  raw:         string
  normalized:  string
  countryCode: string
  country:     string
  type:        string
  valid:       boolean
}

const COUNTRY_CODES: [string, string][] = [
  // longer codes first to match greedily
  ['+1242', 'Bahamas'], ['+1246', 'Barbados'], ['+1264', 'Anguilla'],
  ['+1268', 'Antigua & Barbuda'], ['+1284', 'British Virgin Islands'],
  ['+1345', 'Cayman Islands'], ['+1441', 'Bermuda'], ['+1473', 'Grenada'],
  ['+1649', 'Turks & Caicos'], ['+1664', 'Montserrat'], ['+1721', 'Sint Maarten'],
  ['+1758', 'Saint Lucia'], ['+1767', 'Dominica'], ['+1784', 'Saint Vincent'],
  ['+1787', 'Puerto Rico'], ['+1809', 'Dominican Republic'], ['+1868', 'Trinidad & Tobago'],
  ['+1869', 'Saint Kitts & Nevis'], ['+1876', 'Jamaica'],
  ['+380', 'Ukraine'], ['+351', 'Portugal'], ['+353', 'Ireland'], ['+354', 'Iceland'],
  ['+355', 'Albania'], ['+356', 'Malta'], ['+358', 'Finland'], ['+359', 'Bulgaria'],
  ['+370', 'Lithuania'], ['+371', 'Latvia'], ['+372', 'Estonia'], ['+373', 'Moldova'],
  ['+374', 'Armenia'], ['+375', 'Belarus'], ['+376', 'Andorra'], ['+377', 'Monaco'],
  ['+381', 'Serbia'], ['+382', 'Montenegro'], ['+385', 'Croatia'], ['+386', 'Slovenia'],
  ['+387', 'Bosnia & Herzegovina'], ['+389', 'North Macedonia'],
  ['+420', 'Czech Republic'], ['+421', 'Slovakia'], ['+423', 'Liechtenstein'],
  ['+852', 'Hong Kong'], ['+853', 'Macau'], ['+855', 'Cambodia'], ['+856', 'Laos'],
  ['+880', 'Bangladesh'], ['+886', 'Taiwan'],
  ['+960', 'Maldives'], ['+961', 'Lebanon'], ['+962', 'Jordan'], ['+963', 'Syria'],
  ['+964', 'Iraq'], ['+965', 'Kuwait'], ['+966', 'Saudi Arabia'], ['+967', 'Yemen'],
  ['+968', 'Oman'], ['+970', 'Palestine'], ['+971', 'UAE'], ['+972', 'Israel'],
  ['+973', 'Bahrain'], ['+974', 'Qatar'], ['+975', 'Bhutan'], ['+976', 'Mongolia'],
  ['+977', 'Nepal'], ['+992', 'Tajikistan'], ['+993', 'Turkmenistan'],
  ['+994', 'Azerbaijan'], ['+995', 'Georgia'], ['+996', 'Kyrgyzstan'], ['+998', 'Uzbekistan'],
  ['+212', 'Morocco'], ['+213', 'Algeria'], ['+216', 'Tunisia'], ['+218', 'Libya'],
  ['+220', 'Gambia'], ['+221', 'Senegal'], ['+222', 'Mauritania'], ['+223', 'Mali'],
  ['+224', 'Guinea'], ['+225', 'Ivory Coast'], ['+226', 'Burkina Faso'], ['+227', 'Niger'],
  ['+228', 'Togo'], ['+229', 'Benin'], ['+230', 'Mauritius'], ['+231', 'Liberia'],
  ['+232', 'Sierra Leone'], ['+233', 'Ghana'], ['+234', 'Nigeria'], ['+235', 'Chad'],
  ['+236', 'Central African Republic'], ['+237', 'Cameroon'], ['+238', 'Cape Verde'],
  ['+239', 'São Tomé & Príncipe'], ['+240', 'Equatorial Guinea'], ['+241', 'Gabon'],
  ['+242', 'Republic of Congo'], ['+243', 'DR Congo'], ['+244', 'Angola'],
  ['+245', 'Guinea-Bissau'], ['+249', 'Sudan'], ['+250', 'Rwanda'],
  ['+251', 'Ethiopia'], ['+252', 'Somalia'], ['+253', 'Djibouti'], ['+254', 'Kenya'],
  ['+255', 'Tanzania'], ['+256', 'Uganda'], ['+257', 'Burundi'], ['+258', 'Mozambique'],
  ['+260', 'Zambia'], ['+261', 'Madagascar'], ['+262', 'Réunion'],
  ['+263', 'Zimbabwe'], ['+264', 'Namibia'], ['+265', 'Malawi'], ['+266', 'Lesotho'],
  ['+267', 'Botswana'], ['+268', 'Eswatini'], ['+269', 'Comoros'],
  ['+27', 'South Africa'],
  ['+1', 'USA / Canada'],
  ['+7', 'Russia / Kazakhstan'],
  ['+20', 'Egypt'], ['+30', 'Greece'], ['+31', 'Netherlands'], ['+32', 'Belgium'],
  ['+33', 'France'], ['+34', 'Spain'], ['+36', 'Hungary'], ['+39', 'Italy'],
  ['+40', 'Romania'], ['+41', 'Switzerland'], ['+43', 'Austria'], ['+44', 'United Kingdom'],
  ['+45', 'Denmark'], ['+46', 'Sweden'], ['+47', 'Norway'], ['+48', 'Poland'],
  ['+49', 'Germany'], ['+51', 'Peru'], ['+52', 'Mexico'], ['+53', 'Cuba'],
  ['+54', 'Argentina'], ['+55', 'Brazil'], ['+56', 'Chile'], ['+57', 'Colombia'],
  ['+58', 'Venezuela'], ['+60', 'Malaysia'], ['+61', 'Australia'], ['+62', 'Indonesia'],
  ['+63', 'Philippines'], ['+64', 'New Zealand'], ['+65', 'Singapore'],
  ['+66', 'Thailand'], ['+81', 'Japan'], ['+82', 'South Korea'], ['+84', 'Vietnam'],
  ['+86', 'China'], ['+90', 'Turkey'], ['+91', 'India'], ['+92', 'Pakistan'],
  ['+93', 'Afghanistan'], ['+94', 'Sri Lanka'], ['+95', 'Myanmar'], ['+98', 'Iran'],
]

export function parsePhone(raw: string): PhoneInfo {
  const stripped = raw.replace(/[^\d+]/g, '')
  const normalized = stripped.startsWith('+')   ? stripped
                   : stripped.startsWith('00')  ? '+' + stripped.slice(2)
                   : '+' + stripped

  for (const [code, country] of COUNTRY_CODES) {
    if (normalized.startsWith(code)) {
      const local = normalized.slice(code.length)
      return {
        raw, normalized,
        countryCode: code, country,
        type: local.length >= 9 ? 'Mobile / Fixed' : local.length >= 5 ? 'Short' : 'Unknown',
        valid: local.length >= 6 && local.length <= 12,
      }
    }
  }
  return { raw, normalized, countryCode: '', country: 'Unknown', type: 'Unknown', valid: false }
}

// ── Name search links ──────────────────────────────────────────────────────
export interface NameSearchLink {
  label: string
  color: string
  url:   string
  desc:  string
}

export function getNameSearchLinks(name: string): NameSearchLink[] {
  const enc     = encodeURIComponent(name)
  const encQ    = encodeURIComponent(`"${name}"`)
  const slug    = name.toLowerCase().replace(/\s+/g, '-')
  const parts   = name.trim().split(/\s+/)
  const first   = encodeURIComponent(parts[0] ?? '')
  const last    = encodeURIComponent(parts.slice(1).join(' '))
  return [
    { label: 'Google',           color: '#4285f4', url: `https://www.google.com/search?q=${encQ}`,                                                         desc: 'General web search' },
    { label: 'LinkedIn',         color: '#0a66c2', url: `https://www.linkedin.com/search/results/people/?keywords=${enc}`,                                  desc: 'Professional network' },
    { label: 'Twitter / X',      color: '#1da1f2', url: `https://twitter.com/search?q=${enc}&f=user`,                                                       desc: 'Social media' },
    { label: 'Facebook',         color: '#1877f2', url: `https://www.facebook.com/search/people/?q=${enc}`,                                                 desc: 'Social media' },
    { label: 'Instagram',        color: '#e1306c', url: `https://www.google.com/search?q=instagram+${enc}`,                                                 desc: 'Instagram search via Google' },
    { label: 'TikTok',           color: '#ff0050', url: `https://www.tiktok.com/search/user?q=${enc}`,                                                      desc: 'TikTok users' },
    { label: 'Pipl',             color: '#ff4400', url: `https://pipl.com/search/?q=${enc}`,                                                                desc: 'People search engine' },
    { label: 'Spokeo',           color: '#ff6b35', url: `https://www.spokeo.com/${slug}`,                                                                   desc: 'People finder' },
    { label: 'WhitePages',       color: '#007bff', url: `https://www.whitepages.com/name/${slug}`,                                                          desc: 'US public directory' },
    { label: 'BeenVerified',     color: '#25a244', url: `https://www.beenverified.com/people/search/?firstName=${first}&lastName=${last}`,                  desc: 'Background check' },
    { label: 'TruePeopleSearch', color: '#e11d48', url: `https://www.truepeoplesearch.com/results?name=${enc}`,                                             desc: 'Free people directory' },
    { label: 'FastPeopleSearch', color: '#f59e0b', url: `https://www.fastpeoplesearch.com/name/${slug}`,                                                    desc: 'Free people search' },
    { label: 'PeekYou',          color: '#6366f1', url: `https://www.peekyou.com/${name.toLowerCase().replace(/\s+/g, '_')}`,                               desc: 'Social search' },
    { label: 'Intelius',         color: '#8b5cf6', url: `https://www.intelius.com/people-search/results/?ReportType=1&search%5Bfirst%5D=${first}&search%5Blast%5D=${last}`, desc: 'Public records' },
    { label: 'ZabaSearch',       color: '#00c8ff', url: `https://www.zabasearch.com/people/${slug}/`,                                                       desc: 'Free public records' },
    { label: 'Radaris',          color: '#ff8800', url: `https://radaris.com/p/${name.replace(/\s+/g, '+')}`,                                               desc: 'People search' },
  ]
}
