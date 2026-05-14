// ── Hibiki Memory v12 ─────────────────────────────────────────────────────────
// Smart context memory: extract → store → score → inject
// No extra API calls. All heuristic. Lightweight by design.

import { storage } from './storage'

const MEM_KEY_PREFIX = 'hibiki_mem_'
const MAX_MEMORIES   = 20

// ── Types ─────────────────────────────────────────────────────────────────────
// Memory entry shape:
// { id, chatId, category, content, keywords, weight, lastUsed, createdAt }
// category: 'preference' | 'emotion' | 'fact' | 'relationship' | 'event'

// ── Storage helpers ───────────────────────────────────────────────────────────
function memKey(chatId) { return `${MEM_KEY_PREFIX}${chatId}` }

function readMems(chatId) {
  try {
    const raw = localStorage.getItem(memKey(chatId))
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}

function writeMems(chatId, mems) {
  try { localStorage.setItem(memKey(chatId), JSON.stringify(mems)) } catch {}
}

function clearMems(chatId) {
  localStorage.removeItem(memKey(chatId))
}

function clearAllMems() {
  Object.keys(localStorage)
    .filter(k => k.startsWith(MEM_KEY_PREFIX))
    .forEach(k => localStorage.removeItem(k))
}

// ── Keyword extractor ─────────────────────────────────────────────────────────
function extractKeywords(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 3 && !STOP_WORDS.has(w))
}

const STOP_WORDS = new Set([
  'that','this','with','have','from','they','will','been','were','said',
  'what','when','where','which','there','their','about','would','could',
  'should','really','just','like','know','think','make','want','need',
  'dont','cant','wont','isnt','arent','wasnt','didnt','doesnt','hadnt',
])

// ── Extraction patterns ───────────────────────────────────────────────────────
const PATTERNS = [
  // preferences
  { re: /\b(?:i\s+(?:really\s+)?(?:love|like|enjoy|adore|prefer))\s+(.{4,60}?)(?:\.|,|$)/gi, cat: 'preference', template: m => `They like ${m}` },
  { re: /\b(?:i\s+(?:hate|dislike|can't stand|avoid))\s+(.{4,60}?)(?:\.|,|$)/gi,              cat: 'preference', template: m => `They dislike ${m}` },
  { re: /\bmy\s+(?:favourite|favorite)\s+(.{4,60}?)\s+is\s+(.{3,40}?)(?:\.|,|$)/gi,           cat: 'preference', template: (a,b) => `Their favourite ${a} is ${b}` },

  // facts
  { re: /\bi(?:'m| am)\s+(?:a\s+|an\s+)?(.{4,50}?)(?:\.|,|and|but|$)/gi,                      cat: 'fact',       template: m => `They are ${m}` },
  { re: /\bi\s+(?:study|work|go\s+to)\s+(.{4,60}?)(?:\.|,|$)/gi,                               cat: 'fact',       template: m => `They study/work: ${m}` },
  { re: /\bmy\s+(?:name\s+is|name's)\s+([A-Z][a-z]+)/g,                                        cat: 'fact',       template: m => `Their name is ${m}` },
  { re: /\bi'?m\s+(\d+)\s+years?\s+old/gi,                                                      cat: 'fact',       template: m => `They are ${m} years old` },
  { re: /\bi\s+live\s+in\s+(.{4,40}?)(?:\.|,|$)/gi,                                             cat: 'fact',       template: m => `They live in ${m}` },
  { re: /\bi\s+have\s+(?:a\s+|an\s+)?(.{4,50}?)(?:\.|,|$)/gi,                                  cat: 'fact',       template: m => `They have ${m}` },

  // emotions
  { re: /\bi(?:'m|\s+am)\s+(?:feeling\s+|so\s+|really\s+|very\s+)?(?:feeling\s+)?(stressed|anxious|happy|sad|excited|scared|nervous|tired|overwhelmed|lonely|confused|angry|frustrated|hopeful|grateful|proud|embarrassed|disappointed|worried)(?:\s|,|\.|$)/gi,
    cat: 'emotion', template: m => `They mentioned feeling ${m}` },
  { re: /\bthis\s+(?:makes|is\s+making)\s+me\s+(?:feel\s+)?(.{4,40}?)(?:\.|,|$)/gi,           cat: 'emotion',    template: m => `Something makes them feel ${m}` },

  // events
  { re: /\b(?:yesterday|today|tomorrow|last\s+week|next\s+week)\s+(?:i\s+)?(?:had|have|went|going|did|doing)\s+(.{4,60}?)(?:\.|,|$)/gi,
    cat: 'event', template: m => `Recent event: ${m}` },
  { re: /\bmy\s+(?:exam|test|interview|birthday|anniversary|deadline)\s+(?:is|was|will\s+be)\s+(.{4,40}?)(?:\.|,|$)/gi,
    cat: 'event', template: m => `Their upcoming/recent event: ${m}` },
]

// ── Extract memories from a user message ──────────────────────────────────────
export function extractMemories(chatId, userMessage) {
  const ai = storage.getAiParams()
  const mode = storage.getTokenMode()
  // Disable extraction in economy mode
  if (mode === 'economy') return

  const text = userMessage.trim()
  if (text.length < 10) return

  const existing = readMems(chatId)
  const newMems = []

  for (const { re, cat, template } of PATTERNS) {
    re.lastIndex = 0
    let match
    while ((match = re.exec(text)) !== null) {
      const content = template(...match.slice(1).map(s => s?.trim())).trim()
      if (!content || content.length < 8) continue

      // Deduplicate — skip if very similar content already stored
      const isDupe = existing.some(m =>
        similarity(m.content.toLowerCase(), content.toLowerCase()) > 0.7
      )
      if (isDupe) continue

      newMems.push({
        id: `mem_${Date.now()}_${Math.random().toString(36).slice(2,7)}`,
        chatId,
        category: cat,
        content,
        keywords: extractKeywords(content),
        weight: 1.0,
        lastUsed: null,
        createdAt: Date.now(),
      })
    }
  }

  if (!newMems.length) return

  let all = [...existing, ...newMems]

  // Cap at MAX_MEMORIES — evict lowest weight
  if (all.length > MAX_MEMORIES) {
    all = all.sort((a, b) => b.weight - a.weight).slice(0, MAX_MEMORIES)
  }

  writeMems(chatId, all)
}

// Simple Jaccard similarity for dedup
function similarity(a, b) {
  const sa = new Set(a.split(/\s+/))
  const sb = new Set(b.split(/\s+/))
  const inter = [...sa].filter(x => sb.has(x)).length
  const union = new Set([...sa, ...sb]).size
  return union === 0 ? 0 : inter / union
}

// ── Score and select relevant memories ───────────────────────────────────────
export function selectMemories(chatId, currentMessage) {
  const mode = storage.getTokenMode()
  const maxInject = mode === 'economy' ? 0 : mode === 'balanced' ? 4 : 6
  if (maxInject === 0) return []

  const mems = readMems(chatId)
  if (!mems.length) return []

  const msgKeywords = new Set(extractKeywords(currentMessage))
  if (!msgKeywords.size) return mems.slice(0, 2) // fallback: top 2 by weight

  // Score each memory
  const scored = mems.map(m => {
    const memKws = new Set(m.keywords)
    const overlap = [...msgKeywords].filter(k => memKws.has(k)).length
    const kwScore  = msgKeywords.size > 0 ? overlap / msgKeywords.size : 0
    const catBoost = getCatBoost(m.category, currentMessage)
    const recency  = m.lastUsed
      ? Math.max(0.1, 1 - (Date.now() - m.lastUsed) / (7 * 24 * 3600 * 1000))
      : 0.5
    const score = kwScore * 0.6 + catBoost * 0.25 + (m.weight * 0.1) + (recency * 0.05)
    return { ...m, score }
  })

  // Sort by score, take top N above threshold
  const THRESHOLD = 0.05
  const selected = scored
    .filter(m => m.score >= THRESHOLD)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxInject)

  // Update lastUsed + boost weight for selected memories
  const now = Date.now()
  const selectedIds = new Set(selected.map(m => m.id))
  const updated = mems.map(m => selectedIds.has(m.id)
    ? { ...m, lastUsed: now, weight: Math.min(2.0, m.weight + 0.1) }
    : m
  )
  writeMems(chatId, updated)

  return selected
}

// Category boost based on message context
function getCatBoost(category, message) {
  const msg = message.toLowerCase()
  const emotionWords = ['feel', 'feeling', 'sad', 'happy', 'stress', 'anxious', 'excited', 'scared', 'tired', 'overwhelmed']
  const factWords    = ['who', 'what', 'where', 'when', 'study', 'work', 'live', 'name', 'age', 'school']
  const prefWords    = ['like', 'love', 'hate', 'prefer', 'favourite', 'favorite', 'enjoy']
  const eventWords   = ['today', 'tomorrow', 'yesterday', 'soon', 'coming', 'upcoming', 'plan']

  const hasEmotion = emotionWords.some(w => msg.includes(w))
  const hasFact    = factWords.some(w => msg.includes(w))
  const hasPref    = prefWords.some(w => msg.includes(w))
  const hasEvent   = eventWords.some(w => msg.includes(w))

  if (category === 'emotion'      && hasEmotion) return 0.4
  if (category === 'fact'         && hasFact)    return 0.3
  if (category === 'preference'   && hasPref)    return 0.4
  if (category === 'event'        && hasEvent)   return 0.35
  if (category === 'relationship')               return 0.2 // always somewhat relevant
  return 0
}

// ── Format selected memories into system prompt block ─────────────────────────
export function buildMemoryBlock(memories) {
  if (!memories || !memories.length) return ''
  const CAT_LABELS = {
    preference:   'likes/dislikes',
    emotion:      'emotional state',
    fact:         'about them',
    relationship: 'how they relate to you',
    event:        'recent/upcoming event',
  }
  const lines = memories.map(m => `• (${CAT_LABELS[m.category] || m.category}) ${m.content}`)
  return `[MEMORY — things you know about this person from past conversation]\n${lines.join('\n')}\nOnly reference these naturally if genuinely relevant. Never list or repeat them directly. Never say "I remember". Just know it.`
}

// ── Public API ────────────────────────────────────────────────────────────────
export const Memory = {
  extract:   extractMemories,
  select:    selectMemories,
  buildBlock: buildMemoryBlock,

  getAll: chatId => readMems(chatId),
  delete: (chatId, memId) => {
    const updated = readMems(chatId).filter(m => m.id !== memId)
    writeMems(chatId, updated)
  },
  clear:    clearMems,
  clearAll: clearAllMems,

  // Summarize for settings UI
  getSummary: chatId => {
    const mems = readMems(chatId)
    const byCategory = {}
    mems.forEach(m => {
      byCategory[m.category] = (byCategory[m.category] || 0) + 1
    })
    return { total: mems.length, byCategory }
  },
}
