/** What a pasted YouTube link points at: one video/live stream, or a channel's current live stream. */
export type YouTubeTarget = { kind: 'video'; id: string } | { kind: 'channel'; id: string }

const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/

/** Parses a pasted YouTube link (watch, youtu.be, /live/, /embed/, /channel/UC…) or a bare video id. Returns null if unrecognised. */
export function parseYouTubeLink(input: string): YouTubeTarget | null {
  const text = input.trim()
  if (VIDEO_ID.test(text)) return { kind: 'video', id: text }
  let url: URL
  try { url = new URL(/^https?:\/\//i.test(text) ? text : `https://${text}`) } catch { return null }
  const host = url.hostname.replace(/^(www|m)\./, '')
  if (host === 'youtu.be') {
    const id = url.pathname.slice(1).split('/')[0]
    return VIDEO_ID.test(id) ? { kind: 'video', id } : null
  }
  if (host !== 'youtube.com') return null
  const v = url.searchParams.get('v')
  if (v && VIDEO_ID.test(v)) return { kind: 'video', id: v }
  const [, first, second] = url.pathname.split('/')
  if ((first === 'live' || first === 'embed' || first === 'shorts') && VIDEO_ID.test(second ?? '')) return { kind: 'video', id: second }
  if (first === 'channel' && /^UC[A-Za-z0-9_-]{22}$/.test(second ?? '')) return { kind: 'channel', id: second }
  return null
}
