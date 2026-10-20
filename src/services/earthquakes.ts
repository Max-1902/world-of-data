// USGS Earthquake API — completely free, no key
// https://earthquake.usgs.gov/earthquakes/feed/v1.0/geojson.php

export interface Earthquake {
  id: string
  magnitude: number
  place: string
  time: number
  latitude: number
  longitude: number
  depth: number
  url: string
}

export async function fetchEarthquakes(period: 'hour' | 'day' | 'week' = 'week', minMag: 'significant' | '4.5' | '2.5' | 'all' = '4.5'): Promise<Earthquake[]> {
  try {
    const url = `https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/${minMag}_${period}.geojson`
    const res = await fetch(url)
    if (!res.ok) throw new Error(`USGS ${res.status}`)
    const json = await res.json()

    const features: unknown[] = Array.isArray(json.features) ? json.features : []
    return features.flatMap(f => {
      const q = toQuake(f)
      return q ? [q] : []
    })
  } catch (err) {
    console.warn('[USGS] fetch error:', err)
    return []
  }
}

interface UsgsFeature {
  id?: string
  properties?: { mag?: number | null; place?: string | null; time?: number; url?: string }
  geometry?: { coordinates?: number[] } | null
}

// one malformed feature is skipped instead of wiping out the whole feed
function toQuake(raw: unknown): Earthquake | null {
  const f = raw as UsgsFeature
  const [lng, lat, depth] = f?.geometry?.coordinates ?? []
  const mag = f?.properties?.mag
  if (!f?.id || typeof mag !== 'number' || !Number.isFinite(lat) || !Number.isFinite(lng)) return null
  return {
    id: f.id,
    magnitude: mag,
    place: f.properties?.place ?? 'Unknown location',
    time: f.properties?.time ?? 0,
    latitude: lat,
    longitude: lng,
    depth: Number.isFinite(depth) ? depth : 0,
    url: f.properties?.url ?? '',
  }
}
