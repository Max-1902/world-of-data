import { explainChange, type Change, type ForecastRecord } from '../../utils/forecastRecord'
import { EvidenceTag } from '../DataLabels'

/** "What changed": what differs between the forecast first shown on this device and the one shown now, and why. */
export function SinceBlock({ memory, unit }: { memory: { previous: ForecastRecord | null; since: string; now: ForecastRecord }; unit: string }) {
  const changes: Change[] = memory.previous ? explainChange(memory.previous, memory.now, unit) : []
  return (
    <div className="pred-block">
      <div className="pred-block-h">What changed</div>
      {!memory.previous
        ? <p className="viz-verdict">First shown on this device on {memory.since}. When the World Bank adds or revises data, or the IMF publishes a new edition, this card will say what changed and why the forecast moved.</p>
        : changes.length === 0
          ? <p className="viz-verdict">Nothing new since {memory.since}: same data, same forecast.</p>
          : <>
              <p className="viz-verdict">Since the forecast shown on {memory.previous.issued}:</p>
              <ul className="ex-path">{changes.map((c, i) => <li key={i}><EvidenceTag kind={c.kind} /><div>{c.text}</div></li>)}</ul>
            </>}
    </div>
  )
}
