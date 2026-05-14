// ── Hibiki Providers v12 ────────────────────────────────────────────────────────
export const PROVIDERS = {
  openrouter: {
    id: 'openrouter', name: 'OpenRouter', emoji: '🔀', color: '#7c3aed',
    baseUrl: 'https://openrouter.ai/api/v1',
    keyPrefix: ['sk-or-'], keyHint: 'sk-or-v1-···',
    keyDocs: 'https://openrouter.ai/keys',
    authHeader: k => ({ 'Authorization': `Bearer ${k}`, 'HTTP-Referer': window.location.origin, 'X-Title': 'Hibiki' }),
    modelsUrl: 'https://openrouter.ai/api/v1/models',
    creditsUrl: 'https://openrouter.ai/api/v1/auth/key',
    parseCredits: d => {
      const data = d?.data || d
      return {
        label: data?.label || data?.name || 'Unnamed key',
        credits: typeof data?.limit_remaining === 'number' ? `$${data.limit_remaining.toFixed(4)}` : 'unlimited',
        usage: typeof data?.usage === 'number' ? `$${data.usage.toFixed(4)}` : '—',
        limitPct: (typeof data?.limit_remaining === 'number' && typeof data?.limit === 'number' && data.limit > 0)
          ? Math.round((data.limit_remaining / data.limit) * 100) : null,
      }
    },
    defaultModel: 'meta-llama/llama-3.3-70b-instruct:free',
    models: [
      { id: 'meta-llama/llama-3.3-70b-instruct:free',        label: 'Llama 3.3 70B (Free)',      group: 'Free' },
      { id: 'meta-llama/llama-3.1-8b-instruct:free',         label: 'Llama 3.1 8B (Free)',       group: 'Free' },
      { id: 'google/gemma-3-27b-it:free',                    label: 'Gemma 3 27B (Free)',        group: 'Free' },
      { id: 'mistralai/mistral-small-3.1-24b-instruct:free', label: 'Mistral Small 3.1 (Free)',  group: 'Free' },
      { id: 'openai/gpt-oss-120b:free',                      label: 'GPT-OSS 120B (Free)',       group: 'Free' },
      { id: 'deepseek/deepseek-r1:free',                     label: 'DeepSeek R1 (Free)',        group: 'Free' },
      { id: 'deepseek/deepseek-v3.1',                        label: 'DeepSeek V3.1',             group: 'Paid' },
      { id: 'anthropic/claude-3.5-haiku',                    label: 'Claude 3.5 Haiku',          group: 'Paid' },
      { id: 'anthropic/claude-3.5-sonnet',                   label: 'Claude 3.5 Sonnet',         group: 'Paid' },
      { id: 'anthropic/claude-sonnet-4-6',                   label: 'Claude Sonnet 4.6',         group: 'Paid' },
      { id: 'openai/gpt-4o-mini',                            label: 'GPT-4o Mini',               group: 'Paid' },
      { id: 'openai/gpt-4o',                                 label: 'GPT-4o',                    group: 'Paid' },
      { id: 'google/gemini-2.0-flash-001',                   label: 'Gemini 2.0 Flash',          group: 'Paid' },
      { id: 'qwen/qwen3-235b-a22b',                          label: 'Qwen 3 235B A22B',          group: 'Paid' },
    ],
  },
  groq: {
    id: 'groq', name: 'Groq', emoji: '⚡', color: '#f97316',
    baseUrl: 'https://api.groq.com/openai/v1',
    keyPrefix: ['gsk_'], keyHint: 'gsk_···',
    keyDocs: 'https://console.groq.com/keys',
    authHeader: k => ({ 'Authorization': `Bearer ${k}` }),
    modelsUrl: 'https://api.groq.com/openai/v1/models',
    creditsUrl: null,
    parseCredits: () => ({ label: 'Groq key', credits: 'Free tier', usage: '—', limitPct: null }),
    defaultModel: 'llama-3.3-70b-versatile',
    models: [
      { id: 'llama-3.3-70b-versatile',       label: 'Llama 3.3 70B Versatile',       group: 'Chat' },
      { id: 'llama-3.1-8b-instant',          label: 'Llama 3.1 8B Instant',          group: 'Chat' },
      { id: 'qwen/qwen3-32b',                label: 'Qwen 3 32B',                    group: 'Reasoning' },
      { id: 'openai/gpt-oss-120b',           label: 'GPT-OSS 120B',                  group: 'Reasoning' },
      { id: 'deepseek-r1-distill-llama-70b', label: 'DeepSeek R1 Distill Llama 70B', group: 'Reasoning' },
    ],
  },
  fireworks: {
    id: 'fireworks', name: 'Fireworks AI', emoji: '🎆', color: '#ef4444',
    baseUrl: 'https://api.fireworks.ai/inference/v1',
    keyPrefix: ['fw_'], keyHint: 'fw_···',
    keyDocs: 'https://fireworks.ai/account/api-keys',
    authHeader: k => ({ 'Authorization': `Bearer ${k}` }),
    modelsUrl: 'https://api.fireworks.ai/inference/v1/models',
    creditsUrl: null,
    parseCredits: () => ({ label: 'Fireworks key', credits: 'Pay-as-go', usage: '—', limitPct: null }),
    defaultModel: 'accounts/fireworks/models/llama-v3p3-70b-instruct',
    models: [
      { id: 'accounts/fireworks/models/llama-v3p3-70b-instruct', label: 'Llama 3.3 70B Instruct', group: 'Llama' },
      { id: 'accounts/fireworks/models/llama-v3p1-8b-instruct',  label: 'Llama 3.1 8B Instruct',  group: 'Llama' },
      { id: 'accounts/fireworks/models/deepseek-v3p1',           label: 'DeepSeek V3.1',           group: 'DeepSeek' },
      { id: 'accounts/fireworks/models/deepseek-r1',             label: 'DeepSeek R1',             group: 'DeepSeek' },
      { id: 'accounts/fireworks/models/qwen3-30b-a3b',           label: 'Qwen 3 30B A3B',          group: 'Qwen' },
      { id: 'accounts/fireworks/models/gpt-oss-120b',            label: 'GPT-OSS 120B',            group: 'Other' },
    ],
  },
  together: {
    id: 'together', name: 'Together AI', emoji: '🤝', color: '#0ea5e9',
    baseUrl: 'https://api.together.xyz/v1',
    keyPrefix: [], keyHint: '(Together AI key)',
    keyDocs: 'https://api.together.ai/settings/api-keys',
    authHeader: k => ({ 'Authorization': `Bearer ${k}` }),
    modelsUrl: 'https://api.together.xyz/v1/models',
    creditsUrl: null,
    parseCredits: () => ({ label: 'Together key', credits: 'Pay-as-go', usage: '—', limitPct: null }),
    defaultModel: 'meta-llama/Llama-3.3-70B-Instruct-Turbo',
    models: [
      { id: 'meta-llama/Llama-3.3-70B-Instruct-Turbo',     label: 'Llama 3.3 70B Turbo',  group: 'Llama' },
      { id: 'meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo', label: 'Llama 3.1 8B Turbo',   group: 'Llama' },
      { id: 'Qwen/Qwen2.5-7B-Instruct-Turbo',              label: 'Qwen 2.5 7B Turbo',    group: 'Qwen' },
      { id: 'Qwen/Qwen3-235B-A22B-Instruct-2507-tput',     label: 'Qwen 3 235B A22B',     group: 'Qwen' },
      { id: 'deepseek-ai/DeepSeek-V3.1',                   label: 'DeepSeek V3.1',        group: 'DeepSeek' },
      { id: 'deepseek-ai/DeepSeek-R1',                     label: 'DeepSeek R1',          group: 'DeepSeek' },
      { id: 'openai/gpt-oss-120b',                         label: 'GPT-OSS 120B',         group: 'OpenAI' },
      { id: 'google/gemma-3n-E4B-it',                      label: 'Gemma 3N E4B (Free)',  group: 'Other' },
    ],
  },
}

export const PROVIDER_LIST = Object.values(PROVIDERS)
export const getProvider = id => PROVIDERS[id] || null

export function detectProvider(key) {
  if (!key) return null
  for (const p of PROVIDER_LIST) {
    if (p.keyPrefix.some(pfx => key.startsWith(pfx))) return p.id
  }
  if (/^[a-f0-9]{64}$/i.test(key)) return 'together'
  return null
}
