# FluxGit

**AI-Powered Git Desktop Application** — v1.1.0

FluxGit is a cross-platform desktop Git client built on Tauri + SvelteKit that integrates a unified multi-provider AI system to automate and augment common version control workflows.

[![Build](https://github.com/fluxgitapp/fluxgit/actions/workflows/build.yml/badge.svg)](https://github.com/fluxgitapp/fluxgit/actions)
[![Release](https://img.shields.io/github/v/release/fluxgitapp/fluxgit)](https://github.com/fluxgitapp/fluxgit/releases)
[![License](https://img.shields.io/badge/license-FSL--1.0--MIT-blue)](LICENSE.md)

---

## Features

### AI Commit Message Generation
Click the ✨ button in the commit editor to generate a Conventional Commits-formatted message from your staged diff. Works with all 6 AI providers.

### Branch Intelligence
Click ✨ on any branch card to open the Branch Intelligence panel:
- **💡 Explain Changes** — plain English summary of what the branch does
- **📝 Generate PR Description** — full GitHub PR with title, summary, testing notes
- **🔍 Find Issues** — code review: bugs, security, performance problems
- **✍️ Suggest Commit Message** — conventional commit for the branch's changes

### AI Chat Panel
Full chat interface with real branch context — the AI knows your actual changed files. Supports real PR creation directly from chat.

### Multi-Provider AI Support
| Provider | Type | Cost |
|----------|------|------|
| Google Gemini | Cloud | Free tier |
| Mistral AI | Cloud | Paid |
| Grok (xAI) | Cloud | Paid |
| DeepSeek | Cloud | Paid |
| Ollama | **Local** | Free |
| LMStudio | **Local** | Free |

### Stream Rules
Define glob patterns to control which files are tracked per branch. Full CRUD with auto-suggest from file analysis.

### Auto-commit Automation
Quick Workflow: stage → AI generate → commit. Optional auto-push. Configurable per project.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Desktop UI | SvelteKit 5 + TypeScript |
| Desktop Shell | Tauri 2 (Rust) |
| Git Engine | libgit2 via Rust crates |
| Cloud API | Node.js + Express on Railway |
| Authentication | GitHub OAuth (FluxGit app) |
| AI — Cloud | Gemini · Mistral · Grok · DeepSeek |
| AI — Local | Ollama · LMStudio |
| Build System | Turborepo + pnpm workspaces |
| CI/CD | GitHub Actions |

---

## Project Structure

```
fluxgit/
├── apps/
│   ├── desktop/                    # SvelteKit desktop frontend
│   │   └── src/
│   │       ├── components/
│   │       │   ├── AIChatPanel.svelte          # AI chat with branch context
│   │       │   ├── BranchIntelligence.svelte   # 4-action AI panel
│   │       │   ├── CommitMessageEditor.svelte  # AI commit generation
│   │       │   ├── BranchCard.svelte           # Branch card with ✨ button
│   │       │   └── projectSettings/
│   │       │       ├── AISettingsPanel.svelte  # Provider config UI
│   │       │       ├── StreamRulesSettings.svelte
│   │       │       └── AutomationSettings.svelte
│   │       └── lib/
│   │           └── ai/
│   │               ├── aiProviderClient.ts     # Provider interface
│   │               ├── aiProviderService.svelte.ts  # Settings + client factory
│   │               ├── geminiProviderClient.ts # Gemini SDK client
│   │               ├── openAICompatibleClient.ts   # All other providers
│   │               └── providerCatalogue.ts    # Provider registry
│   └── web/                        # SvelteKit web app
├── crates/
│   └── fluxgit-tauri/              # Rust/Tauri backend
│       ├── src/main.rs             # App entry, deep link handler
│       └── icons/                  # App icons (all sizes)
└── .github/
    └── workflows/
        └── build.yml               # CI/CD pipeline
```

---

## Getting Started

### Prerequisites
- Node.js 22+
- pnpm 9+
- Rust (stable)
- [Tauri prerequisites](https://tauri.app/start/prerequisites/)

### Development

```bash
git clone https://github.com/fluxgitapp/fluxgit
cd fluxgit
pnpm install
pnpm tauri dev
```

### Production Build

```bash
pnpm tauri build
```

Produces signed installers in `target/tauri/release/bundle/`.

---

## AI Setup

### Cloud Providers
Go to **Project Settings → AI Options**, select a provider, enter your API key, and click Save.

- **Gemini**: [aistudio.google.com](https://aistudio.google.com) — free tier available
- **Mistral**: [console.mistral.ai](https://console.mistral.ai)
- **Grok**: [console.x.ai](https://console.x.ai)
- **DeepSeek**: [platform.deepseek.com](https://platform.deepseek.com)

### Local Providers (No API Key Required)

**Ollama:**
```bash
# Install from https://ollama.ai
ollama pull gemma4:e4b
# Runs at http://localhost:11434
```

**LMStudio:**
1. Download from [lmstudio.ai](https://lmstudio.ai)
2. Download `google/gemma-4-e4b` model
3. Start the server (Developer tab)
4. Enable CORS in Server Settings
5. Set URL to `http://127.0.0.1:1234` in FluxGit AI Options

---

## Authentication

FluxGit uses GitHub OAuth for login. Click **Log in / Sign up** in Global Settings → General. The OAuth flow:

1. App requests login URL from Railway API
2. Browser opens GitHub authorization page
3. After authorization, GitHub redirects to Railway
4. Railway deep-links the token back to the app (`but-dev://login?access_token=...`)
5. App logs in automatically

---

## CI/CD

Pushing a version tag triggers the build pipeline:

```bash
git tag v1.x.x
git push origin v1.x.x
```

GitHub Actions builds and signs installers for Windows (MSI + NSIS), macOS (DMG), and Linux (AppImage), then creates a GitHub Release.

---

## Related Repositories

- **[fluxgitapp/fluxgit-api](https://github.com/fluxgitapp/fluxgit-api)** — OAuth API (Node.js, Railway)
- **fluxgit-web** — Marketing website (Next.js)

---

## License

FluxGit is based on [GitButler](https://github.com/gitbutlerapp/gitbutler) and is licensed under the [Functional Source License 1.0 with MIT Future License](LICENSE.md).
