import { describe, it, expect } from 'vitest'
import questionsV2 from '../../research/eval/questions-v2.json'
import { extractNumbers, scoreFidelity, briefingText, isBriefing, notMeasuredViolations, parseNotMeasured, isYear } from './fidelity'
import { buildDashboardContext, NOT_IN_CONTEXT } from '../services/openrouter'

const values = (t: string) => extractNumbers(t).map(n => n.value * n.scale)

describe('extractNumbers', () => {
  it('reads plain, comma-grouped, decimal, percent and scaled numbers', () => {
    expect(values('12 events, 1,234 flights, 3.5 points, 57% up, 2.1 million people, 40k troops'))
      .toEqual([12, 1234, 3.5, 57, 2_100_000, 40_000])
    expect(extractNumbers('57%')[0].percent).toBe(true)
  })

  it('skips list markers, digits glued to letters and window labels', () => {
    expect(values('1. First\n2) Second\nG7 and COVID-19, last 72h, a 10-day window, A400M')).toEqual([])
  })

  it('does not read a bare "m" as million', () => {
    expect(values('within 5 m of the line')).toEqual([5])
  })

  it('flags years', () => {
    const [y, n] = extractNumbers('since 2022, about 2,022 people')
    expect(isYear(y)).toBe(true)
    expect(isYear(n)).toBe(false)
  })
})

describe('scoreFidelity', () => {
  const ctx = 'Total events: 412\nCritical: 37 | High: 120\nAirborne flights tracked: 9,876\n  • Sudan: RISING (velocity 81/100) — 14 events in 72h, up from 6 in the prior week\nscore 23.4'

  it('counts numbers present in the context as supported, including rounded ones', () => {
    const r = scoreFidelity('There are 412 events, 37 critical. About 9.9k flights; Sudan scored 23 (velocity 81).', ctx)
    expect(r.unsupported).toEqual([])
    expect(r.checked).toBe(5)
    expect(r.score).toBe(1)
  })

  it('returns unsupported numbers with a snippet for review', () => {
    const r = scoreFidelity('Sudan saw 500 fatalities and 14 events.', ctx)
    expect(r.checked).toBe(2)
    expect(r.unsupported).toEqual([{ raw: '500', snippet: 'Sudan saw 500 fatalities and 14 events.' }])
    expect(r.score).toBe(0.5)
  })

  it('accepts numbers taken from the question', () => {
    expect(scoreFidelity('Here are the top 5.', ctx, 'Name the top 5 flashpoints').score).toBe(1)
  })

  it('reports years separately and leaves them out of the score', () => {
    const r = scoreFidelity('The war began in 2023. 37 critical events.', ctx)
    expect(r.years).toEqual(['2023'])
    expect(r.checked).toBe(1)
  })

  it('ignores dashboard command lines', () => {
    expect(scoreFidelity('[FLY:33.5, 36.3]\nNo figures here.', ctx).checked).toBe(0)
  })

  it('gives no score (not a perfect one) when the answer states no numbers', () => {
    expect(scoreFidelity('Activity is concentrated in Sudan.', ctx).score).toBeNull()
  })

  it('does not round an answer up to a value the context never had', () => {
    expect(scoreFidelity('about 24 points', ctx).score).toBe(0) // 23.4 rounds to 23, not 24
  })
})

describe('NOT MEASURED violations', () => {
  const missing = [{ what: 'Air traffic', why: 'flights layer switched off' }, { what: 'Live conflict events', why: 'no events received from ACLED' }]

  it('catches the observed failure: reading an unmeasured feed as zero or absence', () => {
    for (const a of ['There are 0 flights over the region.', 'No aircraft are currently airborne.', 'Air traffic is low today.', 'Flights tracked: 0', 'There are no live events in Sudan.']) {
      expect(notMeasuredViolations(a, missing).length, a).toBeGreaterThan(0)
    }
  })

  it('accepts saying that it was not measured', () => {
    expect(notMeasuredViolations('Air traffic was not measured, so no flights can be assessed.', missing)).toEqual([])
    expect(notMeasuredViolations('Sudan remains a major conflict (background knowledge).', missing)).toEqual([])
  })

  it('only checks items that were actually missing', () => {
    expect(notMeasuredViolations('0 flights', [])).toEqual([])
  })

  it('round-trips the NOT MEASURED block of a real context', () => {
    const ctx = buildDashboardContext([], [], [], '', '', '', { flightsLayer: false })
    expect(parseNotMeasured(ctx)).toEqual([...missing, ...NOT_IN_CONTEXT])
    expect(parseNotMeasured('no block here')).toEqual([])
  })
})

describe('briefing detection', () => {
  const native = "<|tool_call_start|>[COUNTRY(name='Ukraine'), FLY(location='Sudan')]<|tool_call_end|>"

  it('strips dashboard commands and model-native tool-call blocks (the observed default-model output)', () => {
    expect(briefingText(native)).toBe('')
    expect(briefingText(`[FLY:Kyiv]\n${native}\nActivity is concentrated in Sudan.`)).toBe('Activity is concentrated in Sudan.')
    expect(briefingText('<|tool_call_start|>[FLY(unterminated')).toBe('')
  })

  it('needs at least a short paragraph of prose', () => {
    expect(isBriefing(native)).toBe(false)
    expect(isBriefing('Too short to count.')).toBe(false)
    expect(isBriefing(native + ' ' + 'word '.repeat(25))).toBe(true)
  })

  it('does not score numbers inside tool-call blocks', () => {
    expect(scoreFidelity("<|tool_call_start|>[FLY(coordinates='15.5, 25.5')]<|tool_call_end|>", 'ctx').checked).toBe(0)
  })
})

describe('eval question set v2', () => {
  const set = questionsV2 as {
    questions: { id: string; kind: string; prompt: string; expect: string; notMeasured?: string; needs: string }[]
  }

  it('has 30+ questions with unique ids, a prompt and an expected behaviour each', () => {
    expect(set.questions.length).toBeGreaterThanOrEqual(30)
    expect(new Set(set.questions.map(q => q.id)).size).toBe(set.questions.length)
    for (const q of set.questions) {
      expect(q.prompt.length, q.id).toBeGreaterThan(10)
      expect(q.expect.length, q.id).toBeGreaterThan(10)
      expect(['conflict', 'any'], q.id).toContain(q.needs)
    }
  })

  it('covers numeric-with-data, numeric-without-data, false-premise, labelling and layer-not-loaded questions', () => {
    const kinds = new Set(set.questions.map(q => q.kind))
    for (const k of ['numeric-in-context', 'numeric-not-in-context', 'false-premise', 'labelling', 'layer-not-loaded']) expect(kinds).toContain(k)
  })

  it('every notMeasured target is something the context can actually list as NOT MEASURED', () => {
    const listable = new Set(['Air traffic', 'Live conflict events', ...NOT_IN_CONTEXT.map(m => m.what)])
    for (const q of set.questions) if (q.notMeasured) expect(listable, q.id).toContain(q.notMeasured)
  })
})
