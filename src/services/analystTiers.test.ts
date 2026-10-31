import { describe, it, expect } from 'vitest'
import { analystSystemPrompt, buildFreeSystemPrompt, profileFor, TIERS, FREE_TOOLS } from './analystTiers'
import { buildSystemPrompt, DEFAULT_MODEL } from './openrouter'
import { toolCatalogue, TOOL_NAMES } from './aiTools'

describe('analyst tiers', () => {
  it('free models get the free profile, everything else the paid one', () => {
    expect(profileFor(DEFAULT_MODEL).tier).toBe('free')
    expect(profileFor('anthropic/claude-x').tier).toBe('paid')
    expect(TIERS.free.rounds).toBeLessThan(TIERS.paid.rounds)
  })

  it('offers free models only tools that exist', () => {
    for (const t of FREE_TOOLS) expect(TOOL_NAMES, t).toContain(t)
  })

  it('free prompt keeps every honesty rule in short form, with the context last', () => {
    const { prompt } = analystSystemPrompt('CTX-MARKER', DEFAULT_MODEL)
    expect(prompt.endsWith('CTX-MARKER')).toBe(true)
    expect(prompt).toMatch(/Only use numbers that appear in the data below or in TOOL RESULTS/)
    expect(prompt).toMatch(/NOT MEASURED or NOT AVAILABLE is unknown, not zero/)
    expect(prompt).toMatch(/\[dashboard\].*\[background\].*\[inference\]/)
    expect(prompt).toMatch(/cannot move the map/)
    expect(prompt).toMatch(/WORLD ECONOMY block are the IMF's projections/)
    expect(prompt).not.toMatch(/\[(FLY|COUNTRY|LAYER|DEEPSTATE):/)
  })

  it('free prompt states its own limits and lists only the free tools', () => {
    const { prompt, profile } = analystSystemPrompt('', DEFAULT_MODEL)
    expect(prompt).toContain(`at most ${profile.rounds} rounds of requests and ${profile.perRound} requests per round`)
    expect(prompt).toContain('[DATA:conflict]')
    expect(prompt).not.toContain('[DATA:catalog]')
    expect(prompt).not.toContain('INVESTIGATING WITH DATA TOOLS')
    expect(prompt.length).toBeLessThan(analystSystemPrompt('', 'anthropic/claude-x').prompt.length / 2)
  })

  it('paid prompt is the full one with every tool, and its stated limits are the ones the agent applies', () => {
    const { prompt, profile } = analystSystemPrompt('CTX', 'anthropic/claude-x')
    expect(prompt).toBe(buildSystemPrompt('CTX', { tools: toolCatalogue() }))
    expect(prompt).toContain(`at most ${profile.rounds} rounds of requests and ${profile.perRound} requests per round`)
  })

  it('free prompt is built from what it is given', () => {
    expect(buildFreeSystemPrompt('C', '[DATA:x] — y')).toContain('[DATA:x] — y')
  })
})
