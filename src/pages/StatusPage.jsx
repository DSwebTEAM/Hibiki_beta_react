import { useState, useRef, useEffect } from 'react'

// Session-persistent ping store — survives route changes, resets on tab/browser reload
const SESSION_KEY = 'hibiki_ping_session'
function loadSession() { try { return JSON.parse(sessionStorage.getItem(SESSION_KEY) || '{}') } catch { return {} } }
function saveSession(data) { try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(data)) } catch {} }
import { storage } from '../lib/storage'
import { pingProvider, fetchCredits, testCompletion, customPing } from '../lib/api'
import { PROVIDER_LIST, getProvider } from '../lib/providers'
import { showToast } from '../lib/ui'
import BottomNav, { DesktopNav } from '../components/shared/BottomNav'

// Mini sparkline SVG from an array of ms values
function Sparkline({ data, color = '#c96a84', width = 120, height = 36 }) {
  if (!data || data.length < 2) return (
    <div style={{ width, height, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <span style={{ fontFamily: 'var(--font-ui)', fontSize: '0.62rem', color: 'var(--muted)' }}>no data</span>
    </div>
  )
  const min = Math.min(...data)
  const max = Math.max(...data) || 1
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width
    const y = height - ((v - min) / (max - min || 1)) * (height - 6) - 3
    return `${x},${y}`
  }).join(' ')
  return (
    <svg width={width} height={height} style={{ display: 'block' }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {data.map((v, i) => {
        const x = (i / (data.length - 1)) * width
        const y = height - ((v - min) / (max - min || 1)) * (height - 6) - 3
        return <circle key={i} cx={x} cy={y} r="2.5" fill={color} />
      })}
    </svg>
  )
}

// Bar chart for token breakdown
function TokenBar({ prompt, completion, total }) {
  if (!total) return null
  const pct = Math.round((prompt / total) * 100)
  return (
    <div style={{ marginTop: '8px' }}>
      <div style={{ display: 'flex', height: 8, borderRadius: 4, overflow: 'hidden', background: 'var(--border)', marginBottom: '4px' }}>
        <div style={{ width: `${pct}%`, background: 'var(--deep-rose)', transition: 'width 0.4s ease' }} />
        <div style={{ flex: 1, background: 'var(--rose)', opacity: 0.5 }} />
      </div>
      <div style={{ display: 'flex', gap: '12px' }}>
        <span style={{ fontFamily: 'var(--font-ui)', fontSize: '0.62rem', color: 'var(--deep-rose)' }}>■ Prompt {prompt}</span>
        <span style={{ fontFamily: 'var(--font-ui)', fontSize: '0.62rem', color: 'var(--rose)', opacity: 0.8 }}>■ Completion {completion}</span>
        <span style={{ fontFamily: 'var(--font-ui)', fontSize: '0.62rem', color: 'var(--muted)' }}>Total {total}</span>
      </div>
    </div>
  )
}

// Speed rating badge
function SpeedBadge({ ms }) {
  if (!ms) return null
  const { label, bg, fg } =
    ms < 500   ? { label: 'Fast',    bg: '#0e2a1a', fg: '#40d080' } :
    ms < 1500  ? { label: 'Good',    bg: '#1a2a0e', fg: '#80c040' } :
    ms < 3000  ? { label: 'Slow',    bg: '#2a2a0e', fg: '#c0a040' } :
                 { label: 'Very slow', bg: '#2a0e0e', fg: '#d06060' }
  return (
    <span style={{ background: bg, color: fg, fontFamily: 'var(--font-ui)', fontSize: '0.6rem', fontWeight: 700, padding: '2px 7px', borderRadius: '8px', letterSpacing: '0.08em' }}>
      {label}
    </span>
  )
}

export default function StatusPage() {
  const session = loadSession()
  const [results, setResults]         = useState(session.results || {})
  const [credits, setCredits]         = useState(session.credits || {})
  const [testResults, setTestResults] = useState(session.testResults || {})
  const [history, setHistory]         = useState(session.history || {})
  const [pinging, setPinging]         = useState({})
  const [testing, setTesting]         = useState({})
  const [nerdPrompt, setNerdPrompt] = useState('Are you online?')
  const [nerdPid, setNerdPid]       = useState('')
  const [nerdModel, setNerdModel]   = useState('')
  const [nerdResult, setNerdResult] = useState(null)
  const [nerdRunning, setNerdRunning] = useState(false)
  const [activeTab, setActiveTab]   = useState('providers')

  const keys = storage.getProviderKeys()
  const configuredProviders = PROVIDER_LIST.filter(p => keys[p.id])

  // Init nerdPid to first configured provider
  const defaultNerdPid = nerdPid || configuredProviders[0]?.id || 'openrouter'

  function recordHistory(pid, ms) {
    setHistory(h => {
      const prev = h[pid] || []
      const next = { ...h, [pid]: [...prev.slice(-9), ms] }
      saveSession({ results, credits, testResults, history: next })
      return next
    })
  }

  async function ping(pid) {
    setPinging(v => ({ ...v, [pid]: true }))
    const r = await pingProvider(pid)
    setResults(v => {
      const next = { ...v, [pid]: r }
      saveSession({ results: next, credits, testResults, history })
      return next
    })
    if (r.ms) recordHistory(pid, r.ms)
    const cr = await fetchCredits(pid)
    if (cr) setCredits(v => {
      const next = { ...v, [pid]: cr }
      saveSession({ results, credits: next, testResults, history })
      return next
    })
    setPinging(v => ({ ...v, [pid]: false }))
  }

  async function pingAll() {
    configuredProviders.forEach(p => ping(p.id))
    showToast('Pinging all providers…')
  }

  async function runTest(pid) {
    const provider = getProvider(pid)
    const model = storage.getActiveProvider() === pid
      ? (storage.getActiveModel() || provider.defaultModel)
      : provider.defaultModel
    setTesting(v => ({ ...v, [pid]: true }))
    const r = await testCompletion(pid, model)
    setTestResults(v => ({ ...v, [pid]: { ...r, model } }))
    if (r.ms) recordHistory(pid, r.ms)
    setTesting(v => ({ ...v, [pid]: false }))
  }

  async function runNerd() {
    if (!nerdPrompt.trim()) return
    const pid = defaultNerdPid
    const provider = getProvider(pid)
    const model = nerdModel || provider?.defaultModel
    setNerdRunning(true); setNerdResult(null)
    const r = await customPing(pid, model, nerdPrompt)
    setNerdResult({ ...r, pid, model })
    if (r.ms) recordHistory(pid, r.ms)
    setNerdRunning(false)
  }

  const nerdProvider = getProvider(defaultNerdPid)

  // ── Summary stats ──────────────────────────────────────────────────────────
  const totalPings = Object.values(history).reduce((a, h) => a + h.length, 0)
  const allMs = Object.values(history).flat()
  const avgMs = allMs.length ? Math.round(allMs.reduce((a, b) => a + b, 0) / allMs.length) : null
  const connectedCount = Object.values(results).filter(r => r?.ok).length

  const TABS = [
    { id: 'providers', label: 'Providers' },
    { id: 'analysis', label: 'Analysis' },
    { id: 'diagnostic', label: 'Diagnostic' },
  ]

  return (
    <div className="page">
      <DesktopNav />
      <div className="topbar">
        <span className="topbar-kanji">響</span>
        <span className="topbar-title" style={{ flex: 1 }}>API Status</span>
        <button className="topbar-btn" onClick={pingAll} title="Ping all">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
        </button>
      </div>

      <div className="page-inner">

        {/* Summary bar */}
        {totalPings > 0 && (
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '20px' }}>
            {[
              { label: 'Connected', value: `${connectedCount}/${configuredProviders.length}`, color: connectedCount === configuredProviders.length ? '#40d080' : 'var(--rose)' },
              { label: 'Avg latency', value: avgMs ? `${avgMs}ms` : '—', color: 'var(--ink)' },
              { label: 'Total pings', value: totalPings, color: 'var(--muted)' },
            ].map(({ label, value, color }) => (
              <div key={label} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '10px 16px', flex: '1 1 100px', minWidth: 100 }}>
                <div style={{ fontFamily: 'var(--font-ui)', fontSize: '0.62rem', color: 'var(--muted)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '4px' }}>{label}</div>
                <div style={{ fontFamily: 'var(--font-serif)', fontSize: '1.3rem', color, fontWeight: 600 }}>{value}</div>
              </div>
            ))}
          </div>
        )}

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '4px', marginBottom: '16px', borderBottom: '1px solid var(--separator)', paddingBottom: '0' }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)}
              style={{ fontFamily: 'var(--font-ui)', fontSize: '0.78rem', padding: '8px 14px', borderRadius: '10px 10px 0 0', background: activeTab === t.id ? 'var(--surface)' : 'transparent', color: activeTab === t.id ? 'var(--deep-rose)' : 'var(--muted)', border: activeTab === t.id ? '1px solid var(--separator)' : '1px solid transparent', borderBottom: activeTab === t.id ? '1px solid var(--surface)' : '1px solid transparent', marginBottom: '-1px', cursor: 'pointer' }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* ── Providers tab ── */}
        {activeTab === 'providers' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px,1fr))', gap: '12px' }}>
            {configuredProviders.length === 0 && (
              <div style={{ textAlign: 'center', padding: '40px 20px', fontFamily: 'var(--font-ui)', fontSize: '0.82rem', color: 'var(--muted)', gridColumn: '1/-1' }}>
                No API keys configured. Go to Settings to add one.
              </div>
            )}
            {configuredProviders.map(p => {
              const r = results[p.id]
              const cr = credits[p.id]
              const tr = testResults[p.id]
              const hist = history[p.id] || []
              const isPinging = pinging[p.id]
              const isTesting = testing[p.id]
              const avgProvMs = hist.length ? Math.round(hist.reduce((a, b) => a + b, 0) / hist.length) : null

              return (
                <div key={p.id} className="card">
                  {/* Provider header */}
                  <div className="card-section">
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ width: 10, height: 10, borderRadius: '50%', background: r ? (r.ok ? '#40d080' : '#d04040') : 'var(--border)', flexShrink: 0 }} />
                        <span style={{ fontFamily: 'var(--font-ui)', fontSize: '0.88rem', fontWeight: 700, color: p.color }}>{p.emoji} {p.name}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {r?.ms && <SpeedBadge ms={r.ms} />}
                        {r?.ms && <span style={{ fontFamily: 'var(--font-ui)', fontSize: '0.65rem', color: 'var(--muted)' }}>{r.ms}ms</span>}
                      </div>
                    </div>

                    {/* Status line */}
                    {r && (
                      <div style={{ fontFamily: 'var(--font-ui)', fontSize: '0.72rem', color: r.ok ? '#40c070' : '#d04040', marginBottom: '8px' }}>
                        {r.ok ? `✓ Connected · HTTP ${r.status}` : `✗ ${r.error}`}
                      </div>
                    )}

                    {/* Sparkline */}
                    {hist.length >= 2 && (
                      <div style={{ marginBottom: '8px' }}>
                        <div style={{ fontFamily: 'var(--font-ui)', fontSize: '0.6rem', color: 'var(--muted)', marginBottom: '3px' }}>Latency history ({hist.length} pings · avg {avgProvMs}ms)</div>
                        <Sparkline data={hist} color={p.color} width={200} height={32} />
                      </div>
                    )}

                    {/* Credits */}
                    {cr && (
                      <div style={{ background: 'var(--petal)', border: '1px solid var(--border)', borderRadius: '10px', padding: '8px 12px', marginBottom: '8px' }}>
                        <div style={{ fontFamily: 'var(--font-ui)', fontSize: '0.65rem', color: 'var(--muted)', marginBottom: '3px' }}>{cr.label}</div>
                        <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
                          <span style={{ fontFamily: 'var(--font-ui)', fontSize: '0.75rem', color: 'var(--ink)' }}>Balance <strong style={{ color: 'var(--deep-rose)' }}>{cr.credits}</strong></span>
                          <span style={{ fontFamily: 'var(--font-ui)', fontSize: '0.75rem', color: 'var(--ink)' }}>Usage <strong>{cr.usage}</strong></span>
                          {cr.limitPct !== null && (
                            <span style={{ fontFamily: 'var(--font-ui)', fontSize: '0.75rem', color: 'var(--ink)' }}>Remaining <strong>{cr.limitPct}%</strong></span>
                          )}
                        </div>
                        {cr.limitPct !== null && (
                          <div style={{ marginTop: '6px', height: 5, borderRadius: 3, background: 'var(--border)', overflow: 'hidden' }}>
                            <div style={{ width: `${cr.limitPct}%`, height: '100%', background: cr.limitPct > 20 ? '#40c070' : '#d06040', transition: 'width 0.5s ease' }} />
                          </div>
                        )}
                      </div>
                    )}

                    {/* Test result */}
                    {tr && (
                      <div style={{ background: tr.ok ? '#0e2a1a' : '#2a0e0e', border: `1px solid ${tr.ok ? '#40d080' : '#d04040'}`, borderRadius: '10px', padding: '10px 12px', marginBottom: '8px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                          <span style={{ fontFamily: 'var(--font-ui)', fontSize: '0.65rem', color: tr.ok ? '#40d080' : '#d07070' }}>
                            {tr.ok ? `✓ Completion test passed · ${tr.ms}ms` : `✗ Failed · ${tr.ms}ms`}
                          </span>
                          {tr.ok && <SpeedBadge ms={tr.ms} />}
                        </div>
                        {tr.ok && (
                          <div style={{ fontFamily: 'var(--font-serif)', fontSize: '0.82rem', color: '#c0e8c0', fontStyle: 'italic', marginBottom: '4px' }}>"{tr.reply}"</div>
                        )}
                        {!tr.ok && (
                          <div style={{ fontFamily: 'var(--font-ui)', fontSize: '0.75rem', color: '#e08080' }}>{tr.error}</div>
                        )}
                        {tr.usage && <TokenBar prompt={tr.usage.prompt_tokens} completion={tr.usage.completion_tokens} total={tr.usage.total_tokens} />}
                        <div style={{ fontFamily: 'var(--font-ui)', fontSize: '0.6rem', color: 'var(--muted)', marginTop: '5px' }}>Model: {tr.model}</div>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="card-section" style={{ display: 'flex', gap: '8px' }}>
                    <button className="btn btn-ghost" style={{ flex: 1, fontSize: '0.72rem', padding: '7px' }} onClick={() => ping(p.id)} disabled={isPinging}>
                      {isPinging ? '…' : 'Ping'}
                    </button>
                    <button className="btn btn-ghost" style={{ flex: 1, fontSize: '0.72rem', padding: '7px' }} onClick={() => runTest(p.id)} disabled={isTesting}>
                      {isTesting ? 'Testing…' : 'Test completion'}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* ── Analysis tab ── */}
        {activeTab === 'analysis' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px,1fr))', gap: '16px' }}>

            {/* Latency comparison */}
            <div className="card">
              <div className="card-section">
                <div className="section-label">Latency Comparison</div>
                {Object.entries(history).length === 0 ? (
                  <p style={{ fontFamily: 'var(--font-ui)', fontSize: '0.78rem', color: 'var(--muted)' }}>Run pings on the Providers tab first.</p>
                ) : (
                  Object.entries(history).map(([pid, hist]) => {
                    const p = getProvider(pid)
                    const avg = Math.round(hist.reduce((a, b) => a + b, 0) / hist.length)
                    const best = Math.min(...hist)
                    const worst = Math.max(...hist)
                    const barWidth = Math.min(100, (avg / 3000) * 100)
                    return (
                      <div key={pid} style={{ marginBottom: '16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '5px' }}>
                          <span style={{ fontFamily: 'var(--font-ui)', fontSize: '0.75rem', fontWeight: 600, color: p?.color }}>{p?.emoji} {p?.name}</span>
                          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <SpeedBadge ms={avg} />
                            <span style={{ fontFamily: 'var(--font-ui)', fontSize: '0.7rem', color: 'var(--ink)' }}>{avg}ms avg</span>
                          </div>
                        </div>
                        <div style={{ height: 8, borderRadius: 4, background: 'var(--petal)', overflow: 'hidden', marginBottom: '4px' }}>
                          <div style={{ width: `${barWidth}%`, height: '100%', background: p?.color || 'var(--deep-rose)', borderRadius: 4, transition: 'width 0.5s ease' }} />
                        </div>
                        <div style={{ display: 'flex', gap: '12px' }}>
                          <span style={{ fontFamily: 'var(--font-ui)', fontSize: '0.6rem', color: '#40c070' }}>Best {best}ms</span>
                          <span style={{ fontFamily: 'var(--font-ui)', fontSize: '0.6rem', color: '#d07070' }}>Worst {worst}ms</span>
                          <span style={{ fontFamily: 'var(--font-ui)', fontSize: '0.6rem', color: 'var(--muted)' }}>{hist.length} sample{hist.length > 1 ? 's' : ''}</span>
                        </div>
                        <Sparkline data={hist} color={p?.color || 'var(--deep-rose)'} width={260} height={30} />
                      </div>
                    )
                  })
                )}
              </div>
            </div>

            {/* Token analysis */}
            <div className="card">
              <div className="card-section">
                <div className="section-label">Token Usage Analysis</div>
                {Object.values(testResults).filter(r => r?.usage).length === 0 ? (
                  <p style={{ fontFamily: 'var(--font-ui)', fontSize: '0.78rem', color: 'var(--muted)' }}>Run "Test completion" on providers first.</p>
                ) : (
                  Object.entries(testResults).filter(([, r]) => r?.usage).map(([pid, r]) => {
                    const p = getProvider(pid)
                    const eff = r.usage.completion_tokens ? Math.round((r.usage.completion_tokens / r.usage.total_tokens) * 100) : 0
                    return (
                      <div key={pid} style={{ marginBottom: '16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                          <span style={{ fontFamily: 'var(--font-ui)', fontSize: '0.75rem', fontWeight: 600, color: p?.color }}>{p?.emoji} {p?.name}</span>
                          <span style={{ fontFamily: 'var(--font-ui)', fontSize: '0.65rem', color: 'var(--muted)' }}>{eff}% output ratio</span>
                        </div>
                        <TokenBar prompt={r.usage.prompt_tokens} completion={r.usage.completion_tokens} total={r.usage.total_tokens} />
                        <div style={{ marginTop: '6px', fontFamily: 'var(--font-ui)', fontSize: '0.65rem', color: 'var(--muted)' }}>
                          Model: {r.model} · {r.ms}ms
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </div>

            {/* Best provider recommendation */}
            <div className="card">
              <div className="card-section">
                <div className="section-label">Recommendation</div>
                {Object.entries(history).length === 0 ? (
                  <p style={{ fontFamily: 'var(--font-ui)', fontSize: '0.78rem', color: 'var(--muted)' }}>Ping providers to get a recommendation.</p>
                ) : (() => {
                  const ranked = Object.entries(history)
                    .map(([pid, hist]) => ({
                      pid,
                      avg: Math.round(hist.reduce((a, b) => a + b, 0) / hist.length),
                      ok: results[pid]?.ok,
                    }))
                    .filter(r => r.ok)
                    .sort((a, b) => a.avg - b.avg)
                  if (!ranked.length) return <p style={{ fontFamily: 'var(--font-ui)', fontSize: '0.78rem', color: '#d07070' }}>No providers connected.</p>
                  const best = ranked[0]
                  const p = getProvider(best.pid)
                  return (
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'var(--petal)', borderRadius: '12px', padding: '12px 14px', marginBottom: '12px', border: '1px solid var(--border)' }}>
                        <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#40d080', flexShrink: 0 }} />
                        <div>
                          <div style={{ fontFamily: 'var(--font-ui)', fontSize: '0.82rem', fontWeight: 700, color: p?.color }}>{p?.emoji} {p?.name}</div>
                          <div style={{ fontFamily: 'var(--font-ui)', fontSize: '0.65rem', color: 'var(--muted)' }}>Fastest · {best.avg}ms avg</div>
                        </div>
                        <SpeedBadge ms={best.avg} />
                      </div>
                      {ranked.slice(1).map((r, i) => {
                        const rp = getProvider(r.pid)
                        return (
                          <div key={r.pid} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '7px 0', borderBottom: '1px solid var(--separator)' }}>
                            <span style={{ fontFamily: 'var(--font-ui)', fontSize: '0.65rem', color: 'var(--muted)', width: 16 }}>#{i + 2}</span>
                            <span style={{ fontFamily: 'var(--font-ui)', fontSize: '0.75rem', color: rp?.color }}>{rp?.emoji} {rp?.name}</span>
                            <span style={{ fontFamily: 'var(--font-ui)', fontSize: '0.7rem', color: 'var(--muted)', marginLeft: 'auto' }}>{r.avg}ms</span>
                          </div>
                        )
                      })}
                    </div>
                  )
                })()}
              </div>
            </div>

            {/* Model info */}
            <div className="card">
              <div className="card-section">
                <div className="section-label">Active Configuration</div>
                {(() => {
                  const pid = storage.getActiveProvider()
                  const model = storage.getActiveModel()
                  const p = getProvider(pid)
                  const ai = storage.getAiParams()
                  const mode = storage.getTokenMode()
                  return (
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: p?.color || 'var(--border)' }} />
                        <span style={{ fontFamily: 'var(--font-ui)', fontSize: '0.82rem', fontWeight: 700, color: p?.color }}>{p?.emoji} {p?.name}</span>
                      </div>
                      {[
                        { k: 'Model',       v: model || p?.defaultModel },
                        { k: 'Mode',        v: mode },
                        { k: 'Max tokens',  v: ai.maxTokens },
                        { k: 'Context',     v: `${ai.contextWindow} messages` },
                        { k: 'Temperature', v: ai.temperature },
                        { k: 'Top P',       v: ai.topP },
                      ].map(({ k, v }) => (
                        <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid var(--separator)' }}>
                          <span style={{ fontFamily: 'var(--font-ui)', fontSize: '0.72rem', color: 'var(--muted)' }}>{k}</span>
                          <span style={{ fontFamily: 'var(--font-ui)', fontSize: '0.72rem', color: 'var(--ink)', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'right' }}>{String(v)}</span>
                        </div>
                      ))}
                    </div>
                  )
                })()}
              </div>
            </div>

          </div>
        )}

        {/* ── Diagnostic tab ── */}
        {activeTab === 'diagnostic' && (
          <div style={{ maxWidth: 640 }}>
            <div className="card" style={{ marginBottom: '14px' }}>
              <div className="card-section">
                <div className="section-label">Custom Diagnostic Prompt</div>
                <p style={{ fontFamily: 'var(--font-ui)', fontSize: '0.72rem', color: 'var(--muted)', marginBottom: '12px', lineHeight: 1.6 }}>
                  Sends a real completion request to your configured provider. Use this to test model behaviour, latency, or specific prompts.
                </p>
                <div style={{ display: 'flex', gap: '6px', marginBottom: '10px', flexWrap: 'wrap' }}>
                  <select className="input" style={{ flex: 1, padding: '7px 10px', minWidth: '120px' }}
                    value={defaultNerdPid}
                    onChange={e => setNerdPid(e.target.value)}>
                    {configuredProviders.map(p => <option key={p.id} value={p.id}>{p.emoji} {p.name}</option>)}
                  </select>
                  <select className="input" style={{ flex: 2, padding: '7px 10px', minWidth: '150px' }}
                    value={nerdModel}
                    onChange={e => setNerdModel(e.target.value)}>
                    <option value="">Default model</option>
                    {(nerdProvider?.models || []).map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
                  </select>
                </div>
                <textarea className="input textarea" style={{ minHeight: 80, marginBottom: '10px' }}
                  placeholder="Type your test prompt…"
                  value={nerdPrompt}
                  onChange={e => setNerdPrompt(e.target.value)}
                />
                <button className="btn btn-primary" style={{ width: '100%' }} onClick={runNerd} disabled={nerdRunning || configuredProviders.length === 0}>
                  {nerdRunning ? 'Sending…' : 'Send diagnostic'}
                </button>
              </div>

              {nerdResult && (
                <div className="card-section">
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap' }}>
                    <span style={{ fontFamily: 'var(--font-ui)', fontSize: '0.65rem', color: nerdResult.ok ? '#40d080' : '#d07070' }}>
                      {nerdResult.ok ? '✓ Success' : '✗ Failed'}
                    </span>
                    <span style={{ fontFamily: 'var(--font-ui)', fontSize: '0.65rem', color: 'var(--muted)' }}>{nerdResult.ms}ms</span>
                    {nerdResult.ok && <SpeedBadge ms={nerdResult.ms} />}
                    <span style={{ fontFamily: 'var(--font-ui)', fontSize: '0.6rem', color: 'var(--muted)', marginLeft: 'auto' }}>{nerdResult.model}</span>
                  </div>
                  <div style={{ background: nerdResult.ok ? '#0e2a1a' : '#2a0e0e', border: `1px solid ${nerdResult.ok ? '#40d080' : '#d04040'}`, borderRadius: '10px', padding: '12px 14px' }}>
                    <div style={{ fontFamily: 'var(--font-serif)', fontSize: '0.92rem', color: nerdResult.ok ? '#c0e8c0' : '#e08080', lineHeight: 1.6 }}>
                      {nerdResult.ok ? nerdResult.reply : nerdResult.error}
                    </div>
                  </div>
                  {nerdResult.usage && (
                    <div style={{ marginTop: '10px' }}>
                      <div className="section-label">Token breakdown</div>
                      <TokenBar prompt={nerdResult.usage.prompt_tokens} completion={nerdResult.usage.completion_tokens} total={nerdResult.usage.total_tokens} />
                    </div>
                  )}
                </div>
              )}
            </div>

            <div style={{ textAlign: 'center', fontFamily: 'var(--font-ui)', fontSize: '0.65rem', color: 'var(--muted)', lineHeight: 1.8 }}>
              All requests go directly from your browser to the AI provider.<br />Nothing passes through any Hibiki server.
            </div>
          </div>
        )}

      </div>
      <BottomNav />
    </div>
  )
}
