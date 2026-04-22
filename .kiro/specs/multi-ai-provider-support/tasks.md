# Implementation Plan: Multi-AI Provider Support

## Overview

Implement multi-AI provider support for FluxGit's desktop app by introducing a new `AIProviderService` alongside the existing `AIService`, four provider clients (Gemini, Mistral, Grok, DeepSeek), a redesigned `AISettingsPanel` component, and reactive integration points in the commit message editor and agent chat. All settings are persisted via `@tauri-apps/plugin-store`.

## Tasks

- [x] 1. Define core types and the `AIProviderClient` interface
  - Create `src/lib/ai/aiProviderClient.ts` with the `ChatMessage`, `RepoContext`, and `AIProviderClient` interface
  - Export `AIProvider` and `ProviderTestStatus` union types used across the feature
  - _Requirements: 1.1, 1.2_

- [x] 2. Create the provider catalogue
  - [x] 2.1 Implement `src/lib/ai/providerCatalogue.ts`
    - Define `PROVIDER_CATALOGUE` as a `const satisfies Record<AIProvider, ProviderMeta>` with all four providers, their model lists, and default models
    - Export a `getModelsForProvider(provider: AIProvider): string[]` helper used by the UI and property tests
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [ ]* 2.2 Write property test for provider catalogue (Property 4)
    - **Property 4: Model dropdown is always a subset of the selected provider's catalogue**
    - Use `fc.constantFrom('gemini', 'mistral', 'grok', 'deepseek')` to assert `getModelsForProvider` returns exactly the catalogue models — no more, no fewer
    - **Validates: Requirements 2.6, 3.3**

- [x] 3. Implement `GeminiProviderClient`
  - [x] 3.1 Create `src/lib/ai/geminiProviderClient.ts`
    - Implement `AIProviderClient` using `@google/genai` SDK, following the existing `GeminiClient` pattern
    - `generateCommitMessage(diff)` sends a single-turn prompt and returns the trimmed response
    - `generateAgentResponse(messages, context)` maps `ChatMessage[]` to Gemini history format and calls `sendMessage`
    - _Requirements: 1.1, 1.2, 1.3_

  - [ ]* 3.2 Write property test for `GeminiProviderClient` commit message (Property 1)
    - **Property 1: Provider client returns non-empty commit message for any diff**
    - Mock `@google/genai` SDK; use `fc.string({ minLength: 1 })` as the diff; assert result length > 0
    - **Validates: Requirements 1.1**

  - [ ]* 3.3 Write property test for `GeminiProviderClient` agent response (Property 2)
    - **Property 2: Provider client returns non-empty agent response for any message history**
    - Use `fc.array(fc.record({ role: fc.constantFrom('user','assistant','system'), content: fc.string({ minLength: 1 }) }), { minLength: 1 })` and a fixed `RepoContext`; assert result length > 0
    - **Validates: Requirements 1.2**

- [x] 4. Implement `OpenAICompatibleClient`
  - [x] 4.1 Create `src/lib/ai/openAICompatibleClient.ts`
    - Implement `AIProviderClient` using native `fetch()` for Mistral (`https://api.mistral.ai/v1`), Grok (`https://api.x.ai/v1`), and DeepSeek (`https://api.deepseek.com`)
    - Set `Authorization: Bearer <apiKey>` header and `Content-Type: application/json`
    - On non-2xx response, read body as text and throw `new Error(\`[${provider}] HTTP ${response.status}: ${body}\`)`
    - Use `AbortSignal.timeout(10_000)` on all fetch calls
    - _Requirements: 1.1, 1.2, 1.4, 1.5, 1.6, 1.7, 1.8_

  - [ ]* 4.2 Write property test for non-2xx error throwing (Property 3)
    - **Property 3: Non-2xx HTTP status always throws with status code**
    - Mock `fetch` with `vi.fn()`; use `fc.integer({ min: 400, max: 599 })` as the status code; assert the thrown error message contains `String(statusCode)`
    - **Validates: Requirements 1.8**

  - [ ]* 4.3 Write property test for `OpenAICompatibleClient` commit message (Property 1 — fetch path)
    - **Property 1: Provider client returns non-empty commit message for any diff**
    - Mock `fetch` to return a valid chat completion JSON; use `fc.string({ minLength: 1 })` as the diff; assert result length > 0
    - **Validates: Requirements 1.1**

  - [ ]* 4.4 Write unit tests for `OpenAICompatibleClient`
    - Verify correct base URL is called for each of Mistral, Grok, and DeepSeek
    - Verify `Authorization: Bearer <key>` header is present
    - Verify error is thrown on 401 and 500 responses
    - _Requirements: 1.4, 1.5, 1.6, 1.8_

- [x] 5. Checkpoint — Ensure all client tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Implement `AIProviderService`
  - [x] 6.1 Create `src/lib/ai/aiProviderService.svelte.ts`
    - Define `ProviderConfig`, `AIProviderSettings` interfaces and export `AI_PROVIDER_SERVICE` injection token
    - Implement `load()`: read all `ai.*` keys from `@tauri-apps/plugin-store`; fall back to `import.meta.env.GEMINI_API_KEY` when store is empty; default to `activeProvider: null` if neither is present
    - Implement `save(update)`, `saveApiKey(provider, key)`, `saveTestStatus(provider, status)` — each writes to the Tauri Store
    - Implement `getActiveClient()`: returns `null` when no API key is configured; otherwise instantiates `GeminiProviderClient` or `OpenAICompatibleClient` based on `activeProvider`
    - Implement `testConnection(provider, apiKey, model)`: sends a minimal request, records result via `saveTestStatus`, uses `AbortSignal.timeout(10_000)`
    - Expose all settings as Svelte 5 `$state` so UI updates reactively
    - _Requirements: 3.7, 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 9.1, 9.2, 9.3, 10.1, 10.2, 10.3_

  - [ ]* 6.2 Write property test for settings round-trip (Property 5)
    - **Property 5: Settings round-trip preserves all values**
    - Mock `@tauri-apps/plugin-store`; use `fc.record` to generate arbitrary valid settings combinations; call `save()` then `load()` and assert all values are equal to originals
    - **Validates: Requirements 3.7, 4.1–4.6**

  - [ ]* 6.3 Write property test for connection test persistence (Property 7)
    - **Property 7: Connection test result is always persisted**
    - Mock `fetch` to return success or failure; after `testConnection()` resolves, read `ai.testStatus.<provider>` from the mocked store and assert it is `'passed'` or `'failed'` — never `'untested'`
    - **Validates: Requirements 10.2, 10.3**

  - [ ]* 6.4 Write unit tests for `AIProviderService`
    - Verify `load()` reads all store keys and populates `$state`
    - Verify fallback to `GEMINI_API_KEY` env var when store is empty
    - Verify `getActiveClient()` returns `null` when no API key is configured
    - Verify `getActiveClient()` returns a `GeminiProviderClient` when provider is `'gemini'` and key is set
    - _Requirements: 4.6, 9.1, 9.2, 9.3_

- [x] 7. Implement the status indicator pure function and its tests
  - [x] 7.1 Create `src/lib/ai/providerStatus.ts`
    - Export `computeStatusColor(hasKey: boolean, testStatus: ProviderTestStatus): 'grey' | 'yellow' | 'green' | 'red'` as a pure function
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6_

  - [ ]* 7.2 Write property test for status indicator (Property 6)
    - **Property 6: Provider status indicator is determined solely by key presence and test result**
    - Use `fc.boolean()` and `fc.constantFrom('untested', 'passed', 'failed')`; assert the four colour rules hold for all combinations
    - **Validates: Requirements 6.1–6.6**

- [x] 8. Build `AISettingsPanel` component
  - [x] 8.1 Create `src/components/projectSettings/AISettingsPanel.svelte`
    - Inject `AI_PROVIDER_SERVICE` and render the full settings UI: provider selector cards (4 providers with status dots using `computeStatusColor`), model dropdown (filtered to selected provider via `getModelsForProvider`), API key password input with show/hide toggle, "Save" button, "Test Connection" button with loading/success/failure state, "Use for commit messages" toggle, "Use for agent chat" toggle
    - On "Save": call `aiProviderService.save(...)` and `aiProviderService.saveApiKey(...)`
    - On "Test Connection": disable button, show loading state, call `aiProviderService.testConnection(...)`, update status dot immediately on completion
    - Pre-populate all fields from `aiProviderService.settings` on mount
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 3.10, 4.1–4.7, 5.1, 5.2, 5.5, 6.1–6.6, 10.1–10.5_

  - [ ]* 8.2 Write property test for unconfigured provider prompt (Property 8)
    - **Property 8: Unconfigured provider always shows configuration prompt**
    - For each of the four providers with no API key in the mocked store, render `AISettingsPanel` and assert the "Configure AI in Settings → AI options" message is visible
    - **Validates: Requirements 7.4, 8.5, 9.4**

- [x] 9. Wire `AISettingsPanel` into project settings
  - Modify `src/components/ProjectSettingsModalContent.svelte`: replace `<CloudForm projectId={data.projectId} />` with `<AISettingsPanel projectId={data.projectId} />` for `currentPage.id === 'ai'`
  - Add the import for `AISettingsPanel`
  - _Requirements: 3.1_

- [x] 10. Register `AIProviderService` in the app bootstrap
  - Locate the bootstrap/DI registration file (e.g., `src/lib/bootstrap/`) and register `AI_PROVIDER_SERVICE` using the same `InjectionToken` pattern as `AI_SERVICE`
  - Call `aiProviderService.load()` during app startup so settings are available before any component renders
  - _Requirements: 4.6, 9.1, 9.2_

- [x] 11. Update commit message editor to use `AIProviderService`
  - Modify `src/components/CommitMessageEditor.svelte`:
    - Inject `AI_PROVIDER_SERVICE` alongside the existing `AI_SERVICE`
    - When `aiProviderService.settings.useForCommitMessages` is `true` and `aiProviderService.getActiveClient()` is non-null, call `activeClient.generateCommitMessage(diff)` instead of the existing `aiMacros.generateCommitMessage()`
    - When `useForCommitMessages` is `true` but `getActiveClient()` returns `null`, display "Configure AI in Settings → AI options" instead of attempting generation
    - Update the generate button tooltip to show the active provider and model name (e.g., "Generate with Gemini 2.5 Flash") when the new provider is active
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

- [x] 12. Update agent chat to use `AIProviderService`
  - Locate the agent chat component(s) that handle AI message generation
  - Inject `AI_PROVIDER_SERVICE` and read `aiProviderService.settings.useForAgentChat` reactively
  - When `useForAgentChat` is `true` and `getActiveClient()` is non-null, call `activeClient.generateAgentResponse(messages, context)` for each user message
  - When `useForAgentChat` is `true` but `getActiveClient()` returns `null`, display "Configure AI in Settings → AI options" in the chat header area
  - Display the active provider and model name in the chat header (e.g., "FluxGit AI — Gemini 2.5 Flash") when the new provider is active
  - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

- [x] 13. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- The existing `AIService` and `CloudForm` are left untouched; `AIProviderService` and `AISettingsPanel` are additive
- Property tests use `fast-check` (already compatible with Vitest in this project)
- All property tests run a minimum of 100 iterations (`numRuns: 100`)
- Checkpoints ensure incremental validation before integration work begins
