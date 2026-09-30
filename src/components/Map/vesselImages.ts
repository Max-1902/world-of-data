import type { Map as MapboxMap } from 'mapbox-gl'

// ── Vessel SDF icons — one per vessel type, sized small→large ────────────────
export function addVesselImages(map: MapboxMap) {
  // Helper: create SDF image from a drawing function
  function makeSDF(name: string, size: number, draw: (ctx: CanvasRenderingContext2D, s: number) => void) {
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = size
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#000'
    ctx.fillRect(0, 0, size, size)
    ctx.fillStyle = '#fff'
    draw(ctx, size)
    map.addImage(name, ctx.getImageData(0, 0, size, size), { sdf: true })
  }

  // Cargo — large boxy freighter (28px)
  makeSDF('vessel-cargo', 28, (ctx, s) => {
    ctx.beginPath()
    ctx.moveTo(14, 1)    // bow
    ctx.lineTo(21, 7)
    ctx.lineTo(22, 22)
    ctx.lineTo(20, 26)
    ctx.lineTo(8, 26)
    ctx.lineTo(6, 22)
    ctx.lineTo(7, 7)
    ctx.closePath()
    ctx.fill()
    // Containers on deck
    ctx.fillRect(9, 10, 10, 3)
    ctx.fillRect(9, 14, 10, 3)
    ctx.fillRect(9, 18, 10, 3)
    // Bridge
    ctx.fillRect(10, 22, 8, 3)
  })

  // Tanker — long hull with rounded bow (28px)
  makeSDF('vessel-tanker', 28, (ctx) => {
    ctx.beginPath()
    ctx.moveTo(14, 1)
    ctx.lineTo(20, 6)
    ctx.lineTo(21, 24)
    ctx.lineTo(18, 27)
    ctx.lineTo(10, 27)
    ctx.lineTo(7, 24)
    ctx.lineTo(8, 6)
    ctx.closePath()
    ctx.fill()
    // Deck pipes
    ctx.fillRect(12, 8, 4, 14)
    // Bridge at stern
    ctx.fillRect(10, 23, 8, 3)
  })

  // Passenger — cruise ship with multiple decks (26px)
  makeSDF('vessel-passenger', 26, (ctx) => {
    ctx.beginPath()
    ctx.moveTo(13, 1)
    ctx.lineTo(19, 6)
    ctx.lineTo(20, 20)
    ctx.lineTo(18, 24)
    ctx.lineTo(8, 24)
    ctx.lineTo(6, 20)
    ctx.lineTo(7, 6)
    ctx.closePath()
    ctx.fill()
    // Multiple deck lines
    ctx.clearRect(8, 9, 10, 1)
    ctx.clearRect(8, 13, 10, 1)
    ctx.clearRect(8, 17, 10, 1)
    // Funnel
    ctx.fillRect(11, 2, 4, 4)
  })

  // Fishing — small boat with mast (20px)
  makeSDF('vessel-fishing', 20, (ctx) => {
    ctx.beginPath()
    ctx.moveTo(10, 2)   // bow
    ctx.lineTo(15, 6)
    ctx.lineTo(16, 15)
    ctx.lineTo(14, 18)
    ctx.lineTo(6, 18)
    ctx.lineTo(4, 15)
    ctx.lineTo(5, 6)
    ctx.closePath()
    ctx.fill()
    // Mast/boom
    ctx.fillRect(9, 3, 2, 10)
    // Outrigger lines
    ctx.fillRect(5, 7, 10, 1)
  })

  // Military — sleek warship (26px)
  makeSDF('vessel-military', 26, (ctx) => {
    ctx.beginPath()
    ctx.moveTo(13, 0)   // sharp bow
    ctx.lineTo(18, 7)
    ctx.lineTo(19, 20)
    ctx.lineTo(17, 24)
    ctx.lineTo(9, 24)
    ctx.lineTo(7, 20)
    ctx.lineTo(8, 7)
    ctx.closePath()
    ctx.fill()
    // Superstructure
    ctx.fillRect(10, 10, 6, 6)
    // Forward gun
    ctx.fillRect(12, 4, 2, 5)
    // Radar mast
    ctx.fillRect(12, 8, 2, 2)
  })

  // Tug — small stubby vessel (18px)
  makeSDF('vessel-tug', 18, (ctx) => {
    ctx.beginPath()
    ctx.moveTo(9, 2)    // bow
    ctx.lineTo(14, 5)
    ctx.lineTo(14, 14)
    ctx.lineTo(12, 16)
    ctx.lineTo(6, 16)
    ctx.lineTo(4, 14)
    ctx.lineTo(4, 5)
    ctx.closePath()
    ctx.fill()
    // Wheelhouse
    ctx.fillRect(6, 6, 6, 5)
  })

  // Other — generic small boat (20px)
  makeSDF('vessel-other', 20, (ctx) => {
    ctx.beginPath()
    ctx.moveTo(10, 2)
    ctx.lineTo(15, 6)
    ctx.lineTo(15, 16)
    ctx.lineTo(13, 18)
    ctx.lineTo(7, 18)
    ctx.lineTo(5, 16)
    ctx.lineTo(5, 6)
    ctx.closePath()
    ctx.fill()
    ctx.fillRect(8, 8, 4, 4)
  })
}
