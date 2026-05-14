// ── Hibiki API v12 ─────────────────────────────────────────────────────────────
import { storage } from './storage'
import { getProvider } from './providers'

async function tryProvider(providerId, modelId, systemPrompt, messages) {
  const provider = getProvider(providerId)
  if (!provider) throw new Error(`Unknown provider: ${providerId}`)
  const key = storage.getKeyFor(providerId)
  if (!key) throw new Error(`NO_KEY:${providerId}`)

  const ai  = storage.getAiParams()
  const ctl = storage.getApiControls()
  const trimmed = messages.slice(-Math.max(1, ai.contextWindow))
  const fullSystem = [ai.systemPromptPrefix, systemPrompt].filter(Boolean).join('\n\n')

  const body = {
    model:             modelId,
    messages:          [{ role: 'system', content: fullSystem }, ...trimmed.map(m => ({ role: m.role, content: m.content }))],
    max_tokens:        ai.maxTokens,
    temperature:       ai.temperature,
    top_p:             ai.topP,
    presence_penalty:  ai.presencePenalty,
    frequency_penalty: ai.frequencyPenalty,
    stream:            false,
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), ctl.timeoutMs || 30000)
  let lastErr

  const retries = Math.max(0, ctl.retryCount || 0)
  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) await new Promise(r => setTimeout(r, ctl.retryDelayMs || 1000))
    try {
      const res = await fetch(`${provider.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...provider.authHeader(key) },
        body: JSON.stringify(body),
        signal: controller.signal,
      })
      clearTimeout(timer)
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e?.error?.message || `HTTP ${res.status}`) }
      const data = await res.json()
      return { content: data?.choices?.[0]?.message?.content || '…', provider: provider.name, model: modelId, usage: data?.usage || null }
    } catch (e) {
      lastErr = e
      if (e.name === 'AbortError') { clearTimeout(timer); throw new Error(`Request timed out after ${ctl.timeoutMs}ms`) }
      if (attempt < retries) continue
    }
  }
  clearTimeout(timer)
  throw lastErr
}

export async function chat({ systemPrompt, messages, onAttempt }) {
  const activePid   = storage.getActiveProvider()
  const activeModel = storage.getActiveModel() || getProvider(activePid)?.defaultModel
  const sequence    = [{ provider: activePid, model: activeModel }, ...storage.getFallbackChain()]
  let lastError = null

  for (const entry of sequence) {
    if (!getProvider(entry.provider) || !storage.getKeyFor(entry.provider)) continue
    if (typeof onAttempt === 'function') onAttempt(entry)
    try { return await tryProvider(entry.provider, entry.model, systemPrompt, messages) }
    catch (err) { lastError = err; console.warn(`[Hibiki] ${entry.provider}/${entry.model}: ${err.message}`) }
  }
  throw new Error(lastError?.message || 'All providers failed.')
}

export async function pingProvider(pid) {
  const provider = getProvider(pid)
  if (!provider) return { ok: false, ms: 0, error: 'Unknown provider' }
  const key = storage.getKeyFor(pid)
  if (!key) return { ok: false, ms: 0, error: 'No key configured' }
  const t0 = Date.now()
  try {
    const ctl = storage.getApiControls()
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), ctl.timeoutMs || 30000)
    const res = await fetch(provider.modelsUrl, { headers: { 'Content-Type': 'application/json', ...provider.authHeader(key) }, signal: controller.signal })
    clearTimeout(timer)
    const ms = Date.now() - t0
    let data = null; try { data = await res.json() } catch {}
    return { ok: res.ok, ms, status: res.status, data, error: res.ok ? null : (data?.error?.message || `HTTP ${res.status}`) }
  } catch (e) { return { ok: false, ms: Date.now() - t0, error: e.message } }
}

export async function fetchCredits(pid) {
  const provider = getProvider(pid)
  if (!provider?.creditsUrl) return null
  const key = storage.getKeyFor(pid)
  if (!key) return null
  try {
    const res = await fetch(provider.creditsUrl, { headers: provider.authHeader(key) })
    if (!res.ok) return null
    return provider.parseCredits(await res.json())
  } catch { return null }
}

export async function testCompletion(pid, modelId) {
  const t0 = Date.now()
  try {
    const r = await tryProvider(pid, modelId, 'You are a test assistant.', [{ role: 'user', content: 'Reply with exactly: "hibiki online"' }])
    return { ok: true, ms: Date.now() - t0, reply: r.content, usage: r.usage }
  } catch (e) { return { ok: false, ms: Date.now() - t0, error: e.message } }
}

export async function customPing(pid, modelId, userPrompt) {
  const t0 = Date.now()
  const sys = 'You are a connectivity test endpoint. Respond with a single brief technical status line only — confirm the test received and any key facts. Do not ask follow-up questions. Do not introduce yourself. Do not offer help or continue the conversation. Maximum 15 words.'
  try {
    const r = await tryProvider(pid, modelId, sys, [{ role: 'user', content: userPrompt }])
    return { ok: true, ms: Date.now() - t0, reply: r.content, usage: r.usage }
  } catch (e) { return { ok: false, ms: Date.now() - t0, error: e.message } }
}

// ── Streaming API ─────────────────────────────────────────────────────────────
export async function chatStream({ systemPrompt, messages, onChunk, onDone, onError }) {
  const activePid   = storage.getActiveProvider()
  const activeModel = storage.getActiveModel() || getProvider(activePid)?.defaultModel
  const sequence    = [{ provider: activePid, model: activeModel }, ...storage.getFallbackChain()]
  const ai          = storage.getAiParams()
  const ctl_s       = storage.getApiControls()

  let lastError = null

  for (const entry of sequence) {
    const provider = getProvider(entry.provider)
    if (!provider || !storage.getKeyFor(entry.provider)) continue

    const trimmed    = messages.slice(-Math.max(1, ai.contextWindow))
    const fullSystem = [ai.systemPromptPrefix, systemPrompt].filter(Boolean).join('\n\n')

    const body = {
      model: entry.model, stream: true,
      messages: [{ role: 'system', content: fullSystem }, ...trimmed.map(m => ({ role: m.role, content: m.content }))],
      max_tokens: ai.maxTokens, temperature: ai.temperature,
      top_p: ai.topP, presence_penalty: ai.presencePenalty, frequency_penalty: ai.frequencyPenalty,
    }

    const controller  = new AbortController()
    const timer       = setTimeout(() => controller.abort(), ctl_s.timeoutMs || 30000)

    try {
      const res = await fetch(`${provider.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...provider.authHeader(storage.getKeyFor(entry.provider)) },
        body: JSON.stringify(body),
        signal: controller.signal,
      })
      clearTimeout(timer)

      if (!res.ok) {
        const e = await res.json().catch(() => ({}))
        throw new Error(e?.error?.message || `HTTP ${res.status}`)
      }

      const reader  = res.body.getReader()
      const decoder = new TextDecoder()
      let full = '', buffer = ''

      while (true) {
        const { value, done } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          const trimmedLine = line.trim()
          if (!trimmedLine || trimmedLine === 'data: [DONE]') continue
          if (trimmedLine.startsWith('data: ')) {
            try {
              const json = JSON.parse(trimmedLine.slice(6))
              const token = json?.choices?.[0]?.delta?.content
              if (token) { full += token; onChunk?.(token) }
            } catch {}
          }
        }
      }

      onDone?.(full)
      return full

    } catch (e) {
      clearTimeout(timer)
      lastError = e
      if (e.name === 'AbortError') { onError?.(new Error('Request cancelled')); return null }
      console.warn(`[Hibiki Stream] ${entry.provider}: ${e.message}`)
    }
  }

  const err = new Error(lastError?.message || 'All providers failed.')
  onError?.(err)
  throw err
}

// Cancel controller registry — keyed by chatId
const activeControllers = new Map()
export function cancelStream(chatId) {
  const c = activeControllers.get(chatId)
  if (c) { c.abort(); activeControllers.delete(chatId) }
}
