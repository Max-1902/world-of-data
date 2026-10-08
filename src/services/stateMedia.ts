/**
 * Ownership labels for news outlets that a government owns, funds or directs.
 *
 * Criterion: the state owns, funds or directs the outlet AND no independent statutory body insulates its
 * editorial line from that government. Public-service broadcasters with independent governance (BBC, DW,
 * France 24/RFI, NHK, CBC, ABC AU, RNZ, the Nordic and Benelux broadcasters, …) are deliberately not
 * labelled — being publicly funded is not the same as being state-directed. Privately owned outlets with a
 * pro-government line are not labelled either; this marks ownership/control, not editorial stance.
 *
 * Each entry names the owning or funding body so the badge tooltip states a checkable fact, not a judgement.
 * Lookup is by outlet name, so the label also appears when one of these outlets arrives through Google News
 * or GDELT rather than through the curated RSS lists in news.ts.
 */

export interface StateMediaInfo {
  /** Country whose government owns/funds/directs the outlet. */
  country: string
  /** The owning or funding body — shown in the tooltip. */
  owner: string
}

const OUTLETS: { names: string[]; info: StateMediaInfo }[] = [
  { names: ['RT', 'RT.com', 'RT International'],
    info: { country: 'Russia', owner: 'ANO TV-Novosti, financed from the Russian federal budget' } },
  { names: ['CGTN', 'China Global Television Network'],
    info: { country: 'China', owner: 'China Media Group (CCTV), under the CCP Central Propaganda Department' } },
  { names: ['Global Times'],
    info: { country: 'China', owner: "People's Daily, the official newspaper of the CCP Central Committee" } },
  { names: ['Xinhua', 'Xinhua News Agency', 'Xinhua Net', 'Xinhuanet'],
    info: { country: 'China', owner: 'the State Council of the PRC (official state news agency)' } },
  { names: ['Tehran Times'],
    info: { country: 'Iran', owner: 'the Islamic Propagation Organization, an Iranian state body' } },
  { names: ['Vietnam News', 'Việt Nam News'],
    info: { country: 'Vietnam', owner: 'Vietnam News Agency, the government news agency' } },
  { names: ['Anadolu Agency', 'Anadolu Ajansı'],
    info: { country: 'Turkey', owner: 'the Turkish state (state-run news agency)' } },
  { names: ['Ukrinform'],
    info: { country: 'Ukraine', owner: 'the Ukrainian state (national news agency under the Ministry of Culture)' } },
  { names: ['Al Jazeera', 'Al Jazeera English', 'Al Jazeera Media Network'],
    info: { country: 'Qatar', owner: 'Al Jazeera Media Network, funded by the government of Qatar' } },
]

/** "Al Jazeera English" / "DW News (EN)" → "al jazeera" / "dw news": drop edition suffixes before matching. */
function normalise(name: string): string {
  return name.toLowerCase().replace(/\(.*?\)/g, '').replace(/\benglish\b/g, '').replace(/\s+/g, ' ').trim()
}

const BY_NAME = new Map<string, StateMediaInfo>()
for (const o of OUTLETS) for (const n of o.names) BY_NAME.set(normalise(n), o.info)

/** The state-ownership record for an outlet name, or null when the outlet isn't state-owned/-directed. */
export function stateMediaInfo(source: string | undefined | null): StateMediaInfo | null {
  if (!source) return null
  return BY_NAME.get(normalise(source)) ?? null
}

/** Tooltip text for the badge. */
export function stateMediaTitle(info: StateMediaInfo): string {
  return `State media (${info.country}): owned, funded or directed by ${info.owner}.`
}
