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
        display: 'flex', alignItems: 'center', gap: 6,
        border: `1px solid ${expanded || query ? 'var(--accent)' : 'var(--border)'}`,
        background: expanded || query ? 'var(--surface)' : 'var(--surface2)',
        borderRadius: 'var(--r-md)',
        padding: '5px 10px', transition: 'all 0.15s',
        minWidth: expanded ? 170 : 'auto',
      }}>
        <Fingerprint size={11} style={{ color: query ? 'var(--accent)' : 'var(--text3)', flexShrink: 0 }} />
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
              fontSize: '11px', color: 'var(--text1)', fontFamily: 'inherit',
              letterSpacing: '0', minWidth: 128,
            }}
          />
        ) : (
          <button
            onClick={() => setExpanded(true)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text2)', fontSize: '11px', fontWeight: 500, letterSpacing: '.04em', padding: 0, fontFamily: 'inherit' }}
          >
            OSINT
          </button>
        )}
        {query && <button onClick={() => { setQuery(''); setExpanded(false) }}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', display: 'flex', padding: 0 }}>
          <X size={11} />
        </button>}
        {expanded && query && (
          <button onClick={handleSubmit}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent)', display: 'flex', padding: 0 }}>
            <Search size={11} />
          </button>
        )}
      </div>

      {/* ── Results modal ──────────────────────────────────────────────────── */}
      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 300,
            background: 'rgba(20,22,26,0.45)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
            paddingTop: 44,
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width: 540, maxWidth: '96vw', maxHeight: '82vh',
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--r-lg)',
              boxShadow: 'var(--shadow-lg)',
              display: 'flex', flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            {/* Header */}
            <div style={{
              display: 'flex', alignItems: 'center', padding: '12px 16px',
              borderBottom: '1px solid var(--border)',
              background: 'var(--surface2)',
              flexShrink: 0,
            }}>
              <Fingerprint size={13} style={{ color: 'var(--accent)', marginRight: 10 }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.04em', color: 'var(--text1)' }}>OSINT Lookup</div>
                <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 5 }}>
                  <TypeIcon size={9} />
                  {queryType.toUpperCase()} · <span style={{ color: 'var(--text2)' }}>{query}</span>
                </div>
              </div>
              <button onClick={() => setOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', fontSize: 18, lineHeight: 1, transition: 'color .12s', borderRadius: 'var(--r-sm)', padding: '2px 6px' }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--red)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--text3)' }}
              >×</button>
            </div>

            {/* Body */}
            <div style={{ overflowY: 'auto', flex: 1 }}>
              {searching && (
                <div style={{ padding: '24px', fontSize: 11, color: 'var(--text3)', letterSpacing: '.04em', textAlign: 'center' }}>
                  Querying sources…
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
    <div style={{ padding: '12px 14px', fontSize: 11, color: 'var(--red)', lineHeight: 1.6 }}>
      ⚠ {text}
    </div>
  )
}

function Row({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div style={{ display: 'flex', gap: 12, padding: '5px 0', borderBottom: '1px solid var(--border)', fontSize: 11 }}>
      <span style={{ color: 'var(--text3)', width: 140, flexShrink: 0 }}>{label}</span>
      <span style={{ color: highlight ? 'var(--accent)' : 'var(--text2)' }}>{value}</span>
    </div>
  )
}

function EmailResults({ data }: { data: EmailRepResult }) {
  const repColor = data.reputation === 'high' ? 'var(--green)'
                 : data.reputation === 'medium' ? 'var(--amber)'
                 : data.reputation === 'low' ? 'var(--amber)' : 'var(--red)'

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
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '10px 12px', borderRadius: 'var(--r-md)', background: 'var(--surface2)', border: `1px solid ${repColor}33` }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 800, color: repColor, lineHeight: 1 }}>{data.reputation.toUpperCase()}</div>
          <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 3 }}>REPUTATION</div>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12, color: 'var(--text1)', marginBottom: 2 }}>{data.email}</div>
          <div style={{ fontSize: 10, color: 'var(--text3)' }}>{data.references} external references found</div>
        </div>
        {data.suspicious && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--red)', fontSize: 10, fontWeight: 700 }}>
            <AlertTriangle size={12} /> SUSPICIOUS
          </div>
        )}
      </div>

      {/* Flag grid */}
      <div>
        <div style={{ fontSize: 10, color: 'var(--text3)', fontWeight: 600, marginBottom: 6 }}>INDICATORS</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
          {flags.map(({ label, val, danger }) => {
            const active = val
            const color  = active ? (danger ? 'var(--red)' : 'var(--amber)') : 'var(--text3)'
            return (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 8px', borderRadius: 'var(--r-sm)', background: active ? (danger ? 'var(--red-soft)' : 'var(--amber-soft)') : 'transparent', border: `1px solid ${active ? color + '55' : 'var(--border)'}`, fontSize: 10 }}>
                {active
                  ? (danger ? <AlertTriangle size={10} style={{ color }} /> : <CheckCircle size={10} style={{ color }} />)
                  : <XCircle size={10} style={{ color: 'var(--text3)' }} />}
                <span style={{ color: active ? color : 'var(--text2)' }}>{label}</span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Details */}
      <div>
        <div style={{ fontSize: 10, color: 'var(--text3)', fontWeight: 600, marginBottom: 4 }}>DETAILS</div>
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
          <div style={{ fontSize: 10, color: 'var(--text3)', fontWeight: 600, marginBottom: 6 }}>ASSOCIATED PROFILES</div>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {data.details.profiles.map(p => (
              <span key={p} style={{ fontSize: 10, color: 'var(--green)', padding: '2px 8px', borderRadius: 'var(--r-pill)', border: '1px solid var(--green)' }}>{p.toUpperCase()}</span>
            ))}
          </div>
        </div>
      )}

      {/* External links */}
      <div style={{ paddingTop: 8, borderTop: '1px solid var(--border)', display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {[
          { label: 'HaveIBeenPwned', url: `https://haveibeenpwned.com/account/${encodeURIComponent(data.email)}` },
          { label: 'Hunter.io', url: `https://hunter.io/email-verifier/${encodeURIComponent(data.email)}` },
          { label: 'Google Search', url: `https://www.google.com/search?q=${encodeURIComponent('"' + data.email + '"')}` },
        ].map(({ label, url }) => (
          <a key={label} href={url} target="_blank" rel="noopener noreferrer"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, color: 'var(--accent)', textDecoration: 'none' }}>
            <ExternalLink size={10} /> {label}
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
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '10px 12px', borderRadius: 'var(--r-md)', background: 'var(--surface2)', border: `1px solid ${data.valid ? 'var(--green)' : 'var(--red)'}33` }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 800, color: data.valid ? 'var(--green)' : 'var(--red)', lineHeight: 1 }}>
            {data.valid ? 'VALID' : 'INVALID'}
          </div>
          <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 3 }}>FORMAT</div>
        </div>
        <div>
          <div style={{ fontSize: 13, color: 'var(--text1)', fontVariantNumeric: 'tabular-nums' }}>{data.normalized}</div>
          <div style={{ fontSize: 11, color: 'var(--text2)', marginTop: 2 }}>{data.country}</div>
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

      <div style={{ paddingTop: 8, borderTop: '1px solid var(--border)' }}>
        <div style={{ fontSize: 10, color: 'var(--text3)', fontWeight: 600, marginBottom: 6 }}>LOOKUP RESOURCES</div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {[
            { label: 'Truecaller',     url: `https://www.truecaller.com/search/us/${data.normalized.replace('+', '')}` },
            { label: 'Sync.me',        url: `https://sync.me/search/?number=${encodeURIComponent(data.normalized)}` },
            { label: 'Spy Dialer',     url: `https://www.spydialer.com/default.aspx` },
            { label: 'Google Search',  url: `https://www.google.com/search?q=${encodeURIComponent('"' + data.normalized + '"')}` },
            { label: 'WhoCalledMe',    url: `https://whocallsme.com/Phone-Number.aspx/${data.normalized.replace(/\D/g,'')}` },
          ].map(({ label, url }) => (
            <a key={label} href={url} target="_blank" rel="noopener noreferrer"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, color: 'var(--accent)', textDecoration: 'none' }}>
              <ExternalLink size={10} /> {label}
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
      <div style={{ fontSize: 10, color: 'var(--text3)' }}>
        Public OSINT sources — <span style={{ color: 'var(--accent)' }}>"{query.toUpperCase()}"</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
        {links.map(link => (
          <a
            key={link.label}
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            style={{ textDecoration: 'none', padding: '9px 11px', borderRadius: 'var(--r-md)', background: 'var(--surface2)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', transition: 'all .1s' }}
            onMouseEnter={e => { const el = e.currentTarget as HTMLAnchorElement; el.style.borderColor = link.color; el.style.background = link.color + '14' }}
            onMouseLeave={e => { const el = e.currentTarget as HTMLAnchorElement; el.style.borderColor = 'var(--border)'; el.style.background = 'var(--surface2)' }}
          >
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: link.color }}>{link.label}</div>
              <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 1 }}>{link.desc}</div>
            </div>
            <ExternalLink size={10} style={{ color: 'var(--text3)', flexShrink: 0 }} />
          </a>
        ))}
      </div>

      <div style={{ padding: '9px 11px', borderRadius: 'var(--r-md)', background: 'var(--accent-soft)', border: '1px solid var(--border)', fontSize: 10, color: 'var(--text2)', lineHeight: 1.7 }}>
        Links open public directories using the name provided. Results depend on publicly available records only.
        No data is collected or stored by this application.
      </div>
    </div>
  )
}
