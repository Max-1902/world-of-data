/**
 * Panel implementations. Split out of the former PanelContent.tsx; wired up in src/panels/registry.tsx.
 */
import { useState, useEffect, useRef, useMemo } from 'react'
import { lastAcledPoll } from '../../services/crises'
import { TrendingUp, TrendingDown, Minus, Send, Square, History, Trash2, Plus, MessageSquare, ChevronDown, Maximize2, ExternalLink } from 'lucide-react'
import { CrisisEvent, PanelState, Flight, type ConflictFeed } from '../../types'
import { buildDashboardContext, buildSystemPrompt, notMeasured, visibleText, QUICK_PROMPTS, FREE_MODELS, DEFAULT_MODEL, fetchAllModels, fetchModelPolicy, isModelEnabled, describeAIError, groupModels, formatModelPrice, type DSMessage, type ModelOption, type ModelPolicy } from '../../services/openrouter'
import { listSessions, saveSession, deleteSession, newSessionId, type ChatSession, type ChatTurn } from '../../services/chatHistory'
import { fetchMultipleQuotes, MARKET_HUBS } from '../../services/stocks'
import { findCountryInText } from '../../services/worldbank'
import { LIVE_WINDOW, isBaseline, isFlaggedUp, type TrajectoryEntry } from '../../utils/trajectory'
import { conflictTrajectories } from '../../utils/monthlyTrajectory'
import { healthTracker, healthSummary } from '../../services/sourceHealth'
import { useCountryAnalytics } from '../../hooks/useCountryAnalytics'
import { summarizeForAI } from '../../utils/countryStats'
import { runAgent, MAX_DATA_ROUNDS } from '../../services/aiAgent'
import { toolCatalogue, CHART_LINE, MAX_CALLS_PER_STEP, type ToolCall, type ToolResult } from '../../services/aiTools'
import { AIMarkdown } from './aiAnalyst/AIMarkdown'
import { AIChart } from './aiAnalyst/AIChart'
import { InvestigationTrail } from './aiAnalyst/InvestigationTrail'
import { useAnalystWindow } from './aiAnalyst/AnalystWindow'
import { onAnalystDraft, takeAnalystDraft } from '../../utils/analystDraft'

// ── Watchlist card — rule-based trajectory forecast, rendered inside AIAnalystPanel ──
function WatchlistCard({ entry, onExplain, disabled = false }: { entry: TrajectoryEntry; onExplain: () => void; disabled?: boolean }) {
  const Icon = entry.trend === 'rising' ? TrendingUp : entry.trend === 'falling' ? TrendingDown : Minus
  const color = entry.trend === 'rising' ? 'var(--red)' : entry.trend === 'falling' ? 'var(--green)' : 'var(--text3)'
  return (
    <div style={{
      background: 'var(--surface2)', border: '1px solid var(--border)',
      borderRadius: 'var(--r-md)', padding: '10px 12px',
      display: 'flex', flexDirection: 'column', gap: 6,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
        <Icon size={14} color={color} style={{ flexShrink: 0 }} />
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text1)', flex: 1 }}>{entry.country}</span>
        {entry.unusual && (
          <span className={`ai-trend-badge ${entry.unusual === 'high' ? 'rising' : 'falling'}`} title={`Measured against ${entry.country}'s own ${entry.baseline?.span}`}>
            unusual
          </span>
        )}
        <span className={`ai-trend-badge ${entry.trend}`}>
          {entry.trend}
        </span>
      </div>
      <div style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.5 }}>{entry.reason}</div>
      <button
        onClick={onExplain}
        disabled={disabled}
        style={{
          alignSelf: 'flex-start', background: 'none', border: 'none', cursor: disabled ? 'not-allowed' : 'pointer',
          color: disabled ? 'var(--text3)' : 'var(--accent)', fontSize: 11, padding: 0, fontFamily: 'inherit', opacity: disabled ? .7 : 1,
        }}
        onMouseEnter={e => { if (!disabled) (e.currentTarget as HTMLButtonElement).style.opacity = '0.7' }}
        onMouseLeave={e => { if (!disabled) (e.currentTarget as HTMLButtonElement).style.opacity = '1' }}
      >
        {disabled ? 'Connect a model to ask about this trend' : 'Investigate this trend →'}
      </button>
    </div>
  )
}

/** The turn being worked on: everything the thread shows while the analyst is still investigating. */
interface LiveTurn {
  id: string
  question: string
  /** visible text of the current model call */
  text: string
  notes: string[]
  results: ToolResult[]
  pending: ToolCall[]
  step: number
}

/** At most this many charts are added under an answer that placed none itself. */
const AUTO_CHARTS = 2

// ── AI Analyst Panel (OpenRouter) ─────────────────────────────────────────
const MARKET_QUESTION = /\b(stocks?|markets?|equit(?:y|ies)|shares?|invest\w*|portfolio|sectors?|etfs?|oil|gold|crypto\w*|bitcoin|forex|currenc\w*|bonds?|prices?|trad(?:e|ing)|returns?)\b/i

/** The model's view of earlier turns: question and visible answer only (tool data is re-fetched when needed). */
function historyOf(turns: ChatTurn[]): DSMessage[] {
  return turns.filter(t => t.answer).flatMap(t => [{ role: 'user' as const, content: t.question }, { role: 'assistant' as const, content: t.answer }]).slice(-10)
}

/** Sessions saved before the analyst could fetch data have messages only — rebuild their turns from those. */
function turnsOf(s: ChatSession): ChatTurn[] {
  if (s.turns) return s.turns
  const out: ChatTurn[] = []
  for (let i = 0; i < s.messages.length; i++) {
    const m = s.messages[i]
    if (m.role !== 'user') continue
    const next = s.messages[i + 1]
    out.push({ id: `${s.id}-${i}`, question: m.content, answer: next?.role === 'assistant' ? next.content : '', results: [], notes: [] })
  }
  return out
}

// The analyst never moves the map or opens panels: the reader stays in the conversation while it works.
export function AIAnalystPanel({ crises, conflictFeed, flights, panelState }: {
  crises: CrisisEvent[]; conflictFeed?: ConflictFeed; flights: Flight[]
  panelState?: PanelState
}) {
  const [input, setInput]         = useState('')
  const inputRef = useRef<HTMLTextAreaElement>(null)
  // a question handed over by "Ask the analyst" elsewhere: shown for the reader to edit, never sent for them
  useEffect(() => {
    const take = () => { const d = takeAnalystDraft(); if (d) { setInput(d); inputRef.current?.focus() } }
    take()
    return onAnalystDraft(take)
  }, [])
  const [streaming, setStreaming] = useState(false)
  const [turns, setTurns]         = useState<ChatTurn[]>([])
  const [live, setLive]           = useState<LiveTurn | null>(null)
  const [error, setError]         = useState('')
  const [model, setModel]         = useState(DEFAULT_MODEL)
  // Full OpenRouter catalogue (Claude, ChatGPT, …); falls back to the built-in free list if it can't load.
  const [allModels, setAllModels] = useState<ModelOption[] | null>(null)
  // What this deployment's proxy will send upstream; models outside it would be rejected, so they aren't offered.
  const [policy, setPolicy] = useState<ModelPolicy | null>(null)
  useEffect(() => {
    fetchAllModels().then(setAllModels).catch(() => {})
    fetchModelPolicy().then(setPolicy)
  }, [])
  const enabledModels = useMemo(() => allModels && allModels.filter(m => isModelEnabled(m.id, policy)), [allModels, policy])
  const modelGroups = useMemo(() => {
    if (!enabledModels) return null
    // A model from a loaded session that has since left the catalogue (or the allowance) stays selectable.
    const known = enabledModels.some(m => m.id === model) ? enabledModels : [{ id: model, label: `${model} (unlisted)`, ctx: '', priceIn: 0, priceOut: 0, free: false, created: 0 }, ...enabledModels]
    return groupModels(known)
  }, [enabledModels, model])
  const hiddenModels = allModels && enabledModels ? allModels.length - enabledModels.length : 0
  const [sessionId, setSessionId] = useState(() => newSessionId())
  const [showHistory, setShowHistory] = useState(false)
  const [pastSessions, setPastSessions] = useState<ChatSession[]>([])
  const [followUps, setFollowUps] = useState<string[]>([])
  const [notice, setNotice]     = useState('')
  const [showOutlook, setShowOutlook] = useState(true)
  /** expanded tool result per turn, opened from the trail or from a reference in the answer */
  const [openRef, setOpenRef]   = useState<{ turn: string; id: string } | null>(null)
  const modelName = (id: string) => FREE_MODELS.find(m => m.id === id)?.label ?? allModels?.find(m => m.id === id)?.label ?? id
  // pop-out controls (null when rendered without the window provider)
  const popout = useAnalystWindow()
  const abortRef  = useRef<AbortController | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const stickRef  = useRef(true) // follow the stream only while the reader is at the bottom
  // Whether OpenRouter is actually configured now lives server-side (api/openrouter/*)
  // and can't be checked from the client; the UI stays enabled and any missing-key
  // failure surfaces through the normal streamAI error path below instead.
  const hasKey    = true

  // Rule-based trajectory scoring — recomputes automatically as crises/flights refresh.
  // No prompt required; this is what makes the panel proactive rather than ask-only.
  const trajectories = useMemo(() => conflictTrajectories(crises, conflictFeed), [crises, conflictFeed])
  // Same rule as the AI context: an unmeasured feed reads "not measured", never 0 (and baseline markers aren't incidents).
  const missing = notMeasured(crises, flights, { flightsLayer: panelState?.flights, crisesLayer: panelState?.crises })
  const incidentsLabel = missing.some(m => m.what === 'Live conflict events') ? 'not measured' : crises.filter(c => !isBaseline(c)).length.toLocaleString()
  const flightsLabel = missing.some(m => m.what === 'Air traffic') ? 'not measured' : flights.length.toLocaleString()
  // whatever comparison is open in Country Analytics (null until its data has loaded) — computed locally, so the model can cite it
  const ca = useCountryAnalytics(false)
  const countryAnalyticsSummary = ca.analysis ? summarizeForAI(ca.analysis, ca.xMeta, ca.yMeta, ca.xs, ca.ys) : ''
  const empty = turns.length === 0 && !live

  // Follow the streaming text inside the conversation box only. (scrollIntoView on every token
  // scrolled every ancestor too — the whole right dock jumped down while the AI wrote.)
  useEffect(() => {
    const el = scrollRef.current
    if (el && stickRef.current) el.scrollTop = el.scrollHeight
  }, [live, turns, streaming])

  // Persist the running conversation to localStorage after each turn
  useEffect(() => {
    if (turns.length === 0) return
    saveSession({
      id: sessionId,
      startedAt: Number(sessionId.split('-')[0]) || Date.now(),
      updatedAt: Date.now(),
      model,
      messages: historyOf(turns),
      turns,
    })
  }, [turns, sessionId, model])

  function openHistory() {
    setPastSessions(listSessions())
    setShowHistory(true)
  }

  function resetThread() {
    setLive(null)
    setError('')
    setShowHistory(false)
    setFollowUps([])
    setOpenRef(null)
    setNotice('')
  }

  function loadSession(s: ChatSession) {
    resetThread()
    setTurns(turnsOf(s))
    setModel(s.model)
    setSessionId(s.id)
    setShowOutlook(false)
  }

  function startNewSession() {
    abortRef.current?.abort()
    resetThread()
    setTurns([])
    setSessionId(newSessionId())
    setShowOutlook(true)
  }

  // Contextual follow-up chips — derived client-side from the answer, the data used and live dashboard state,
  // not another model call. Keeps the "next question" always one tap away instead of a blank input box.
  function deriveFollowUps(text: string, prompt: string, results: ToolResult[]): string[] {
    const suggestions: string[] = []
    const place = findCountryInText(prompt)
      ?? results.find(r => r.ok && r.args[0] && ['profile', 'conflict', 'trade', 'series', 'energy'].includes(r.tool))?.args[0]?.split(',')[0]
    const used = new Set(results.map(r => r.tool))
    if (place && !used.has('forecast')) suggestions.push(`Forecast GDP growth for ${place} and show how reliable the model is`)
    if (place && !used.has('conflict')) suggestions.push(`How has the security situation in ${place} developed over the last two weeks?`)
    if (place && !used.has('trade')) suggestions.push(`Who would be most exposed economically if ${place} destabilised?`)
    if (/marke|price|oil|energy/i.test(text) && !used.has('markets')) suggestions.push('Check the latest market moves and relate them to this')
    if (/escalat|risk|tension/i.test(text)) suggestions.push('What would de-escalation look like, and what would signal it?')
    if (trajectories.length > 0 && suggestions.length < 2) suggestions.push(`Compare this to the ${trajectories[0].country} trajectory`)
    if (suggestions.length < 2) suggestions.push('Summarise this in 3 bullet points')
    return suggestions.slice(0, 3)
  }

  function removeSession(id: string, e: React.MouseEvent) {
    e.stopPropagation()
    deleteSession(id)
    setPastSessions(listSessions())
    if (id === sessionId) startNewSession()
  }

  async function ask(prompt: string) {
    if (!prompt.trim() || streaming) return
    setError('')
    setFollowUps([])
    setOpenRef(null)
    stickRef.current = true
    setNotice('')
    setStreaming(true)
    setShowOutlook(false)
    abortRef.current = new AbortController()
    const turnId = `${Date.now()}`
    setLive({ id: turnId, question: prompt, text: '', notes: [], results: [], pending: [], step: 0 })

    // Market questions get a fresh quote snapshot (same free feed the Markets panel uses); if it
    // can't be reached the analyst still answers from the crisis data — it never refuses over it.
    let marketSnapshot = ''
    if (MARKET_QUESTION.test(prompt)) {
      try {
        const quotes = await fetchMultipleQuotes(MARKET_HUBS.map(h => h.symbol))
        // "% on the last session, last trade <UTC time>": on a weekend the latest change is Friday's, not today's
        marketSnapshot = quotes.map(q => `  • ${q.name} (${q.symbol}): ${q.price.toFixed(2)} ${q.currency}, ${q.changePercent >= 0 ? '+' : ''}${q.changePercent.toFixed(2)}% on the last session (last trade ${q.lastUpdated.slice(0, 16).replace('T', ' ')} UTC)`).join('\n')
      } catch { /* answer without it */ }
    }
    const layers   = { flightsLayer: panelState?.flights, crisesLayer: panelState?.crises, conflictCapped: lastAcledPoll()?.capped ?? false }
    const context  = buildDashboardContext(crises, flights, trajectories, healthSummary(healthTracker.getAll()), marketSnapshot, countryAnalyticsSummary, layers)
    const sysMsg: DSMessage = { role: 'system', content: buildSystemPrompt(context, { tools: toolCatalogue() }) }
    const messages: DSMessage[] = [sysMsg, ...historyOf(turns), { role: 'user', content: prompt }]

    let raw = ''
    let answeredBy: string | null = null
    let results: ToolResult[] = []
    // what this question has gathered so far, kept here (not read back from state) so a stop or error can still save it
    const notes: string[] = []
    const gathered: ToolResult[] = []
    let stepText = ''
    let runError: string | undefined
    try {
      const run = await runAgent({
        messages, model, signal: abortRef.current.signal,
        ctx: { crises, flights, trajectories, flightsLayer: panelState?.flights, crisesLayer: panelState?.crises },
        onEvent: e => {
          if (e.type === 'step') { stepText = ''; setLive(l => l && { ...l, text: '', step: e.step }) }
          else if (e.type === 'text') {
            stepText = visibleText(e.raw)
            setLive(l => l && { ...l, text: stepText })
          } else if (e.type === 'tools') {
            // prose written next to data requests is the model thinking aloud: keep it in the trail, not the answer
            if (stepText.trim()) notes.push(stepText.trim())
            stepText = ''
            const n = [...notes]
            setLive(l => l && { ...l, text: '', notes: n, pending: e.calls })
          } else if (e.type === 'result') {
            gathered.push(e.result)
            const r = e.result
            setLive(l => l && { ...l, results: [...l.results, r], pending: l.pending.filter(c => c.raw !== r.call) })
          } else if (e.type === 'fallback') {
            setNotice(`${modelName(e.from)} is rate-limited — switched to ${modelName(e.to)}.`)
          }
        },
      })
      raw = run.answer
      answeredBy = run.answeredBy
      results = run.results
      const answer = visibleText(raw).trim()
      if (!answer) {
        setError('The selected model did not return a briefing. Try a different model.')
      } else {
        setFollowUps(deriveFollowUps(answer, prompt, results))
      }
      setTurns(prev => [...prev, { id: turnId, question: prompt, answer, results, notes, model: answeredBy ?? model }])
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        runError = describeAIError(err)
        setError(runError)
      }
      // keep what was gathered so the question and its data are not lost
      results = gathered
      if (gathered.length || stepText.trim()) {
        setTurns(prev => [...prev, { id: turnId, question: prompt, answer: stepText.trim(), results: gathered, notes, error: runError ? undefined : 'Stopped before the answer was finished.' }])
      }
    } finally {
      setLive(null)
      setStreaming(false)
    }
  }

  function stop() {
    abortRef.current?.abort()
    setStreaming(false)
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); ask(input); setInput('') }
  }

  // A reference like (R2) in an answer opens that result in the turn's trail and scrolls to it.
  function showRef(turn: string, id: string) {
    setOpenRef({ turn, id })
    // the analyst may be living in a separate browser window: look the result up in its own document
    const view = scrollRef.current?.ownerDocument.defaultView ?? window
    view.requestAnimationFrame(() => {
      const box = scrollRef.current
      const el = box?.ownerDocument.getElementById(`ai-res-${turn}-${id}`)
      if (box && el) { stickRef.current = false; box.scrollTop = el.offsetTop - 12 }
    })
  }

  function renderTurn(t: ChatTurn, isLast: boolean) {
    const placed = new Set(t.answer.split('\n').map(l => l.trim().match(CHART_LINE)?.[1]?.toUpperCase()).filter(Boolean))
    const extra = placed.size ? [] : t.results.filter(r => r.ok && r.chart).slice(0, AUTO_CHARTS)
    return (
      <div key={t.id} className="ai-turn">
        <div className="ai-user-bubble"><span>{t.question}</span></div>
        <InvestigationTrail
          turnId={t.id} results={t.results} notes={t.notes}
          open={openRef?.turn === t.id ? openRef.id : null}
          onToggle={id => setOpenRef(id ? { turn: t.id, id } : null)}
        />
        {t.answer && <AIMarkdown text={t.answer} results={t.results} onRef={id => showRef(t.id, id)} />}
        {extra.length > 0 && (
          <div className="ai-auto-charts">
            <div className="ai-auto-charts-h">Data behind this answer</div>
            {extra.map(r => <div key={r.id} className="ai-chart"><AIChart result={r} /></div>)}
          </div>
        )}
        {t.error && <div className="ai-turn-error">{t.error}</div>}
        {t.model && t.answer && isLast && <div className="ai-turn-meta">{modelName(t.model)}{t.results.length ? ` · ${t.results.length} dataset${t.results.length === 1 ? '' : 's'} queried` : ''}</div>}
      </div>
    )
  }

  const liveStatus = !live ? '' : live.pending.length ? `Fetching ${live.pending.length} dataset${live.pending.length === 1 ? '' : 's'}…`
    : live.step === 0 ? (live.text ? '' : 'Planning the investigation…')
    : live.text ? '' : `Analysing ${live.results.length} result${live.results.length === 1 ? '' : 's'}…`

  return (
    <div className="ai-surface" style={{ display: 'flex', flexDirection: 'column', flex: 1, height: '100%', minHeight: 0 }}>

      {/* Analyst workspace header */}
      <div className="ai-header" style={{ padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, position: 'relative' }}>
        <div className="ai-brand-mark"><MessageSquare size={15} /></div>
        <div className="ai-brand-copy">
          <div className="ai-brand-title">Analyst</div>
          <div className="ai-brand-subtitle">Investigates the dashboard's live data, then briefs with evidence and charts</div>
        </div>
        <select
          className="ai-model-select"
          aria-label="Analysis model"
          title={`Choose analysis model — paid models bill your OpenRouter account${hiddenModels ? `. ${hiddenModels} more models are hidden because this deployment only enables free models and the ones in OPENROUTER_ALLOWED_MODELS.` : ''}`}
          value={model}
          onChange={e => setModel(e.target.value)}
          disabled={streaming}
          style={{
            background: 'var(--surface)', border: '1px solid var(--border-strong)', color: 'var(--text2)',
            fontFamily: 'inherit', letterSpacing: '.01em', padding: '6px 7px', borderRadius: 'var(--r-sm)',
            outline: 'none', cursor: 'pointer',
          }}
        >
          {modelGroups
            ? modelGroups.map(g => (
              <optgroup key={g.label} label={g.label}>
                {g.models.map(m => (
                  <option key={m.id} value={m.id}>{m.created ? `${m.label} · ${m.ctx} · ${formatModelPrice(m)}` : m.label}</option>
                ))}
              </optgroup>
            ))
            : FREE_MODELS.map(m => (
              <option key={m.id} value={m.id}>{m.label}</option>
            ))}
        </select>
        <button
          onClick={startNewSession}
          title="New conversation"
          aria-label="New conversation"
          style={{ background: 'var(--surface)', border: '1px solid var(--border-strong)', borderRadius: 'var(--r-sm)', color: 'var(--text2)', cursor: 'pointer', padding: '6px 7px', display: 'flex', alignItems: 'center', flexShrink: 0, transition: 'all .12s' }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--accent)'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--accent)' }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--text2)'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border-strong)' }}
        >
          <Plus size={14} />
        </button>
        <button
          onClick={() => (showHistory ? setShowHistory(false) : openHistory())}
          title="Chat history"
          aria-label="Conversation history"
          style={{ background: showHistory ? 'var(--accent-soft)' : 'var(--surface)', border: `1px solid ${showHistory ? 'var(--accent)' : 'var(--border-strong)'}`, borderRadius: 'var(--r-sm)', color: showHistory ? 'var(--accent)' : 'var(--text2)', cursor: 'pointer', padding: '6px 7px', display: 'flex', alignItems: 'center', flexShrink: 0, transition: 'all .12s' }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--accent)' }}
          onMouseLeave={e => { if (!showHistory) (e.currentTarget as HTMLButtonElement).style.color = 'var(--text2)' }}
        >
          <History size={14} />
        </button>
        {popout?.mode === 'dock' && (
          <>
            <button onClick={popout.popOut} className="ai-head-btn" title="Pop out — open the analyst in a large window over the dashboard" aria-label="Pop out analyst">
              <Maximize2 size={14} />
            </button>
            <button onClick={popout.openWindow} className="ai-head-btn" title="Open the analyst in a separate browser window (e.g. a second monitor)" aria-label="Open analyst in a separate window">
              <ExternalLink size={14} />
            </button>
          </>
        )}

        {showHistory && (
          <div className="ai-glow-border" style={{
            position: 'absolute', top: '100%', right: 10, left: 10, zIndex: 40,
            background: 'var(--surface)', border: '1px solid var(--border-strong)',
            borderRadius: 'var(--r-md)', maxHeight: 280, overflowY: 'auto', marginTop: 4,
          }}>
            <div style={{ padding: '8px 11px', fontSize: 11, color: 'var(--text2)', letterSpacing: '.06em', borderBottom: '1px solid var(--border)' }}>
              Past conversations · {pastSessions.length}
            </div>
            {pastSessions.length === 0 && (
              <div style={{ padding: '12px 11px', fontSize: 12.5, color: 'var(--text3)' }}>No saved conversations yet</div>
            )}
            {pastSessions.map(s => {
              const firstUser = s.messages.find(m => m.role === 'user') ?? (s.turns?.[0] && { content: s.turns[0].question })
              return (
                <div
                  key={s.id}
                  onClick={() => loadSession(s)}
                  style={{
                    padding: '9px 11px', borderBottom: '1px solid var(--border)', cursor: 'pointer',
                    background: s.id === sessionId ? 'var(--accent-soft)' : 'transparent',
                    display: 'flex', alignItems: 'flex-start', gap: 6, transition: 'background .12s',
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = 'var(--surface2)' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = s.id === sessionId ? 'var(--accent-soft)' : 'transparent' }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12.5, color: 'var(--text1)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {firstUser?.content || '(empty)'}
                    </div>
                    <div style={{ fontSize: 10.5, color: 'var(--text3)', marginTop: 2 }}>
                      {new Date(s.updatedAt).toLocaleString()} · {s.turns ? `${s.turns.length} question${s.turns.length === 1 ? '' : 's'}` : `${s.messages.length} messages`}
                    </div>
                  </div>
                  <button
                    onClick={e => removeSession(s.id, e)}
                    title="Delete conversation"
                    style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', padding: 2, flexShrink: 0 }}
                    onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--red)' }}
                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--text3)' }}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Watchlist — proactive trajectory forecast, no prompt required. Folds away once a conversation is running. */}
      {trajectories.length > 0 && (
        <div className="ai-watchlist" style={{ padding: showOutlook ? '12px 14px' : '7px 14px', borderBottom: '1px solid var(--border)', flexShrink: 0, maxHeight: showOutlook ? '38%' : undefined, overflowY: 'auto' }}>
          <button className="ai-section-heading ai-outlook-toggle" onClick={() => setShowOutlook(v => !v)} aria-expanded={showOutlook} style={{ marginBottom: showOutlook ? 9 : 0 }}>
            <span>Regional activity · {trajectories.filter(isFlaggedUp).length} {trajectories[0]?.baseline ? 'unusually high' : 'rising'}</span>
            <span>72-hour activity trends <ChevronDown size={11} style={{ transform: showOutlook ? 'rotate(180deg)' : undefined, verticalAlign: -2 }} /></span>
          </button>
          {showOutlook && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {trajectories.map(t => (
                <WatchlistCard key={t.country} entry={t} disabled={!hasKey} onExplain={() => {
                  const w = t.window ?? LIVE_WINDOW
                  const own = t.baseline ? ` Against its own ${t.baseline.span} it would normally see ~${Math.round(t.baseline.expected * 10) / 10} events in ${w === LIVE_WINDOW ? '72h' : 'a month'} (${t.unusual ? `unusually ${t.unusual}` : 'within its normal range'}).` : ''
                  const counts = w === LIVE_WINDOW
                    ? `${t.recentCount} events in the last 72h (score ${t.recentScore}) vs ${t.priorCount} in the prior week (score ${t.priorScore})`
                    : `${t.reason} (${w.source}, lethal organised violence only)`
                  ask(`Investigate the ${t.trend} trend for ${t.country}: ${counts}.${own} What's driving this, what does the wider data (outages, disasters, news, economy) say, and what should I watch for next?`)
                }} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Quick prompts */}
      {empty && (
        <div className="ai-prompts" style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <div className="ai-section-heading">
            <span>Suggested questions</span><span>The analyst fetches the data it needs</span>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
            {QUICK_PROMPTS.map(qp => (
              <button
                key={qp.label}
                onClick={() => { ask(qp.prompt) }}
                disabled={!hasKey}
                style={{
                  background: 'var(--surface2)', border: '1px solid var(--border-strong)',
                  borderRadius: 6,
                  color: hasKey ? 'var(--text2)' : 'var(--text3)', fontSize: 11, padding: '7px 10px',
                  cursor: hasKey ? 'pointer' : 'not-allowed', fontFamily: 'inherit', opacity: hasKey ? 1 : .6,
                  transition: 'all .12s', display: 'flex', alignItems: 'center',
                }}
                onMouseEnter={e => { if (!hasKey) return; const el = e.currentTarget; el.style.borderColor = 'var(--accent)'; el.style.background = 'var(--accent-soft)' }}
                onMouseLeave={e => { const el = e.currentTarget; el.style.borderColor = 'var(--border-strong)'; el.style.background = 'var(--surface2)' }}
              >
                {qp.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Conversation thread */}
      <div
        ref={scrollRef}
        className="ai-conversation"
        onScroll={e => { const el = e.currentTarget; stickRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 48 }}
        style={{ flex: 1, overflowY: 'auto', overscrollBehavior: 'contain', scrollbarGutter: 'stable', padding: '12px 16px', minHeight: 0, position: 'relative' }}
      >
        {empty && (
          <div className="ai-welcome">
            <div className="ai-welcome-title">What would you like to understand?</div>
            <div className="ai-welcome-copy">
              Ask about a country, a crisis, a market or an economic trend. The analyst queries the dashboard's data itself —
              conflict events, outages, disasters, earthquakes, fires, news, markets, World Bank series, trade, energy, sanctions —
              runs local statistics and forecasts, and answers with the evidence and charts it used.
            </div>
            <div className="ai-welcome-context">
              <span><b>{incidentsLabel}</b> incidents</span>
              <span><b>{flightsLabel}</b> flights tracked</span>
              <span><b>{trajectories.length}</b> regional trends</span>
            </div>
          </div>
        )}

        {turns.map((t, i) => renderTurn(t, i === turns.length - 1 && !live))}

        {live && (
          <div className="ai-turn">
            <div className="ai-user-bubble"><span>{live.question}</span></div>
            <InvestigationTrail turnId={live.id} results={live.results} pending={live.pending} notes={live.notes} />
            {liveStatus && <div className="ai-loading"><span className="ai-loading-dot" />{liveStatus}{live.step > 0 && <span className="ai-step">round {live.step + 1} of up to {MAX_DATA_ROUNDS + 1}</span>}</div>}
            {live.text && <AIMarkdown text={live.text} results={live.results} streaming />}
          </div>
        )}

        {/* Auto-suggested follow-ups — derived from the response, one tap to continue */}
        {!streaming && hasKey && followUps.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginTop: 12 }}>
            {followUps.map(fu => (
              <button key={fu} onClick={() => ask(fu)} className="ai-followup">{fu}</button>
            ))}
          </div>
        )}

        {notice && !error && (
          <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 8 }}>{notice}</div>
        )}
        {error && (
          <div className="ai-error" style={{ fontSize: 12.5, color: 'var(--red)', marginTop: 8 }}>
            {error}
          </div>
        )}
      </div>

      {/* Context pill */}
      {!hasKey && (
        <div className="ai-key-notice">
          Set up OpenRouter from Settings → API Keys to enable chat. The regional activity watchlist remains available.
        </div>
      )}

      <div className="ai-context-bar">
        <div className="ai-context-items">
          <span><i className="incidents" />incidents {incidentsLabel}</span>
          <span><i className="flights" />flights {flightsLabel}</span>
          <span className="ai-live-status" title={`Up to ${MAX_DATA_ROUNDS} data rounds × ${MAX_CALLS_PER_STEP} queries per question`}><i />Live data + tools</span>
        </div>
        {turns.length > 0 && (
          <button
            onClick={startNewSession}
            className="ai-new-thread"
            title="Start a new conversation"
          ><Plus size={12} /> New conversation</button>
        )}
      </div>

      {/* Input */}
      <div style={{ padding: '10px 14px', display: 'flex', gap: 8, alignItems: 'flex-end', flexShrink: 0 }}>
        <textarea
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKey}
          disabled={!hasKey}
          placeholder={hasKey ? 'Ask anything — e.g. "Compare inflation in Turkey and Argentina since 2010"' : 'Connect an analysis model to start a conversation'}
          rows={3}
          className="ai-input"
          style={{
            flex: 1, background: 'var(--surface)', border: '1px solid var(--border-strong)',
            borderRadius: 'var(--r-md)',
            color: 'var(--text1)', fontFamily: 'inherit',
            padding: '9px 12px', resize: 'none', outline: 'none', lineHeight: 1.5,
            transition: 'border-color .12s',
            opacity: hasKey ? 1 : .65,
          }}
          onFocus={e  => { (e.currentTarget as HTMLTextAreaElement).style.borderColor = 'var(--accent)' }}
          onBlur={e   => { (e.currentTarget as HTMLTextAreaElement).style.borderColor = 'var(--border-strong)' }}
        />
        {streaming ? (
          <button onClick={stop} aria-label="Stop" style={{ background: 'var(--red-soft)', border: '1px solid rgba(220,38,38,0.4)', borderRadius: 'var(--r-md)', color: 'var(--red)', cursor: 'pointer', padding: '9px 11px', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
            <Square size={14} />
          </button>
        ) : (
          <button
            onClick={() => { ask(input); setInput('') }}
            disabled={!hasKey || !input.trim()}
            aria-label="Send"
            style={{ background: input.trim() && hasKey ? 'var(--accent)' : 'var(--surface2)', border: `1px solid ${input.trim() && hasKey ? 'var(--accent)' : 'var(--border-strong)'}`, borderRadius: 'var(--r-md)', color: input.trim() && hasKey ? '#111820' : 'var(--text3)', cursor: input.trim() && hasKey ? 'pointer' : 'default', padding: '9px 11px', display: 'flex', alignItems: 'center', flexShrink: 0, transition: 'all .12s' }}
          >
            <Send size={14} />
          </button>
        )}
      </div>
    </div>
  )
}
