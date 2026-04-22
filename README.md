<div align="center">
  <img src="apps/desktop/static/images/logo.png" alt="FluxGit Logo" width="80" />
  <h1>FluxGit</h1>
  <p><strong>A modern Git client with multi-AI provider support, built on Tauri + SvelteKit</strong></p>

  [![Build](https://github.com/fluxgitapp/fluxgit/actions/workflows/build.yml/badge.svg)](https://github.com/fluxgitapp/fluxgit/actions/workflows/build.yml)
  [![Release](https://img.shields.io/github/v/release/fluxgitapp/fluxgit)](https://github.com/fluxgitapp/fluxgit/releases)
  [![License](https://img.shields.io/badge/license-FSL--1.1--MIT-blue)](LICENSE.md)
</div>

---

## What is FluxGit?

FluxGit is a desktop Git client for Windows (macOS and Linux coming soon) that combines powerful branch management with AI-assisted workflows. It lets you manage stacks of branches, generate commit messages with AI, chat with an AI agent about your code, and authenticate with GitHub — all from a single native desktop app.

---

## Features

### 🌿 Git & Branch Management
- Visual stack-based branch management
- Commit, amend, squash, reorder, and rebase from the UI
- Drag-and-drop file assignment to branches
- Upstream integration and conflict resolution
- Oplog (snapshot history) with one-click restore
- Git hooks support (pre-commit, post-commit, message)
- Worktree management

### 🤖 Multi-AI Provider Support
FluxGit supports four AI providers for commit message generation and agent chat:

| Provider | Models |
|----------|--------|
| 🟦 Google Gemini | `gemini-2.5-flash`, `gemini-2.5-pro`, `gemini-2.0-flash` |
| 🟧 Mistral AI | `mistral-small-latest`, `mistral-medium-latest`, `mistral-large-latest` |
| ⬛ Grok (xAI) | `grok-2`, `grok-2-mini` |
| 🟩 DeepSeek | `deepseek-chat`, `deepseek-reasoner` |

**AI Settings Panel** (Project Settings → AI Options):
- Provider selector with status indicators (grey/yellow/green/red dots)
- Per-provider API key storage via Tauri Store (never written to `.env` or git config)
- Model dropdown filtered per provider
- Test Connection button with live feedback
- Toggles: "Use for commit message generation" and "Use for AI agent chat"
- Default fallback to Gemini if `GEMINI_API_KEY` is set in environment

**Commit Message Generation:**
- Reads staged diff and sends to selected AI provider
- Button tooltip shows active provider: "Generate with Gemini 2.5 Flash"
- Falls back to existing AI service if new provider not configured
- Error toasts on API failures (e.g. 503 capacity errors)

**AI Agent Chat:**
- Generic chat panel powered by selected provider
- Shows "FluxGit AI — Google Gemini gemini-2.5-flash" in header
- Automatically switches when provider changes in settings
- Falls back to Claude Code panel if `useForAgentChat` is disabled

### 🔐 GitHub OAuth (FluxGit-branded)
- Custom GitHub OAuth App registered as **"FluxGit"**
- Uses GitHub Device Flow — no browser redirect needed
- OAuth backend deployed on Railway (`fluxgit-api-production.up.railway.app`)
- Shows "Authorize FluxGit" instead of "Authorize GitButler Client"

### 🔗 Forge Integrations
- GitHub: Pull requests, reviews, checks, auto-merge
- GitLab: Merge requests, self-hosted support
- Gerrit: Push and review support

### 🎨 UI & UX
- Dark theme with customizable appearance
- Floating commit box mode
- Resizable panels
- Keyboard shortcuts
- Svelte 5 runes-based reactive UI

---

## Architecture

```
fluxgit/
├── apps/
│   ├── desktop/          # SvelteKit + Tauri desktop app (main app)
│   │   ├── src/
│   │   │   ├── components/
│   │   │   │   ├── AIChatPanel.svelte          # Generic AI chat panel
│   │   │   │   ├── CommitMessageEditor.svelte  # AI-powered commit editor
│   │   │   │   ├── StackView.svelte            # Branch stack view
│   │   │   │   ├── projectSettings/
│   │   │   │   │   └── AISettingsPanel.svelte  # Multi-AI settings UI
│   │   │   │   └── codegen/
│   │   │   │       └── CodegenMessages.svelte  # Claude Code chat
│   │   │   └── lib/
│   │   │       ├── ai/
│   │   │       │   ├── aiProviderClient.ts         # Shared types & interfaces
│   │   │       │   ├── aiProviderService.svelte.ts # Reactive service + Tauri Store
│   │   │       │   ├── geminiProviderClient.ts     # Gemini via @google/genai
│   │   │       │   ├── openAICompatibleClient.ts   # Mistral/Grok/DeepSeek via fetch()
│   │   │       │   ├── providerCatalogue.ts        # Provider + model definitions
│   │   │       │   └── providerStatus.ts           # Status dot color logic
│   │   │       └── bootstrap/
│   │   │           └── deps.ts                 # DI registration
│   └── lite/             # Electron lite version
│
├── crates/               # Rust backend (Tauri)
│   ├── fluxgit-tauri/    # Main Tauri app entry point
│   ├── but-github/       # GitHub OAuth device flow
│   ├── but-settings/     # App settings with defaults.jsonc
│   ├── but-api/          # Tauri command handlers
│   └── ...               # 40+ Rust crates
│
├── packages/
│   ├── ui/               # Shared Svelte UI component library
│   ├── shared/           # Shared TypeScript utilities
│   └── core/             # DI context (InjectionToken)
│
└── fluxgit-api/          # OAuth backend (Node.js + Express)
    └── src/index.js
```

---

## FluxGit API (OAuth Backend)

A lightweight Node.js/Express server that handles GitHub OAuth authentication.

**Deployed at:** `https://fluxgit-api-production.up.railway.app`

### Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Health check → `{ status: "ok", app: "FluxGit API" }` |
| `GET` | `/login` | Redirect to GitHub OAuth authorization |
| `GET` | `/auth/callback` | Exchange code for access token |
| `GET` | `/login/token.json` | Tauri-compatible token endpoint |
| `GET` | `/login/whoami` | Validate token, return GitHub user info |

### Features
- Rate limiting (100 req/15min global, 20 req/15min for auth endpoints)
- CORS configured for allowed origins
- Request logging via Morgan
- Error handling on all routes
- Deployed on Railway with auto-deploy from GitHub

### Source
Repository: `https://github.com/fluxgitapp/fluxgit-api`

---

## Tech Stack

### Frontend (Desktop App)
- **Framework:** SvelteKit with Svelte 5 runes (`$state`, `$derived`, `$effect`)
- **Desktop:** Tauri v2 (Rust backend + WebView frontend)
- **Styling:** PostCSS with CSS custom properties
- **State:** Redux (via `@reduxjs/toolkit`) + Svelte 5 reactive state
- **Build:** Vite + Turborepo

### Backend (Rust)
- **Language:** Rust (stable)
- **Async:** Tokio
- **Git:** `git2` (libgit2 bindings) + `gix`
- **IPC:** Tauri commands
- **Storage:** Tauri Store plugin (`@tauri-apps/plugin-store`)
- **Secrets:** OS keychain via `but-secret`

### AI Integration
- **Gemini:** `@google/genai` SDK
- **Mistral / Grok / DeepSeek:** Native `fetch()` to OpenAI-compatible endpoints
- **Storage:** All API keys stored in Tauri Store (never in git config or `.env`)

### OAuth API
- **Runtime:** Node.js 18+
- **Framework:** Express 4
- **Deployment:** Railway
- **Rate limiting:** `express-rate-limit`
- **Logging:** Morgan

---

## Getting Started

### Prerequisites
- [Rust](https://rustup.rs/) (stable)
- [Node.js](https://nodejs.org/) 22+
- [pnpm](https://pnpm.io/) (version from `package.json`)
- Windows: Visual Studio Build Tools with MSVC

### Development

```bash
# Clone the repo
git clone https://github.com/fluxgitapp/fluxgit.git
cd fluxgit

# Install dependencies
pnpm install

# Start dev server (Tauri + SvelteKit hot reload)
pnpm tauri dev
```

### Production Build

```bash
pnpm tauri build
```

Outputs to `target/tauri/release/bundle/`:
- `msi/FluxGit_1.0.0_x64_en-US.msi` — Windows MSI installer
- `nsis/FluxGit_1.0.0_x64-setup.exe` — Windows NSIS installer

### Running the OAuth API locally

```bash
cd fluxgit-api
cp .env.example .env
# Fill in GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET
npm install
npm start
# API runs on http://localhost:3333
```

---

## Configuration

### AI Providers
Go to **Project Settings → AI Options** to configure:
1. Select a provider (Gemini, Mistral, Grok, or DeepSeek)
2. Enter your API key
3. Choose a model
4. Click **Save** then **Test Connection**
5. Enable toggles for commit messages and/or agent chat

### GitHub OAuth
The app uses the FluxGit GitHub OAuth App (`Ov23liC1vTzKIVDLMKby`) for authentication via the Device Flow. No browser redirect is required — just enter the code shown in the app at `github.com/login/device`.

---

## CI/CD

GitHub Actions workflow (`.github/workflows/build.yml`) triggers on `v*` tags:

1. Checks out code
2. Installs Rust stable + pnpm + Node 22
3. Builds with `pnpm tauri build`
4. Signs updater artifacts with `TAURI_SIGNING_PRIVATE_KEY`
5. Uploads MSI and NSIS installers as artifacts
6. Creates a GitHub Release with all installer files

### Required GitHub Secrets
| Secret | Description |
|--------|-------------|
| `TAURI_SIGNING_PRIVATE_KEY` | Minisign private key for updater signing |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | Password for the private key |

---

## Release

To create a new release:

```bash
git tag v1.0.2
git push origin v1.0.2
```

This triggers the CI build and automatically creates a GitHub Release at `https://github.com/fluxgitapp/fluxgit/releases`.

---

## License

[FSL-1.1-MIT](LICENSE.md) — Functional Source License

---

<div align="center">
  Built with ❤️ by <a href="https://github.com/fluxgitapp">FluxGit</a>
</div>
