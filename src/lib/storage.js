// ── Hibiki Storage v12 ─────────────────────────────────────────────────────────
import { useSyncExternalStore } from 'react'

const K = {
  providerKeys:   'hibiki_provider_keys',
  activeProvider: 'hibiki_active_provider',
  activeModel:    'hibiki_active_model',
  fallbackChain:  'hibiki_fallback_chain',
  aiParams:       'hibiki_ai_params',
  apiControls:    'hibiki_api_controls',
  tokenMode:      'hibiki_token_mode',
  chats:          'hibiki_chats',
  customChars:    'hibiki_chars',
  nsfwOk:         'hibiki_nsfw_ok',
  theme:          'hibiki_theme',
  chatBg:         'hibiki_chat_bg',
}

const lsGet = (k, fb = null) => {
  try { const v = localStorage.getItem(k); if (!v) return fb; try { return JSON.parse(v) } catch { return v } } catch { return fb }
}
const lsSet = (k, v) => {
  try { localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v)) } catch {}
}

export const TOKEN_MODES = {
  economy:  { maxTokens: 512,  contextWindow: 8,  temperature: 0.75, label: 'Economy',  desc: 'Fast & efficient. Lower token usage.' },
  balanced: { maxTokens: 1024, contextWindow: 20, temperature: 0.85, label: 'Balanced', desc: 'Default. Good quality, normal cost.' },
  max:      { maxTokens: 2048, contextWindow: 40, temperature: 0.90, label: 'Max',       desc: 'Full performance. Higher token usage.' },
}

export const AI_DEFAULTS = {
  temperature: 0.85, maxTokens: 1024, topP: 1.0,
  presencePenalty: 0.0, frequencyPenalty: 0.0,
  systemPromptPrefix: '', contextWindow: 20,
}

export const API_DEFAULTS = {
  timeoutMs: 30000, retryCount: 2, retryDelayMs: 1000, streamEnabled: false,
}

// Simple external store for React subscriptions
const listeners = new Set()
const notify = () => listeners.forEach(fn => fn())

export const storage = {
  subscribe: fn => { listeners.add(fn); return () => listeners.delete(fn) },
  getSnapshot: () => ({ ts: Date.now() }),

  // Provider keys
  getProviderKeys:   ()        => lsGet(K.providerKeys, {}),
  getKeyFor:         pid       => (lsGet(K.providerKeys, {}))[pid] || '',
  setKeyFor:         (pid, k)  => { const a = lsGet(K.providerKeys, {}); a[pid] = k; lsSet(K.providerKeys, a); notify() },
  removeKeyFor:      pid       => { const a = lsGet(K.providerKeys, {}); delete a[pid]; lsSet(K.providerKeys, a); notify() },
  hasApiKey:         ()        => Object.values(lsGet(K.providerKeys, {})).some(v => !!v),

  // Provider selection
  getActiveProvider: ()        => lsGet(K.activeProvider, 'openrouter'),
  setActiveProvider: pid       => { lsSet(K.activeProvider, pid); notify() },
  getActiveModel:    ()        => lsGet(K.activeModel, null),
  setActiveModel:    m         => { lsSet(K.activeModel, m); notify() },

  // Fallback chain
  getFallbackChain:  ()        => lsGet(K.fallbackChain, []),
  setFallbackChain:  arr       => { lsSet(K.fallbackChain, arr); notify() },
  addFallback:       entry     => { const c = lsGet(K.fallbackChain, []).filter(e => !(e.provider === entry.provider && e.model === entry.model)); lsSet(K.fallbackChain, [...c, entry]); notify() },
  removeFallback:    idx       => { const c = lsGet(K.fallbackChain, []); c.splice(idx, 1); lsSet(K.fallbackChain, c); notify() },
  moveFallback:      (f, t)    => { const c = lsGet(K.fallbackChain, []); if (f < 0 || t < 0 || f >= c.length || t >= c.length) return; c.splice(t, 0, c.splice(f, 1)[0]); lsSet(K.fallbackChain, c); notify() },

  // Token mode
  getTokenMode:      ()        => lsGet(K.tokenMode, 'balanced'),
  setTokenMode:      mode      => { lsSet(K.tokenMode, mode); if (TOKEN_MODES[mode]) { const cur = lsGet(K.aiParams, {}); lsSet(K.aiParams, { ...cur, ...TOKEN_MODES[mode] }) } notify() },

  // AI params
  getAiParams:       ()        => ({ ...AI_DEFAULTS, ...lsGet(K.aiParams, {}) }),
  setAiParams:       patch     => { lsSet(K.aiParams, { ...lsGet(K.aiParams, {}), ...patch }); notify() },
  resetAiParams:     ()        => { localStorage.removeItem(K.aiParams); notify() },

  // API controls
  getApiControls:    ()        => ({ ...API_DEFAULTS, ...lsGet(K.apiControls, {}) }),
  setApiControls:    patch     => { lsSet(K.apiControls, { ...lsGet(K.apiControls, {}), ...patch }); notify() },

  // Chats
  getChats:          ()        => lsGet(K.chats, []),
  addChat:           c         => { const u = [c, ...lsGet(K.chats, []).filter(x => x.id !== c.id)]; lsSet(K.chats, u); notify(); return u },
  updateChat:        (id, patch) => { const u = lsGet(K.chats, []).map(c => c.id === id ? { ...c, ...patch, updatedAt: Date.now() } : c); lsSet(K.chats, u); notify(); return u },
  deleteChat:        id        => { const u = lsGet(K.chats, []).filter(c => c.id !== id); lsSet(K.chats, u); notify(); return u },
  deleteChats:       ids       => { const u = lsGet(K.chats, []).filter(c => !ids.includes(c.id)); lsSet(K.chats, u); notify(); return u },
  getChat:           id        => lsGet(K.chats, []).find(c => c.id === id) || null,
  clearAllChats:     ()        => { localStorage.removeItem(K.chats); notify() },
  getChatByCharId:   charId    => lsGet(K.chats, []).filter(c => c.charId === charId).sort((a,b) => b.updatedAt - a.updatedAt)[0] || null,
  upsertChatForChar: (charId, newChatData) => {
    const ex = lsGet(K.chats, []).find(c => c.charId === charId)
    if (ex) return ex
    const u = [newChatData, ...lsGet(K.chats, [])]
    lsSet(K.chats, u); notify(); return newChatData
  },
  resetChatForChar:  (charId, newChatData) => {
    const filtered = lsGet(K.chats, []).filter(c => c.charId !== charId)
    lsSet(K.chats, [newChatData, ...filtered]); notify(); return newChatData
  },

  // Custom chars
  getCustomChars:    ()        => lsGet(K.customChars, []),
  addCustomChar:     c         => { const u = [...lsGet(K.customChars, []), c]; lsSet(K.customChars, u); notify(); return u },
  updateCustomChar:  (id, data) => { const u = lsGet(K.customChars, []).map(c => c.id === id ? { ...c, ...data } : c); lsSet(K.customChars, u); notify(); return u },
  deleteCustomChar:  id        => { const u = lsGet(K.customChars, []).filter(c => c.id !== id); lsSet(K.customChars, u); notify(); return u },
  clearCustomChars:  ()        => { localStorage.removeItem(K.customChars); notify() },

  // NSFW
  getNsfwOk:         ()        => lsGet(K.nsfwOk, false),
  setNsfwOk:         v         => { lsSet(K.nsfwOk, v); notify() },

  // Theme
  getTheme:          ()        => lsGet(K.theme, 'light'),
  setTheme:          v         => { lsSet(K.theme, v); notify() },

  // Chat bg
  getChatBg:         ()        => lsGet(K.chatBg, 'default'),
  setChatBg:         v         => { lsSet(K.chatBg, v); notify() },

  // Data ops
  clearSessionData: () => {
    [K.aiParams, K.apiControls, K.fallbackChain, K.tokenMode, K.nsfwOk, K.chatBg].forEach(k => localStorage.removeItem(k))
    notify()
  },
  clearEverythingExceptKeys: () => {
    const keep = [K.providerKeys, K.activeProvider, K.activeModel]
    Object.keys(localStorage).forEach(k => { if (k.startsWith('hibiki_') && !keep.includes(k)) localStorage.removeItem(k) })
    notify()
  },
  clearAll: () => {
    Object.keys(localStorage).forEach(k => { if (k.startsWith('hibiki_')) localStorage.removeItem(k) })
    notify()
  },

  exportAll: () => JSON.stringify({
    chats: lsGet(K.chats, []), customChars: lsGet(K.customChars, []),
    fallbackChain: lsGet(K.fallbackChain, []), aiParams: lsGet(K.aiParams, {}),
    apiControls: lsGet(K.apiControls, {}), tokenMode: lsGet(K.tokenMode, 'balanced'),
    theme: lsGet(K.theme, 'light'), chatBg: lsGet(K.chatBg, 'default'),
    exportedAt: new Date().toISOString(),
  }, null, 2),
  importAll: json => {
    try {
      const d = JSON.parse(json)
      if (d.chats)         lsSet(K.chats, d.chats)
      if (d.customChars)   lsSet(K.customChars, d.customChars)
      if (d.fallbackChain) lsSet(K.fallbackChain, d.fallbackChain)
      if (d.aiParams)      lsSet(K.aiParams, d.aiParams)
      if (d.apiControls)   lsSet(K.apiControls, d.apiControls)
      if (d.tokenMode)     lsSet(K.tokenMode, d.tokenMode)
      if (d.theme)         lsSet(K.theme, d.theme)
      if (d.chatBg)        lsSet(K.chatBg, d.chatBg)
      notify(); return true
    } catch { return false }
  },
}

// React hook
export function useStorage(selector) {
  return useSyncExternalStore(storage.subscribe, () => selector(storage))
}
