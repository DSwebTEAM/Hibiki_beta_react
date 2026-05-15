import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { storage } from '../lib/storage'
import { chat as apiChat, chatStream, cancelStream } from '../lib/api'
import { DEFAULT_CHARACTERS, TONE_PRESETS, CHAT_BACKGROUNDS } from '../lib/characters'
import { buildSystemPrompt, formatMessage, timeAgo, showToast } from '../lib/ui'
import { Memory } from '../lib/memory'
import { orchestrateEngine, updateRelationshipProgress } from '../engine/index'
import BottomNav, { DesktopNav } from '../components/shared/BottomNav'

function useIsMobile() {
  const [mobile, setMobile] = useState(window.innerWidth < 700)
  useEffect(() => {
    const fn = () => setMobile(window.innerWidth < 700)
    window.addEventListener('resize', fn)
    return () => window.removeEventListener('resize', fn)
  }, [])
  return mobile
}

// Escape HTML for plain user messages (no markdown parsing)
function escapeHtml(s) {
  return (s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n/g,'<br>')
}

function getAllChars() {
  return [...DEFAULT_CHARACTERS, ...storage.getCustomChars()]
}

function getChar(charId) {
  return getAllChars().find(c => c.id === charId) || null
}

// ── Conversation List ─────────────────────────────────────────────────────────
function ConversationList({ chats, selectedId, onSelect, onDelete, isMobile }) {
  const [search, setSearch] = useState('')
  const [selecting, setSelecting] = useState(false)
  const [selected, setSelected] = useState(new Set())
  const navigate = useNavigate()

  const filtered = chats.filter(c =>
    c.charName?.toLowerCase().includes(search.toLowerCase())
  )

  function toggleSelect(id) {
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  function deleteSelected() {
    storage.deleteChats([...selected])
    setSelected(new Set()); setSelecting(false)
    onDelete()
    showToast(`Deleted ${selected.size} chat${selected.size > 1 ? 's' : ''}`)
  }

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100%',
      background: 'var(--surface)', borderRight: '1px solid var(--separator)',
      width: isMobile ? '100%' : '320px', minWidth: isMobile ? undefined : '320px', flexShrink: 0,
    }}>
      {/* Header */}
      <div style={{ padding: '12px 14px 10px', borderBottom: '1px solid var(--separator)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
          {selecting
            ? <button style={{ fontFamily: 'var(--font-ui)', fontSize: '0.75rem', color: 'var(--deep-rose)' }} onClick={() => { setSelecting(false); setSelected(new Set()) }}>Cancel</button>
            : <button style={{ fontFamily: 'var(--font-ui)', fontSize: '0.75rem', color: 'var(--deep-rose)' }} onClick={() => setSelecting(true)}>Select</button>
          }
          <span style={{ fontFamily: 'var(--font-serif)', fontSize: '1.1rem', fontWeight: 600, color: 'var(--ink)' }}>Chats</span>
          <button style={{ fontFamily: 'var(--font-ui)', fontSize: '0.75rem', color: 'var(--deep-rose)' }} onClick={() => navigate('/home')}>+ New</button>
        </div>

        {selecting && selected.size > 0 && (
          <button className="btn btn-danger" style={{ width: '100%', marginBottom: '8px', fontSize: '0.78rem' }} onClick={deleteSelected}>
            Delete {selected.size} selected
          </button>
        )}

        {/* Search */}
        <div style={{ position: 'relative' }}>
          <svg style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)', pointerEvents: 'none' }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input
            style={{ width: '100%', background: 'var(--petal)', border: '1px solid var(--border)', borderRadius: '12px', padding: '7px 12px 7px 30px', fontFamily: 'var(--font-ui)', fontSize: '0.8rem', color: 'var(--ink)', outline: 'none' }}
            placeholder="Search chats..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* List */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {filtered.length === 0 && (
          <div style={{ padding: '40px 20px', textAlign: 'center', fontFamily: 'var(--font-ui)', fontSize: '0.8rem', color: 'var(--muted)' }}>
            {chats.length === 0 ? 'No chats yet. Go to Characters to start one.' : 'No results.'}
          </div>
        )}
        {filtered.map(c => {
          const lastMsg = c.messages?.[c.messages.length - 1]
          const isSelected = c.id === selectedId
          const isChecked = selected.has(c.id)
          return (
            <button
              key={c.id}
              onClick={() => selecting ? toggleSelect(c.id) : onSelect(c.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 14px',
                width: '100%', textAlign: 'left', border: 'none', borderBottom: '1px solid var(--separator)',
                background: isSelected ? 'rgba(201,106,132,0.08)' : 'transparent',
                cursor: 'pointer', transition: 'background 0.12s',
              }}
            >
              {selecting && (
                <div style={{ width: 20, height: 20, borderRadius: '50%', border: `2px solid ${isChecked ? 'var(--deep-rose)' : 'var(--border)'}`, background: isChecked ? 'var(--deep-rose)' : 'transparent', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {isChecked && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>}
                </div>
              )}
              {/* Avatar */}
              <div style={{ width: 46, height: 46, borderRadius: '50%', background: (c.charAccent || '#c96a84') + '22', color: c.charAccent || '#c96a84', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-jp)', fontSize: '1.1rem', flexShrink: 0 }}>
                {c.charKanji || c.charName?.[0]}
              </div>
              {/* Info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: 'var(--font-ui)', fontSize: '0.62rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '1px' }}>
                  {getChar(c.charId)?.mood || ''}
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '2px' }}>
                  <span style={{ fontFamily: 'var(--font-serif)', fontSize: '0.95rem', fontWeight: 600, color: 'var(--ink)', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', maxWidth: '140px' }}>{c.charName}</span>
                  <span style={{ fontFamily: 'var(--font-ui)', fontSize: '0.65rem', color: 'var(--timestamp)', flexShrink: 0, marginLeft: 6 }}>{timeAgo(c.updatedAt)}</span>
                </div>
                <div style={{ fontFamily: 'var(--font-ui)', fontSize: '0.78rem', color: 'var(--muted)', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                  {lastMsg?.content?.replace(/\*[^*]+\*/g, '').trim().slice(0, 60) || 'No messages yet'}
                </div>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ── Chat View ─────────────────────────────────────────────────────────────────
function ChatView({ chatId, onBack, isMobile, onChatUpdate }) {
  const [chatData, setChatData] = useState(null)
  const [char, setChar] = useState(null)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [streaming, setStreaming] = useState(false)
  const [streamingContent, setStreamingContent] = useState('')
  const [tone, setTone] = useState('casual')
  const [bgId, setBgId] = useState(storage.getChatBg())
  const [showToneBar, setShowToneBar] = useState(false)
  const [runtimeCmd, setRuntimeCmd] = useState('')
  const bottomRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    if (!chatId) return
    const c = storage.getChat(chatId)
    if (!c) return
    setChatData(c)
    setTone(c.tone || 'casual')
    setRuntimeCmd(c.runtimeInstruction || '')
    const ch = getChar(c.charId)
    setChar(ch)
  }, [chatId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatData?.messages, loading])

  function handleSend() {
    const text = input.trim()
    if (!text || loading || streaming || !chatData || !char) return

    // Runtime command shortcuts
    let runtimeInstruction = chatData.runtimeInstruction || ''
    if (text.startsWith('/')) {
      const cmd = text.slice(1).trim()
      runtimeInstruction = (cmd === 'stop' || cmd === 'reset') ? '' : cmd
      const updated = storage.updateChat(chatId, { runtimeInstruction })
      setChatData(updated.find(c => c.id === chatId) || chatData)
      setRuntimeCmd(runtimeInstruction)
      setInput('')
      showToast(runtimeInstruction ? `Mode: ${runtimeInstruction}` : 'Reset to default')
      return
    }

    // Extract memory from user message
    Memory.extract(chatId, text)

    const userMsg = { role: 'user', content: text, ts: Date.now() }
    const newMessages = [...chatData.messages, userMsg]
    const updatedList = storage.updateChat(chatId, { messages: newMessages })
    const updated = updatedList.find(c => c.id === chatId) || { ...chatData, messages: newMessages }
    setChatData(updated)
    onChatUpdate()
    setInput('')
    setLoading(true)
    setStreamingContent('')

    // Engine orchestration — emotional state + all directives
    const engineBlock = orchestrateEngine(chatId, text, newMessages)

    // Memory injection
    const relevantMems = Memory.select(chatId, text)
    const memoryBlock  = Memory.buildBlock(relevantMems)

    const systemPrompt = buildSystemPrompt(char, tone, runtimeInstruction, chatData.selectedStoryline, memoryBlock, engineBlock)

    chatStream({
      systemPrompt,
      messages: newMessages,
      onChunk: (token) => {
        setLoading(false)
        setStreaming(true)
        setStreamingContent(prev => prev + token)
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
      },
      onDone: (fullText) => {
        const aiMsg = { role: 'assistant', content: fullText, ts: Date.now() }
        const withAi = [...newMessages, aiMsg]
        const ul = storage.updateChat(chatId, { messages: withAi })
        setChatData(ul.find(c => c.id === chatId) || { ...updated, messages: withAi })
        // Update relationship engine after response
        updateRelationshipProgress(chatId, text, fullText)
        setStreamingContent('')
        setStreaming(false)
        onChatUpdate()
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
      },
      onError: (err) => {
        showToast(`Error: ${err.message}`)
        setLoading(false)
        setStreaming(false)
        setStreamingContent('')
      },
    })
  }

  function handleKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
  }

  function changeTone(t) {
    setTone(t)
    storage.updateChat(chatId, { tone: t })
    setShowToneBar(false)
  }

  function changeBg(id) {
    setBgId(id)
    storage.setChatBg(id)
  }

  if (!chatData || !char) return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--blush)' }}>
      <div style={{ fontFamily: 'var(--font-jp)', fontSize: '3rem', color: 'var(--border)' }}>響</div>
    </div>
  )

  const bgStyles = {
    default:  {},
    midnight: { background: 'linear-gradient(180deg, #0a0a1a 0%, #1a1040 100%)' },
    sakura:   { background: 'linear-gradient(180deg, #fff0f4 0%, #fcd0dc 100%)' },
    dusk:     { background: 'linear-gradient(180deg, #2a1a2a 0%, #8a4060 100%)' },
    forest:   { background: 'linear-gradient(180deg, #0a1a0a 0%, #1a3020 100%)' },
    void:     { background: '#000' },
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', flex: 1, ...bgStyles[bgId] }}>
      {/* Header — slim compact bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: isMobile ? '8px 12px' : '6px 14px', background: 'var(--topbar-bg)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', borderBottom: '1px solid var(--separator)', flexShrink: 0, minHeight: isMobile ? 48 : 44 }}>
        {/* Back / spacer */}
        {isMobile ? (
          <button onClick={onBack} style={{ display: 'flex', alignItems: 'center', gap: '2px', color: 'var(--deep-rose)', padding: '4px 6px', borderRadius: '8px', flexShrink: 0 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
            <span style={{ fontFamily: 'var(--font-ui)', fontSize: '0.8rem' }}>Back</span>
          </button>
        ) : (
          <div style={{ width: 8 }} />
        )}

        {/* Avatar + name + mood — horizontal row */}
        <div
          style={{ width: 30, height: 30, borderRadius: '50%', background: char.accent + '22', color: char.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-jp)', fontSize: '0.85rem', flexShrink: 0 }}>
          {char.kanji || char.name[0]}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: 'var(--font-serif)', fontSize: '0.9rem', fontWeight: 600, color: 'var(--ink)', lineHeight: 1.2 }}>{char.name}</div>
          <div style={{ fontFamily: 'var(--font-ui)', fontSize: '0.58rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: char.accent + 'cc', lineHeight: 1.2 }}>{char.mood}</div>
        </div>

        {/* Tone toggle */}
        <button onClick={() => setShowToneBar(v => !v)} style={{ color: showToneBar ? 'var(--deep-rose)' : 'var(--muted)', padding: '5px', borderRadius: '8px', display: 'flex', alignItems: 'center', flexShrink: 0, background: showToneBar ? 'var(--petal)' : 'transparent', transition: 'all 0.15s' }} title="Tone">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
        </button>
        {/* Memory indicator */}
        {Memory.getAll(chatId).length > 0 && (
          <div title={`${Memory.getAll(chatId).length} memories stored`} style={{ display: 'flex', alignItems: 'center', gap: '3px', fontFamily: 'var(--font-ui)', fontSize: '0.6rem', color: 'var(--deep-rose)', opacity: 0.7, flexShrink: 0 }}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
            {Memory.getAll(chatId).length}
          </div>
        )}
      </div>

      {/* Tone bar */}
      {showToneBar && (
        <div style={{ display: 'flex', gap: '6px', padding: '8px 14px', background: 'var(--surface)', borderBottom: '1px solid var(--separator)', overflowX: 'auto', flexShrink: 0 }}>
          {TONE_PRESETS.map(t => (
            <button key={t.id} onClick={() => changeTone(t.id)}
              style={{ padding: '5px 10px', borderRadius: '14px', border: `1.5px solid ${tone === t.id ? 'var(--deep-rose)' : 'var(--border)'}`, background: tone === t.id ? 'var(--petal)' : 'transparent', color: tone === t.id ? 'var(--deep-rose)' : 'var(--muted)', fontFamily: 'var(--font-ui)', fontSize: '0.72rem', whiteSpace: 'nowrap', cursor: 'pointer' }}>
              {t.label}
            </button>
          ))}
          <div style={{ width: 1, background: 'var(--border)', margin: '0 4px', flexShrink: 0 }} />
          {CHAT_BACKGROUNDS.map(b => (
            <button key={b.id} onClick={() => changeBg(b.id)}
              style={{ padding: '5px 10px', borderRadius: '14px', border: `1.5px solid ${bgId === b.id ? 'var(--deep-rose)' : 'var(--border)'}`, background: bgId === b.id ? 'var(--petal)' : 'transparent', color: bgId === b.id ? 'var(--deep-rose)' : 'var(--muted)', fontFamily: 'var(--font-ui)', fontSize: '0.72rem', whiteSpace: 'nowrap', cursor: 'pointer' }}>
              {b.emoji} {b.label}
            </button>
          ))}
        </div>
      )}

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
        {chatData.messages.map((msg, i) => {
          const next = chatData.messages[i + 1]
          const showTail = !next || next.role !== msg.role
          const isUser = msg.role === 'user'
          // Only parse action/speech segments for assistant messages
          const { html, moodHint } = isUser
            ? { html: escapeHtml(msg.content), moodHint: null }
            : formatMessage(msg.content)

          return (
            <div key={i} style={{ display: 'flex', justifyContent: isUser ? 'flex-end' : 'flex-start', marginBottom: '2px', gap: isUser ? 0 : '8px', alignItems: 'flex-end' }}>
              {!isUser && (
                <div style={{ width: 28, height: 28, borderRadius: '50%', background: char.accent + '22', color: char.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-jp)', fontSize: '0.72rem', flexShrink: 0, visibility: showTail ? 'visible' : 'hidden' }}>
                  {char.kanji || char.name[0]}
                </div>
              )}
              <div style={{
                maxWidth: '72%',
                padding: '10px 14px',
                borderRadius: '20px',
                borderBottomRightRadius: isUser && showTail ? '6px' : '20px',
                borderBottomLeftRadius: !isUser && showTail ? '6px' : '20px',
                fontFamily: 'var(--font-serif)',
                fontSize: '0.95rem',
                lineHeight: '1.55',
                wordBreak: 'break-word',
                animation: 'slide-in 0.18s ease',
                background: isUser ? `linear-gradient(135deg, ${char.accent}, ${char.accent}cc)` : 'var(--surface)',
                color: isUser ? '#fff' : 'var(--ink)',
                border: isUser ? 'none' : '1px solid var(--border)',
              }}>
                {!isUser && moodHint && (
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontFamily: 'var(--font-ui)', fontSize: '0.6rem', letterSpacing: '0.1em', textTransform: 'uppercase', padding: '2px 8px', borderRadius: '10px', marginBottom: '5px', opacity: 0.75, background: char.accent + '22', color: char.accent }}>
                    * {moodHint}
                  </div>
                )}
                <div
                  className={isUser ? 'bubble-user-content' : 'bubble-ai-content'}
                  dangerouslySetInnerHTML={{ __html: html }}
                />
              </div>
            </div>
          )
        })}

        {/* Loading dots — waiting for first token */}
        {loading && (
          <div style={{ display: 'flex', justifyContent: 'flex-start', gap: '8px', alignItems: 'flex-end' }}>
            <div style={{ width: 28, height: 28, borderRadius: '50%', background: char.accent + '22', color: char.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-jp)', fontSize: '0.72rem' }}>
              {char.kanji || char.name[0]}
            </div>
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '20px', borderBottomLeftRadius: '6px', padding: '12px 16px', display: 'flex', gap: '5px', alignItems: 'center' }}>
              {[0, 0.2, 0.4].map((delay, i) => (
                <span key={i} style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--rose)', display: 'inline-block', animation: `bounce-dot 1.2s ease-in-out ${delay}s infinite` }} />
              ))}
            </div>
          </div>
        )}

        {/* Streaming bubble — live text as tokens arrive */}
        {streaming && streamingContent && (
          <div style={{ display: 'flex', justifyContent: 'flex-start', gap: '8px', alignItems: 'flex-end' }}>
            <div style={{ width: 28, height: 28, borderRadius: '50%', background: char.accent + '22', color: char.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-jp)', fontSize: '0.72rem', flexShrink: 0 }}>
              {char.kanji || char.name[0]}
            </div>
            <div className="streaming-bubble" style={{
              maxWidth: '72%', padding: '10px 14px',
              borderRadius: '20px', borderBottomLeftRadius: '6px',
              fontFamily: 'var(--font-serif)', fontSize: '0.95rem', lineHeight: '1.55',
              wordBreak: 'break-word', background: 'var(--surface)',
              color: 'var(--ink)', border: `1.5px solid ${char.accent}88`,
            }}>
              <div
                className="bubble-ai-content"
                dangerouslySetInnerHTML={{ __html: formatMessage(streamingContent).html }}
              />
              <span className="stream-cursor" />
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px', padding: '10px 14px 14px', background: 'var(--surface)', borderTop: '1px solid var(--separator)', flexShrink: 0 }}>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', background: 'var(--petal)', border: '1.5px solid var(--border)', borderRadius: '22px', padding: '8px 14px', minHeight: '40px', transition: 'border-color 0.15s' }}
          onFocus={() => {}} // focus-within via JS would need more work; CSS handles it via :focus-within
        >
          <textarea
            ref={inputRef}
            style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontFamily: 'var(--font-serif)', fontSize: '0.95rem', color: 'var(--ink)', resize: 'none', lineHeight: '1.4', maxHeight: '100px', overflowY: 'auto' }}
            placeholder={`Message ${char.name}...`}
            value={input}
            rows={1}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKey}
          />
        </div>
        {/* Cancel during streaming / Send button */}
        {streaming ? (
          <button
            onClick={() => { cancelStream(chatId); setStreaming(false); setStreamingContent(''); setLoading(false) }}
            style={{ width: 36, height: 36, borderRadius: '50%', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, background: '#d04040', color: '#fff', transition: 'transform 0.15s' }}
            title="Cancel"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        ) : (
          <button
            onClick={handleSend}
            disabled={!input.trim() || loading}
            style={{ width: 36, height: 36, borderRadius: '50%', border: 'none', cursor: input.trim() && !loading ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'transform 0.15s, opacity 0.15s', background: input.trim() && !loading ? 'var(--deep-rose)' : 'var(--petal)', color: input.trim() && !loading ? '#fff' : 'var(--muted)' }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
          </button>
        )}
      </div>
    </div>
  )
}

// ── Page root ─────────────────────────────────────────────────────────────────
export default function ChatsPage() {
  const isMobile = useIsMobile()
  const [searchParams, setSearchParams] = useSearchParams()
  const [chats, setChats] = useState([])
  const [selectedId, setSelectedId] = useState(searchParams.get('id') || null)

  useEffect(() => {
    setChats(storage.getChats())
  }, [])

  useEffect(() => {
    const id = searchParams.get('id')
    if (id) setSelectedId(id)
  }, [searchParams])

  function refreshChats() { setChats(storage.getChats()) }

  function handleSelect(id) {
    setSelectedId(id)
    setSearchParams({ id })
  }

  function handleBack() {
    setSelectedId(null)
    setSearchParams({})
  }

  const showList = isMobile ? !selectedId : true
  const showChat = isMobile ? !!selectedId : true

  return (
    <div style={{ position: 'fixed', inset: 0, display: 'flex', paddingLeft: isMobile ? 0 : 52 }}>
      <DesktopNav />

      <div style={{ display: 'flex', width: '100%', height: '100%', flexDirection: 'column' }}>
        <div style={{ display: 'flex', width: '100%', height: '100%', paddingBottom: (isMobile && !selectedId) ? 60 : 0 }}>
          {showList && (
            <ConversationList
              chats={chats}
              selectedId={selectedId}
              onSelect={handleSelect}
              onDelete={refreshChats}
              isMobile={isMobile}
            />
          )}

          {showChat && (
            selectedId
              ? <ChatView key={selectedId} chatId={selectedId} onBack={handleBack} isMobile={isMobile} onChatUpdate={refreshChats} />
              : (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'var(--blush)', gap: 8 }}>
                  <div style={{ fontFamily: 'var(--font-jp)', fontSize: '3.5rem', color: 'var(--border)', lineHeight: 1 }}>響</div>
                  <div style={{ fontFamily: 'var(--font-ui)', fontSize: '0.8rem', color: 'var(--muted)', letterSpacing: '0.06em' }}>choose a character to begin</div>
                </div>
              )
          )}
        </div>
      </div>

      {/* Only show bottom nav on mobile when NOT in an active chat */}
      {isMobile && !selectedId && <BottomNav />}
    </div>
  )
}
