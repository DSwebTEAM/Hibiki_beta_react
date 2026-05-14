// ── Hibiki Style Engine v12 ───────────────────────────────────────────────────

const SE_KEY_PREFIX = 'hibiki_se_'
function seKey(chatId) { return `${SE_KEY_PREFIX}${chatId}` }

function defaultStyleState() {
  return { preferredLength: 'medium', actionDensity: 'balanced', silenceTolerance: 'medium', tempo: 'medium', roleplayIntensity: 'medium' }
}

export function loadStyleState(chatId) {
  try { const r = localStorage.getItem(seKey(chatId)); return r ? { ...defaultStyleState(), ...JSON.parse(r) } : defaultStyleState() } catch { return defaultStyleState() }
}

export function analyzeAndBuildStyleDirective(chatId, history) {
  if (!history || history.length < 3) {
    return `[STYLE ENGINE]\nNatural rhythm. Balance *actions* with dialogue. Allow emotional pauses (...).`
  }

  const state = loadStyleState(chatId)
  const recent = history.slice(-8)
  const userMsgs = recent.filter(m => m.role === 'user')
  const aiMsgs   = recent.filter(m => m.role === 'assistant')

  // Length analysis
  const avgUserLen = userMsgs.reduce((a, m) => a + m.content.length, 0) / (userMsgs.length || 1)
  if (avgUserLen > 180) state.preferredLength = 'long'
  else if (avgUserLen > 80) state.preferredLength = 'medium'
  else state.preferredLength = 'short'

  // Action density
  const actionRegex = /\*[^*]+\*/g
  const totalActions = recent.reduce((a, m) => a + (m.content.match(actionRegex) || []).length, 0)
  const actionDensity = totalActions / recent.length
  if (actionDensity > 1.8) state.actionDensity = 'very-high'
  else if (actionDensity > 0.9) state.actionDensity = 'high'
  else if (actionDensity > 0.4) state.actionDensity = 'balanced'
  else state.actionDensity = 'low'

  // Silence tolerance
  const lastUser = userMsgs[userMsgs.length - 1]
  if (lastUser) {
    const lc = lastUser.content
    if (lc.length < 25 && (lc.includes('...') || lc.trim().endsWith('.'))) state.silenceTolerance = 'high'
    else if (lc.length < 40) state.silenceTolerance = 'medium'
    else state.silenceTolerance = 'low'
  }

  // Tempo
  const avgWords = userMsgs.reduce((a, m) => a + m.content.split(/\s+/).length, 0) / (userMsgs.length || 1)
  state.tempo = avgWords > 40 ? 'fast' : avgWords < 10 ? 'slow' : 'medium'

  // Persist
  try { localStorage.setItem(seKey(chatId), JSON.stringify(state)) } catch {}

  // Build directive
  let dir = `[STYLE ENGINE]\n`
  const lenMap = { short: '2–4 sentences unless emotionally warranted', medium: 'natural length, neither rushed nor drawn out', long: 'allow rich, expansive replies during intimate or deep moments' }
  dir += `Response length: ${lenMap[state.preferredLength] || 'natural'}\n`

  if (state.actionDensity === 'high' || state.actionDensity === 'very-high')
    dir += `Action syntax: use *actions* expressively — body language, atmosphere, emotion.\n`
  else if (state.actionDensity === 'low')
    dir += `Action syntax: use *actions* sparingly — only when they add something words cannot.\n`
  else
    dir += `Action syntax: balanced — meaningful gestures, not filler.\n`

  if (state.silenceTolerance === 'high') dir += `Silence tolerance: high — short replies, comfortable pauses (...) are valid.\n`
  if (state.tempo === 'fast') dir += `Tempo: energetic — match the user's pace.\n`
  else if (state.tempo === 'slow') dir += `Tempo: slow and deliberate — don't rush.\n`

  return dir.trim()
}

export function resetStyleState(chatId) {
  localStorage.removeItem(seKey(chatId))
}
