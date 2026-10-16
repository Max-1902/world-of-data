/**
 * Whole-word country-name matching that knows a qualifier can turn one place into another:
 * "South Sudan" is not Sudan, "Equatorial Guinea" and "Guinea-Bissau" are not Guinea, "New Mexico" is not Mexico.
 * Plain substring tests got this wrong in several places (UK bases listed under Ukraine, Niger's trade profile
 * showing Nigeria's), so every name join in the app goes through here or through `resolveISO2`.
 */

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** A word directly before a name that makes it a different place (or a sub-national one). */
const QUALIFIER_BEFORE = /(?:^|[^\p{L}])(north|south|east|west|northern|southern|eastern|western|equatorial|new|american|british|french|dutch|caribbean|democratic republic of the|lake)\s+$/u
/** Text directly after a name that makes it a different place. */
const QUALIFIER_AFTER = /^(-bissau|\s+delta\b)/u

/**
 * Start indexes of every whole-word occurrence of `name` in `text` that isn't part of a longer place name.
 * Case-insensitive; a name shorter than 2 letters never matches.
 */
export function placeMentions(text: string, name: string): number[] {
  const n = name.trim().toLowerCase()
  if (n.length < 2) return []
  const t = text.toLowerCase()
  const re = new RegExp(`(?<![\\p{L}\\p{N}])${escapeRe(n)}(?![\\p{L}\\p{N}])`, 'gu')
  const out: number[] = []
  for (let m = re.exec(t); m; m = re.exec(t)) {
    if (QUALIFIER_BEFORE.test(t.slice(0, m.index))) continue
    if (QUALIFIER_AFTER.test(t.slice(m.index + n.length))) continue
    out.push(m.index)
  }
  return out
}
