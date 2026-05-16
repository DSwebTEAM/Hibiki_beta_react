<div align="center">
  <img width="100" height="100" alt="HIBIKI" src="https://github.com/user-attachments/assets/26418a2b-57e7-4680-8564-e60f02502c8f" />

  <h1>HIBIKI</h1>

  <p><em>An anime companion AI — open source, private, and entirely yours.</em></p>

  <a href="https://hibiki-beta.netlify.app/">
    <img src="https://img.shields.io/badge/Try%20it%20now-hibiki--beta.netlify.app-c96a84?style=for-the-badge&logo=netlify&logoColor=white" alt="Try HIBIKI"/>
  </a>

  <br/><br/>

  ![React](https://img.shields.io/badge/React-Vite-61dafb?style=flat-square&logo=react)
  ![License](https://img.shields.io/badge/License-MIT-f4a0b4?style=flat-square)
  ![Privacy](https://img.shields.io/badge/Privacy-100%25%20local-40d080?style=flat-square)

</div>

---
> [!NOTE]
> HIBIKI is currently under active refinement and optimization.
>
> Some systems in the current release are still being improved:
>
> - The Behavioural Engine is not yet behaving consistently outside internal testing environments.
> - The ChatStream pause system may not function reliably in some situations.
> - Token usage in current and previous versions is higher than expected.
>
> ### Current Token Usage
> - Previous versions: ~35% – 48%
> - Current v12: ~3,352 tokens per request (~100% usage even in Economy Mode)
>
> ### Expected Optimization Targets
> - Economy Mode: ~727 tokens (~22%)
> - Balanced Mode: ~773 tokens (~23%)
> - Max Mode: ~827 tokens (~25%)
>
> These optimizations are focused on reducing token usage while improving behavioural consistency and overall output quality.


## What is HIBIKI?

HIBIKI (響, *resonance*) is an open-source anime companion AI that lets you have genuine, emotionally grounded conversations with characters from the anime and manga worlds. It runs entirely in your browser — no accounts, no servers, no data collection. Your conversations, memories, and settings never leave your device.

HIBIKI is not a basic chatbot. Each character carries a distinct voice, emotional depth, and a behavioral system that adapts to the flow of your conversation — shifting tone, pacing, and personality in real time.

---

## Features

**Emotionally aware conversations**
Characters respond with genuine emotional intelligence — they acknowledge how you feel, pick up on your mood, and adjust their tone naturally across the conversation.

**Smart context memory**
HIBIKI remembers things you share across a conversation — your preferences, emotions, facts about your life, upcoming events — and weaves them back in naturally when relevant. No repetition, no data sheets. It just knows.

**Character Studio**
Build your own characters from scratch. Define their name, kanji symbol, personality, speech style, traits, backstory, and storylines. Advanced options include physical details, outfit, and gender — all stored privately on your device.

**API Status & Analytics**
A dedicated dashboard to monitor your AI providers in real time — ping latency with sparkline history, credit balances, token usage breakdowns, per-provider speed ratings, and a smart recommendation engine that surfaces the fastest available provider. A custom diagnostic tool lets you send test prompts and inspect raw completions.

**Fallback chain**
Configure a priority chain of providers and models. If your primary provider fails or runs out of credits, HIBIKI automatically falls through to the next one without interrupting your conversation.

**Precision AI controls**
Fine-tune temperature, top-p, max tokens, context window size, and token mode (economy / balanced / max) from Settings. Every parameter is exposed — nothing is hidden behind defaults.

**Full data control**
Export your entire HIBIKI setup — chats, characters, memories, keys, settings — as a single JSON file. Import it back any time. Delete everything with one tap. Your data is yours.

**Light and dark themes**
Adapts to your preference, with a sakura-tinted aesthetic that holds up in both modes.

**Works on any device**
Responsive across mobile, tablet, and desktop with adaptive navigation and layout.

---

## Supported AI Providers

HIBIKI works with your own API keys from any of these providers:

| Provider | Notes |
|---|---|
| OpenRouter | Access to hundreds of models from one key |
| Groq | Fast inference |
| Fireworks AI | High-performance model hosting |
| Together AI | Open-source model access |

Bring your own key. HIBIKI never touches it beyond your browser's local storage.

---

## Privacy

All data — your API keys, chat history, character definitions, and memories — is stored exclusively in your browser's local storage (on indexDB). No analytics. No telemetry. No backend. Requests go directly from your browser to your chosen AI provider.

---

<details>
<summary><strong>Setup & Self-Hosting</strong></summary>

<br/>

HIBIKI is a standard Vite + React project. Self-hosting it takes a few minutes.

**Prerequisites**
- Node.js 18+
- An API key from at least one supported provider

**Install and run**

```bash
git clone https://github.com/DSwebTEAM/Hibiki_beta_react.git
cd Hibiki_beta_react
npm install
npm run dev
```

Open `http://localhost:5173` in your browser.

**Production build**

```bash
npm run build
```

The `dist/` folder can be deployed to any static host — Netlify, Vercel, Cloudflare Pages, or your own server.

**Netlify (recommended)**

The repo includes a `netlify.toml` with pre-configured SPA routing. Connect the repo in your Netlify dashboard and it deploys automatically on every push.

**Adding your API key**

Open HIBIKI → Settings → paste your API key for any supported provider → select it as active.

</details>

---

<div align="center">
  <br/>
  <img src="https://github.com/user-attachments/assets/26418a2b-57e7-4680-8564-e60f02502c8f" width="32" height="32" alt="響"/>
  <br/>
  <sub>Built by <a href="https://github.com/DSwebTEAM">DSwebTEAM</a> &nbsp;·&nbsp; Made with passion, for the love of anime and good conversation.</sub>
  <br/><br/>
  <sub>Open source. Contributions, feedback, and characters are welcome.</sub>
</div>
