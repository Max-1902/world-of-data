/**
 * Panel implementations. Split out of the former PanelContent.tsx; wired up in src/panels/registry.tsx.
 */
import { useState, useEffect, useRef, useMemo } from 'react'
import { TrendingUp, TrendingDown, Minus, Send, Square, History, Trash2, Plus, Navigation, Layers, Info, Radio, MessageSquare } from 'lucide-react'
import { CrisisEvent, PanelState, Flight } from '../../types'
import { buildDashboardContext, QUICK_PROMPTS, FREE_MODELS, DEFAULT_MODEL, fetchAllModels, describeAIError, streamAIWithFallback, groupModels, formatModelPrice, type DSMessage, type ModelOption } from '../../services/openrouter'
import { listSessions, saveSession, deleteSession, newSessionId, type ChatSession } from '../../services/chatHistory'
import { findCountryInText } from '../../services/worldbank'
import { computeTrajectories, type TrajectoryEntry } from '../../utils/trajectory'
import { healthTracker, healthSummary } from '../../services/sourceHealth'

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
        {disabled ? 'Connect a model to ask about this trend' : 'Ask about this trend →'}
      </button>
    </div>
  )
}

// ── Action log entry — one row per dashboard command the AI has executed ───
interface ActionLogEntry {
  id: string
  kind: 'fly' | 'country' | 'layer' | 'deepstate'
  label: string
  at: number
}

// ── AI Analyst Panel (OpenRouter) ─────────────────────────────────────────
export function AIAnalystPanel({ crises, flights, onGeoSearch, onCountryClick, onToggleLayer, panelState }: {
  crises: CrisisEvent[]; flights: Flight[]
  onGeoSearch?: (q: string) => void
  onCountryClick?: (country: string) => void
  onToggleLayer?: (id: keyof PanelState) => void
  panelState?: PanelState
}) {
  const [input, setInput]         = useState('')
  const [streaming, setStreaming] = useState(false)
  const [response, setResponse]   = useState('')
  const [history, setHistory]     = useState<DSMessage[]>([])
  const [error, setError]         = useState('')
  const [model, setModel]         = useState(DEFAULT_MODEL)
  // Full OpenRouter catalogue (Claude, ChatGPT, …); falls back to the built-in free list if it can't load.
  const [allModels, setAllModels] = useState<ModelOption[] | null>(null)
  useEffect(() => { fetchAllModels().then(setAllModels).catch(() => {}) }, [])
  const modelGroups = useMemo(() => {
    if (!allModels) return null
    // A model from a loaded session that has since left the catalogue stays selectable.
    const known = allModels.some(m => m.id === model) ? allModels : [{ id: model, label: `${model} (unlisted)`, ctx: '', priceIn: 0, priceOut: 0, free: false, created: 0 }, ...allModels]
    return groupModels(known)
  }, [allModels, model])
  const [sessionId, setSessionId] = useState(() => newSessionId())
  const [showHistory, setShowHistory] = useState(false)
  const [pastSessions, setPastSessions] = useState<ChatSession[]>([])
  const [actionLog, setActionLog] = useState<ActionLogEntry[]>([])
  const [followUps, setFollowUps] = useState<string[]>([])
  const [notice, setNotice]     = useState('')
  const modelName = (id: string) => FREE_MODELS.find(m => m.id === id)?.label ?? allModels?.find(m => m.id === id)?.label ?? id
  const abortRef  = useRef<AbortController | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const stickRef  = useRef(true) // follow the stream only while the reader is at the bottom
  // Whether OpenRouter is actually configured now lives server-side (api/openrouter/*)
  // and can't be checked from the client; the UI stays enabled and any missing-key
  // failure surfaces through the normal streamAI error path below instead.
  const hasKey    = true

  // Rule-based trajectory scoring — recomputes automatically as crises/flights refresh.
  // No prompt required; this is what makes the panel proactive rather than ask-only.
  const trajectories = useMemo(() => computeTrajectories(crises, flights), [crises, flights])

  // Follow the streaming text inside the conversation box only. (scrollIntoView on every token
  // scrolled every ancestor too — the whole right dock jumped down while the AI wrote.)
  useEffect(() => {
    const el = scrollRef.current
    if (el && stickRef.current) el.scrollTop = el.scrollHeight
  }, [response, actionLog, streaming])

  // Persist the running conversation to localStorage after each turn
  useEffect(() => {
    if (history.length === 0) return
    saveSession({
      id: sessionId,
      startedAt: Number(sessionId.split('-')[0]) || Date.now(),
      updatedAt: Date.now(),
      model,
      messages: history,
    })
  }, [history, sessionId, model])

  function openHistory() {
    setPastSessions(listSessions())
    setShowHistory(true)
  }

  function loadSession(s: ChatSession) {
    setHistory(s.messages)
    setModel(s.model)
    setSessionId(s.id)
    const lastAssistant = [...s.messages].reverse().find(m => m.role === 'assistant')
    setResponse(lastAssistant?.content ?? '')
    setShowHistory(false)
    setError('')
    setActionLog([])
    setFollowUps([])
  }

  function startNewSession() {
    setHistory([])
    setResponse('')
    setError('')
    setSessionId(newSessionId())
    setShowHistory(false)
    setActionLog([])
    setFollowUps([])
  }

  // Contextual follow-up chips — derived client-side from the response text and
  // live dashboard state, not another model call. Keeps the "next question" always
  // one tap away instead of a blank input box.
  function deriveFollowUps(text: string, cmds: ActionLogEntry[]): string[] {
    const suggestions: string[] = []
    const flown = cmds.find(c => c.kind === 'fly' || c.kind === 'country')
    if (flown) suggestions.push(`What's the historical pattern for ${flown.label}?`)
    if (/marke|price|oil|energy/i.test(text)) suggestions.push('How would this affect markets over the next 30 days?')
    if (/escalat|risk|tension/i.test(text)) suggestions.push('What would de-escalation look like here?')
    if (trajectories.length > 0 && suggestions.length < 2) {
      suggestions.push(`Compare this to the ${trajectories[0].country} trajectory`)
    }
    if (suggestions.length < 2) suggestions.push('Summarize this in 3 bullet points')
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
    setResponse('')
    setActionLog([])
    setFollowUps([])
    stickRef.current = true
    setNotice('')
    setStreaming(true)
    abortRef.current = new AbortController()

    // A country named in the user's message always goes to the map and the country drawer —
    // done here, before the model runs, so it never depends on a small model emitting commands.
    const mentioned = findCountryInText(prompt)
    const opened: ActionLogEntry[] = []
    if (mentioned) {
      onGeoSearch?.(mentioned)
      onCountryClick?.(mentioned)
      const at = Date.now()
      opened.push({ id: `${at}-fly`, kind: 'fly', label: mentioned, at }, { id: `${at}-country`, kind: 'country', label: mentioned, at })
      setActionLog(opened)
    }

    const context  = buildDashboardContext(crises, flights, trajectories, healthSummary(healthTracker.getAll()))
    const sysMsg: DSMessage = {
      role: 'system',
      content: `You are the analyst in Meridian, a live world monitoring dashboard. You have access to current crisis and flight data, including locally calculated regional activity trends for the last 72 hours compared with the prior week. Ground your analysis in this information. Distinguish current activity from changes in activity, and explain what evidence supports each assessment. Write in a clear, measured briefing style. Be concise, specific, and direct. Do not use emojis, terminal-style status text, decorative symbols, or unsupported confidence scores.

IMPORTANT: You can execute dashboard commands by including them in your response. Commands are on their own line:

[FLY:location] — Fly the map to a location (city, country, coordinates). Example: [FLY:Tehran, Iran]
[COUNTRY:name] — Open the country intelligence drawer. Example: [COUNTRY:Iran]
[LAYER:id:on] or [LAYER:id:off] — Toggle a map layer. Layer IDs: flights, crises, wildfires, military, nuclear, sanctions, cameras, infrastructure, airspace, humanitarian, vessels, oil, gas, ports, pipelines, gpsjam
[DEEPSTATE:on] or [DEEPSTATE:off] — Toggle Ukraine frontline overlay

When a user asks about a specific country or region, ALWAYS include the FLY and COUNTRY commands to show it on the map. (If the user's message names a country, the dashboard has already flown there and opened its overview — repeating those commands is harmless.) When relevant, enable related layers. For example if asked about Iran, fly there, open the country drawer, and enable relevant layers like military, crises, airspace.

Execute commands BEFORE your analysis text — put them at the very start of your response.

${context}`,
    }
    const userMsg: DSMessage = { role: 'user', content: prompt }
    const messages: DSMessage[] = [sysMsg, ...history, userMsg]

    let full = ''
    const executedCmds = new Set<string>()
    const loggedActions: ActionLogEntry[] = [...opened]
    try {
      await streamAIWithFallback(
        messages,
        token => {
          full += token
          // Parse and execute commands as they stream in
          const lines = full.split('\n')
          for (const line of lines) {
            const trimmed = line.trim()
            if (executedCmds.has(trimmed)) continue

            const flyMatch = trimmed.match(/^\[FLY:(.+)\]$/)
            if (flyMatch) {
              executedCmds.add(trimmed)
              const loc = flyMatch[1].trim()
              onGeoSearch?.(loc)
              const entry: ActionLogEntry = { id: `${Date.now()}-fly`, kind: 'fly', label: loc, at: Date.now() }
              loggedActions.push(entry)
              setActionLog(prev => [...prev, entry])
              continue
            }

            const countryMatch = trimmed.match(/^\[COUNTRY:(.+)\]$/)
            if (countryMatch) {
              executedCmds.add(trimmed)
              const name = countryMatch[1].trim()
              onCountryClick?.(name)
              const entry: ActionLogEntry = { id: `${Date.now()}-country`, kind: 'country', label: name, at: Date.now() }
              loggedActions.push(entry)
              setActionLog(prev => [...prev, entry])
              continue
            }

            const layerMatch = trimmed.match(/^\[LAYER:(\w+):(on|off)\]$/)
            if (layerMatch && onToggleLayer && panelState) {
              const layerId = layerMatch[1] as keyof PanelState
              const wantOn = layerMatch[2] === 'on'
              if (layerId in panelState && panelState[layerId] !== wantOn) {
                executedCmds.add(trimmed)
                onToggleLayer(layerId)
                const entry: ActionLogEntry = { id: `${Date.now()}-layer-${layerId}`, kind: 'layer', label: `${layerId} ${wantOn ? 'on' : 'off'}`, at: Date.now() }
                loggedActions.push(entry)
                setActionLog(prev => [...prev, entry])
              }
              continue
            }

            const dsMatch = trimmed.match(/^\[DEEPSTATE:(on|off)\]$/)
            if (dsMatch) {
              executedCmds.add(trimmed)
              const entry: ActionLogEntry = { id: `${Date.now()}-deepstate`, kind: 'deepstate', label: `Ukraine frontline ${dsMatch[1]}`, at: Date.now() }
              loggedActions.push(entry)
              setActionLog(prev => [...prev, entry])
              continue
            }
          }
          // Display response without command lines
          const display = full.split('\n').filter(l => !l.trim().match(/^\[(FLY|COUNTRY|LAYER|DEEPSTATE):.+\]$/)).join('\n')
          setResponse(display)
        },
        abortRef.current.signal,
        model,
        undefined,
        (from, to) => setNotice(`${modelName(from)} is rate-limited — switched to ${modelName(to)}.`),
      )
      const cleanResponse = full.split('\n').filter(l => !l.trim().match(/^\[(FLY|COUNTRY|LAYER|DEEPSTATE):.+\]$/)).join('\n')
      if (!cleanResponse.trim()) {
        setError('The selected model did not return a briefing. Try a different model.')
      } else {
        setHistory(prev => [
          ...prev.slice(-10),
          userMsg,
          { role: 'assistant', content: cleanResponse },
        ])
        setFollowUps(deriveFollowUps(cleanResponse, loggedActions))
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        setError(describeAIError(err))
      }
    } finally {
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

  // Render markdown-ish text: bold **text**, bullet — text
  function renderText(text: string) {
    return text.split('\n').map((line, i) => {
      const isHeader = /^#{1,3}\s/.test(line)
      const isBullet = /^[\-\•\*]\s/.test(line)
      const content = line.replace(/^#{1,3}\s/, '').replace(/^[\-\•\*]\s/, '')
      const parts = content.split(/(\*\*[^*]+\*\*)/g)
      return (
        <div key={i} className={`ai-response-line${isHeader ? ' heading' : ''}${isBullet ? ' bullet' : ''}`}>
          {isBullet && <span className="ai-bullet-mark" />}
          {parts.map((part, index) => part.startsWith('**') && part.endsWith('**')
            ? <strong key={index}>{part.slice(2, -2)}</strong>
            : <span key={index}>{part}</span>)}
        </div>
      )
    })
  }

  return (
    <div className="ai-surface" style={{ display: 'flex', flexDirection: 'column', flex: 1, height: '100%', minHeight: 0 }}>

      {/* Analyst workspace header */}
      <div className="ai-header" style={{ padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, position: 'relative' }}>
        <div className="ai-brand-mark"><MessageSquare size={15} /></div>
        <div className="ai-brand-copy">
          <div className="ai-brand-title">Analyst chat</div>
          <div className="ai-brand-subtitle">Briefings grounded in live incidents and regional trends</div>
        </div>
        <select
          className="ai-model-select"
          aria-label="Analysis model"
          title="Choose analysis model — paid models bill your OpenRouter account"
          value={model}
          onChange={e => setModel(e.target.value)}
          disabled={streaming}
          style={{
            width: 160, background: 'var(--surface)', border: '1px solid var(--border-strong)', color: 'var(--text2)',
            fontSize: 10.5, fontFamily: 'inherit', letterSpacing: '.01em', padding: '6px 7px', borderRadius: 'var(--r-sm)',
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
              const firstUser = s.messages.find(m => m.role === 'user')
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
                      {new Date(s.updatedAt).toLocaleString()} · {s.messages.length} messages
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

      {/* Watchlist — proactive trajectory forecast, no prompt required */}
      {trajectories.length > 0 && (
        <div className="ai-watchlist" style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <div className="ai-section-heading">
            <span>Regional outlook</span><span>72-hour activity trends</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {trajectories.map(t => (
              <WatchlistCard key={t.country} entry={t} disabled={!hasKey} onExplain={() => {
                ask(`Explain the ${t.trend} trend for ${t.country}: ${t.recentCount} events in the last 72h (score ${t.recentScore}) vs ${t.priorCount} in the prior week (score ${t.priorScore}). What's driving this and what should I watch for next?`)
              }} />
            ))}
          </div>
        </div>
      )}

      {/* Quick prompts */}
      {!response && !streaming && history.length === 0 && (
        <div className="ai-prompts" style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <div className="ai-section-heading">
            <span>Suggested questions</span><span>Choose a starting point</span>
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

      {/* Conversation history */}
      {history.length > 0 && (
        <div className="ai-user-questions" style={{ padding: '12px 14px 0', flexShrink: 0 }}>
          {history.filter(m => m.role === 'user').slice(-2).map((m, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
              <span style={{
                background: 'var(--surface2)', color: 'var(--text1)', border: '1px solid var(--border-strong)',
                borderRadius: '12px 12px 3px 12px', padding: '8px 12px', fontSize: 12,
                maxWidth: '85%', lineHeight: 1.5,
              }}>
                {m.content.slice(0, 140)}{m.content.length > 140 ? '…' : ''}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Response area */}
      <div
        ref={scrollRef}
        className="ai-conversation"
        onScroll={e => { const el = e.currentTarget; stickRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 48 }}
        style={{ flex: 1, overflowY: 'auto', overscrollBehavior: 'contain', scrollbarGutter: 'stable', padding: '12px 16px', minHeight: 0 }}
      >
        {!response && !streaming && history.length === 0 && (
          <div className="ai-welcome">
            <div className="ai-welcome-title">What would you like to understand?</div>
            <div className="ai-welcome-copy">
              Ask about the current situation, compare regional activity, or explore what a developing event could mean.
            </div>
            <div className="ai-welcome-context">
              <span><b>{crises.length.toLocaleString()}</b> incidents</span>
              <span><b>{flights.length.toLocaleString()}</b> flights tracked</span>
              <span><b>{trajectories.length}</b> regional trends</span>
            </div>
          </div>
        )}

        {streaming && !response && (
          <div className="ai-loading"><span className="ai-loading-dot" />Preparing your briefing…</div>
        )}

        {/* Live action timeline — every dashboard command the AI has executed this turn */}
        {actionLog.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 10 }}>
            {actionLog.map(a => {
              const Icon = a.kind === 'fly' ? Navigation : a.kind === 'country' ? Info : a.kind === 'layer' ? Layers : Radio
              return (
                <div key={a.id} className="ai-action-row" style={{
                  display: 'flex', alignItems: 'center', gap: 7, fontSize: 12,
                  padding: '6px 10px', borderRadius: 'var(--r-sm)',
                  background: 'var(--accent-soft)', color: 'var(--accent)',
                  border: '1px solid rgba(213,168,95,0.22)',
                }}>
                  <Icon size={12} style={{ flexShrink: 0 }} />
                  <span style={{ fontWeight: 600 }}>
                    {a.kind === 'fly' ? 'Map moved to' : a.kind === 'country' ? 'Opened country overview' : a.kind === 'layer' ? 'Map layer updated' : 'Frontline view updated'}
                  </span>
                  <span style={{ color: 'var(--text1)' }}>{a.label}</span>
                </div>
              )
            })}
          </div>
        )}

        {(response || streaming) && (
          <div style={{ padding: '2px 0' }}>
            {renderText(response)}
            {streaming && <span className="ai-cursor" />}
          </div>
        )}

        {/* Auto-suggested follow-ups — derived from the response, one tap to continue */}
        {!streaming && hasKey && followUps.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginTop: 12 }}>
            {followUps.map(fu => (
              <button
                key={fu}
                onClick={() => ask(fu)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  background: 'var(--surface)', border: '1px solid var(--border-strong)',
                  borderRadius: 'var(--r-pill)', color: 'var(--text2)', fontSize: 12,
                  padding: '6px 12px', cursor: 'pointer', fontFamily: 'inherit',
                  transition: 'all .12s',
                }}
                onMouseEnter={e => { const el = e.currentTarget; el.style.borderColor = 'var(--accent)'; el.style.color = 'var(--accent)' }}
                onMouseLeave={e => { const el = e.currentTarget; el.style.borderColor = 'var(--border-strong)'; el.style.color = 'var(--text2)' }}
              >
                {fu}
              </button>
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
          Set up OpenRouter from Settings → API Keys to enable chat. The regional outlook remains available.
        </div>
      )}

      <div className="ai-context-bar">
        <div className="ai-context-items">
          <span><i className="incidents" />{crises.length.toLocaleString()} incidents</span>
          <span><i className="flights" />{flights.length.toLocaleString()} flights</span>
          <span className="ai-live-status"><i />Live data</span>
        </div>
        {history.length > 0 && (
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
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKey}
          disabled={!hasKey}
          placeholder={hasKey ? 'Ask about a country, event, or emerging trend…' : 'Connect an analysis model to start a conversation'}
          rows={3}
          style={{
            flex: 1, background: 'var(--surface)', border: '1px solid var(--border-strong)',
            borderRadius: 'var(--r-md)',
            color: 'var(--text1)', fontSize: 13, fontFamily: 'inherit',
            padding: '9px 12px', resize: 'none', outline: 'none', lineHeight: 1.5,
            transition: 'border-color .12s',
            opacity: hasKey ? 1 : .65,
          }}
          onFocus={e  => { (e.currentTarget as HTMLTextAreaElement).style.borderColor = 'var(--accent)' }}
          onBlur={e   => { (e.currentTarget as HTMLTextAreaElement).style.borderColor = 'var(--border-strong)' }}
        />
        {streaming ? (
          <button onClick={stop} style={{ background: 'var(--red-soft)', border: '1px solid rgba(220,38,38,0.4)', borderRadius: 'var(--r-md)', color: 'var(--red)', cursor: 'pointer', padding: '9px 11px', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
            <Square size={14} />
          </button>
        ) : (
          <button
            onClick={() => { ask(input); setInput('') }}
            disabled={!hasKey || !input.trim()}
            style={{ background: input.trim() && hasKey ? 'var(--accent)' : 'var(--surface2)', border: `1px solid ${input.trim() && hasKey ? 'var(--accent)' : 'var(--border-strong)'}`, borderRadius: 'var(--r-md)', color: input.trim() && hasKey ? '#111820' : 'var(--text3)', cursor: input.trim() && hasKey ? 'pointer' : 'default', padding: '9px 11px', display: 'flex', alignItems: 'center', flexShrink: 0, transition: 'all .12s' }}
          >
            <Send size={14} />
          </button>
        )}
      </div>
    </div>
  )
}
