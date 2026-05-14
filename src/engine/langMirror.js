// ── Hibiki LangMirror v12 ─────────────────────────────────────────────────────

export const SLANG_REGIONS = {
  us:       { markers: ['fr', 'no cap', 'bet', 'bussin', 'rizz', 'mid', 'slay', 'lowkey', 'highkey', 'sus', 'goated', 'periodt', 'vibe', 'delulu'], name: 'US/Gen-Z' },
  uk:       { markers: ['innit', 'bruv', 'mate', 'peng', 'knackered', 'banter', 'dodgy', 'cheeky', 'proper', 'gutted', 'lush', 'bare'], name: 'UK' },
  japanese: { markers: ['yabai', 'sugoi', 'kawaii', 'maji', 'nani', 'senpai', 'desu', 'ne', 'yo', 'meccha'], name: 'Japanese' },
  filipino: { markers: ['grabe', 'charot', 'diba', 'lodi', 'petmalu', 'werpa', 'jowa', 'naman', 'talaga', 'kasi', 'ay nako'], name: 'Filipino' },
  thai:     { markers: ['na', 'krub', 'kha', 'aroi', 'jaap', 'jai yen', 'sanuk'], name: 'Thai' },
}

export function detectLangRegion(recentMessages) {
  if (!recentMessages?.length) return null
  const text = recentMessages.filter(m => m.role === 'user').slice(-6).map(m => m.content).join(' ').toLowerCase()
  let best = null, bestScore = 0
  for (const [region, { markers }] of Object.entries(SLANG_REGIONS)) {
    const score = markers.filter(m => text.includes(m)).length
    if (score > bestScore) { bestScore = score; best = region }
  }
  return bestScore >= 2 ? best : null
}

export function analyzeLangRegister(recentMessages) {
  const userMsgs = (recentMessages || []).filter(m => m.role === 'user').slice(-8)
  if (!userMsgs.length) return { formality: 'casual', avgLen: 60, complexity: 'medium' }

  const texts = userMsgs.map(m => m.content)
  const avgLen = texts.reduce((a, t) => a + t.length, 0) / texts.length
  const avgWords = texts.reduce((a, t) => a + t.split(/\s+/).length, 0) / texts.length

  // Formality signals
  const formalWords = ['however', 'therefore', 'furthermore', 'indeed', 'regarding', 'consequently']
  const casualWords = ['gonna', 'wanna', 'kinda', 'sorta', 'ya', 'ngl', 'tbh', 'rn', 'imo']
  const text = texts.join(' ').toLowerCase()
  const formalScore = formalWords.filter(w => text.includes(w)).length
  const casualScore = casualWords.filter(w => text.includes(w)).length

  const formality = formalScore > casualScore ? 'formal' : casualScore > 2 ? 'very-casual' : 'casual'
  const complexity = avgWords > 20 ? 'high' : avgWords < 8 ? 'low' : 'medium'

  return { formality, avgLen, complexity, avgWords }
}

export function buildLangMirrorDirective(recentMessages) {
  const region = detectLangRegion(recentMessages)
  const register = analyzeLangRegister(recentMessages)

  let dir = `[LANGUAGE MIRROR]\n`

  if (register.formality === 'very-casual') {
    dir += `Match the user's casual, relaxed tone. Short sentences, natural contractions, easy rhythm.\n`
  } else if (register.formality === 'formal') {
    dir += `User writes thoughtfully and formally. Elevate your language slightly — measured, precise, mature.\n`
  } else {
    dir += `Conversational, warm register. Natural flow.\n`
  }

  if (register.avgLen < 30) dir += `User is brief — keep most replies concise. Don't over-explain.\n`
  else if (register.avgLen > 150) dir += `User writes in depth — you can match with richer, more expansive replies.\n`

  if (region) {
    const rName = SLANG_REGIONS[region]?.name || region
    dir += `The user uses ${rName} slang/expressions. You may mirror lightly and naturally — never force it.\n`
  }

  return dir.trim()
}
