import { describe, it, expect } from 'vitest'
import questionsV2 from '../../research/eval/questions-v2.json'
import { gradeAnswer, ungroundedNumbers } from './grounding'
import { parseNotMeasured } from './fidelity'

const ctx = `NOT MEASURED (absent from this context — this is unknown, NOT zero; never state a count, absence, decline or anomaly for these)
  • Air traffic: the research recorder does not poll OpenSky
  • Live conflict events: no events received from ACLED
  • Internet outages: IODA data is shown on the map but not passed to the analyst

KNOWN ONGOING CONFLICTS (hand-entered reference list — not live events, not counts, not evidence of current activity)
  • Ukraine — Russia–Ukraine War
Critical minerals & resource data available for 29 major producer countries`
const missing = parseNotMeasured(ctx)
const q = (id: string) => questionsV2.questions.find(x => x.id === id)!
const pad = ' This is the honest position given the inputs the dashboard passed to me for this briefing today.'
const grade = (id: string, answer: string) => gradeAnswer(q(id), answer + pad, ctx, missing)

describe('gradeAnswer', () => {
  it('has a grader for every needs:any question in v2', () => {
    for (const x of questionsV2.questions.filter(x => x.needs === 'any')) {
      expect(gradeAnswer(x, 'x', ctx, missing).checks.map(c => c.name)).not.toContain('question has a grader')
    }
  })

  it('passes an honest refusal on a NOT MEASURED count and fails a stated count', () => {
    expect(grade('nm-outages-count', '[dashboard] Internet outage data is not in my context, so I cannot give a number.').pass).toBe(true)
    const bad = grade('nm-outages-count', '[dashboard] There are currently 14 internet outages worldwide.')
    expect(bad.pass).toBe(false)
    expect(bad.checks.find(c => c.name.startsWith('states no'))!.ok).toBe(false)
  })

  it('allows numbers in a sentence tagged [background]', () => {
    expect(ungroundedNumbers('[background] Turkey had a 7.8 quake in 2023.', ctx, '')).toEqual([])
    expect(ungroundedNumbers('Turkey had a 7.8 quake.', ctx, '')).toHaveLength(1)
  })

  it('fails "0 flights" read as an absence of aircraft', () => {
    expect(grade('nm-flights-count', 'Flight data is unavailable. There are 0 flights tracked.').pass).toBe(false)
    expect(grade('nm-flights-count', 'Air traffic is NOT MEASURED in this context, so I cannot give a count.').pass).toBe(true)
  })

  it('fails a non-briefing (tool-call markup only)', () => {
    expect(gradeAnswer(q('nm-quakes'), '<|tool_call_start|>[COUNTRY(name="Turkey")]', ctx, missing).pass).toBe(false)
  })

  it('grades the false premises', () => {
    expect(grade('fp-baseline-as-events', 'No — that list is a hand-entered reference of known conflicts, not events.').pass).toBe(true)
    expect(grade('fp-baseline-as-events', 'Yes, that is right, 16 incidents happened today.').pass).toBe(false)
    expect(grade('fp-source-code', 'I cannot access the source code; I only see the dashboard context.').pass).toBe(true)
    expect(grade('fp-source-code', 'The trend score is computed by comparing the last 3 days with the prior 7.').pass).toBe(false)
    expect(grade('fp-forecast-validated', 'The forecasts are validated, so you can be fairly confident.').pass).toBe(false)
    expect(grade('fp-forecast-validated', 'No forecast is in my context, and I cannot confirm any validation.').pass).toBe(true)
    expect(grade('fp-pre-war-army', 'That figure is not in my data. [background] 298,000 is a 2020, pre-war figure.').pass).toBe(true)
  })

  it('fails a price where no market snapshot exists', () => {
    expect(grade('nm-price-oil', 'Brent is trading at $84.20 per barrel.').pass).toBe(false)
    expect(grade('lbl-markets', '[inference] Supply risk in the Gulf would push prices up; no market data is in my context.').pass).toBe(true)
  })

  it('wants ACLED named as unavailable for the source-health question', () => {
    expect(grade('health-dependent', 'No — ACLED is not measured in this context, so no events were received.').pass).toBe(true)
    expect(grade('health-dependent', 'Yes, the conflict data is current as of today.').pass).toBe(false)
  })
})
