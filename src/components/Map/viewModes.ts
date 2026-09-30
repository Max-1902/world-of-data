import type { MapViewMode } from '../../types'

// ── Vision mode CSS canvas filters ──────────────────────────────────────────
// Pure CSS filters work reliably on WebGL canvases (SVG url() filters do NOT
// render properly on <canvas> in most browsers — they produce blank/broken output).
// The distinctive look of each mode comes from the filter + colored overlays.
export const CANVAS_FILTERS: Partial<Record<MapViewMode, string>> = {
  dark:        'brightness(0.35) contrast(1.4) saturate(0.3)',
  nightvision: 'brightness(0.75) contrast(1.7) saturate(0)',
  bw:          'grayscale(100%) contrast(1.3) brightness(0.95)',
  infrared:    'brightness(1.15) contrast(1.5) saturate(0) invert(1)',
  snow:        'brightness(1.5) contrast(1.15) saturate(0.25) sepia(0.08)',
  thermal:     'brightness(0.9) contrast(1.7) saturate(0)',
  // Crisp, high-clarity satellite-imagery look — punchier than the neutral globe default
  satellite:   'brightness(1.05) contrast(1.25) saturate(1.3)',
  // Flattened, cartographic look — desaturated and brightened to read like a vector road map
  standard:    'brightness(1.2) contrast(0.92) saturate(0.35)',
}

// Overlay configs per mode — multiple overlay layers for realistic look
interface VisionOverlay {
  layers: {
    background?: string
    mixBlendMode?: string
    opacity?: number
    boxShadow?: string
  }[]
  scanlines?: boolean
  noise?: { opacity: number; blend: string }
}

export const VISION_OVERLAYS: Partial<Record<MapViewMode, VisionOverlay>> = {
  nightvision: {
    layers: [
      // P43 phosphor green tint
      { background: 'rgba(0,255,16,0.2)', mixBlendMode: 'multiply', opacity: 1 },
      // Green color cast
      { background: 'rgba(0,200,0,0.25)', mixBlendMode: 'color', opacity: 1 },
      // Tube vignette — softer so center stays readable
      { background: 'radial-gradient(circle at center, transparent 45%, rgba(0,6,0,0.3) 65%, rgba(0,2,0,0.6) 85%, rgba(0,0,0,0.85) 100%)' },
      { boxShadow: 'inset 0 0 120px 30px rgba(0,0,0,0.5)' },
    ],
    scanlines: true,
    noise: { opacity: 0.05, blend: 'overlay' },
  },
  infrared: {
    layers: [
      // Warm amber on bright (hot) regions
      { background: 'rgba(255,190,100,0.1)', mixBlendMode: 'screen', opacity: 1 },
      // Light cool blue in shadows
      { background: 'linear-gradient(180deg, rgba(0,15,50,0.08) 0%, rgba(0,8,30,0.12) 100%)', mixBlendMode: 'multiply', opacity: 1 },
      // Gentle sensor vignette
      { background: 'radial-gradient(circle at center, transparent 55%, rgba(0,0,0,0.3) 85%, rgba(0,0,0,0.55) 100%)' },
      { boxShadow: 'inset 0 0 80px 20px rgba(0,0,0,0.35)' },
    ],
    noise: { opacity: 0.03, blend: 'overlay' },
  },
  thermal: {
    layers: [
      // Iron palette: violet/blue shadows → red/orange mids → yellow peaks
      { background: 'linear-gradient(180deg, rgba(80,0,180,0.15) 0%, rgba(20,0,80,0.18) 100%)', mixBlendMode: 'screen', opacity: 1 },
      // Red/orange color cast
      { background: 'rgba(255,50,0,0.15)', mixBlendMode: 'color', opacity: 1 },
      // Yellow center hotspot
      { background: 'radial-gradient(ellipse at 50% 45%, rgba(255,240,0,0.07) 0%, transparent 50%)', mixBlendMode: 'screen', opacity: 1 },
      // Moderate vignette
      { background: 'radial-gradient(circle at center, transparent 50%, rgba(0,0,10,0.35) 80%, rgba(0,0,0,0.6) 100%)' },
      { boxShadow: 'inset 0 0 100px 25px rgba(0,0,10,0.4)' },
    ],
    noise: { opacity: 0.04, blend: 'overlay' },
  },
  snow: {
    layers: [
      // Light blue-white wash
      { background: 'rgba(210,230,255,0.15)', mixBlendMode: 'screen', opacity: 1 },
      // Subtle desaturation so markers pop
      { background: 'rgba(230,238,250,0.1)', mixBlendMode: 'saturation', opacity: 1 },
      // Very light edge shading
      { background: 'radial-gradient(circle at center, transparent 65%, rgba(160,180,210,0.12) 90%, rgba(120,140,180,0.2) 100%)' },
      { boxShadow: 'inset 0 0 60px 15px rgba(180,200,230,0.1)' },
    ],
  },
  dark: {
    layers: [
      // Moderate vignette — keep center bright enough to read
      { background: 'radial-gradient(circle at center, transparent 45%, rgba(0,0,0,0.35) 75%, rgba(0,0,0,0.6) 100%)' },
      { boxShadow: 'inset 0 0 100px 30px rgba(0,0,0,0.4)' },
    ],
  },
}
