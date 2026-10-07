import { useState } from 'react'

/** Centre crosshair plus its on/off switch (top-left). */
export default function Reticle({ color: reticleColor }: { color: string }) {
  const [showReticle, setShowReticle] = useState(true)
  return (
    <>
      {showReticle && (
    <div style={{ position:'absolute', top:'50%', left:'50%', transform:'translate(-50%,-50%)', width:88, height:88, pointerEvents:'none', zIndex:10 }}>
      <svg width="88" height="88" viewBox="0 0 88 88">
        <circle cx="44" cy="44" r="41" fill="none" stroke={reticleColor} strokeWidth=".5" opacity=".3"/>
        <circle cx="44" cy="44" r="3"  fill="none" stroke={reticleColor} strokeWidth=".8" opacity=".65"/>
        <line x1="0"  y1="44" x2="32" y2="44" stroke={reticleColor} strokeWidth=".5" opacity=".45"/>
        <line x1="56" y1="44" x2="88" y2="44" stroke={reticleColor} strokeWidth=".5" opacity=".45"/>
        <line x1="44" y1="0"  x2="44" y2="32" stroke={reticleColor} strokeWidth=".5" opacity=".45"/>
        <line x1="44" y1="56" x2="44" y2="88" stroke={reticleColor} strokeWidth=".5" opacity=".45"/>
        <path d="M 8 8 L 8 19 M 8 8 L 19 8"   stroke={reticleColor} strokeWidth=".9" fill="none" opacity=".55"/>
        <path d="M 80 8 L 80 19 M 80 8 L 69 8" stroke={reticleColor} strokeWidth=".9" fill="none" opacity=".55"/>
        <path d="M 8 80 L 8 69 M 8 80 L 19 80" stroke={reticleColor} strokeWidth=".9" fill="none" opacity=".55"/>
        <path d="M 80 80 L 80 69 M 80 80 L 69 80" stroke={reticleColor} strokeWidth=".9" fill="none" opacity=".55"/>
      </svg>
    </div>
      )}
    <div style={{ position:'absolute', top:10, left:10, zIndex:20 }}>
      <button
        onClick={() => setShowReticle(v => !v)}
        style={{
          background: showReticle ? 'rgba(0,0,0,0.6)' : 'rgba(0,0,0,0.4)',
          border:`1px solid ${showReticle ? reticleColor + '66' : '#31434d'}`,
          color: showReticle ? reticleColor : '#c0cbd0',
          padding:'3px 8px', fontSize:8, fontFamily:'IBM Plex Mono, monospace',
          fontWeight:500, letterSpacing:'.1em', cursor:'pointer', transition:'all .15s',
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = reticleColor }}
        onMouseLeave={e => { if (!showReticle) (e.currentTarget as HTMLButtonElement).style.color = '#c0cbd0' }}
      >
        RETICLE
      </button>
    </div>
    </>
  )
}
