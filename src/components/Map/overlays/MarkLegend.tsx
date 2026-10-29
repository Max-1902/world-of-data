import { useState, type ReactNode } from 'react'
import { shapeFor, shapePath } from '../layers/markShapes'
import { CRISIS_COLORS, CRISIS_SHAPES, crisisTypeLabel } from '../layers/crisisShape'
import { FLIGHT_TYPE_COLORS, FLIGHT_TYPE_LABELS, type FlightType } from '../../../utils/flightType'
import { FACILITY_COLORS, FACILITY_LABELS, PLANT_STATUS_COLORS } from '../../../services/military'
import { INFRA_COLORS, INFRA_LABELS } from '../../../services/infrastructure'
import { PORT_TYPE_COLORS, PORT_TYPE_LABELS } from '../../../services/ports'
import { FACILITY_TYPE_COLORS, FACILITY_TYPE_LABELS } from '../../../services/supplychain'
import { CROSSING_STATUS_COLORS } from '../../../services/unhcr'
import { SANCTION_COLORS } from '../../../services/sanctions'
import { SANCTION_FILL_OPACITY, SANCTION_LINE_WIDTH } from '../layers/sanctions'

export interface MarkLegendLayers {
  crises: boolean; flights: boolean; military: boolean; infrastructure: boolean; nuclear: boolean
  ports: boolean; supplyChain: boolean; humanitarian: boolean; sanctions: boolean
}

const HEAD = { fontSize: 11, fontWeight: 650, color: 'var(--text1)' } as const
const SUB = { fontSize: 10, fontWeight: 650, color: 'var(--text2)', marginTop: 8 } as const
const ROW = { display: 'flex', alignItems: 'center', gap: 6, marginTop: 3, fontSize: 9.5, color: 'var(--text2)', lineHeight: 1.35 } as const
const NOTE = { marginTop: 4, fontSize: 9, color: 'var(--text3)', lineHeight: 1.45 } as const

/** A mark drawn from the same outline the map uses, in the category's colour. */
const Glyph = ({ shape, color, ring }: { shape: string; color: string; ring?: boolean }) => (
  <svg width={14} height={14} viewBox="0 0 12 12" aria-hidden="true" style={{ flexShrink: 0 }}>
    <path d={shapePath(shape, 12)} fill={color} fillRule="evenodd" stroke={ring === false ? 'none' : '#fff'} strokeWidth={0.7} />
  </svg>
)

const Group = ({ title, note, children }: { title: string; note?: ReactNode; children: ReactNode }) => (
  <div><div style={SUB}>{title}</div>{children}{note && <div style={NOTE}>{note}</div>}</div>
)

function Categories<T extends string>({ colors, labels }: { colors: Record<T, string>; labels: Record<T, string> }) {
  const keys = Object.keys(colors) as T[]
  return <>{keys.map(k => <div key={k} style={ROW}><Glyph shape={shapeFor(keys, k)} color={colors[k]} /><span>{labels[k]}</span></div>)}</>
}

// Dash patterns as drawn on the map (units of line width), so the legend and the layer cannot drift apart.
const CROSSING_DASH: Record<string, string> = { open: '', restricted: '6 3.2', closed: '2 2.8', unknown: '0.8 4.8' }

/**
 * Key for the layers that tell categories apart by shape, dash or weight: what each mark means in words, drawn with the
 * same outline the map uses. Only layers that are switched on appear.
 */
export default function MarkLegend({ layers, bottom = 58 }: { layers: MarkLegendLayers; bottom?: number }) {
  const [open, setOpen] = useState(true)
  if (!Object.values(layers).some(Boolean)) return null
  return (
    <div className="map-legend" role="region" aria-label="Map key" style={{ right: 10, bottom, width: 230, maxHeight: '55%', overflowY: 'auto' }}>
      <button onClick={() => setOpen(v => !v)} aria-expanded={open}
        style={{ ...HEAD, display: 'flex', width: '100%', justifyContent: 'space-between', background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}>
        <span>Map key</span><span style={{ color: 'var(--text3)' }}>{open ? '–' : '+'}</span>
      </button>
      {open && <>
        {layers.crises && (
          <Group title="Conflict and crisis events" note="Shape is the type; size is severity. A hollow mark is an archived event about a year old.">
            {Object.keys(CRISIS_SHAPES).map(t => <div key={t} style={ROW}><Glyph shape={CRISIS_SHAPES[t].glyph} color={CRISIS_COLORS[t]} /><span>{crisisTypeLabel(t)}</span></div>)}
          </Group>
        )}
        {layers.flights && (
          <Group title="Aircraft" note="Silhouette is the type; the nose points along the heading.">
            {(Object.keys(FLIGHT_TYPE_COLORS) as FlightType[]).map(t => <div key={t} style={ROW}><Glyph shape={t} color={FLIGHT_TYPE_COLORS[t]} ring={false} /><span>{FLIGHT_TYPE_LABELS[t]}</span></div>)}
          </Group>
        )}
        {layers.military && <Group title="Military facilities"><Categories colors={FACILITY_COLORS} labels={FACILITY_LABELS} /></Group>}
        {layers.infrastructure && <Group title="Infrastructure" note="Power plants are sized by capacity."><Categories colors={INFRA_COLORS} labels={INFRA_LABELS} /></Group>}
        {layers.nuclear && (
          <Group title="Nuclear plants by status">
            <Categories colors={PLANT_STATUS_COLORS} labels={{ operating: 'Operating', under_construction: 'Under construction', shutdown: 'Shut down', planned: 'Planned' }} />
          </Group>
        )}
        {layers.ports && <Group title="Ports"><Categories colors={PORT_TYPE_COLORS} labels={PORT_TYPE_LABELS} /></Group>}
        {layers.supplyChain && <Group title="Supply chain"><Categories colors={FACILITY_TYPE_COLORS} labels={FACILITY_TYPE_LABELS} /></Group>}
        {layers.humanitarian && (
          <Group title="Border crossings" note="Line style and the word in the label give the status as well as the colour.">
            {Object.entries(CROSSING_STATUS_COLORS).map(([status, color]) => (
              <div key={status} style={ROW}>
                <svg width={28} height={8} aria-hidden="true" style={{ flexShrink: 0 }}><line x1={1} y1={4} x2={27} y2={4} stroke={color} strokeWidth={2} strokeLinecap="round" strokeDasharray={CROSSING_DASH[status] || undefined} /></svg>
                <span>{status[0].toUpperCase() + status.slice(1)}</span>
              </div>
            ))}
          </Group>
        )}
        {layers.sanctions && (
          <Group title="Sanctions severity" note="Stronger fill and a heavier outline mean harsher sanctions.">
            {(Object.keys(SANCTION_COLORS) as (keyof typeof SANCTION_COLORS)[]).map(sev => (
              <div key={sev} style={ROW}>
                <span style={{ width: 22, height: 10, flexShrink: 0, background: SANCTION_COLORS[sev], opacity: 0.4 + SANCTION_FILL_OPACITY[sev], border: `${SANCTION_LINE_WIDTH[sev]}px solid ${SANCTION_COLORS[sev]}`, boxSizing: 'border-box' }} />
                <span>{sev[0].toUpperCase() + sev.slice(1)}</span>
              </div>
            ))}
          </Group>
        )}
      </>}
    </div>
  )
}
