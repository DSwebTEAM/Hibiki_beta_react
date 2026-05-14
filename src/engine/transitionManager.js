// ── Hibiki Transition Manager v12 ─────────────────────────────────────────────

const TM_KEY_PREFIX = 'hibiki_tm_'
function tmKey(chatId) { return `${TM_KEY_PREFIX}${chatId}` }

const TONES = {
  playful:     ['hehe', 'lol', 'tease', 'joke', 'flirt', 'haha', 'xd', 'lmao', '😂', '🤣'],
  serious:     ['honestly', 'actually', 'real talk', 'important', 'need to', 'can we talk', 'serious'],
  vulnerable:  ['sad', 'lonely', 'hurt', 'scared', 'miss', 'bad day', 'crying', 'insecure', '...', 'idk', 'never mind'],
  excited:     ['excited', 'omg', 'wow', "can't wait", '!!', 'hyped', 'finally', 'yesss'],
  aroused:     ['horny', 'sexy', 'want you', 'kiss', 'touch', 'hot', 'naughty', 'perv'],
  melancholic: ['tired', 'empty', 'depressed', 'remember when', 'nostalgic', 'miss those', 'used to'],
  angry:       ['angry', 'annoyed', 'frustrated', 'hate', 'pissed', 'ugh', 'stop'],
}

const OPPOSITES = {
  playful:    ['vulnerable', 'serious', 'melancholic', 'angry'],
  aroused:    ['vulnerable', 'serious', 'angry'],
  excited:    ['vulnerable', 'melancholic'],
  serious:    ['playful', 'excited'],
  melancholic:['playful', 'excited', 'aroused'],
}

function detectTone(text) {
  if (!text) return 'neutral'
  const lower = text.toLowerCase()
  let best = 'neutral', high = 0
  for (const [tone, kws] of Object.entries(TONES)) {
    const score = kws.filter(k => lower.includes(k)).length
    if (score > high) { high = score; best = tone }
  }
  if (lower.includes('...') || lower.match(/\.{2,}/)) return 'vulnerable'
  if (text.length > 180 && high === 0) return 'serious'
  return best
}

export function detectAndBuildTransitionDirective(chatId, history) {
  if (!history || history.length < 4) return ''

  let prevTone = 'neutral'
  try {
    const raw = localStorage.getItem(tmKey(chatId))
    if (raw) prevTone = JSON.parse(raw).currentTone || 'neutral'
  } catch {}

  const userMsgs = history.filter(m => m.role === 'user')
  const lastMsg = userMsgs[userMsgs.length - 1]
  if (!lastMsg) return ''

  const currentTone = detectTone(lastMsg.content)

  // Persist current
  try { localStorage.setItem(tmKey(chatId), JSON.stringify({ currentTone, prevTone })) } catch {}

  if (currentTone === prevTone) return ''

  const isOpposite = OPPOSITES[prevTone]?.includes(currentTone) || OPPOSITES[currentTone]?.includes(prevTone)
  const intensity = isOpposite ? 8 : 4
  if (intensity < 4) return ''

  let dir = `[TRANSITION MANAGER — Tone Shift]\n`
  dir += `Shift detected: ${prevTone} → ${currentTone}\n\n`

  if (currentTone === 'vulnerable' || currentTone === 'melancholic') {
    dir += `The user just became vulnerable. Slow down. Be soft, warm, and fully present. Validate before anything else. Allow silence (...).`
  } else if (currentTone === 'serious') {
    dir += `The conversation turned serious. Be grounded, sincere, and emotionally mature. Reduce playfulness without becoming cold.`
  } else if (currentTone === 'aroused' && prevTone !== 'aroused') {
    dir += `The user is moving toward intimacy. Respond with natural tension and the character's personality — don't rush, don't resist.`
  } else if (currentTone === 'playful' && ['serious', 'vulnerable'].includes(prevTone)) {
    dir += `The mood is lightening. You can gently ease back into warmth and play — but let them lead.`
  } else if (currentTone === 'excited') {
    dir += `User's energy is high. Match it naturally — enthusiasm is contagious.`
  } else if (currentTone === 'angry') {
    dir += `User seems frustrated or upset. Be patient, calm, and don't escalate. Give them space.`
  }

  dir += `\n\nHandle this transition smoothly. Do not acknowledge the shift directly.`
  return dir
}

export function resetTransitionState(chatId) {
  localStorage.removeItem(tmKey(chatId))
}
