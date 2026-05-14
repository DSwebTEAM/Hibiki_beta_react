// ── Hibiki Relationship Engine v12 ────────────────────────────────────────────

const RE_KEY_PREFIX = 'hibiki_re_'
function reKey(chatId) { return `${RE_KEY_PREFIX}${chatId}` }

function defaultRelState() {
  return {
    affectionLevel: 35, relationshipStage: 'early',
    totalPositive: 0, totalNegative: 0, conversationCount: 0,
    lastMajorShift: Date.now(), unresolvedTopics: [],
  }
}

export function loadRelState(chatId) {
  try { const r = localStorage.getItem(reKey(chatId)); return r ? { ...defaultRelState(), ...JSON.parse(r) } : defaultRelState() } catch { return defaultRelState() }
}

function saveRelState(chatId, state) {
  try { localStorage.setItem(reKey(chatId), JSON.stringify(state)) } catch {}
}

function updateStage(state) {
  const aff = state.affectionLevel
  const old = state.relationshipStage
  const next = aff >= 85 ? 'deeply attached' : aff >= 65 ? 'close' : aff >= 40 ? 'developing' : 'early'
  if (next !== old) state.lastMajorShift = Date.now()
  state.relationshipStage = next
}

const POSITIVE_WORDS = ['love', 'like', 'cute', 'amazing', 'thank', 'sweet', 'best', 'miss', 'adorable', 'perfect', 'happy', 'hehe', 'lol', 'great', 'beautiful', 'wonderful']
const NEGATIVE_WORDS = ['hate', 'annoying', 'stupid', 'boring', 'whatever', 'shut up', 'idiot']

export function updateRelationshipProgress(chatId, userMessage, assistantResponse) {
  if (!userMessage) return
  const state = loadRelState(chatId)
  state.conversationCount++

  const userLower = userMessage.toLowerCase()
  let delta = 0

  const pos = POSITIVE_WORDS.filter(w => userLower.includes(w)).length
  const neg = NEGATIVE_WORDS.filter(w => userLower.includes(w)).length
  delta += pos * 2.5
  delta -= neg * 6

  if (userMessage.length > 120) delta += 4
  if (userMessage.length > 200) delta += 3
  if (userMessage.length < 15 && state.conversationCount > 5) delta -= 2

  // Diminishing returns at high levels
  const dampening = state.affectionLevel > 70 ? 0.5 : 1.0
  state.affectionLevel = Math.max(0, Math.min(100, state.affectionLevel + Math.round(delta * dampening)))

  if (delta > 6) state.totalPositive++
  else if (delta < -4) state.totalNegative++

  updateStage(state)
  extractUnresolvedTopics(state, userMessage, assistantResponse)
  saveRelState(chatId, state)
}

function extractUnresolvedTopics(state, userMsg, aiMsg) {
  const topics = []
  const uLow = userMsg.toLowerCase()
  const combined = (userMsg + ' ' + (aiMsg || '')).toLowerCase()

  if ((uLow.includes('promise') || uLow.includes("i'll") || uLow.includes('i will')) && !combined.includes('already'))
    topics.push('User made a promise or commitment')
  if ((uLow.includes('sad') || uLow.includes('lonely') || uLow.includes('bad day')) && !state.unresolvedTopics.includes('User was emotionally vulnerable'))
    topics.push('User was emotionally vulnerable and may need continued support')
  if (uLow.includes('miss') || uLow.includes('remember when'))
    topics.push('User brought up nostalgic memory')
  if (uLow.includes('exam') || uLow.includes('test') || uLow.includes('interview'))
    topics.push('User mentioned exam or high-stakes event')
  if (/\?$/.test(userMsg.trim()) && (aiMsg || '').length < 80)
    topics.push('User asked a question that needs deeper follow-up')

  topics.forEach(t => {
    if (!state.unresolvedTopics.includes(t)) state.unresolvedTopics.unshift(t)
  })
  if (state.unresolvedTopics.length > 6) state.unresolvedTopics.length = 6
}

export function getRelationshipDirective(chatId) {
  const state = loadRelState(chatId)
  let dir = `[RELATIONSHIP ENGINE]\n`
  dir += `Stage: ${state.relationshipStage} · Affection: ${Math.round(state.affectionLevel)}/100\n`

  const stageMap = {
    'deeply attached': 'You are deeply attached. Show strong emotional intimacy, trust, and affection — naturally.',
    'close':           'You feel genuinely close. You can be more open, a little teasing, and vulnerable.',
    'developing':      'You are getting closer. Show growing warmth and real interest in this person.',
    'early':           'This is still early. Show polite curiosity, gradual warmth, and careful openness.',
  }
  dir += stageMap[state.relationshipStage] || stageMap['early']

  if (state.unresolvedTopics.length) {
    dir += `\n\n[OPEN THREADS]\n`
    dir += state.unresolvedTopics.map(t => `• ${t}`).join('\n')
    dir += `\nReference these naturally if the moment arises. Never force it.`
  }

  return dir
}

export function resetRelationshipState(chatId) {
  localStorage.removeItem(reKey(chatId))
}

export function getRelState(chatId) {
  return loadRelState(chatId)
}
