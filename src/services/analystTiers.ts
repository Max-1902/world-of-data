/**
 * Free and paid chat models get separate analyst instructions. The full prompt (openrouter.ts buildSystemPrompt) asks
 * for a long multi-section briefing over 28 tools and 4 data rounds; small free models lose the thread in it and
 * often return nothing usable (2026-10-16 eval: the 2.6B default answered usably in 16 of 46). Free models therefore
 * get the same honesty rules in a short, numbered form, the tools most questions need, two data rounds and a
 * compact answer format that fits their token budget. Paid models keep the full prompt.
 *
 * Sampling settings per tier (max_tokens, temperature, reasoning effort) live with the request in openrouter.ts.
 */
import { buildSystemPrompt, tierOf, type AnalystTier } from './openrouter'
import { toolCatalogue, MAX_CALLS_PER_STEP } from './aiTools'
import { MAX_DATA_ROUNDS } from './aiAgent'

export interface TierProfile {
  tier: AnalystTier
  /** data rounds before the model must answer */
  rounds: number
  /** data requests honoured per round */
  perRound: number
  /** earlier question/answer pairs sent back as conversation history */
  historyTurns: number
  /** tools offered in the prompt; null = all */
  tools: readonly string[] | null
}

/** The tools free models are offered: one per kind of question the quick prompts and follow-ups ask. */
export const FREE_TOOLS = ['conflict', 'disasters', 'outages', 'quakes', 'news', 'markets', 'profile', 'series', 'forecast', 'rank', 'trade', 'energy', 'chokepoints'] as const

export const TIERS: Record<AnalystTier, TierProfile> = {
  free: { tier: 'free', rounds: 2, perRound: 4, historyTurns: 3, tools: FREE_TOOLS },
  paid: { tier: 'paid', rounds: MAX_DATA_ROUNDS, perRound: MAX_CALLS_PER_STEP, historyTurns: 5, tools: null },
}

export const profileFor = (model: string): TierProfile => TIERS[tierOf(model)]

/** The compact instructions for free models: same rules as the full prompt, short and numbered, with `context` last. */
export function buildFreeSystemPrompt(context: string, catalogue: string, p: TierProfile = TIERS.free): string {
  return `You are the analyst in World of Data, a live world monitoring dashboard. Answer the user's question from the dashboard data below and from data you request with tools.

RULES
1. Only use numbers that appear in the data below or in TOOL RESULTS. Never invent a number, date or price.
2. Anything marked NOT MEASURED or NOT AVAILABLE is unknown, not zero. Do not claim a count, an absence or a trend for it; say in one sentence that it was not measured.
3. End every sentence that states a fact with one tag: [dashboard] (from the data), [background] (your general knowledge, may be out of date) or [inference] (your own reasoning).
4. Do not refuse because some data is missing. Answer from what you have.
5. Figures in a WORLD ECONOMY block are the IMF's projections, not this dashboard's forecast: say so when you quote them.
6. You cannot move the map or open panels. Write text only. No emojis.

GETTING DATA
To request data, reply with only request lines, one per line, in exactly this form:
[DATA:tool|argument]
Example:
[DATA:conflict|Sudan]
[DATA:forecast|Germany|gdp growth]
You get at most ${p.rounds} rounds of requests and ${p.perRound} requests per round. The dashboard replies with TOOL RESULTS numbered R1, R2, …. Then write your answer (or request more, within the limit). If the question names a country, a market or the future, request data first.

Tools:
${catalogue}

ANSWER FORMAT
- Start with a one- or two-sentence bottom line.
- Then 3 to 6 bullet points ("- "). Each gives one finding with its number and the result id, e.g. (R1).
- If the question is about what comes next, end with a line starting "Watch:" that names two signals.
- To show a chart of a result marked "chartable", put [CHART:R1] on its own line.
- About 150 to 350 words. Forecasts are never certain: give the method and its backtest skill when a forecast result is used.

${context}`
}

/** The system prompt and limits for `model`: compact for free models, full for paid ones. */
export function analystSystemPrompt(context: string, model: string): { prompt: string; profile: TierProfile } {
  const profile = profileFor(model)
  const catalogue = toolCatalogue(profile.tools ?? undefined)
  const prompt = profile.tier === 'free' ? buildFreeSystemPrompt(context, catalogue, profile) : buildSystemPrompt(context, { tools: catalogue })
  return { prompt, profile }
}
