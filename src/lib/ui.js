// ── Hibiki UI Utilities v12 ─────────────────────────────────────────────────────
import { BEHAVIOURAL_ENGINE } from '../engine/behaviouralEngine'
import { TONE_PRESETS } from './characters'

export function buildSystemPrompt(char, toneId, runtimeInstruction, selectedStoryline, memoryBlock, engineBlock) {
  const parts = []
  parts.push(BEHAVIOURAL_ENGINE)

  const core = char.system || `You are ${char.name}, a companion. Mood: ${char.mood}.`
  parts.push(`[CHARACTER PERSONALITY]\n${core}`)

  const traitLines = []
  if (char.speechStyle?.trim()) traitLines.push(`Speech style: ${char.speechStyle.trim()}`)
  if (char.traits?.trim())      traitLines.push(`Personality traits: ${char.traits.trim()}`)
  if (char.rules?.trim())       traitLines.push(`Hard rules — never break these:\n${char.rules.trim()}`)
  if (traitLines.length) parts.push(`[CHARACTER TRAITS & RULES]\n${traitLines.join('\n\n')}`)

  const advLines = []
  if (char.backstory?.trim())       advLines.push(`CHARACTER BACKSTORY:\n${char.backstory.trim()}`)
  if (selectedStoryline?.trim())    advLines.push(`ACTIVE STORYLINE (conversation begins here):\n${selectedStoryline.trim()}`)

  const personalLines = []
  if (char.gender) personalLines.push(`Gender: ${char.gender}`)
  if (char.measurements && Object.keys(char.measurements).some(k => char.measurements[k])) {
    const mStr = Object.entries(char.measurements).filter(([,v]) => v).map(([k,v]) => `${k}: ${v}`).join(', ')
    personalLines.push(`Body measurements (private — see privacy rules): ${mStr}`)
  }
  if (char.braSize || char.braCup) personalLines.push(`Bra size (most private — three-stage trust rule applies): ${[char.braSize, char.braCup].filter(Boolean).join('')}`)
  if (char.pantiesNumSize)   personalLines.push(`Panties size (number) (most private): ${char.pantiesNumSize}`)
  if (char.pantiesAlphaSize) personalLines.push(`Panties size (letter) (most private): ${char.pantiesAlphaSize}`)
  if (char.dressCombo?.trim())  personalLines.push(`Usual outfit (private): ${char.dressCombo.trim()}`)
  if (char.innerwear?.trim())   personalLines.push(`Innerwear details (very private): ${char.innerwear.trim()}`)
  if (personalLines.length) advLines.push(`PERSONAL DETAILS (deeply private — base behaviour privacy rules fully apply):\n${personalLines.join('\n')}`)

  if (advLines.length) parts.push(`[ADVANCED CHARACTER CONTEXT]\n${advLines.join('\n\n')}`)

  // Layer 4.5 — Smart memory injection
  if (memoryBlock?.trim()) parts.push(memoryBlock)

  // Layer 5 — Behavioral Engine directives (emotional state, relationship, style, transition)
  if (engineBlock?.trim()) parts.push(engineBlock)

  const tone = TONE_PRESETS.find(t => t.id === toneId)
  if (tone) parts.push(`[TONE MODIFIER]\n${tone.mod}`)

  if (runtimeInstruction?.trim())
    parts.push(`[RUNTIME DIRECTION — maintain until told otherwise]\n${runtimeInstruction.trim()}\nAdopt immediately. Do not comment on the shift. Just be it.`)

  return parts.join('\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n')
}

export function formatMessage(raw) {
  let text = raw
  let moodHint = null
  const moodMatch = text.match(/^\[mood:\s*([^\]]+)\]/i)
  if (moodMatch) { moodHint = moodMatch[1].trim(); text = text.slice(moodMatch[0].length).trim() }

  // ── Smart segment parser ───────────────────────────────────────────────────
  // Split the raw text into alternating action/speech segments.
  // Each segment becomes its own block element — never inline with each other.
  // This ensures actions and dialogue are always on separate lines.

  // Tokenise: split on *...* boundaries, keeping delimiters
  const tokens = text.split(/(\*[^*\n]+\*)/g)

  const segments = [] // { type: 'action'|'speech', content: string }

  for (const token of tokens) {
    if (!token) continue

    const actionMatch = token.match(/^\*([^*\n]+)\*$/)
    if (actionMatch) {
      const inner = actionMatch[1].trim()
      // Classify: action if multi-word OR starts lowercase
      const isAction = inner.includes(' ') || /^[a-z]/.test(inner)
      if (isAction) {
        segments.push({ type: 'action', content: inner })
      } else {
        // Single proper noun — treat as inline emphasis within speech
        segments.push({ type: 'speech', content: `<em>${escHtml(inner)}</em>` })
      }
    } else {
      // Regular speech — may contain newlines, markdown
      const cleaned = token.trim()
      if (cleaned) {
        segments.push({ type: 'speech', content: cleaned })
      }
    }
  }

  // Merge consecutive same-type segments
  const merged = []
  for (const seg of segments) {
    const prev = merged[merged.length - 1]
    if (prev && prev.type === seg.type) {
      prev.content += (seg.type === 'speech' ? ' ' : ', ') + seg.content
    } else {
      merged.push({ ...seg })
    }
  }

  // Render each segment as its own block
  const html = merged.map(seg => {
    if (seg.type === 'action') {
      return `<span class="action-block">${escHtml(seg.content)}</span>`
    }
    // Speech: apply remaining markdown, then wrap in <p>
    let s = escHtml(seg.content)
    s = s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    s = s.replace(/_(.+?)_/g, '<em>$1</em>')
    s = s.replace(/^&gt;\s?(.+)$/gm, '<span class="quote-line">$1</span>')
    s = s.replace(/`([^`]+)`/g, '<code>$1</code>')
    // Split on double newlines into sub-paragraphs
    const paras = s.split(/\n\n+/).map(p => p.replace(/\n/g, '<br>').trim()).filter(Boolean)
    return paras.map(p => `<p class="speech-block">${p}</p>`).join('')
  }).join('')

  return { html, moodHint }
}

function escHtml(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
}

export function timeAgo(ts) {
  if (!ts) return ''
  const diff = Date.now() - ts, m = Math.floor(diff / 60000)
  if (m < 1)  return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

export function selectStoryline(char) {
  if (!char.storylines?.length) return null
  const valid = char.storylines.filter(s => s?.trim())
  if (!valid.length) return null
  return valid[Math.floor(Math.random() * valid.length)]
}

let _toastTimer = null
export function showToast(msg) {
  let t = document.getElementById('hibiki-toast')
  if (!t) { t = document.createElement('div'); t.id = 'hibiki-toast'; t.className = 'toast'; document.body.appendChild(t) }
  t.textContent = msg
  t.classList.add('show')
  clearTimeout(_toastTimer)
  _toastTimer = setTimeout(() => t.classList.remove('show'), 2200)
}
