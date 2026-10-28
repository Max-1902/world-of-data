import { describe, it, expect } from 'vitest'
import { parseYouTubeLink } from './youtubeLink'

describe('parseYouTubeLink', () => {
  const vid = { kind: 'video', id: 'GotlA1KKWoo' }
  it('reads the common video link shapes', () => {
    expect(parseYouTubeLink('https://www.youtube.com/watch?v=GotlA1KKWoo&t=5')).toEqual(vid)
    expect(parseYouTubeLink('https://youtu.be/GotlA1KKWoo?si=x')).toEqual(vid)
    expect(parseYouTubeLink('https://www.youtube.com/live/GotlA1KKWoo')).toEqual(vid)
    expect(parseYouTubeLink('https://www.youtube.com/embed/GotlA1KKWoo')).toEqual(vid)
    expect(parseYouTubeLink('m.youtube.com/watch?v=GotlA1KKWoo')).toEqual(vid)
    expect(parseYouTubeLink('GotlA1KKWoo')).toEqual(vid)
  })
  it('reads a channel id link', () => {
    expect(parseYouTubeLink('https://www.youtube.com/channel/UCupvZG-5ko_eiXAupbDfxWw')).toEqual({ kind: 'channel', id: 'UCupvZG-5ko_eiXAupbDfxWw' })
  })
  it('rejects anything else', () => {
    expect(parseYouTubeLink('')).toBeNull()
    expect(parseYouTubeLink('https://example.com/watch?v=GotlA1KKWoo')).toBeNull()
    expect(parseYouTubeLink('https://www.youtube.com/@cnn')).toBeNull()
    expect(parseYouTubeLink('not a link')).toBeNull()
  })
})
