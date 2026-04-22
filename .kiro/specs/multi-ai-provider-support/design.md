# Design Document: Multi-AI Provider Support

## Overview

This feature extends FluxGit's desktop app (SvelteKit + Tauri) with support for four AI providers: Google Gemini, Mistral AI, Grok (xAI), and DeepSeek. It replaces the current project-level AI settings (the `CloudForm` component) with a full provider configuration panel, adds per-provider API key management via `@tauri-apps/plugin-store`, and wires commit message generation and agent chat to use the user-selected provider.

The existing codebase already has an `AIService` in `src/lib/ai/service.ts` that manages OpenAI, Anthropic, Ollama, LM Studio, and Gemini via a `ModelKind` enum and individual client classes. This design adds four new provider clients, a new `AIProviderService` that reads from Tauri Store instead of git config, a redesigned `AISettingsPanel` Svelte component, and reactive integration points in the commit message editor and agent chat.

### Key Design Decisions

- **New service alongside existing**: Rather than modifying the existing `AIService` (which is used by the profile-level settings and the FluxGit API path), a new `AIProviderService` is introduced specifically for the four new providers. This avoids breaking existing functionality.
- **Tauri Store over git config**: The new providers use `@tauri-apps/plugin-store` for persistence, consistent with the requirement to not write to `.env` or git config.
- **fetch() for non-Gemini providers**: Mistral, Grok, and DeepSeek all use OpenAI-compatible chat completion APIs, so a single shared `OpenAICompatibleClient` handles all three, parameterized by base URL.
- **Svelte 5 runes**: All new components use `$state`, `$derived`, and `$effect` consistent with the existing codebase patterns.

---

## Architecture

```mermaid
graph TD
    subgraph UI Layer
        ASP[AISettingsPanel.svelte]
        CME[CommitMessageEditor.svelte]
        AC[AgentChat component]
    end

    subgraph Service Layer
        APS[AIProviderService]
        TS[Tauri Store\n@tauri-apps/plugin-store]
    end

    subgraph Client Layer
        GC[GeminiProviderClient\n@google/genai]
        OCC[OpenAICompatibleClient\nfetch - Mistral / Grok / DeepSeek]
    end

    ASP -->|reads/writes| APS
    CME -->|reads active provider| APS
    AC -->|reads active provider| APS
    APS -->|persists| TS
    APS -->|instantiates| GC
    APS -->|instantiates| OCC
```

The `AIProviderService` is the single source of truth for provider configuration. It reads from and writes to the Tauri Store, instantiates the appropriate client on demand, and exposes reactive Svelte stores so the UI updates automatically when settings change.

---

## Components and Interfaces

### `AIProviderService` (`src/lib/ai/aiProviderService.svelte.ts`)

The central service. Injected via `InjectionToken` following the existing pattern.

```typescript
export type AIProvider = 'gemini' | 'mistral' | 'grok' | 'deepseek';

export type ProviderTestStatus = 'untested' | 'passed' | 'failed';

export interface ProviderConfig {
  provider: AIProvider;
  model: string;
  apiKey: string;
  testStatus: ProviderTestStatus;
}

export interface AIProviderSettings {
  activeProvider: AIProvider | null;
  activeModel: string | null;
  useForCommitMessages: boolean;
  useForAgentChat: boolean;
  providerConfigs: Record<AIProvider, Partial<ProviderConfig>>;
}

export class AIProviderService {
  // Reactive state (Svelte 5 $state)
  readonly settings: AIProviderSettings;

  // Load settings from Tauri Store on init
  async load(): Promise<void>;

  // Persist a full settings update
  async save(update: Partial<AIProviderSettings>): Promise<void>;

  // Save API key for a specific provider
  async saveApiKey(provider: AIProvider, key: string): Promise<void>;

  // Save test result for a provider
  async saveTestStatus(provider: AIProvider, status: ProviderTestStatus): Promise<void>;

  // Build and return the active client (or null if unconfigured)
  getActiveClient(): AIProviderClient | null;

  // Run a connection test for the given provider + key
  async testConnection(provider: AIProvider, apiKey: string, model: string): Promise<boolean>;
}
```

### `AIProviderClient` interface (`src/lib/ai/aiProviderClient.ts`)

```typescript
export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface RepoContext {
  repoPath: string;
  currentBranch: string;
  recentCommits?: string[];
}

export interface AIProviderClient {
  generateCommitMessage(diff: string): Promise<string>;
  generateAgentResponse(messages: ChatMessage[], context: RepoContext): Promise<string>;
}
```

### `GeminiProviderClient` (`src/lib/ai/geminiProviderClient.ts`)

Wraps `@google/genai`. Reuses the existing `GeminiClient` pattern but implements `AIProviderClient`.

```typescript
export class GeminiProviderClient implements AIProviderClient {
  constructor(apiKey: string, model: GeminiProviderModel) {}
  async generateCommitMessage(diff: string): Promise<string>;
  async generateAgentResponse(messages: ChatMessage[], context: RepoContext): Promise<string>;
}
```

### `OpenAICompatibleClient` (`src/lib/ai/openAICompatibleClient.ts`)

Handles Mistral, Grok, and DeepSeek — all of which expose an OpenAI-compatible `/chat/completions` endpoint.

```typescript
export class OpenAICompatibleClient implements AIProviderClient {
  constructor(baseUrl: string, apiKey: string, model: string) {}
  async generateCommitMessage(diff: string): Promise<string>;
  async generateAgentResponse(messages: ChatMessage[], context: RepoContext): Promise<string>;
  // Throws with HTTP status + body on non-2xx responses
}
```

### `AISettingsPanel` (`src/components/projectSettings/AISettingsPanel.svelte`)

Replaces the current `CloudForm` component for the `ai` page in `ProjectSettingsModalContent`.

Key UI elements:
- Provider selector (4 cards with status dot + name)
- Model dropdown (filtered to selected provider)
- API key input (password type, show/hide toggle)
- "Save" button
- "Test Connection" button with loading/success/failure state
- "Use for commit messages" toggle
- "Use for agent chat" toggle

### Provider Catalogue (`src/lib/ai/providerCatalogue.ts`)

```typescript
export const PROVIDER_CATALOGUE = {
  gemini: {
    name: 'Google Gemini',
    models: ['gemini-2.5-flash', 'gemini-2.5-pro'],
    defaultModel: 'gemini-2.5-flash',
  },
  mistral: {
    name: 'Mistral AI',
    models: ['mistral-small-latest', 'mistral-medium-latest', 'mistral-large-latest'],
    defaultModel: 'mistral-small-latest',
  },
  grok: {
    name: 'Grok (xAI)',
    models: ['grok-2', 'grok-2-mini'],
    defaultModel: 'grok-2-mini',
  },
  deepseek: {
    name: 'DeepSeek',
    models: ['deepseek-chat', 'deepseek-reasoner'],
    defaultModel: 'deepseek-chat',
  },
} as const satisfies Record<AIProvider, ProviderMeta>;
```

---

## Data Models

### Tauri Store Keys

All keys are prefixed with `ai.` to avoid collisions with other store entries.

| Key | Type | Description |
|-----|------|-------------|
| `ai.activeProvider` | `AIProvider \| null` | Currently selected provider |
| `ai.activeModel` | `string \| null` | Currently selected model |
| `ai.useForCommitMessages` | `boolean` | Toggle state |
| `ai.useForAgentChat` | `boolean` | Toggle state |
| `ai.key.gemini` | `string` | Gemini API key |
| `ai.key.mistral` | `string` | Mistral API key |
| `ai.key.grok` | `string` | Grok API key |
| `ai.key.deepseek` | `string` | DeepSeek API key |
| `ai.testStatus.gemini` | `ProviderTestStatus` | Last test result |
| `ai.testStatus.mistral` | `ProviderTestStatus` | Last test result |
| `ai.testStatus.grok` | `ProviderTestStatus` | Last test result |
| `ai.testStatus.deepseek` | `ProviderTestStatus` | Last test result |

### Provider Status Logic

The status dot color is a pure function of the stored state:

```
statusColor(provider) =
  if no API key saved          → grey
  if key saved, testStatus === 'untested'  → yellow
  if testStatus === 'passed'   → green
  if testStatus === 'failed'   → red
```

### API Endpoint Map

| Provider | Base URL |
|----------|----------|
| Mistral | `https://api.mistral.ai/v1` |
| Grok | `https://api.x.ai/v1` |
| DeepSeek | `https://api.deepseek.com` |

DeepSeek's path is `/chat/completions` (no `/v1` prefix in the base URL).

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Provider client returns non-empty commit message for any diff

*For any* non-empty diff string, calling `generateCommitMessage(diff)` on any provider client (with mocked HTTP responses returning a valid chat completion) SHALL return a non-empty string.

**Validates: Requirements 1.1**

### Property 2: Provider client returns non-empty agent response for any message history

*For any* non-empty array of `ChatMessage` objects and any `RepoContext`, calling `generateAgentResponse(messages, context)` on any provider client (with mocked HTTP responses) SHALL return a non-empty string.

**Validates: Requirements 1.2**

### Property 3: Non-2xx HTTP status always throws with status code

*For any* HTTP status code in the range 400–599, when a fetch-based provider client (`OpenAICompatibleClient`) receives that status code, it SHALL throw an error whose message contains the numeric status code.

**Validates: Requirements 1.8**

### Property 4: Model dropdown is always a subset of the selected provider's catalogue

*For any* provider selection in the `AISettingsPanel`, the set of models shown in the model dropdown SHALL be exactly equal to the models defined for that provider in `PROVIDER_CATALOGUE` — no more, no fewer.

**Validates: Requirements 2.6, 3.3**

### Property 5: Settings round-trip preserves all values

*For any* valid combination of `(activeProvider, activeModel, apiKey, useForCommitMessages, useForAgentChat)`, saving those values to the Tauri Store and then reading them back SHALL produce values equal to the originals.

**Validates: Requirements 3.7, 4.1–4.6**

### Property 6: Provider status indicator is determined solely by key presence and test result

*For any* provider, the status dot color SHALL be:
- grey when no API key is stored
- yellow when an API key is stored and `testStatus === 'untested'`
- green when `testStatus === 'passed'`
- red when `testStatus === 'failed'`

This must hold for all four providers independently.

**Validates: Requirements 6.1–6.6**

### Property 7: Connection test result is always persisted

*For any* provider, after `testConnection()` resolves (either success or failure), reading `ai.testStatus.<provider>` from the Tauri Store SHALL return `'passed'` or `'failed'` respectively — never `'untested'`.

**Validates: Requirements 10.2, 10.3**

### Property 8: Unconfigured provider always shows configuration prompt

*For any* provider where no API key is stored in the Tauri Store, both the `Commit_Message_Generator` and `Agent_Chat` SHALL display the "Configure AI in Settings → AI options" message rather than attempting generation.

**Validates: Requirements 7.4, 8.5, 9.4**

---

## Error Handling

### API Call Failures

`OpenAICompatibleClient` checks `response.ok` after every `fetch()` call. On failure it reads the response body as text and throws:

```typescript
throw new Error(`[${provider}] HTTP ${response.status}: ${body}`);
```

`GeminiProviderClient` wraps the `@google/genai` SDK call in a try/catch and re-throws with a consistent format.

### Missing API Key

`AIProviderService.getActiveClient()` returns `null` when no API key is configured for the active provider. Callers (commit message editor, agent chat) check for `null` and display the configuration prompt instead of calling the client.

### Connection Test Timeout

The connection test uses `AbortSignal.timeout(10_000)` (10 seconds) to prevent indefinite hangs. On timeout, the test is recorded as `'failed'`.

### Store Read Failures

If the Tauri Store fails to read (e.g., first launch, corrupted store), `AIProviderService.load()` falls back to the default state: check `GEMINI_API_KEY` env var, otherwise `activeProvider: null`.

### Default Provider Fallback

On `load()`, if `ai.activeProvider` is absent from the store:
1. Check `import.meta.env.GEMINI_API_KEY`
2. If present and non-empty: set `activeProvider = 'gemini'`, `activeModel = 'gemini-2.5-flash'`, store the key under `ai.key.gemini`
3. Otherwise: `activeProvider = null` (unconfigured state)

---

## Testing Strategy

### Unit Tests (Vitest)

Located alongside source files as `*.test.ts`.

**`providerCatalogue.test.ts`**
- Assert each provider has the exact model list from requirements
- Assert `defaultModel` is a member of the `models` array

**`openAICompatibleClient.test.ts`**
- Mock `fetch` using `vi.fn()`
- Verify correct URL is called for Mistral, Grok, DeepSeek
- Verify `Authorization: Bearer <key>` header is set
- Verify error thrown on non-2xx status (example: 401, 500)

**`geminiProviderClient.test.ts`**
- Mock `@google/genai` SDK
- Verify client is constructed with correct apiKey and model
- Verify `generateCommitMessage` and `generateAgentResponse` return non-empty strings

**`aiProviderService.test.ts`**
- Mock `@tauri-apps/plugin-store`
- Verify `load()` reads all keys and populates state
- Verify `save()` writes all keys
- Verify fallback to `GEMINI_API_KEY` env var when store is empty
- Verify `getActiveClient()` returns `null` when no key is configured

**`statusIndicator.test.ts`**
- Unit test the pure `statusColor(hasKey, testStatus)` function for all four input combinations

### Property-Based Tests (fast-check)

Using [fast-check](https://fast-check.io/) — already compatible with Vitest.

Each property test runs a minimum of 100 iterations.

**Property 1 — Commit message non-empty** (`Tag: Feature: multi-ai-provider-support, Property 1: Provider client returns non-empty commit message for any diff`)
```typescript
fc.assert(fc.asyncProperty(
  fc.string({ minLength: 1 }),  // any non-empty diff
  async (diff) => {
    const client = new OpenAICompatibleClient(MISTRAL_URL, 'test-key', 'mistral-small-latest');
    vi.mocked(fetch).mockResolvedValue(mockChatResponse('Generated commit message'));
    const result = await client.generateCommitMessage(diff);
    return result.length > 0;
  }
), { numRuns: 100 });
```

**Property 2 — Agent response non-empty** (`Tag: Feature: multi-ai-provider-support, Property 2: Provider client returns non-empty agent response for any message history`)

**Property 3 — Non-2xx throws with status code** (`Tag: Feature: multi-ai-provider-support, Property 3: Non-2xx HTTP status always throws with status code`)
```typescript
fc.assert(fc.asyncProperty(
  fc.integer({ min: 400, max: 599 }),
  async (statusCode) => {
    vi.mocked(fetch).mockResolvedValue(new Response('error', { status: statusCode }));
    await expect(client.generateCommitMessage('diff')).rejects.toThrow(String(statusCode));
    return true;
  }
), { numRuns: 100 });
```

**Property 4 — Model dropdown subset** (`Tag: Feature: multi-ai-provider-support, Property 4: Model dropdown is always a subset of the selected provider's catalogue`)
```typescript
fc.assert(fc.property(
  fc.constantFrom('gemini', 'mistral', 'grok', 'deepseek') as fc.Arbitrary<AIProvider>,
  (provider) => {
    const models = getModelsForProvider(provider);
    const catalogueModels = PROVIDER_CATALOGUE[provider].models;
    return models.every(m => catalogueModels.includes(m)) &&
           catalogueModels.every(m => models.includes(m));
  }
), { numRuns: 100 });
```

**Property 5 — Settings round-trip** (`Tag: Feature: multi-ai-provider-support, Property 5: Settings round-trip preserves all values`)

**Property 6 — Status indicator logic** (`Tag: Feature: multi-ai-provider-support, Property 6: Provider status indicator is determined solely by key presence and test result`)
```typescript
fc.assert(fc.property(
  fc.boolean(),
  fc.constantFrom('untested', 'passed', 'failed') as fc.Arbitrary<ProviderTestStatus>,
  (hasKey, testStatus) => {
    const color = computeStatusColor(hasKey, testStatus);
    if (!hasKey) return color === 'grey';
    if (testStatus === 'untested') return color === 'yellow';
    if (testStatus === 'passed') return color === 'green';
    return color === 'red';
  }
), { numRuns: 100 });
```

**Property 7 — Connection test result persisted** (`Tag: Feature: multi-ai-provider-support, Property 7: Connection test result is always persisted`)

**Property 8 — Unconfigured shows prompt** (`Tag: Feature: multi-ai-provider-support, Property 8: Unconfigured provider always shows configuration prompt`)

### Integration Points

The `AISettingsPanel` component is wired into `ProjectSettingsModalContent` by replacing the `<CloudForm>` render for `currentPage.id === 'ai'` with `<AISettingsPanel projectId={data.projectId} />`.

The commit message editor reads `aiProviderService.settings.useForCommitMessages` and `aiProviderService.getActiveClient()` reactively. No restart is required because the service exposes reactive Svelte 5 `$state`.

Agent chat reads `aiProviderService.settings.useForAgentChat` and `aiProviderService.getActiveClient()` in the same way.
