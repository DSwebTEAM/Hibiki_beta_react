// ── Hibiki Emotional Engine v12 ───────────────────────────────────────────────
import { storage } from '../lib/storage'

const ES_KEY_PREFIX = 'hibiki_es_'

function esKey(chatId) { return `${ES_KEY_PREFIX}${chatId}` }

function defaultState() {
  return {
    userMood: 'neutral',
    characterFeeling: 'curious',
    affectionLevel: 35,
    relationshipStage: 'early',
    energyLevel: 'medium',
    lastEmotionalShift: Date.now(),
    customOverride: null,
    conversationLength: 0,
    lastUserMessageType: 'neutral',
  }
}

export function loadEmotionalState(chatId) {
  try {
    const raw = localStorage.getItem(esKey(chatId))
    return raw ? { ...defaultState(), ...JSON.parse(raw) } : defaultState()
  } catch { return defaultState() }
}

export function saveEmotionalState(chatId, state) {
  try { localStorage.setItem(esKey(chatId), JSON.stringify(state)) } catch {}
}

export function clearEmotionalState(chatId) {
  localStorage.removeItem(esKey(chatId))
}

const EMOTIONS = {
  happy:      ['love', 'amazing', 'happy', 'great', 'wonderful', 'best', 'cute', 'adorable', 'glad', 'yay'],
  sad:        ['sad', 'bad day', 'depressed', 'lonely', 'miss', 'hurt', 'crying', 'upset', 'heartbreak'],
  excited:    ['excited', "can't wait", 'omg', 'wow', '!!', 'hyped', 'finally', 'yesss'],
  anxious:    ['worried', 'nervous', 'scared', 'anxious', 'stress', 'panic', 'overwhelmed'],
  frustrated: ['annoying', 'stupid', 'hate', 'angry', 'frustrated', 'uggh', 'ugh', 'whatever'],
  aroused:    ['horny', 'sexy', 'want you', 'kiss', 'touch', 'hot', 'naughty'],
  playful:    ['hehe', 'lol', 'tease', 'playful', 'joke', 'haha', 'lmao', 'xd'],
  tired:      ['tired', 'sleepy', 'exhausted', 'drained', 'yawn', 'cant sleep'],
  vulnerable: ['...', 'idk', 'i dont know', 'never mind', 'forget it', 'it\'s fine'],
}

export function analyzeAndUpdateEmotion(chatId, userMessage) {
  if (!userMessage || typeof userMessage !== 'string') return loadEmotionalState(chatId)

  const state = loadEmotionalState(chatId)
  const msg = userMessage.toLowerCase().trim()
  state.conversationLength++

  let newUserMood = state.userMood
  let moodShift = 0

  // Priority order — check from most specific
  if (EMOTIONS.aroused.some(w => msg.includes(w))) { newUserMood = 'aroused'; moodShift += 12 }
  else if (EMOTIONS.vulnerable.some(w => msg.includes(w))) { newUserMood = 'vulnerable'; moodShift += 5 }
  else if (EMOTIONS.sad.some(w => msg.includes(w))) { newUserMood = 'sad'; moodShift += 8 }
  else if (EMOTIONS.anxious.some(w => msg.includes(w))) { newUserMood = 'anxious'; moodShift += 7 }
  else if (EMOTIONS.frustrated.some(w => msg.includes(w))) { newUserMood = 'frustrated'; moodShift -= 6 }
  else if (EMOTIONS.excited.some(w => msg.includes(w))) { newUserMood = 'excited'; moodShift += 9 }
  else if (EMOTIONS.happy.some(w => msg.includes(w))) { newUserMood = 'happy'; moodShift += 10 }
  else if (EMOTIONS.playful.some(w => msg.includes(w))) { newUserMood = 'playful'; moodShift += 4 }
  else if (EMOTIONS.tired.some(w => msg.includes(w))) { newUserMood = 'tired'; moodShift -= 2 }

  // Length investment
  if (msg.length > 120) moodShift += 5
  if (msg.length < 15) moodShift -= 3

  state.userMood = newUserMood
  state.lastUserMessageType = newUserMood

  // Character feeling update
  if (['happy', 'excited', 'aroused', 'playful'].includes(newUserMood)) {
    state.affectionLevel = Math.min(100, state.affectionLevel + 4 + Math.floor(Math.abs(moodShift) / 3))
    state.characterFeeling = state.affectionLevel > 70 ? 'deeply affectionate' : 'warm and happy'
  } else if (['sad', 'lonely', 'anxious', 'vulnerable'].includes(newUserMood)) {
    state.affectionLevel = Math.min(100, state.affectionLevel + 6)
    state.characterFeeling = 'caring and protective'
  } else if (newUserMood === 'frustrated') {
    state.affectionLevel = Math.max(20, state.affectionLevel - 3)
    state.characterFeeling = 'concerned and patient'
  } else if (newUserMood === 'tired') {
    state.characterFeeling = 'gentle and understanding'
  }

  // Stage progression
  if (state.affectionLevel >= 85) state.relationshipStage = 'deeply attached'
  else if (state.affectionLevel >= 65) state.relationshipStage = 'close'
  else if (state.affectionLevel >= 40) state.relationshipStage = 'developing'
  else state.relationshipStage = 'early'

  // Energy
  if (['tired', 'vulnerable'].includes(newUserMood)) state.energyLevel = 'low'
  else if (['excited', 'aroused', 'playful'].includes(newUserMood)) state.energyLevel = 'high'
  else state.energyLevel = 'medium'

  state.lastEmotionalShift = Date.now()
  saveEmotionalState(chatId, state)
  return state
}

export function getRuntimeModifiers(chatId) {
  const state = loadEmotionalState(chatId)
  let mod = `[CURRENT EMOTIONAL STATE]\n`
  if (state.customOverride) mod += `Behaviour Override: You are currently ${state.customOverride}. Fully embody this.\n`
  mod += `User's current mood: ${state.userMood}\n`
  mod += `Your feelings toward user: ${state.characterFeeling}\n`
  mod += `Affection level: ${Math.round(state.affectionLevel)}/100\n`
  mod += `Relationship stage: ${state.relationshipStage}\n`
  mod += `Energy level: ${state.energyLevel}`
  return mod
}

export function applyBehaviourOverride(chatId, override) {
  const state = loadEmotionalState(chatId)
  state.customOverride = override ? override.toLowerCase().trim() : null
  if (override?.includes('clingy') || override?.includes('affectionate'))
    state.affectionLevel = Math.min(100, state.affectionLevel + 15)
  if (override?.includes('cold') || override?.includes('distant'))
    state.affectionLevel = Math.max(20, state.affectionLevel - 20)
  saveEmotionalState(chatId, state)
}

export function resetEmotionalState(chatId) {
  saveEmotionalState(chatId, defaultState())
}

export function getEmotionalState(chatId) {
  return loadEmotionalState(chatId)
}
