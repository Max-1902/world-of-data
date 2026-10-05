// Pulls candidate place names out of a headline. This only proposes names — whether a candidate really is a
// place (and where) is decided by the geocoder, which rejects anything that isn't a known settlement,
// region or country. Rule-based on purpose, like the other classifiers in this folder.

// Case-sensitive on the proper noun, so the preposition's first letter is matched in both cases by hand.
const PREPOSITIONS = 'in|near|outside|off|at|across|around|into|inside|over|from|toward|towards|northern|southern|eastern|western|central'
  .split('|').map(p => `[${p[0].toUpperCase()}${p[0]}]${p.slice(1)}`).join('|')

// A proper-noun run: capitalised words, optionally joined by a lowercase connector ("Port of Spain", "Al Hudaydah").
const WORD = "[A-Z\\u00C0-\\u00DE][\\p{L}'’.-]*"
const RUN = `${WORD}(?:\\s+(?:(?:of|de|al|el|la|le|del|da|do|dos)\\s+)?${WORD}){0,2}`
const RUN_RE = new RegExp(RUN, 'gu')
const AFTER_PREP_RE = new RegExp(`\\b(?:${PREPOSITIONS})\\s+(${RUN})`, 'gu')

/** Capitalised words that start sentences or name things that are never the location of an event. */
const STOP = new Set([
  'the', 'a', 'an', 'in', 'on', 'at', 'as', 'by', 'for', 'of', 'to', 'after', 'before', 'amid', 'over', 'how', 'why', 'what',
  'who', 'when', 'where', 'live', 'watch', 'breaking', 'exclusive', 'analysis', 'opinion', 'video', 'photos', 'update',
  'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
  'january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december',
  'president', 'prime', 'minister', 'secretary', 'senator', 'governor', 'general', 'king', 'queen', 'pope', 'dr', 'mr', 'mrs',
  'reuters', 'bbc', 'cnn', 'nato', 'eu', 'un', 'who', 'imf', 'opec', 'fbi', 'cia',
])

/** Abbreviations a headline uses for a country, mapped to the name the geocoder knows. */
const ALIASES: Record<string, string> = {
  'us': 'United States', 'u.s.': 'United States', 'usa': 'United States', 'uk': 'United Kingdom', 'u.k.': 'United Kingdom',
  'uae': 'United Arab Emirates', 'drc': 'Democratic Republic of the Congo',
}

export interface PlaceCandidate {
  name: string
  /** `prep` = introduced by "in/near/…" (most reliable); `plain` = any other proper noun. */
  kind: 'prep' | 'plain'
}

function clean(raw: string): string[] {
  const words = raw.replace(/[’']s$/u, '').split(/\s+/).map(w => w.replace(/[.,;:!?)"”]+$/u, '')).filter(Boolean)
  while (words.length && STOP.has(words[0].toLowerCase())) words.shift()
  while (words.length && STOP.has(words[words.length - 1].toLowerCase())) words.pop()
  return words
}

function expand(words: string[]): string[] {
  if (!words.length) return []
  const out = [words.join(' ')]
  if (words.length > 1) out.push(...words) // "Gaza City" first; if that isn't a place, "Gaza" may be
  return out
    .map(n => ALIASES[n.toLowerCase()] ?? n)
    .filter(n => n.length >= 3 && !STOP.has(n.toLowerCase()))
}

/** Ordered, de-duplicated place-name candidates for a piece of text (most reliable first), at most `max`. */
export function extractPlaceCandidates(text: string, max = 6): PlaceCandidate[] {
  const out: PlaceCandidate[] = []
  const seen = new Set<string>()
  const add = (names: string[], kind: PlaceCandidate['kind']) => {
    for (const name of names) {
      const k = name.toLowerCase()
      if (seen.has(k)) continue
      seen.add(k)
      out.push({ name, kind })
    }
  }
  for (const m of text.matchAll(AFTER_PREP_RE)) add(expand(clean(m[1])), 'prep')
  for (const m of text.matchAll(RUN_RE)) add(expand(clean(m[0])), 'plain')
  return out.slice(0, max)
}
