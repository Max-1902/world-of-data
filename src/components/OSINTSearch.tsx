import { useState, useRef, useEffect } from 'react'
import { Fingerprint, Mail, Phone, User, ExternalLink, X, AlertTriangle, CheckCircle, XCircle, Search } from 'lucide-react'
import {
  detectQueryType, lookupEmail, parsePhone, getNameSearchLinks,
  type OSINTQueryType, type EmailRepResult, type PhoneInfo, type NameSearchLink,
} from '../services/osint'

export default function OSINTSearch() {
  const [expanded, setExpanded]     = useState(false)
  const [query, setQuery]           = useState('')
  const [searching, setSearching]   = useState(false)
  const [open, setOpen]             = useState(false)
  const [queryType, setQueryType]   = useState<OSINTQueryType>('name')
  const [emailResult, setEmailResult] = useState<EmailRepResult | null>(null)
  const [phoneResult, setPhoneResult] = useState<PhoneInfo | null>(null)
  const [nameLinks, setNameLinks]   = useState<NameSearchLink[]>([])
  const [emailError, setEmailError] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (expanded) inputRef.current?.focus()
  }, [expanded])

  async function handleSubmit() {
    const q = query.trim()
    if (!q) return
    const type = detectQueryType(q)
    setQueryType(type)
    setSearching(true)
    setOpen(true)
    setEmailResult(null)
    setPhoneResult(null)
    setNameLinks([])
    setEmailError(false)

    if (type === 'email') {
      const r = await lookupEmail(q)
      if (r) setEmailResult(r)
      else setEmailError(true)
    } else if (type === 'phone') {
      setPhoneResult(parsePhone(q))
    } else {
      setNameLinks(getNameSearchLinks(q))
    }
    setSearching(false)
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter')  handleSubmit()
    if (e.key === 'Escape') { setExpanded(false); setQuery('') }
  }

  const TypeIcon = queryType === 'email' ? Mail : queryType === 'phone' ? Phone : User

  return (
    <>
      {/* ── Compact search trigger ─────────────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 4,
        border: `1px solid ${expanded || query ? 'rgba(255,170,0,0.4)' : '#0d1e30'}`,
        background: expanded || query ? 'rgba(255,170,0,0.05)' : 'transparent',
        padding: '2px 6px', transition: 'all 0.15s',
        minWidth: expanded ? 170 : 'auto',
      }}>
        <Fingerprint size={9} style={{ color: query ? '#ffaa00' : '#2a4060', flexShrink: 0 }} />
        {expanded ? (
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKey}
            onBlur={() => { if (!query) setExpanded(false) }}
            placeholder="name · email · phone…"
            style={{
              flex: 1, background: 'transparent', border: 'none', outline: 'none',
              fontSize: '9px', color: '#c0dcc4', fontFamily: 'inherit',
              letterSpacing: '.04em', minWidth: 128,
            }}
          />
        ) : (
          <button
            onClick={() => setExpanded(true)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#2a4060', fontSize: '9px', letterSpacing: '.12em', padding: 0, fontFamily: 'inherit' }}
          >
            OSINT
          </button>
        )}
        {query && <button onClick={() => { setQuery(''); setExpanded(false) }}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#2a4060', display: 'flex', padding: 0 }}>
          <X size={9} />
        </button>}
        {expanded && query && (
          <button onClick={handleSubmit}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ffaa00', display: 'flex', padding: 0 }}>
            <Search size={9} />
          </button>
        )}
      </div>

      {/* ── Results modal ──────────────────────────────────────────────────── */}
      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 300,
            background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
            paddingTop: 44,
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width: 540, maxWidth: '96vw', maxHeight: '82vh',
              background: 'rgba(8,14,10,0.99)',
              border: '1px solid rgba(255,170,0,0.18)',
              borderTop: '2px solid rgba(255,170,0,0.55)',
              backdropFilter: 'blur(20px)',
              boxShadow: '0 20px 80px rgba(0,0,0,0.95)',
              display: 'flex', flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            {/* Header */}
            <div style={{
              display: 'flex', alignItems: 'center', padding: '9px 14px',
              borderBottom: '1px solid #141e16',
              background: 'linear-gradient(90deg, rgba(255,170,0,0.06) 0%, transparent 60%)',
              flexShrink: 0,
            }}>
              <Fingerprint size={11} style={{ color: '#ffaa00', marginRight: 8 }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.18em', color: '#ffaa00' }}>OSINT LOOKUP</div>
                <div style={{ fontSize: 7.5, color: '#2a3e2e', letterSpacing: '.1em', marginTop: 1, display: 'flex', alignItems: 'center', gap: 5 }}>
                  <TypeIcon size={7} />
                  {queryType.toUpperCase()} · <span style={{ color: '#4a6a50' }}>{query}</span>
                </div>
              </div>
              <button onClick={() => setOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#2a3e2e', fontSize: 18, lineHeight: 1, transition: 'color .12s' }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = '#ff1a3e' }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = '#2a3e2e' }}
              >×</button>
            </div>

            {/* Body */}
            <div style={{ overflowY: 'auto', flex: 1 }}>
              {searching && (
                <div style={{ padding: '24px', fontSize: 9, color: '#2a3e2e', letterSpacing: '.14em', textAlign: 'center' }}>
                  // QUERYING SOURCES…
                </div>
              )}
              {!searching && queryType === 'email' && emailResult && <EmailResults data={emailResult} />}
              {!searching && queryType === 'email' && emailError && <ErrMessage text="EmailRep query failed — API may be rate-limited (10 req/day free tier). Try again shortly." />}
              {!searching && queryType === 'phone' && phoneResult && <PhoneResults data={phoneResult} />}
              {!searching && queryType === 'name' && nameLinks.length > 0 && <NameResults query={query} links={nameLinks} />}
            </div>
          </div>
        </div>
      )}
    </>
  )
}

// ── Sub-components ─────────────────────────────────────────────────────────

function ErrMessage({ text }: { text: string }) {
  return (
    <div style={{ padding: '12px 14px', fontSize: 8.5, color: '#ff4444', letterSpacing: '.06em', lineHeight: 1.6 }}>
      ⚠ {text}
    </div>
  )
}

function Row({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div style={{ display: 'flex', gap: 12, padding: '4px 0', borderBottom: '1px solid #0d120e', fontSize: 9 }}>
      <span style={{ color: '#2a3e2e', width: 140, flexShrink: 0, letterSpacing: '.04em' }}>{label}</span>
      <span style={{ color: highlight ? '#ffaa00' : '#8aac90', letterSpacing: '.03em' }}>{value}</span>
    </div>
  )
}

function EmailResults({ data }: { data: EmailRepResult }) {
  const repColor = data.reputation === 'high' ? '#00ff88'
                 : data.reputation === 'medium' ? '#ffcc00'
                 : data.reputation === 'low' ? '#ff8800' : '#ff1a3e'

  const flags: { label: string; val: boolean; danger: boolean }[] = [
    { label: 'Data Breach',         val: data.details.data_breach,               danger: true  },
    { label: 'Credentials Leaked',  val: data.details.credentials_leaked,        danger: true  },
    { label: 'Malicious Activity',  val: data.details.malicious_activity,        danger: true  },
    { label: 'Blacklisted',         val: data.details.blacklisted,               danger: true  },
    { label: 'Spam',                val: data.details.spam,                      danger: true  },
    { label: 'Suspicious TLD',      val: data.details.suspicious_tld,            danger: true  },
    { label: 'Disposable Address',  val: data.details.disposable,                danger: true  },
    { label: 'Free Provider',       val: data.details.free_provider,             danger: false },
    { label: 'New Domain (<90d)',   val: data.details.new_domain,                danger: true  },
    { label: 'Deliverable',        val: !data.details.deliverable,               danger: false }, // true = NOT deliverable
    { label: 'Accept-All MX',      val: data.details.accept_all,                 danger: false },
    { label: 'Spam List',          val: data.details.spam_list,                  danger: true  },
  ]

  return (
    <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Reputation header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '10px 12px', background: 'rgba(255,255,255,0.02)', border: `1px solid ${repColor}22` }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 800, color: repColor, lineHeight: 1, letterSpacing: '.04em' }}>{data.reputation.toUpperCase()}</div>
          <div style={{ fontSize: 7.5, color: '#2a3e2e', letterSpacing: '.12em', marginTop: 3 }}>REPUTATION</div>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 10, color: '#c0dcc4', marginBottom: 2 }}>{data.email}</div>
          <div style={{ fontSize: 8, color: '#2a3e2e' }}>{data.references} external references found</div>
        </div>
        {data.suspicious && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#ff1a3e', fontSize: 8, letterSpacing: '.1em', fontWeight: 700 }}>
            <AlertTriangle size={10} /> SUSPICIOUS
          </div>
        )}
      </div>

      {/* Flag grid */}
      <div>
        <div style={{ fontSize: 8, color: '#2a3e2e', letterSpacing: '.12em', marginBottom: 6 }}>INDICATORS</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 3 }}>
          {flags.map(({ label, val, danger }) => {
            const active = val
            const color  = active ? (danger ? '#ff4444' : '#ffcc00') : '#1a2a3a'
            return (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 8px', background: active ? (danger ? 'rgba(255,26,62,0.06)' : 'rgba(255,204,0,0.04)') : 'transparent', border: `1px solid ${active ? color + '33' : '#141e16'}`, fontSize: 8, letterSpacing: '.06em' }}>
                {active
                  ? (danger ? <AlertTriangle size={8} style={{ color }} /> : <CheckCircle size={8} style={{ color }} />)
                  : <XCircle size={8} style={{ color: '#0d1e30' }} />}
                <span style={{ color }}>{label}</span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Details */}
      <div>
        <div style={{ fontSize: 8, color: '#2a3e2e', letterSpacing: '.12em', marginBottom: 4 }}>DETAILS</div>
        <Row label="Domain" value={data.details.domain_exists ? 'EXISTS' : 'NOT FOUND'} highlight={!data.details.domain_exists} />
        <Row label="Domain Reputation" value={data.details.domain_reputation || '—'} />
        <Row label="Primary MX" value={data.details.primary_mx || '—'} />
        <Row label="Domain Age" value={data.details.days_since_domain_creation ? `${data.details.days_since_domain_creation} days` : '—'} />
        <Row label="First Seen" value={data.details.first_seen || '—'} />
        <Row label="Last Seen" value={data.details.last_seen || '—'} />
      </div>

      {/* Associated profiles */}
      {data.details.profiles && data.details.profiles.length > 0 && (
        <div>
          <div style={{ fontSize: 8, color: '#2a3e2e', letterSpacing: '.12em', marginBottom: 6 }}>ASSOCIATED PROFILES</div>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {data.details.profiles.map(p => (
              <span key={p} style={{ fontSize: 8, color: '#00ff88', padding: '2px 7px', border: '1px solid rgba(0,255,136,0.22)', letterSpacing: '.08em' }}>{p.toUpperCase()}</span>
            ))}
          </div>
        </div>
      )}

      {/* External links */}
      <div style={{ paddingTop: 8, borderTop: '1px solid #141e16', display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {[
          { label: 'HaveIBeenPwned', url: `https://haveibeenpwned.com/account/${encodeURIComponent(data.email)}` },
          { label: 'Hunter.io', url: `https://hunter.io/email-verifier/${encodeURIComponent(data.email)}` },
          { label: 'Google Search', url: `https://www.google.com/search?q=${encodeURIComponent('"' + data.email + '"')}` },
        ].map(({ label, url }) => (
          <a key={label} href={url} target="_blank" rel="noopener noreferrer"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 8, color: '#ffaa00', letterSpacing: '.09em', textDecoration: 'none' }}>
            <ExternalLink size={7} /> {label}
          </a>
        ))}
      </div>
    </div>
  )
}

function PhoneResults({ data }: { data: PhoneInfo }) {
  return (
    <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '10px 12px', background: 'rgba(255,255,255,0.02)', border: `1px solid ${data.valid ? '#00ff8822' : '#ff1a3e22'}` }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 800, color: data.valid ? '#00ff88' : '#ff1a3e', lineHeight: 1 }}>
            {data.valid ? 'VALID' : 'INVALID'}
          </div>
          <div style={{ fontSize: 7.5, color: '#2a3e2e', letterSpacing: '.12em', marginTop: 3 }}>FORMAT</div>
        </div>
        <div>
          <div style={{ fontSize: 12, color: '#c0dcc4', fontVariantNumeric: 'tabular-nums', letterSpacing: '.04em' }}>{data.normalized}</div>
          <div style={{ fontSize: 9, color: '#4a6a50', marginTop: 2 }}>{data.country}</div>
        </div>
      </div>

      <div>
        <Row label="Raw Input"    value={data.raw} />
        <Row label="Normalized"   value={data.normalized} />
        <Row label="Country Code" value={data.countryCode || 'Unknown'} highlight={!data.countryCode} />
        <Row label="Country"      value={data.country} />
        <Row label="Number Type"  value={data.type} />
        <Row label="Valid Format" value={data.valid ? 'YES' : 'NO'} highlight={!data.valid} />
      </div>

      <div style={{ paddingTop: 8, borderTop: '1px solid #141e16' }}>
        <div style={{ fontSize: 8, color: '#2a3e2e', letterSpacing: '.12em', marginBottom: 6 }}>LOOKUP RESOURCES</div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {[
            { label: 'Truecaller',     url: `https://www.truecaller.com/search/us/${data.normalized.replace('+', '')}` },
            { label: 'Sync.me',        url: `https://sync.me/search/?number=${encodeURIComponent(data.normalized)}` },
            { label: 'Spy Dialer',     url: `https://www.spydialer.com/default.aspx` },
            { label: 'Google Search',  url: `https://www.google.com/search?q=${encodeURIComponent('"' + data.normalized + '"')}` },
            { label: 'WhoCalledMe',    url: `https://whocallsme.com/Phone-Number.aspx/${data.normalized.replace(/\D/g,'')}` },
          ].map(({ label, url }) => (
            <a key={label} href={url} target="_blank" rel="noopener noreferrer"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 8, color: '#ffaa00', letterSpacing: '.09em', textDecoration: 'none' }}>
              <ExternalLink size={7} /> {label}
            </a>
          ))}
        </div>
      </div>
    </div>
  )
}

function NameResults({ query, links }: { query: string; links: NameSearchLink[] }) {
  return (
    <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ fontSize: 8, color: '#2a3e2e', letterSpacing: '.12em' }}>
        // PUBLIC OSINT SOURCES — <span style={{ color: '#ffaa00' }}>"{query.toUpperCase()}"</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
        {links.map(link => (
          <a
            key={link.label}
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            style={{ textDecoration: 'none', padding: '8px 10px', background: 'rgba(255,255,255,0.02)', border: '1px solid #141e16', display: 'flex', alignItems: 'center', justifyContent: 'space-between', transition: 'all .1s' }}
            onMouseEnter={e => { const el = e.currentTarget as HTMLAnchorElement; el.style.borderColor = link.color + '44'; el.style.background = link.color + '0a' }}
            onMouseLeave={e => { const el = e.currentTarget as HTMLAnchorElement; el.style.borderColor = '#141e16';       el.style.background = 'rgba(255,255,255,0.02)' }}
          >
            <div>
              <div style={{ fontSize: 9, fontWeight: 700, color: link.color, letterSpacing: '.07em' }}>{link.label}</div>
              <div style={{ fontSize: 7.5, color: '#2a3e2e', marginTop: 1 }}>{link.desc}</div>
            </div>
            <ExternalLink size={8} style={{ color: '#1a2a3a', flexShrink: 0 }} />
          </a>
        ))}
      </div>

      <div style={{ padding: '8px 10px', background: 'rgba(255,170,0,0.03)', border: '1px solid rgba(255,170,0,0.1)', fontSize: 7.5, color: '#3a5070', letterSpacing: '.04em', lineHeight: 1.7 }}>
        Links open public directories using the name provided. Results depend on publicly available records only.
        No data is collected or stored by this application.
      </div>
    </div>
  )
}
