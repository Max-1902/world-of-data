/**
 * Panel implementations. Split out of the former PanelContent.tsx; wired up in src/panels/registry.tsx.
 */
import { useState, useCallback, useEffect } from 'react'
import { ExternalLink, TrendingUp, TrendingDown } from 'lucide-react'
import { Stock } from '../../types'
import { fetchMultipleQuotes } from '../../services/stocks'
import { onGlobalReload } from '../../utils/reloadBus'
import { SECTORS } from './OverviewPanels'

function StockRow({ s }: { s: Stock }) {
  const pos = s.changePercent >= 0
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '3px 10px', borderBottom: '1px solid var(--border)', borderLeft: '2px solid transparent', transition: 'all .1s' }}
      onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = 'var(--accent-soft)'; (e.currentTarget as HTMLDivElement).style.borderLeftColor = 'var(--accent)' }}
      onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = ''; (e.currentTarget as HTMLDivElement).style.borderLeftColor = 'transparent' }}
    >
      <div>
        <div style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--text1)' }}>{s.symbol}</div>
        <div style={{ fontSize: '10px', color: 'var(--text3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 80 }}>{s.exchange || s.name}</div>
      </div>
      <div style={{ textAlign: 'right' }}>
        <div style={{ fontSize: '12.5px', color: 'var(--text1)', fontVariantNumeric: 'tabular-nums' }}>${s.price.toFixed(2)}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 2, justifyContent: 'flex-end', fontSize: '10.5px', color: pos ? 'var(--accent)' : 'var(--red)' }}>
          {pos ? <TrendingUp size={7} /> : <TrendingDown size={7} />}
          {pos ? '+' : ''}{s.changePercent.toFixed(2)}%
        </div>
      </div>
    </div>
  )
}

function StockList({ symbols }: { symbols: string[] }) {
  const [stocks, setStocks] = useState<Stock[]>([])
  const [loading, setLoading] = useState(true)
  const [retryCount, setRetryCount] = useState(0)
  const key = symbols.join(',')

  useEffect(() => {
    const load = () => { setLoading(true); fetchMultipleQuotes(symbols).then(setStocks).finally(() => setLoading(false)) }
    load()
    const timer = window.setInterval(load, 60_000)
    const unsub = onGlobalReload(load)
    return () => { clearInterval(timer); unsub() }
  }, [key, retryCount]) // eslint-disable-line

  const noData = !loading && stocks.length === 0
  if (noData) return (
    <div style={{ padding: '10px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
      <div style={{ fontSize: 10.5, color: 'var(--text3)', letterSpacing: '.1em', textAlign: 'center' }}>MARKET DATA UNAVAILABLE</div>
      <div style={{ fontSize: 9.5, color: 'var(--text3)', textAlign: 'center', lineHeight: 1.6 }}>
        Set FINNHUB_KEY on the server<br />to enable live market feeds
      </div>
      {/* Skeleton rows */}
      {symbols.slice(0, 4).map((sym, i) => (
        <div key={i} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 6, padding: '4px 0', opacity: 0.3 }}>
          <div style={{ fontSize: 10.5, color: 'var(--text3)', width: 36, fontWeight: 700 }}>{sym}</div>
          <div style={{ flex: 1, height: 3, background: 'var(--border)', borderRadius: 2 }} />
          <div style={{ width: 40, height: 8, background: 'var(--border)', borderRadius: 2 }} />
        </div>
      ))}
    </div>
  )
  if (loading && stocks.length === 0) return (
    <div style={{ padding: '8px 10px' }}>
      {symbols.slice(0, 6).map((sym, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 0', borderBottom: '1px solid var(--border)' }}>
          <div style={{ fontSize: 10.5, color: 'var(--text3)', width: 36, fontWeight: 700 }}>{sym}</div>
          <div style={{ flex: 1 }}>
            <div style={{ height: 3, background: 'var(--border)', borderRadius: 2, width: `${60 + (i * 7) % 30}%`, animation: 'pulse 1.5s ease-in-out infinite', opacity: 0.5 }} />
          </div>
          <div style={{ width: 44, height: 8, background: 'var(--border)', borderRadius: 2, animation: 'pulse 1.5s ease-in-out infinite', opacity: 0.4 }} />
        </div>
      ))}
    </div>
  )
  if (!loading && stocks.length === 0) return (
    <div style={{ padding: '10px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
      <div style={{ fontSize: 10.5, color: 'var(--text3)', letterSpacing: '.1em' }}>DATA FEED INTERRUPTED</div>
      <div style={{ fontSize: 9.5, color: 'var(--text3)', textAlign: 'center', lineHeight: 1.5 }}>
        Market data temporarily unavailable.<br />Finnhub may be rate-limiting.
      </div>
      <button
        onClick={() => setRetryCount(c => c + 1)}
        style={{
          background: 'var(--accent-soft)', border: '1px solid var(--accent)33',
          color: 'var(--accent)', cursor: 'pointer', fontSize: 10, padding: '3px 12px',
          letterSpacing: '.1em', fontWeight: 700, fontFamily: 'inherit',
        }}
      >↻ RETRY</button>
    </div>
  )
  return (
    <div style={{ flex: 1, overflowY: 'auto' }}>
      {stocks.map(s => <StockRow key={s.symbol} s={s} />)}
    </div>
  )
}

// ── World Exchanges Panel ──────────────────────────────────────────────────────
const WORLD_EXCHANGES: { country: string; flag: string; exchange: string; ticker: string; url: string }[] = [
  { country: 'United States', flag: 'US', exchange: 'NYSE / NASDAQ',    ticker: 'SPY',      url: 'https://finance.yahoo.com/quote/SPY' },
  { country: 'United Kingdom',flag: 'GB', exchange: 'London (LSE)',      ticker: 'EWU',      url: 'https://finance.yahoo.com/quote/EWU' },
  { country: 'Germany',       flag: 'DE', exchange: 'Frankfurt (DAX)',   ticker: 'EWG',      url: 'https://finance.yahoo.com/quote/EWG' },
  { country: 'France',        flag: 'FR', exchange: 'Euronext Paris',    ticker: 'EWQ',      url: 'https://finance.yahoo.com/quote/EWQ' },
  { country: 'Japan',         flag: 'JP', exchange: 'Tokyo (TSE)',        ticker: 'EWJ',      url: 'https://finance.yahoo.com/quote/EWJ' },
  { country: 'China',         flag: 'CN', exchange: 'Shanghai / Shenzhen',ticker:'FXI',      url: 'https://finance.yahoo.com/quote/FXI' },
  { country: 'Hong Kong',     flag: 'HK', exchange: 'HKEX',              ticker: 'EWH',      url: 'https://finance.yahoo.com/quote/EWH' },
  { country: 'India',         flag: 'IN', exchange: 'BSE / NSE',         ticker: 'INDA',     url: 'https://finance.yahoo.com/quote/INDA' },
  { country: 'Brazil',        flag: 'BR', exchange: 'B3 (Bovespa)',       ticker: 'EWZ',      url: 'https://finance.yahoo.com/quote/EWZ' },
  { country: 'Canada',        flag: 'CA', exchange: 'TSX',               ticker: 'EWC',      url: 'https://finance.yahoo.com/quote/EWC' },
  { country: 'Australia',     flag: 'AU', exchange: 'ASX',               ticker: 'EWA',      url: 'https://finance.yahoo.com/quote/EWA' },
  { country: 'South Korea',   flag: 'KR', exchange: 'KRX (KOSPI)',        ticker: 'EWY',      url: 'https://finance.yahoo.com/quote/EWY' },
  { country: 'Taiwan',        flag: 'TW', exchange: 'TWSE',              ticker: 'EWT',      url: 'https://finance.yahoo.com/quote/EWT' },
  { country: 'Switzerland',   flag: 'CH', exchange: 'SIX',               ticker: 'EWL',      url: 'https://finance.yahoo.com/quote/EWL' },
  { country: 'Netherlands',   flag: 'NL', exchange: 'Euronext Amsterdam', ticker: 'EWN',      url: 'https://finance.yahoo.com/quote/EWN' },
  { country: 'Sweden',        flag: 'SE', exchange: 'Nasdaq Stockholm',   ticker: 'EWD',      url: 'https://finance.yahoo.com/quote/EWD' },
  { country: 'Spain',         flag: 'ES', exchange: 'BME (IBEX 35)',      ticker: 'EWP',      url: 'https://finance.yahoo.com/quote/EWP' },
  { country: 'Italy',         flag: 'IT', exchange: 'Borsa Italiana',     ticker: 'EWI',      url: 'https://finance.yahoo.com/quote/EWI' },
  { country: 'Mexico',        flag: 'MX', exchange: 'BMV (IPC)',          ticker: 'EWW',      url: 'https://finance.yahoo.com/quote/EWW' },
  { country: 'Russia',        flag: 'RU', exchange: 'MOEX',              ticker: 'ERUS',     url: 'https://finance.yahoo.com/quote/ERUS' },
  { country: 'Saudi Arabia',  flag: 'SA', exchange: 'Tadawul (TASI)',     ticker: 'KSA',      url: 'https://finance.yahoo.com/quote/KSA' },
  { country: 'UAE',           flag: 'AE', exchange: 'DFM / ADX',         ticker: 'UAE',      url: 'https://finance.yahoo.com/quote/UAE' },
  { country: 'South Africa',  flag: 'ZA', exchange: 'JSE',               ticker: 'EZA',      url: 'https://finance.yahoo.com/quote/EZA' },
  { country: 'Singapore',     flag: 'SG', exchange: 'SGX',               ticker: 'EWS',      url: 'https://finance.yahoo.com/quote/EWS' },
  { country: 'Indonesia',     flag: 'ID', exchange: 'IDX (JCI)',          ticker: 'EIDO',     url: 'https://finance.yahoo.com/quote/EIDO' },
  { country: 'Malaysia',      flag: 'MY', exchange: 'Bursa Malaysia',     ticker: 'EWM',      url: 'https://finance.yahoo.com/quote/EWM' },
  { country: 'Thailand',      flag: 'TH', exchange: 'SET',               ticker: 'THD',      url: 'https://finance.yahoo.com/quote/THD' },
  { country: 'Turkey',        flag: 'TR', exchange: 'Borsa Istanbul (BIST)',ticker:'TUR',     url: 'https://finance.yahoo.com/quote/TUR' },
  { country: 'Poland',        flag: 'PL', exchange: 'GPW (WIG)',          ticker: 'EPOL',     url: 'https://finance.yahoo.com/quote/EPOL' },
  { country: 'Israel',        flag: 'IL', exchange: 'TASE',              ticker: 'EIS',      url: 'https://finance.yahoo.com/quote/EIS' },
  { country: 'Greece',        flag: 'GR', exchange: 'Athens (ATHEX)',      ticker: 'GREK',     url: 'https://finance.yahoo.com/quote/GREK' },
  { country: 'Argentina',     flag: 'AR', exchange: 'BCBA (MERVAL)',      ticker: 'ARGT',     url: 'https://finance.yahoo.com/quote/ARGT' },
  { country: 'Chile',         flag: 'CL', exchange: 'Bolsa de Santiago',  ticker: 'ECH',      url: 'https://finance.yahoo.com/quote/ECH' },
  { country: 'Colombia',      flag: 'CO', exchange: 'BVC',               ticker: 'GXG',      url: 'https://finance.yahoo.com/quote/GXG' },
  { country: 'Peru',          flag: 'PE', exchange: 'BVL',               ticker: 'EPU',      url: 'https://finance.yahoo.com/quote/EPU' },
  { country: 'Nigeria',       flag: 'NG', exchange: 'NGX',               ticker: 'NGE',      url: 'https://finance.yahoo.com/quote/NGE' },
  { country: 'Egypt',         flag: 'EG', exchange: 'EGX',               ticker: 'EGPT',     url: 'https://finance.yahoo.com/quote/EGPT' },
  { country: 'Pakistan',      flag: 'PK', exchange: 'PSX (KSE-100)',      ticker: 'PAK',      url: 'https://finance.yahoo.com/quote/PAK' },
  { country: 'Vietnam',       flag: 'VN', exchange: 'HOSE / HNX',         ticker: 'VNM',      url: 'https://finance.yahoo.com/quote/VNM' },
  { country: 'Qatar',         flag: 'QA', exchange: 'QSE',               ticker: 'QAT',      url: 'https://finance.yahoo.com/quote/QAT' },
  { country: 'Kuwait',        flag: 'KW', exchange: 'Boursa Kuwait',      ticker: 'KWEB',     url: 'https://www.boursakuwait.com.kw/en' },
  { country: 'Philippines',   flag: 'PH', exchange: 'PSE (PSEi)',         ticker: 'EPHE',     url: 'https://finance.yahoo.com/quote/EPHE' },
  { country: 'Czech Republic',flag: 'CZ', exchange: 'Prague (PX)',         ticker: 'CQQQ',     url: 'https://www.pse.cz/en' },
  { country: 'Hungary',       flag: 'HU', exchange: 'Budapest (BUX)',      ticker: 'MSFE',     url: 'https://finance.yahoo.com/quote/MSFE' },
  { country: 'Romania',       flag: 'RO', exchange: 'BVB',               ticker: 'MSFT',     url: 'https://www.bvb.ro' },
]

function ExchangesPanel() {
  const [search, setSearch] = useState('')
  const tickers = WORLD_EXCHANGES.map(e => e.ticker)
  const { stocks, loading } = useStockQuotes(tickers)

  const filtered = search.trim()
    ? WORLD_EXCHANGES.filter(e =>
        e.country.toLowerCase().includes(search.toLowerCase()) ||
        e.exchange.toLowerCase().includes(search.toLowerCase()) ||
        e.ticker.toLowerCase().includes(search.toLowerCase())
      )
    : WORLD_EXCHANGES

  return (
    <>
      <div style={{ padding: '4px 8px', borderBottom: '1px solid var(--border)' }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search country or exchange…"
          style={{ width: '100%', background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text1)', fontSize: 11.5, padding: '3px 7px', outline: 'none', fontFamily: 'inherit', letterSpacing: '.03em' }}
        />
      </div>
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {loading && <div style={{ padding: '8px 10px', fontSize: '11.5px', color: 'var(--text3)', letterSpacing: '.12em' }}>// LOADING QUOTES…</div>}
        {filtered.map(ex => {
          const q = stocks.find(s => s.symbol === ex.ticker)
          const chg = q?.changePercent ?? null
          const chgColor = chg === null ? 'var(--text3)' : chg >= 0 ? 'var(--accent)' : 'var(--red)'
          return (
            <div key={ex.ticker} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 8px', borderBottom: '1px solid var(--border)', transition: 'background .1s' }}
              onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = 'var(--accent-soft)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = '' }}
            >
              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.06em', color: 'var(--text3)', width: 20, flexShrink: 0 }}>{ex.flag}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '11.5px', color: 'var(--text1)', fontWeight: 600, letterSpacing: '.04em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ex.country}</div>
                <div style={{ fontSize: '10px', color: 'var(--text3)', letterSpacing: '.04em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ex.exchange}</div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontSize: '11.5px', color: 'var(--text1)', fontVariantNumeric: 'tabular-nums' }}>
                  {q ? q.price.toFixed(2) : '—'}
                </div>
                <div style={{ fontSize: '10px', color: chgColor, fontVariantNumeric: 'tabular-nums', fontWeight: 700 }}>
                  {chg !== null ? `${chg >= 0 ? '+' : ''}${chg.toFixed(2)}%` : ''}
                </div>
              </div>
              <a href={ex.url} target="_blank" rel="noopener noreferrer"
                style={{ color: 'var(--text3)', fontSize: 10.5, flexShrink: 0 }}
                title={`Open ${ex.exchange}`}
                onClick={e => e.stopPropagation()}>
                <ExternalLink size={9} />
              </a>
            </div>
          )
        })}
      </div>
    </>
  )
}

// small hook used by ExchangesPanel only
function useStockQuotes(symbols: string[]) {
  const [stocks, setStocks] = useState<Stock[]>([])
  const [loading, setLoading] = useState(false)
  useEffect(() => {
    if (!symbols.length) return
    setLoading(true)
    fetchMultipleQuotes(symbols).then(s => { setStocks(s); setLoading(false) }).catch(() => setLoading(false))
  }, []) // eslint-disable-line
  return { stocks, loading }
}

// ── Crypto Panel (CoinGecko — no API key required) ───────────────────────────
const COINGECKO_IDS: Record<string, string> = {
  BTC: 'bitcoin', ETH: 'ethereum', SOL: 'solana', BNB: 'binancecoin',
  XRP: 'ripple', ADA: 'cardano', DOGE: 'dogecoin', AVAX: 'avalanche-2',
  DOT: 'polkadot', MATIC: 'matic-network',
}

const CRYPTO_LIST = Object.entries(COINGECKO_IDS).map(([sym, id]) => ({ sym, id }))

function CryptoPanel() {
  const [data, setData] = useState<{ sym: string; price: number; change: number }[]>([])
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const ids = CRYPTO_LIST.map(c => c.id).join(',')
      const res = await fetch(
        `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true`,
        { signal: AbortSignal.timeout(10_000) }
      )
      if (!res.ok) throw new Error(`CoinGecko ${res.status}`)
      const json = await res.json()
      setData(CRYPTO_LIST.map(({ sym, id }) => ({
        sym,
        price:  Number(json[id]?.usd  ?? 0),
        change: Number(json[id]?.usd_24h_change ?? 0),
      })).filter(d => d.price > 0))
    } catch (e) {
      console.warn('[CoinGecko]', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    const t = window.setInterval(load, 60_000)
    const unsub = onGlobalReload(load)
    return () => { clearInterval(t); unsub() }
  }, [load])

  if (loading && !data.length) return <div style={{ padding: '8px 10px', fontSize: '11.5px', color: 'var(--text3)', letterSpacing: '.12em' }}>// LOADING…</div>
  return (
    <div style={{ flex: 1, overflowY: 'auto' }}>
      {data.map(d => {
        const pos = d.change >= 0
        const price = d.price >= 1 ? d.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : d.price.toFixed(4)
        return (
          <div key={d.sym} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '3px 10px', borderBottom: '1px solid var(--border)', borderLeft: '2px solid transparent', transition: 'all .1s' }}
            onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = 'var(--accent-soft)'; (e.currentTarget as HTMLDivElement).style.borderLeftColor = 'var(--accent)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = ''; (e.currentTarget as HTMLDivElement).style.borderLeftColor = 'transparent' }}
          >
            <div>
              <div style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--text1)' }}>{d.sym}</div>
              <div style={{ fontSize: '10px', color: 'var(--text3)' }}>crypto · USD</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '12.5px', color: 'var(--text1)', fontVariantNumeric: 'tabular-nums' }}>${price}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 2, justifyContent: 'flex-end', fontSize: '10.5px', color: pos ? 'var(--accent)' : 'var(--red)' }}>
                {pos ? <TrendingUp size={7} /> : <TrendingDown size={7} />}
                {pos ? '+' : ''}{d.change.toFixed(2)}%
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Forex Panel (Open Exchange Rates — no key required) ─────────────────────
const FOREX_PAIRS = [
  { pair: 'EUR/USD', base: 'EUR', quote: 'USD', flag: 'EU' },
  { pair: 'GBP/USD', base: 'GBP', quote: 'USD', flag: 'GB' },
  { pair: 'USD/JPY', base: 'USD', quote: 'JPY', flag: 'JP' },
  { pair: 'USD/CNY', base: 'USD', quote: 'CNY', flag: 'CN' },
  { pair: 'USD/CHF', base: 'USD', quote: 'CHF', flag: 'CH' },
  { pair: 'AUD/USD', base: 'AUD', quote: 'USD', flag: 'AU' },
  { pair: 'USD/CAD', base: 'USD', quote: 'CAD', flag: 'CA' },
  { pair: 'USD/INR', base: 'USD', quote: 'INR', flag: 'IN' },
  { pair: 'USD/RUB', base: 'USD', quote: 'RUB', flag: 'RU' },
  { pair: 'USD/BRL', base: 'USD', quote: 'BRL', flag: 'BR' },
  { pair: 'USD/KRW', base: 'USD', quote: 'KRW', flag: 'KR' },
  { pair: 'USD/MXN', base: 'USD', quote: 'MXN', flag: 'MX' },
]

function ForexPanel() {
  const [rates, setRates] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('https://open.er-api.com/v6/latest/USD', {
        signal: AbortSignal.timeout(10_000),
      })
      if (!res.ok) throw new Error(`ExchangeRate ${res.status}`)
      const json = await res.json()
      setRates(json.rates ?? {})
    } catch (e) {
      console.warn('[Forex]', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    const t = window.setInterval(load, 120_000)
    const unsub = onGlobalReload(load)
    return () => { clearInterval(t); unsub() }
  }, [load])

  if (loading && !Object.keys(rates).length) return <div style={{ padding: '8px 10px', fontSize: '11.5px', color: 'var(--text3)', letterSpacing: '.12em' }}>// LOADING…</div>

  return (
    <div style={{ flex: 1, overflowY: 'auto' }}>
      {FOREX_PAIRS.map(({ pair, base, quote }) => {
        // Convert: rates are all relative to USD base
        let rate = 0
        if (base === 'USD') rate = rates[quote] ?? 0
        else if (quote === 'USD') rate = rates[base] ? 1 / rates[base] : 0
        else rate = (rates[quote] && rates[base]) ? rates[quote] / rates[base] : 0
        if (!rate) return null
        const decimals = rate > 10 ? 2 : rate > 1 ? 4 : 4
        return (
          <div key={pair} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '3px 10px', borderBottom: '1px solid var(--border)', borderLeft: '2px solid transparent', transition: 'all .1s' }}
            onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = 'var(--accent-soft)'; (e.currentTarget as HTMLDivElement).style.borderLeftColor = 'var(--accent)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = ''; (e.currentTarget as HTMLDivElement).style.borderLeftColor = 'transparent' }}
          >
            <div>
              <div style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--text1)' }}>{pair}</div>
              <div style={{ fontSize: '10px', color: 'var(--text3)' }}>forex · spot</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '12.5px', color: 'var(--text1)', fontVariantNumeric: 'tabular-nums' }}>{rate.toFixed(decimals)}</div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Unified Markets Panel ─────────────────────────────────────────────────
const MARKET_TABS = [
  { id: 'indices',     label: 'IDX' },
  { id: 'commodities', label: 'CMD' },
  { id: 'energy',      label: 'NRG' },
  { id: 'tech',        label: 'TCH' },
  { id: 'healthcare',  label: 'HCR' },
  { id: 'defense',     label: 'DEF' },
  { id: 'bonds',       label: 'BND' },
  { id: 'crypto',      label: 'CRY' },
  { id: 'forex',       label: 'FX' },
  { id: 'exchanges',   label: 'EXC' },
] as const

export function MarketsPanel() {
  const [activeTab, setActiveTab] = useState<string>('indices')

  const renderContent = () => {
    switch (activeTab) {
      case 'crypto':    return <CryptoPanel />
      case 'forex':     return <ForexPanel />
      case 'exchanges': return <ExchangesPanel />
      default: {
        const syms = SECTORS[activeTab]
        return syms ? <StockList symbols={syms} /> : null
      }
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Tab bar — scrollable row */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', flexShrink: 0, overflowX: 'auto', gap: 0 }}>
        {MARKET_TABS.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)} style={{
            padding: '4px 7px', fontSize: 9.5, fontWeight: 700, letterSpacing: '.08em',
            background: activeTab === t.id ? 'var(--accent-soft)' : 'transparent',
            border: 'none', borderBottom: activeTab === t.id ? '2px solid var(--accent)' : '2px solid transparent',
            color: activeTab === t.id ? 'var(--accent)' : 'var(--text3)', cursor: 'pointer',
            transition: 'all .12s', flexShrink: 0, fontFamily: 'inherit',
          }}>{t.label}</button>
        ))}
      </div>
      {/* Active content */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {renderContent()}
      </div>
    </div>
  )
}
