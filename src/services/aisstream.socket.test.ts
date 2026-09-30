/** AISStream WebSocket client, driven by a fake WebSocket and a fake clock. */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { quietConsole } from '../test/helpers'
import type { Vessel } from './aisstream'

class FakeWebSocket {
  static instances: FakeWebSocket[] = []
  url: string
  sent: string[] = []
  closed = false
  onopen: (() => void) | null = null
  onmessage: ((e: { data: unknown }) => void) | null = null
  onerror: ((e: unknown) => void) | null = null
  onclose: ((e: { code: number; reason: string }) => void) | null = null
  constructor(url: string) { this.url = url; FakeWebSocket.instances.push(this) }
  send(data: string) { this.sent.push(data) }
  close() { this.closed = true }
  // test helpers
  open() { this.onopen?.() }
  receive(data: unknown) { this.onmessage?.({ data: typeof data === 'string' ? data : JSON.stringify(data) }) }
  drop(code = 1006, reason = '') { this.onclose?.({ code, reason }) }
}

const position = (mmsi: number, o: { lat?: number | null; lng?: number | null; heading?: number; cog?: number; sog?: number; name?: string } = {}) => ({
  MessageType: 'PositionReport',
  MetaData: { MMSI: mmsi, ShipName: o.name ?? '', time_utc: '2025-01-01T00:00:00Z' },
  Message: { PositionReport: {
    Latitude: o.lat === undefined ? 10 : o.lat, Longitude: o.lng === undefined ? 20 : o.lng,
    TrueHeading: o.heading ?? 90, Cog: o.cog ?? 45, Sog: o.sog ?? 12, NavigationalStatus: 0,
  } },
})
const staticData = (mmsi: number, o: { name?: string; type?: number; dest?: string } = {}) => ({
  MessageType: 'ShipStaticData',
  MetaData: { MMSI: mmsi },
  Message: { ShipStaticData: { Name: o.name ?? '', Type: o.type ?? 0, Destination: o.dest ?? '' } },
})

async function setup(key = 'test-key') {
  vi.resetModules()
  vi.stubEnv('VITE_AISSTREAM_KEY', key)
  const mod = await import('./aisstream')
  const updates: Vessel[][] = []
  const stop = mod.connectAISStream(v => updates.push(v))
  return { mod, updates, stop, ws: () => FakeWebSocket.instances[FakeWebSocket.instances.length - 1] }
}

beforeEach(() => {
  FakeWebSocket.instances = []
  vi.useFakeTimers()
  vi.stubGlobal('WebSocket', FakeWebSocket)
  vi.stubGlobal('window', globalThis)
  quietConsole()
})
afterEach(() => vi.useRealTimers())

describe('connectAISStream', () => {
  it('does nothing (no socket, no updates) when no API key is configured', async () => {
    const { updates, stop } = await setup('')
    expect(FakeWebSocket.instances).toHaveLength(0)
    await vi.advanceTimersByTimeAsync(20_000)
    expect(updates).toEqual([])
    expect(() => stop()).not.toThrow()
  })

  it('subscribes on open with the key, a global bounding box, and only the message types it uses', async () => {
    const { ws } = await setup('abc123')
    expect(ws().url).toBe('wss://stream.aisstream.io/v0/stream')
    ws().open()
    expect(JSON.parse(ws().sent[0])).toEqual({
      APIkey: 'abc123',
      BoundingBoxes: [[[-180, -90], [180, 90]]],
      FilterMessageTypes: ['PositionReport', 'ShipStaticData'],
    })
  })

  it('warns after 10s if the stream opened but delivered nothing (likely a bad key), and stays quiet otherwise', async () => {
    const silent = await setup()
    silent.ws().open()
    await vi.advanceTimersByTimeAsync(9_999)
    expect(console.warn).not.toHaveBeenCalledWith(expect.stringContaining('No messages'))
    await vi.advanceTimersByTimeAsync(1)
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('No messages received after 10s'))

    vi.mocked(console.warn).mockClear()
    const active = await setup()
    active.ws().open()
    active.ws().receive(position(1))
    await vi.advanceTimersByTimeAsync(10_000)
    expect(console.warn).not.toHaveBeenCalledWith(expect.stringContaining('No messages'))
  })

  it('publishes a snapshot every 5s, and only when there are vessels', async () => {
    const { ws, updates } = await setup()
    await vi.advanceTimersByTimeAsync(5000)
    expect(updates).toHaveLength(0)
    ws().receive(position(111, { name: '  MAERSK TEST  ' }))
    await vi.advanceTimersByTimeAsync(5000)
    expect(updates).toHaveLength(1)
    expect(updates[0][0]).toEqual({
      mmsi: 111, name: 'MAERSK TEST', latitude: 10, longitude: 20, cog: 45, sog: 12, heading: 90,
      navStatus: 0, shipType: 0, timestamp: '2025-01-01T00:00:00Z', destination: undefined,
    })
  })

  it('keeps only the latest position per vessel', async () => {
    const { ws, updates } = await setup()
    ws().receive(position(1, { lat: 10, lng: 10 }))
    ws().receive(position(1, { lat: 11, lng: 12 }))
    ws().receive(position(2))
    await vi.advanceTimersByTimeAsync(5000)
    expect(updates[0]).toHaveLength(2)
    expect(updates[0].find(v => v.mmsi === 1)).toMatchObject({ latitude: 11, longitude: 12 })
  })

  it.each([
    ['null latitude', { lat: null }],
    ['null longitude', { lng: null }],
    ['(0,0) null-island placeholder', { lat: 0, lng: 0 }],
    ['latitude above 90', { lat: 90.5 }],
    ['latitude below -90', { lat: -91 }],
    ['longitude above 180', { lng: 181 }],
    ['longitude below -180', { lng: -180.1 }],
  ])('discards positions with %s', async (_label, o) => {
    const { ws, updates } = await setup()
    ws().receive(position(1, o))
    await vi.advanceTimersByTimeAsync(5000)
    expect(updates).toEqual([])
  })

  it('accepts boundary coordinates and a single zero axis', async () => {
    const { ws, updates } = await setup()
    ws().receive(position(1, { lat: 90, lng: 180 }))
    ws().receive(position(2, { lat: 0, lng: 25 }))
    await vi.advanceTimersByTimeAsync(5000)
    expect(updates[0].map(v => v.mmsi).sort()).toEqual([1, 2])
  })

  it('falls back to course-over-ground when true heading is unavailable (511) or out of range', async () => {
    const { ws, updates } = await setup()
    ws().receive(position(1, { heading: 511, cog: 123 }))
    ws().receive(position(2, { heading: 361, cog: 77 }))
    ws().receive(position(3, { heading: 360, cog: 5 }))
    ws().receive(position(4, { heading: 0, cog: 5 }))
    await vi.advanceTimersByTimeAsync(5000)
    const h = Object.fromEntries(updates[0].map(v => [v.mmsi, v.heading]))
    expect(h).toEqual({ 1: 123, 2: 77, 3: 360, 4: 0 })
  })

  it('applies ship static data (name, type, destination) to vessels already on the map', async () => {
    const { ws, updates } = await setup()
    ws().receive(position(7))
    ws().receive(staticData(7, { name: ' EVER GIVEN ', type: 70, dest: ' ROTTERDAM ' }))
    await vi.advanceTimersByTimeAsync(5000)
    expect(updates[0][0]).toMatchObject({ name: 'EVER GIVEN', shipType: 70, destination: 'ROTTERDAM' })
  })

  it('remembers static data and applies it to positions that arrive later', async () => {
    const { ws, updates } = await setup()
    ws().receive(staticData(8, { name: 'LATE BLOOMER', type: 80, dest: 'SINGAPORE' }))
    ws().receive(position(8))
    await vi.advanceTimersByTimeAsync(5000)
    expect(updates[0][0]).toMatchObject({ name: 'LATE BLOOMER', shipType: 80, destination: 'SINGAPORE' })
  })

  it('does not blank out a known name when later static data or positions omit it', async () => {
    const { ws, updates } = await setup()
    ws().receive(staticData(9, { name: 'KNOWN' }))
    ws().receive(position(9, { name: '' }))
    ws().receive(staticData(9, { name: '' }))
    await vi.advanceTimersByTimeAsync(5000)
    expect(updates[0][0].name).toBe('KNOWN')
  })

  it('ignores error responses, malformed JSON, non-string frames, unknown types and incomplete messages', async () => {
    const { ws, updates } = await setup()
    ws().receive({ error: 'Api Key Is Not Valid' })
    ws().receive({ ERROR: 'nope' })
    ws().receive('{not json')
    ws().onmessage?.({ data: new ArrayBuffer(8) })
    ws().receive({ MessageType: 'Unknown' })
    ws().receive({ MessageType: 'PositionReport' })
    ws().receive({ MessageType: 'PositionReport', MetaData: { MMSI: 1 } })
    ws().receive({ MessageType: 'ShipStaticData', MetaData: { MMSI: 1 } })
    await vi.advanceTimersByTimeAsync(5000)
    expect(updates).toEqual([])
  })

  it('reconnects 10s after an unexpected close', async () => {
    const { ws } = await setup()
    expect(FakeWebSocket.instances).toHaveLength(1)
    ws().drop()
    await vi.advanceTimersByTimeAsync(9_999)
    expect(FakeWebSocket.instances).toHaveLength(1)
    await vi.advanceTimersByTimeAsync(1)
    expect(FakeWebSocket.instances).toHaveLength(2)
  })

  it('cleanup closes the socket, stops snapshots, cancels reconnects and clears the vessel store', async () => {
    const { ws, updates, stop } = await setup()
    const first = ws()
    first.receive(position(1))
    stop()
    expect(first.closed).toBe(true)
    first.drop() // a late close event after cleanup must not reconnect
    await vi.advanceTimersByTimeAsync(30_000)
    expect(FakeWebSocket.instances).toHaveLength(1)
    expect(updates).toEqual([])
  })

  it('cleanup cancels an already-scheduled reconnect', async () => {
    const { ws, stop } = await setup()
    ws().drop()
    stop()
    await vi.advanceTimersByTimeAsync(30_000)
    expect(FakeWebSocket.instances).toHaveLength(1)
  })

  it('starts from an empty store after being stopped and restarted', async () => {
    const first = await setup()
    first.ws().receive(position(1))
    first.stop()
    const updates: Vessel[][] = []
    const stop2 = first.mod.connectAISStream(v => updates.push(v))
    await vi.advanceTimersByTimeAsync(5000)
    expect(updates).toEqual([])
    stop2()
  })

  it('survives the WebSocket constructor throwing', async () => {
    vi.stubGlobal('WebSocket', class { constructor() { throw new Error('blocked') } })
    const { updates, stop } = await setup()
    await vi.advanceTimersByTimeAsync(10_000)
    expect(updates).toEqual([])
    expect(() => stop()).not.toThrow()
  })
})
