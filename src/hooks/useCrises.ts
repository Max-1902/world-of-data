import { useState, useEffect, useCallback } from 'react'
import { fetchACLEDEvents, fetchACLEDArchive, type AcledArchive } from '../services/crises'
import type { CrisisEvent } from '../types'

// ── Baseline: major ongoing conflicts (always visible even if APIs fail) ─────
const today = new Date().toISOString().split('T')[0]
const mk = (id: string, title: string, type: CrisisEvent['type'], sev: CrisisEvent['severity'], lat: number, lng: number, country: string, desc = ''): CrisisEvent => ({
  id: `baseline-${id}`, title, type, severity: sev, latitude: lat, longitude: lng, country, date: today, description: desc, source: 'Baseline',
})

export const BASELINE: CrisisEvent[] = [
  mk('ukraine',    'Russia–Ukraine War',               'war',      'critical', 48.8,   32.4,   'Ukraine',       'Full-scale invasion since Feb 2022'),
  mk('gaza',       'Gaza Conflict',                    'war',      'critical', 31.5,   34.4,   'Palestine',     'Ongoing conflict in the Gaza Strip'),
  mk('sudan',      'Sudan Civil War (SAF vs RSF)',      'war',      'critical', 15.5,   32.5,   'Sudan',         'Armed conflict since April 2023'),
  mk('drc',        'DRC–M23 Conflict',                 'war',      'critical', -1.7,   29.2,   'DR Congo',      'M23 offensive in eastern DRC'),
  mk('myanmar',    'Myanmar Civil War',                'conflict', 'critical', 21.9,   95.9,   'Myanmar',       'Armed conflict since 2021 coup'),
  mk('haiti',      'Haiti Gang Crisis',                'conflict', 'critical', 18.5,  -72.3,   'Haiti',         'Gang violence & political collapse'),
  mk('sahel-bf',   'Sahel Insurgency (Burkina Faso)',  'conflict', 'high',     12.4,   -1.5,   'Burkina Faso',  'Jihadist insurgency'),
  mk('sahel-mali', 'Sahel Insurgency (Mali)',          'conflict', 'high',     17.5,   -3.9,   'Mali',          'Al-Qaeda / ISIS affiliates'),
  mk('somalia',    'Somalia – al-Shabaab',             'terrorism','high',      2.0,   45.3,   'Somalia',       'al-Shabaab insurgency'),
  mk('syria',      'Syrian Conflict',                  'conflict', 'high',     35.0,   38.5,   'Syria',         'Ongoing multi-party conflict'),
  mk('yemen',      'Yemen Civil War',                  'war',      'high',     15.6,   48.5,   'Yemen',         'Houthi vs. Saudi-backed government'),
  mk('ethiopia',   'Ethiopia – Amhara Conflict',       'conflict', 'high',     11.6,   37.4,   'Ethiopia',      'Armed conflict in Amhara region'),
  mk('nigeria',    'Nigeria – Boko Haram / ISWAP',    'terrorism','high',     11.5,   14.0,   'Nigeria',       'Islamist insurgency in N. Nigeria'),
  mk('westbank',   'West Bank Violence',               'conflict', 'high',     31.9,   35.2,   'Palestine',     'Settler violence & IDF operations'),
  mk('sahel-niger','Niger Coup Instability',           'political','medium',   17.6,    8.0,   'Niger',         'Post-coup political crisis'),
  mk('taiwan-str', 'Taiwan Strait Tensions',           'political','medium',   24.0,  120.0,   'Taiwan',        'PRC military exercises & threats'),
]

const near = (a: CrisisEvent, b: CrisisEvent) =>
  a.type === b.type && Math.abs(a.latitude - b.latitude) < 0.5 && Math.abs(a.longitude - b.longitude) < 0.5

/**
 * Baseline markers plus live events. A hand-entered marker is shown only where no live event of its type lies
 * within 0.5°; it never displaces live data. (It used to: the baseline went first, so every ACLED battle within
 * 0.5° of the Khartoum, Goma or Gaza markers was dropped and replaced by one marker dated today, and those
 * events vanished from every count that skips the baseline.)
 *
 * Live events are still thinned against each other (same type within 0.5° keeps the first). That is unchanged
 * here but it lowers every downstream count (open methodology question).
 */
export function mergeWithBaseline(live: CrisisEvent[]): CrisisEvent[] {
  const thinned = live.filter((ev, i) => !live.slice(0, i).some(prev => near(prev, ev)))
  const markers = BASELINE.filter(b => !thinned.some(ev => near(ev, b)))
  return [...markers, ...thinned]
}

export function useCrises(enabled: boolean) {
  const [crises, setCrises] = useState<CrisisEvent[]>(BASELINE)
  const [loading, setLoading] = useState(false)
  const [error, setError]   = useState<string | null>(null)
  // Events that came from a live feed (not the hand-entered BASELINE). 0 means the map is showing
  // only the long-running-conflict baseline — callers should say so rather than imply live coverage.
  const [liveCount, setLiveCount] = useState(0)
  // Year-old ACLED events, set only while the live window is empty. Kept apart from `crises` on purpose.
  const [archive, setArchive] = useState<AcledArchive | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      // ACLED is the only live conflict source: it's curated, geolocated and fatality-counted. GDELT was
      // dropped — its GEO API is gone and its raw event codes are too noisy to plot (see services/crises.ts).
      const live   = await fetchACLEDEvents(14)
      setLiveCount(live.length)
      setCrises(mergeWithBaseline(live))
      // An empty live window on an account whose tier lags ~12 months: offer last year's window for the map only.
      setArchive(live.length ? null : await fetchACLEDArchive(14))
    } catch (e) {
      setError(String(e))
      // keep existing data (baseline or previously loaded)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!enabled) return
    load()
    const timer = window.setInterval(load, 5 * 60 * 1000)
    return () => clearInterval(timer)
  }, [enabled, load])

  return { crises, archive, loading, error, liveCount, refresh: load }
}
