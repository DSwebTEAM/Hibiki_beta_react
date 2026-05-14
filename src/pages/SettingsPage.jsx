import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { storage, TOKEN_MODES, AI_DEFAULTS } from '../lib/storage'
import { PROVIDER_LIST, getProvider } from '../lib/providers'
import { showToast } from '../lib/ui'
import { Memory } from '../lib/memory'
import { ConstellationEasterEgg, useConstellationTrigger } from '../components/shared/ConstellationEasterEgg'
import BottomNav, { DesktopNav } from '../components/shared/BottomNav'

export default function SettingsPage() {
  const navigate = useNavigate()
  const { show: showConstellation, setShow: setShowConstellation, onTap: onLogoTap } = useConstellationTrigger()
  const [keys, setKeys] = useState(storage.getProviderKeys())
  const [activePid, setActivePid] = useState(storage.getActiveProvider())
  const [activeModel, setActiveModel] = useState(null)
  const [tokenMode, setTokenMode] = useState(storage.getTokenMode())
  const [aiParams, setAiParams] = useState(storage.getAiParams())
  const [nsfwOk, setNsfwOk] = useState(storage.getNsfwOk())
  const [fallbackChain, setFallbackChain] = useState(storage.getFallbackChain())
  const [dark, setDark] = useState(document.documentElement.getAttribute('data-theme') === 'dark')
  const [fbProvSel, setFbProvSel] = useState('openrouter')
  const [fbModelSel, setFbModelSel] = useState('')
  const [chatCount, setChatCount] = useState(storage.getChats().length)
  const [allMemories, setAllMemories] = useState([]) // { chatId, charName, mems[] }
  const importRef = useRef(null)

  // Load memories across all chats
  useEffect(() => {
    const chats = storage.getChats()
    const withMem = chats.map(c => ({
      chatId: c.id,
      charName: c.charName,
      charAccent: c.charAccent,
      charKanji: c.charKanji,
      mems: Memory.getAll(c.id),
    })).filter(c => c.mems.length > 0)
    setAllMemories(withMem)
  }, [])

  useEffect(() => {
    const pid = storage.getActiveProvider()
    const provider = getProvider(pid)
    const stored = storage.getActiveModel()
    setActiveModel(stored || provider?.defaultModel || '')
  }, [activePid])

  useEffect(() => {
    const fbProv = getProvider(fbProvSel)
    setFbModelSel(fbProv?.defaultModel || fbProv?.models?.[0]?.id || '')
  }, [fbProvSel])

  function toggleTheme() {
    const next = !dark
    setDark(next)
    document.documentElement.setAttribute('data-theme', next ? 'dark' : 'light')
    storage.setTheme(next ? 'dark' : 'light')
  }

  function setKey(pid, val) {
    if (val.trim()) storage.setKeyFor(pid, val.trim())
    else storage.removeKeyFor(pid)
    setKeys(storage.getProviderKeys())
  }

  function switchProvider(pid) {
    setActivePid(pid)
    storage.setActiveProvider(pid)
    const prov = getProvider(pid)
    const m = prov?.defaultModel || ''
    setActiveModel(m)
    storage.setActiveModel(m)
  }

  function switchModel(m) {
    setActiveModel(m)
    storage.setActiveModel(m)
  }

  function applyTokenMode(mode) {
    setTokenMode(mode)
    storage.setTokenMode(mode)
    setAiParams(storage.getAiParams())
  }

  function patchParam(k, v) {
    const patch = { [k]: isNaN(v) ? v : Number(v) }
    setAiParams(p => ({ ...p, ...patch }))
    storage.setAiParams(patch)
  }

  function addFallback() {
    if (!fbModelSel) return
    storage.addFallback({ provider: fbProvSel, model: fbModelSel })
    setFallbackChain(storage.getFallbackChain())
    showToast('Fallback added')
  }

  function moveFallback(from, dir) {
    const to = from + dir
    storage.moveFallback(from, to)
    setFallbackChain(storage.getFallbackChain())
  }

  function removeFallback(i) {
    storage.removeFallback(i)
    setFallbackChain(storage.getFallbackChain())
  }

  function exportData() {
    const blob = new Blob([storage.exportAll()], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = 'hibiki-backup.json'; a.click()
    URL.revokeObjectURL(url)
    showToast('Data exported')
  }

  function importData(e) {
    const file = e.target.files?.[0]; if (!file) return
    const r = new FileReader()
    r.onload = () => {
      if (storage.importAll(r.result)) { showToast('Data imported ✓'); window.location.reload() }
      else showToast('Import failed — invalid file')
    }
    r.readAsText(file)
  }

  const activeProv = getProvider(activePid)
  const fbProv = getProvider(fbProvSel)

  const Row = ({ label, sub, children }) => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid var(--separator)' }}>
      <div>
        <div style={{ fontFamily: 'var(--font-ui)', fontSize: '0.82rem', color: 'var(--ink)' }}>{label}</div>
        {sub && <div style={{ fontFamily: 'var(--font-ui)', fontSize: '0.68rem', color: 'var(--muted)' }}>{sub}</div>}
      </div>
      {children}
    </div>
  )

  return (
    <div className="page">
      <DesktopNav />
      {showConstellation && <ConstellationEasterEgg onClose={() => setShowConstellation(false)} />}
      <div className="topbar">
        <span className="topbar-kanji">響</span>
        <span className="topbar-title">Settings</span>
      </div>

      <div className="page-inner">
        {/* Desktop 2-col grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px', alignItems: 'start' }}>

          {/* Col 1 */}
          <div>
            <div className="section-label">Appearance</div>
            <div className="card" style={{ marginBottom: '20px' }}>
              <div className="card-section">
                <Row label="Dark theme" sub="Easy on the eyes at night">
                  <button className={`toggle ${dark ? 'on' : ''}`} onClick={toggleTheme} />
                </Row>
                <Row label="18+ Vibe Unlock" sub={nsfwOk ? "Adult content enabled — characters may be more expressive" : "Unlock adult character content & expressive intimacy"}>
                  <button className={`toggle ${nsfwOk ? 'on' : ''}`} onClick={() => {
                    const next = !nsfwOk
                    if (next) {
                      // WIRED: leave space for custom vibe unlock prompt/gate
                      // TODO: Add custom age verification or vibe unlock flow here
                      storage.setNsfwOk(true)
                      setNsfwOk(true)
                      showToast('Vibe unlock enabled ✓')
                    } else {
                      storage.setNsfwOk(false)
                      setNsfwOk(false)
                      showToast('Vibe unlock disabled')
                    }
                  }} />
                </Row>
              </div>
            </div>

            <div className="section-label">AI Provider</div>
            <div className="card" style={{ marginBottom: '20px' }}>
              <div className="card-section">
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '12px' }}>
                  {PROVIDER_LIST.map(p => (
                    <button key={p.id} onClick={() => switchProvider(p.id)}
                      style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '6px 11px', borderRadius: '20px', border: `1.5px solid ${activePid === p.id ? p.color : 'var(--border)'}`, background: activePid === p.id ? p.color + '18' : 'transparent', color: activePid === p.id ? p.color : 'var(--muted)', fontFamily: 'var(--font-ui)', fontSize: '0.72rem', cursor: 'pointer' }}>
                      <span style={{ width: 7, height: 7, borderRadius: '50%', background: keys[p.id] ? '#40d080' : 'var(--border)', display: 'inline-block' }} />
                      {p.emoji} {p.name}
                    </button>
                  ))}
                </div>
                {PROVIDER_LIST.map(p => (
                  <div key={p.id} style={{ marginBottom: '8px' }}>
                    <div style={{ fontFamily: 'var(--font-ui)', fontSize: '0.7rem', color: p.color, marginBottom: '4px' }}>{p.emoji} {p.name} — <a href={p.keyDocs} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--deep-rose)' }}>Get key →</a></div>
                    <input className="input" style={{ fontFamily: 'var(--font-ui)', fontSize: '0.8rem' }} placeholder={p.keyHint}
                      defaultValue={keys[p.id] ? keys[p.id].slice(0, 8) + '·'.repeat(12) + keys[p.id].slice(-4) : ''}
                      onFocus={e => { if (e.target.value.includes('·')) e.target.value = '' }}
                      onBlur={e => setKey(p.id, e.target.value)} />
                  </div>
                ))}
              </div>
              <div className="card-section">
                <div className="section-label">Active Model — {activeProv?.name}</div>
                {activeProv?.models && (
                  <select className="input" value={activeModel} onChange={e => switchModel(e.target.value)}>
                    {activeProv.models.reduce((acc, m) => {
                      const g = m.group || 'Models'
                      if (!acc.find(x => x.label === g)) acc.push({ label: g, models: [] })
                      acc.find(x => x.label === g).models.push(m)
                      return acc
                    }, []).map(g => (
                      <optgroup key={g.label} label={g.label}>
                        {g.models.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
                      </optgroup>
                    ))}
                  </select>
                )}
              </div>
            </div>

            <div className="section-label">Data & Storage</div>
            <div className="card" style={{ marginBottom: '20px' }}>
              <div className="card-section">
                <Row label="Chats" sub={`${chatCount} conversation${chatCount !== 1 ? 's' : ''} stored`}>
                  <button className="btn btn-ghost" style={{ fontSize: '0.72rem', padding: '5px 12px' }} onClick={() => { if (confirm('Clear all chats?')) { storage.clearAllChats(); setChatCount(0); showToast('Chats cleared') } }}>Clear</button>
                </Row>
                <Row label="Session data" sub="Resets settings, keeps chats & keys">
                  <button className="btn btn-ghost" style={{ fontSize: '0.72rem', padding: '5px 12px' }} onClick={() => { if (confirm('Clear session data?')) { storage.clearSessionData(); showToast('Session cleared'); window.location.reload() } }}>Clear</button>
                </Row>
                <Row label="Full reset" sub="Clears chats & settings, keeps keys">
                  <button className="btn btn-danger" style={{ fontSize: '0.72rem', padding: '5px 12px' }} onClick={() => { if (confirm('Full reset? Keys will be kept.')) { storage.clearEverythingExceptKeys(); showToast('Reset done'); window.location.reload() } }}>Reset</button>
                </Row>
              </div>
              <div className="card-section" style={{ display: 'flex', gap: '8px' }}>
                <button className="btn btn-ghost" style={{ flex: 1, fontSize: '0.78rem' }} onClick={exportData}>Export JSON</button>
                <label className="btn btn-ghost" style={{ flex: 1, fontSize: '0.78rem', cursor: 'pointer' }}>
                  Import JSON<input ref={importRef} type="file" accept=".json" style={{ display: 'none' }} onChange={importData} />
                </label>
              </div>
            </div>

            <button className="btn btn-danger" style={{ width: '100%' }} onClick={() => { if (confirm('Remove all API keys and return to setup?')) { storage.clearAll(); navigate('/') } }}>
              Remove all keys & sign out
            </button>

            {/* ── Smart Memory ── */}
            <div className="section-label" style={{ marginTop: '24px' }}>Smart Memory</div>
            <div className="card" style={{ marginBottom: '20px' }}>
              <div className="card-section">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                  <div>
                    <div style={{ fontFamily: 'var(--font-ui)', fontSize: '0.82rem', color: 'var(--ink)' }}>Context memory</div>
                    <div style={{ fontFamily: 'var(--font-ui)', fontSize: '0.68rem', color: 'var(--muted)' }}>
                      {allMemories.reduce((a, c) => a + c.mems.length, 0)} memories · {allMemories.length} chat{allMemories.length !== 1 ? 's' : ''}
                    </div>
                  </div>
                  {allMemories.length > 0 && (
                    <button className="btn btn-ghost" style={{ fontSize: '0.7rem', padding: '4px 10px' }}
                      onClick={() => { if (confirm('Clear all memories?')) { Memory.clearAll(); setAllMemories([]); showToast('All memories cleared') } }}>
                      Clear all
                    </button>
                  )}
                </div>

                {allMemories.length === 0 && (
                  <div style={{ fontFamily: 'var(--font-ui)', fontSize: '0.75rem', color: 'var(--muted)', lineHeight: 1.6 }}>
                    No memories yet. Memories are extracted automatically from your conversations and used to make responses feel more personal.
                  </div>
                )}

                {allMemories.map(({ chatId, charName, charAccent, charKanji, mems }) => {
                  const CAT_COLORS = {
                    preference:   { bg: '#fff0f4', fg: '#c96a84' },
                    emotion:      { bg: '#f0f4ff', fg: '#6070c0' },
                    fact:         { bg: '#f4fff0', fg: '#508050' },
                    relationship: { bg: '#fff8f0', fg: '#c08040' },
                    event:        { bg: '#f8f0ff', fg: '#8050c0' },
                  }
                  return (
                    <div key={chatId} style={{ marginBottom: '16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                        <div style={{ width: 26, height: 26, borderRadius: '50%', background: (charAccent || '#c96a84') + '22', color: charAccent || '#c96a84', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-jp)', fontSize: '0.72rem', flexShrink: 0 }}>
                          {charKanji || charName?.[0]}
                        </div>
                        <span style={{ fontFamily: 'var(--font-serif)', fontSize: '0.88rem', fontWeight: 600, color: 'var(--ink)', flex: 1 }}>{charName}</span>
                        <button style={{ fontFamily: 'var(--font-ui)', fontSize: '0.65rem', color: '#d04040' }}
                          onClick={() => { Memory.clear(chatId); setAllMemories(p => p.filter(c => c.chatId !== chatId)); showToast(`${charName} memories cleared`) }}>
                          Clear
                        </button>
                      </div>
                      {mems.map(m => {
                        const { bg, fg } = CAT_COLORS[m.category] || { bg: 'var(--petal)', fg: 'var(--muted)' }
                        return (
                          <div key={m.id} className="memory-entry">
                            <span className="memory-entry-cat" style={{ background: bg, color: fg }}>{m.category}</span>
                            <span className="memory-entry-content">{m.content}</span>
                            <button className="memory-entry-del"
                              onClick={() => { Memory.delete(chatId, m.id); setAllMemories(p => p.map(c => c.chatId === chatId ? { ...c, mems: c.mems.filter(x => x.id !== m.id) } : c).filter(c => c.mems.length > 0)) }}>
                              ✕
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Col 2 */}
          <div>
            <div className="section-label">Performance Mode</div>
            <div className="card" style={{ marginBottom: '20px' }}>
              {Object.entries(TOKEN_MODES).map(([mode, cfg]) => (
                <div key={mode} className="card-section" style={{ cursor: 'pointer' }} onClick={() => applyTokenMode(mode)}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ fontFamily: 'var(--font-ui)', fontSize: '0.82rem', color: tokenMode === mode ? 'var(--deep-rose)' : 'var(--ink)' }}>{cfg.label}</div>
                      <div style={{ fontFamily: 'var(--font-ui)', fontSize: '0.68rem', color: 'var(--muted)' }}>{cfg.desc}</div>
                    </div>
                    <div style={{ width: 18, height: 18, borderRadius: '50%', border: `2px solid ${tokenMode === mode ? 'var(--deep-rose)' : 'var(--border)'}`, background: tokenMode === mode ? 'var(--deep-rose)' : 'transparent', flexShrink: 0 }} />
                  </div>
                </div>
              ))}
              <div className="card-section">
                <div className="section-label">Custom Overrides</div>
                {[
                  { key: 'maxTokens', label: 'Max tokens', min: 64, max: 4096, step: 64 },
                  { key: 'contextWindow', label: 'Context messages', min: 1, max: 80, step: 1 },
                  { key: 'temperature', label: 'Temperature', min: 0, max: 2, step: 0.05 },
                  { key: 'topP', label: 'Top P', min: 0, max: 1, step: 0.05 },
                  { key: 'presencePenalty', label: 'Presence penalty', min: -2, max: 2, step: 0.1 },
                  { key: 'frequencyPenalty', label: 'Frequency penalty', min: -2, max: 2, step: 0.1 },
                ].map(({ key, label, min, max, step }) => (
                  <div key={key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ fontFamily: 'var(--font-ui)', fontSize: '0.75rem', color: 'var(--muted)' }}>{label}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <input type="range" min={min} max={max} step={step} value={aiParams[key]} onChange={e => patchParam(key, e.target.value)} style={{ width: 100, accentColor: 'var(--deep-rose)' }} />
                      <span style={{ fontFamily: 'var(--font-ui)', fontSize: '0.72rem', color: 'var(--ink)', width: 36, textAlign: 'right' }}>{aiParams[key]}</span>
                    </div>
                  </div>
                ))}
                <textarea className="input" placeholder="System prompt prefix (optional)…" value={aiParams.systemPromptPrefix} onChange={e => patchParam('systemPromptPrefix', e.target.value)} style={{ marginTop: 4 }} />
                <button style={{ fontFamily: 'var(--font-ui)', fontSize: '0.72rem', color: 'var(--muted)', marginTop: '8px' }} onClick={() => { storage.resetAiParams(); setAiParams(storage.getAiParams()); showToast('Params reset') }}>Reset to defaults</button>
              </div>
            </div>

            <div className="section-label">Fallback Chain</div>
            <div className="card" style={{ marginBottom: '20px' }}>
              <div className="card-section">
                <div style={{ fontFamily: 'var(--font-ui)', fontSize: '0.7rem', color: 'var(--muted)', marginBottom: '8px' }}>If primary provider fails, try these in order:</div>
                {fallbackChain.length === 0 && <div style={{ fontFamily: 'var(--font-ui)', fontSize: '0.72rem', color: 'var(--muted)', padding: '4px 0' }}>No fallbacks configured.</div>}
                {fallbackChain.map((entry, i) => {
                  const p = getProvider(entry.provider)
                  return (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 0', borderBottom: '1px solid var(--separator)' }}>
                      <span style={{ fontFamily: 'var(--font-ui)', fontSize: '0.68rem', color: 'var(--muted)', width: 16 }}>{i + 1}</span>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: p?.color || '#aaa', display: 'inline-block', flexShrink: 0 }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontFamily: 'var(--font-ui)', fontSize: '0.72rem', color: p?.color || 'var(--ink)', fontWeight: 600 }}>{p?.emoji} {p?.name || entry.provider}</div>
                        <div style={{ fontFamily: 'var(--font-ui)', fontSize: '0.65rem', color: 'var(--muted)' }}>{entry.model}</div>
                      </div>
                      <button onClick={() => moveFallback(i, -1)} disabled={i === 0} style={{ color: 'var(--muted)', fontSize: '0.75rem', padding: '2px 5px' }}>↑</button>
                      <button onClick={() => moveFallback(i, 1)} disabled={i === fallbackChain.length - 1} style={{ color: 'var(--muted)', fontSize: '0.75rem', padding: '2px 5px' }}>↓</button>
                      <button onClick={() => removeFallback(i)} style={{ color: '#d04040', fontSize: '0.75rem', padding: '2px 5px' }}>✕</button>
                    </div>
                  )
                })}
                <div style={{ display: 'flex', gap: '6px', marginTop: '10px', flexWrap: 'wrap' }}>
                  <select className="input" style={{ flex: 1, padding: '6px 8px', minWidth: '100px' }} value={fbProvSel} onChange={e => setFbProvSel(e.target.value)}>
                    {PROVIDER_LIST.map(p => <option key={p.id} value={p.id}>{p.emoji} {p.name}</option>)}
                  </select>
                  <select className="input" style={{ flex: 2, padding: '6px 8px', minWidth: '120px' }} value={fbModelSel} onChange={e => setFbModelSel(e.target.value)}>
                    {(fbProv?.models || []).map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
                  </select>
                  <button className="btn btn-ghost" style={{ fontSize: '0.75rem', padding: '6px 12px' }} onClick={addFallback}>Add</button>
                </div>
              </div>
            </div>

            <div style={{ textAlign: 'center', fontFamily: 'var(--font-ui)', fontSize: '0.65rem', color: 'var(--muted)', lineHeight: 1.8 }}>
              <div
                className="easter-egg-tap"
                onClick={onLogoTap}
                style={{ fontFamily: 'var(--font-jp)', fontSize: '1.4rem', color: 'var(--border)', marginBottom: '4px', cursor: 'default', display: 'inline-block', padding: '4px 12px', borderRadius: '10px', transition: 'color 0.15s' }}
                title=""
              >響</div>
              <div>Hibiki v12 · Your key, your characters, your conversations</div>
              <div style={{ opacity: 0.6 }}>All data stored locally in your browser</div>
            </div>
          </div>

        </div>
      </div>

      <BottomNav />
    </div>
  )
}
