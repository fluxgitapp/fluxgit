# Requirements Document

## Introduction

This feature extends FluxGit's desktop app (SvelteKit + Tauri) with multi-AI provider support, allowing users to choose between Google Gemini, Mistral AI, Grok (xAI), and DeepSeek as their AI backend. The feature replaces the current single-provider AI settings with a full provider configuration panel, updates commit message generation and agent chat to use the selected provider, and persists all settings to the local Tauri store.

The existing codebase already has an `AIService` with support for OpenAI, Anthropic, Ollama, LM Studio, and Gemini via `ModelKind` enum and individual client classes. This feature adds four new providers (Gemini extended, Mistral, Grok, DeepSeek) with model selection, a redesigned settings UI, and provider status indicators.

## Glossary

- **AI_Provider_Service**: The module at `apps/desktop/src/lib/ai/aiProvider.ts` that implements all provider clients and exposes a unified interface.
- **Provider**: One of the four supported AI backends: Gemini, Mistral, Grok, or DeepSeek.
- **Model**: A specific model variant offered by a Provider (e.g., `gemini-2.5-flash`, `mistral-large-latest`).
- **API_Key**: A secret string credential required to authenticate with a Provider's REST API.
- **AI_Settings_Panel**: The UI component rendered under Project Settings → AI options that allows provider/model/key configuration.
- **Tauri_Store**: The persistent key-value store provided by `@tauri-apps/plugin-store`, used to save all AI provider settings locally.
- **Provider_Status**: A visual indicator (grey/yellow/green/red dot) reflecting the configuration and test state of a Provider.
- **Commit_Message_Generator**: The part of the system that calls an AI provider to produce a git commit message from a diff.
- **Agent_Chat**: The AI chat interface within FluxGit that uses a Provider to respond to user messages in a repository context.
- **ChatMessage**: A typed message object with role and content, used as input to `generateAgentResponse`.
- **RepoContext**: Contextual information about the current repository passed to `generateAgentResponse`.
- **Connection_Test**: A lightweight API call used to verify that a saved API_Key is valid and the Provider is reachable.

---

## Requirements

### Requirement 1: AI Provider Client Implementation

**User Story:** As a developer, I want FluxGit to support Gemini, Mistral, Grok, and DeepSeek as AI providers, so that I can use my preferred AI service for commit messages and agent chat.

#### Acceptance Criteria

1. THE AI_Provider_Service SHALL expose a `generateCommitMessage(diff: string): Promise<string>` method for each Provider.
2. THE AI_Provider_Service SHALL expose a `generateAgentResponse(messages: ChatMessage[], context: RepoContext): Promise<string>` method for each Provider.
3. WHEN calling Gemini, THE AI_Provider_Service SHALL use the `@google/genai` SDK with the user-supplied API_Key and selected Model.
4. WHEN calling Mistral, THE AI_Provider_Service SHALL use `fetch()` to POST to `https://api.mistral.ai/v1/chat/completions` with the user-supplied API_Key and selected Model.
5. WHEN calling Grok, THE AI_Provider_Service SHALL use `fetch()` to POST to `https://api.x.ai/v1/chat/completions` with the user-supplied API_Key and selected Model.
6. WHEN calling DeepSeek, THE AI_Provider_Service SHALL use `fetch()` to POST to `https://api.deepseek.com/chat/completions` with the user-supplied API_Key and selected Model.
7. THE AI_Provider_Service SHALL NOT import any third-party SDK other than `@google/genai` for Gemini; all other providers SHALL use the native `fetch()` API.
8. WHEN a Provider API call returns a non-2xx HTTP status, THE AI_Provider_Service SHALL throw an error containing the HTTP status code and response body.

---

### Requirement 2: Provider and Model Catalogue

**User Story:** As a user, I want to see all available providers and their models listed in settings, so that I can make an informed selection.

#### Acceptance Criteria

1. THE AI_Provider_Service SHALL define Gemini models: `gemini-2.5-flash` and `gemini-2.5-pro`.
2. THE AI_Provider_Service SHALL define Mistral models: `mistral-small-latest`, `mistral-medium-latest`, and `mistral-large-latest`.
3. THE AI_Provider_Service SHALL define Grok models: `grok-2` and `grok-2-mini`.
4. THE AI_Provider_Service SHALL define DeepSeek models: `deepseek-chat` and `deepseek-reasoner`.
5. THE AI_Settings_Panel SHALL display all four Providers with their respective names and visual identifiers (icons or colored indicators).
6. WHEN a Provider is selected in the AI_Settings_Panel, THE AI_Settings_Panel SHALL display only the models available for that Provider in the model dropdown.

---

### Requirement 3: AI Settings Panel — Provider and Model Selection

**User Story:** As a user, I want a clear settings panel to select my AI provider and model, so that I can configure which AI powers my FluxGit features.

#### Acceptance Criteria

1. THE AI_Settings_Panel SHALL render within Project Settings under the "AI options" page.
2. THE AI_Settings_Panel SHALL present a provider selector showing all four Providers with distinct visual identifiers.
3. WHEN a Provider is selected, THE AI_Settings_Panel SHALL update the model dropdown to show only that Provider's models.
4. THE AI_Settings_Panel SHALL display a single API_Key input field corresponding to the currently selected Provider.
5. THE AI_Settings_Panel SHALL label the API_Key input field with the Provider name (e.g., "Gemini API Key", "Mistral API Key").
6. THE AI_Settings_Panel SHALL render the API_Key input as a password field with a show/hide visibility toggle.
7. THE AI_Settings_Panel SHALL provide a "Save" button that persists the selected Provider, Model, and API_Key to the Tauri_Store.
8. THE AI_Settings_Panel SHALL provide a "Test Connection" button that triggers a Connection_Test for the currently selected Provider.
9. WHEN the Connection_Test succeeds, THE AI_Settings_Panel SHALL display a success indicator (✅) next to the "Test Connection" button.
10. WHEN the Connection_Test fails, THE AI_Settings_Panel SHALL display a failure indicator (❌) next to the "Test Connection" button.

---

### Requirement 4: Settings Persistence via Tauri Store

**User Story:** As a user, I want my AI provider settings saved locally, so that my configuration persists across app restarts without relying on environment variables.

#### Acceptance Criteria

1. THE AI_Settings_Panel SHALL save the selected Provider identifier to the Tauri_Store under a defined key.
2. THE AI_Settings_Panel SHALL save the selected Model name to the Tauri_Store under a defined key.
3. THE AI_Settings_Panel SHALL save the API_Key for each Provider to the Tauri_Store under a per-provider key.
4. THE AI_Settings_Panel SHALL save the "use for commit message generation" toggle state to the Tauri_Store.
5. THE AI_Settings_Panel SHALL save the "use for agent chat" toggle state to the Tauri_Store.
6. WHEN the AI_Settings_Panel is opened, THE AI_Settings_Panel SHALL read all previously saved values from the Tauri_Store and pre-populate the form fields.
7. THE AI_Settings_Panel SHALL NOT write AI settings to `.env` files or git config.

---

### Requirement 5: Use-For Toggles

**User Story:** As a user, I want to control which AI features use the configured provider, so that I can enable or disable AI assistance per feature independently.

#### Acceptance Criteria

1. THE AI_Settings_Panel SHALL display a toggle labelled "Use for commit message generation".
2. THE AI_Settings_Panel SHALL display a toggle labelled "Use for AI agent chat".
3. WHEN the "Use for commit message generation" toggle is enabled, THE Commit_Message_Generator SHALL use the configured Provider and Model.
4. WHEN the "Use for AI agent chat" toggle is enabled, THE Agent_Chat SHALL use the configured Provider and Model.
5. WHEN a toggle is changed, THE AI_Settings_Panel SHALL persist the new toggle state to the Tauri_Store immediately.

---

### Requirement 6: Provider Status Indicators

**User Story:** As a user, I want to see the configuration status of each provider at a glance, so that I know which providers are ready to use.

#### Acceptance Criteria

1. THE AI_Settings_Panel SHALL display a status indicator dot for each Provider.
2. WHEN a Provider has no saved API_Key, THE AI_Settings_Panel SHALL display a grey dot for that Provider.
3. WHEN a Provider has a saved API_Key but no Connection_Test has been run, THE AI_Settings_Panel SHALL display a yellow dot for that Provider.
4. WHEN the most recent Connection_Test for a Provider succeeded, THE AI_Settings_Panel SHALL display a green dot for that Provider.
5. WHEN the most recent Connection_Test for a Provider failed, THE AI_Settings_Panel SHALL display a red dot for that Provider.
6. WHEN an API_Key is saved for a Provider, THE AI_Settings_Panel SHALL update that Provider's status indicator to yellow until a Connection_Test is run.

---

### Requirement 7: Commit Message Generation Integration

**User Story:** As a developer, I want commit message generation to use my selected AI provider and model, so that I get AI-generated messages from the service I've configured.

#### Acceptance Criteria

1. WHEN the "Generate commit message" action is triggered, THE Commit_Message_Generator SHALL read the active Provider, Model, and API_Key from the Tauri_Store.
2. WHEN the "Use for commit message generation" toggle is enabled, THE Commit_Message_Generator SHALL call the active Provider's `generateCommitMessage()` method.
3. THE Commit_Message_Generator SHALL display the active Provider and Model name in the generate button tooltip (e.g., "Generate with Gemini 2.5 Flash").
4. WHEN no API_Key is configured for the active Provider, THE Commit_Message_Generator SHALL display the message "Configure AI in Settings → AI options" instead of attempting generation.
5. WHEN the active Provider changes in settings, THE Commit_Message_Generator SHALL use the new Provider on the next generation attempt without requiring an app restart.

---

### Requirement 8: Agent Chat Integration

**User Story:** As a developer, I want the AI agent chat to use my selected provider, so that my chat interactions are powered by the AI service I prefer.

#### Acceptance Criteria

1. WHEN the Agent_Chat sends a message, THE Agent_Chat SHALL read the active Provider, Model, and API_Key from the Tauri_Store.
2. WHEN the "Use for AI agent chat" toggle is enabled, THE Agent_Chat SHALL call the active Provider's `generateAgentResponse()` method.
3. THE Agent_Chat SHALL display the active Provider and Model name in the chat header (e.g., "FluxGit AI — Gemini 2.5 Flash").
4. WHEN the active Provider is changed in settings, THE Agent_Chat SHALL use the new Provider for all subsequent messages in the current session without requiring an app restart.
5. WHEN no API_Key is configured for the active Provider, THE Agent_Chat SHALL display a prompt directing the user to configure AI in Settings → AI options.

---

### Requirement 9: Default Provider Fallback

**User Story:** As a user, I want FluxGit to automatically use Gemini if a Gemini API key is already present in the environment, so that existing setups continue to work without reconfiguration.

#### Acceptance Criteria

1. WHEN the app starts and no Provider is saved in the Tauri_Store, THE AI_Provider_Service SHALL check for a `GEMINI_API_KEY` value in the environment.
2. WHEN `GEMINI_API_KEY` is present and non-empty in the environment, THE AI_Provider_Service SHALL default the active Provider to Gemini and the active Model to `gemini-2.5-flash`.
3. WHEN no Provider is saved in the Tauri_Store and no `GEMINI_API_KEY` is present, THE AI_Provider_Service SHALL set the configuration state to "unconfigured".
4. WHEN the configuration state is "unconfigured", THE Commit_Message_Generator and Agent_Chat SHALL display "No AI provider configured" with a link to Settings → AI options.

---

### Requirement 10: Connection Test Implementation

**User Story:** As a user, I want to verify my API key works before relying on it, so that I can catch configuration errors early.

#### Acceptance Criteria

1. WHEN the "Test Connection" button is pressed, THE AI_Settings_Panel SHALL send a minimal request to the selected Provider's API using the entered API_Key.
2. WHEN the Connection_Test request returns a valid response, THE AI_Settings_Panel SHALL record the test result as "passed" in the Tauri_Store for that Provider.
3. WHEN the Connection_Test request fails or returns an error, THE AI_Settings_Panel SHALL record the test result as "failed" in the Tauri_Store for that Provider.
4. WHILE a Connection_Test is in progress, THE AI_Settings_Panel SHALL disable the "Test Connection" button and display a loading state.
5. WHEN a Connection_Test completes, THE AI_Settings_Panel SHALL update the Provider_Status indicator for the tested Provider immediately.
