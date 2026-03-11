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

    return (json.features || []).map((f: {
      id: string
      properties: { mag: number; place: string; time: number; url: string }
      geometry: { coordinates: [number, number, number] }
    }) => ({
      id: f.id,
      magnitude: f.properties.mag,
      place: f.properties.place,
      time: f.properties.time,
      latitude: f.geometry.coordinates[1],
      longitude: f.geometry.coordinates[0],
      depth: f.geometry.coordinates[2],
      url: f.properties.url,
    }))
  } catch (err) {
    console.warn('[USGS] fetch error:', err)
    return []
  }
}
