<script lang="ts">
	import { AI_PROVIDER_SERVICE } from '$lib/ai/aiProviderService.svelte';
	import {
		PROVIDER_CATALOGUE,
		getModelOptionsForProvider,
		isLocalProvider,
		requiresApiKey,
		getProviderBadge,
		getProviderBadgeColor,
		getProviderSetupUrl,
		getProviderHelperText
	} from '$lib/ai/providerCatalogue';
	import { computeStatusColor } from '$lib/ai/providerStatus';
	import { inject } from '@fluxgit/core/context';
	import { CardGroup, Spacer, Toggle } from '@fluxgit/ui';
	import type { AIProvider } from '$lib/ai/aiProviderClient';

	const { projectId }: { projectId: string } = $props();

	const aiProviderService = inject(AI_PROVIDER_SERVICE);

	// ─── Local state ──────────────────────────────────────────────────────────
	let selectedProvider: AIProvider = $state(
		aiProviderService.settings.activeProvider ?? 'gemini'
	);
	let selectedModel: string = $state(
		aiProviderService.settings.activeModel ??
			PROVIDER_CATALOGUE[aiProviderService.settings.activeProvider ?? 'gemini'].defaultModel
	);
	let apiKeyInput: string = $state(
		aiProviderService.settings.providerKeys[
			aiProviderService.settings.activeProvider ?? 'gemini'
		] ?? ''
	);
	let customModelInput: string = $state(aiProviderService.settings.customModelName ?? '');
	let showApiKey = $state(false);
	let testStatus: 'idle' | 'loading' | 'success' | 'error' = $state('idle');
	let isSaving = $state(false);

	// Local provider connection status
	let ollamaStatus: 'checking' | 'connected' | 'offline' = $state('checking');
	let lmstudioStatus: 'checking' | 'connected' | 'offline' = $state('checking');
	let ollamaModels: string[] = $state([]);

	// Configurable LMStudio URL (persisted in localStorage)
	// Migrate: strip any path suffix — we only want the base URL (e.g. http://127.0.0.1:1234)
	function getStoredLmstudioUrl(): string {
		if (typeof localStorage === 'undefined') return 'http://127.0.0.1:1234';
		let stored = localStorage.getItem('lmstudio_url') ?? 'http://127.0.0.1:1234';
		// Strip any path after the port — only keep scheme + host + port
		try {
			const u = new URL(stored);
			stored = `${u.protocol}//${u.host}`;
			localStorage.setItem('lmstudio_url', stored);
		} catch {
			stored = 'http://127.0.0.1:1234';
			localStorage.setItem('lmstudio_url', stored);
		}
		return stored;
	}
	let lmstudioUrl = $state(getStoredLmstudioUrl());

	$effect(() => {
		if (typeof localStorage !== 'undefined') {
			// Always persist only the base URL (scheme + host + port), no path
			try {
				const u = new URL(lmstudioUrl);
				localStorage.setItem('lmstudio_url', `${u.protocol}//${u.host}`);
			} catch {
				localStorage.setItem('lmstudio_url', lmstudioUrl);
			}
		}
	});

	// ─── Init ─────────────────────────────────────────────────────────────────
	let initialized = $state(false);
	$effect(() => {
		if (!initialized) {
			selectedProvider = aiProviderService.settings.activeProvider ?? 'gemini';
			selectedModel =
				aiProviderService.settings.activeModel ??
				PROVIDER_CATALOGUE[selectedProvider].defaultModel;
			apiKeyInput = aiProviderService.settings.providerKeys[selectedProvider] ?? '';
			customModelInput = aiProviderService.settings.customModelName ?? '';
			initialized = true;
		}
	});

	// When selectedProvider changes, reset fields
	$effect(() => {
		apiKeyInput = aiProviderService.settings.providerKeys[selectedProvider] ?? '';
		selectedModel = PROVIDER_CATALOGUE[selectedProvider].defaultModel;
		testStatus = 'idle';
	});

	// Check local provider status on mount and when lmstudioUrl changes
	$effect(() => {
		// Re-check whenever lmstudioUrl changes
		const _url = lmstudioUrl;
		checkLocalProviders();
	});

	// ─── Local provider detection ─────────────────────────────────────────────
	async function checkLocalProviders() {
		// Check Ollama
		try {
			const res = await fetch('http://localhost:11434/api/tags', {
				signal: AbortSignal.timeout(2000)
			});
			if (res.ok) {
				const data = await res.json();
				ollamaModels = (data.models ?? []).map((m: { name: string }) => m.name);
				ollamaStatus = 'connected';
			} else {
				ollamaStatus = 'offline';
			}
		} catch {
			ollamaStatus = 'offline';
		}

		// Check LMStudio — use no-cors so the preflight is skipped.
		// With no-cors the response type is 'opaque' (status=0), but a non-throw means the server is up.
		try {
			const res = await fetch(`${lmstudioUrl}/api/v1/models`, {
				method: 'GET',
				mode: 'no-cors',
				signal: AbortSignal.timeout(3000)
			});
			// opaque response (mode=no-cors) has status 0 but doesn't throw — server is reachable
			lmstudioStatus = 'connected';
		} catch {
			lmstudioStatus = 'offline';
		}
	}

	// ─── Provider groups ──────────────────────────────────────────────────────
	const cloudProviders: { id: AIProvider; icon: string }[] = [
		{ id: 'gemini', icon: '🟦' },
		{ id: 'mistral', icon: '🟧' },
		{ id: 'grok', icon: '⬛' },
		{ id: 'deepseek', icon: '🟩' }
	];

	const localProviders: { id: AIProvider; icon: string }[] = [
		{ id: 'ollama', icon: '🦙' },
		{ id: 'lmstudio', icon: '🖥️' }
	];

	function localProviderStatus(id: AIProvider): 'connected' | 'offline' | 'checking' {
		if (id === 'ollama') return ollamaStatus;
		if (id === 'lmstudio') return lmstudioStatus;
		return 'checking';
	}

	function statusDotStyle(provider: AIProvider): string {
		let hasKey: boolean;
		if (isLocalProvider(provider)) {
			hasKey = localProviderStatus(provider) === 'connected';
		} else {
			hasKey = !!aiProviderService.settings.providerKeys[provider];
		}
		const testSt = aiProviderService.settings.providerTestStatus[provider];
		const color = computeStatusColor(hasKey, testSt);
		const colorMap: Record<string, string> = {
			grey: '#6b7280',
			yellow: '#f59e0b',
			green: '#10b981',
			red: '#ef4444'
		};
		return `background: ${colorMap[color]}`;
	}

	// ─── Derived ──────────────────────────────────────────────────────────────
	const isLocal = $derived(isLocalProvider(selectedProvider));
	const needsKey = $derived(requiresApiKey(selectedProvider));
	const modelOptions = $derived(getModelOptionsForProvider(selectedProvider));
	const isCustomModel = $derived(selectedModel === 'custom');

	// For Ollama: merge installed models with catalogue options
	const ollamaModelOptions = $derived.by(() => {
		if (selectedProvider !== 'ollama') return modelOptions;
		const installed = ollamaModels.map((m) => ({ id: m, name: `${m} (installed)` }));
		const catalogue = modelOptions.filter((o) => o.id !== 'custom');
		const custom = { id: 'custom', name: 'Custom (type model name)' };
		// Deduplicate
		const seen = new Set(installed.map((m) => m.id));
		const filtered = catalogue.filter((o) => !seen.has(o.id));
		return [...installed, ...filtered, custom];
	});

	const displayModelOptions = $derived(
		selectedProvider === 'ollama' ? ollamaModelOptions : modelOptions
	);

	// ─── Actions ──────────────────────────────────────────────────────────────
	async function handleSave() {
		isSaving = true;
		try {
			if (!isLocal) {
				await aiProviderService.saveApiKey(selectedProvider, apiKeyInput);
			}
			await aiProviderService.save({
				activeProvider: selectedProvider,
				activeModel: selectedModel,
				customModelName: customModelInput
			});
		} finally {
			isSaving = false;
		}
	}

	async function handleTestConnection() {
		testStatus = 'loading';
		try {
			const success = await aiProviderService.testConnection(
				selectedProvider,
				apiKeyInput,
				selectedModel
			);
			testStatus = success ? 'success' : 'error';
		} catch {
			testStatus = 'error';
		}
	}

	async function updateUseForCommitMessages(value: boolean) {
		await aiProviderService.save({ useForCommitMessages: value });
	}

	async function updateUseForAgentChat(value: boolean) {
		await aiProviderService.save({ useForAgentChat: value });
	}
</script>

<div class="ai-settings">

	<!-- ── Cloud Providers ─────────────────────────────────────────────────── -->
	<div class="section-label">Cloud Providers</div>
	<div class="provider-grid">
		{#each cloudProviders as { id, icon }}
			<button
				class="provider-card"
				class:selected={selectedProvider === id}
				onclick={() => (selectedProvider = id)}
				type="button"
			>
				<span class="provider-icon">{icon}</span>
				<span class="provider-name">{PROVIDER_CATALOGUE[id].name}</span>
				<span class="status-dot" style={statusDotStyle(id)}></span>
			</button>
		{/each}
	</div>

	<Spacer margin={10} dotted />

	<!-- ── Local Models ────────────────────────────────────────────────────── -->
	<div class="section-label">Local Models</div>
	<div class="local-banner">
		<span class="local-banner-icon">🔒</span>
		<span>No API Key Required — Runs 100% on your machine</span>
	</div>

	<div class="provider-grid">
		{#each localProviders as { id, icon }}
			{@const status = localProviderStatus(id)}
			<button
				class="provider-card"
				class:selected={selectedProvider === id}
				onclick={() => (selectedProvider = id)}
				type="button"
			>
				<span class="provider-icon">{icon}</span>
				<span class="provider-name">{PROVIDER_CATALOGUE[id].name}</span>
				{#if getProviderBadge(id)}
					<span
						class="provider-badge"
						class:badge-green={getProviderBadgeColor(id) === 'green'}
						class:badge-violet={getProviderBadgeColor(id) === 'violet'}
					>
						{getProviderBadge(id)}
					</span>
				{/if}
				<div class="local-status">
					{#if status === 'checking'}
						<span class="status-dot-sm" style="background:#6b7280"></span>
						<span class="status-text">Checking...</span>
					{:else if status === 'connected'}
						<span class="status-dot-sm" style="background:#10b981"></span>
						<span class="status-text connected">Connected</span>
					{:else}
						<span class="status-dot-sm" style="background:#ef4444"></span>
						<span class="status-text offline">Not running</span>
					{/if}
				</div>
			</button>
		{/each}
	</div>

	<!-- Local provider helper text -->
	{#if isLocal}
		{@const status = localProviderStatus(selectedProvider)}
		{#if selectedProvider === 'lmstudio'}
			<div class="field-row">
				<label class="field-label" for="lmstudio-url">LMStudio Server URL</label>
				<input
					id="lmstudio-url"
					class="field-input"
					type="text"
					bind:value={lmstudioUrl}
					placeholder="http://127.0.0.1:1234"
					autocomplete="off"
				/>
				<span class="field-hint-sm">Find this in LM Studio → Developer tab → "Reachable at:"</span>
			</div>
		{/if}
		{#if status === 'offline'}
			<div class="local-offline-banner">
				<span>⚠️ {PROVIDER_CATALOGUE[selectedProvider].name} is not running.</span>
				{#if getProviderSetupUrl(selectedProvider)}
					<a href={getProviderSetupUrl(selectedProvider)} target="_blank" rel="noopener noreferrer" class="setup-link">
						Download & Install →
					</a>
				{/if}
			</div>
		{/if}
		{#if getProviderHelperText(selectedProvider)}
			<div class="helper-text">{getProviderHelperText(selectedProvider)}</div>
		{/if}
	{/if}

	<Spacer margin={10} dotted />

	<!-- ── Model Selection ─────────────────────────────────────────────────── -->
	<div class="field-row">
		<label class="field-label" for="model-select">Model</label>
		<select id="model-select" class="field-select" bind:value={selectedModel}>
			{#each displayModelOptions as opt}
				<option value={opt.id}>{opt.name}</option>
			{/each}
		</select>
	</div>

	<!-- Custom model name input -->
	{#if isCustomModel}
		<div class="field-row">
			<label class="field-label" for="custom-model-input">Custom Model Name</label>
			<input
				id="custom-model-input"
				class="field-input"
				type="text"
				bind:value={customModelInput}
				placeholder={selectedProvider === 'ollama'
					? 'e.g. gemma4:e4b, llama3.2:latest'
					: 'e.g. google/gemma-4-e4b'}
				autocomplete="off"
			/>
		</div>
	{/if}

	<!-- ── API Key (cloud only) ─────────────────────────────────────────────── -->
	{#if needsKey}
		<div class="field-row">
			<label class="field-label" for="api-key-input">
				{PROVIDER_CATALOGUE[selectedProvider].name} API Key
			</label>
			<div class="api-key-row">
				<input
					id="api-key-input"
					class="field-input"
					type={showApiKey ? 'text' : 'password'}
					bind:value={apiKeyInput}
					placeholder="Enter API key..."
					autocomplete="off"
				/>
				<button
					class="show-hide-btn"
					type="button"
					onclick={() => (showApiKey = !showApiKey)}
					title={showApiKey ? 'Hide' : 'Show'}
				>
					{showApiKey ? '🙈' : '👁'}
				</button>
			</div>
		</div>
	{/if}

	<!-- ── Action Buttons ──────────────────────────────────────────────────── -->
	<div class="action-row">
		<button class="save-btn" type="button" disabled={isSaving} onclick={handleSave}>
			{isSaving ? 'Saving...' : 'Save'}
		</button>
		<button
			class="test-btn"
			type="button"
			disabled={testStatus === 'loading'}
			onclick={handleTestConnection}
		>
			{#if testStatus === 'loading'}
				...
			{:else if testStatus === 'success'}
				✅ Connected
			{:else if testStatus === 'error'}
				❌ Failed
			{:else}
				Test Connection
			{/if}
		</button>
		{#if isLocal}
			<button class="refresh-btn" type="button" onclick={checkLocalProviders} title="Refresh status">
				↻
			</button>
		{/if}
	</div>

	<Spacer margin={12} dotted />

	<!-- ── Use-for Toggles ─────────────────────────────────────────────────── -->
	<CardGroup.Item standalone labelFor="useForCommitMessages">
		{#snippet title()}
			Use for commit message generation
		{/snippet}
		{#snippet actions()}
			<Toggle
				id="useForCommitMessages"
				checked={aiProviderService.settings.useForCommitMessages}
				onchange={updateUseForCommitMessages}
			/>
		{/snippet}
	</CardGroup.Item>

	<CardGroup.Item standalone labelFor="useForAgentChat">
		{#snippet title()}
			Use for AI agent chat
		{/snippet}
		{#snippet actions()}
			<Toggle
				id="useForAgentChat"
				checked={aiProviderService.settings.useForAgentChat}
				onchange={updateUseForAgentChat}
			/>
		{/snippet}
	</CardGroup.Item>
</div>

<style>
	.ai-settings {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.section-label {
		font-size: 0.7rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: #6b7280;
		margin-bottom: 2px;
	}

	.provider-grid {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 8px;
	}

	.provider-card {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 4px;
		padding: 10px 6px;
		background: #1e1e2e;
		border: 1px solid #2e2e3e;
		border-radius: 8px;
		cursor: pointer;
		color: #cdd6f4;
		transition: border-color 0.15s, background 0.15s;
	}

	.provider-card:hover {
		background: #252535;
		border-color: #45475a;
	}

	.provider-card.selected {
		border-color: #06b6d4;
		background: #1a2535;
	}

	.provider-icon {
		font-size: 1.3rem;
		line-height: 1;
	}

	.provider-name {
		font-size: 0.65rem;
		text-align: center;
		color: #a6adc8;
		line-height: 1.2;
	}

	.status-dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		flex-shrink: 0;
	}

	.provider-badge {
		font-size: 0.55rem;
		font-weight: 700;
		padding: 1px 5px;
		border-radius: 4px;
		letter-spacing: 0.04em;
	}

	.badge-green {
		background: rgba(16, 185, 129, 0.15);
		color: #10b981;
		border: 1px solid rgba(16, 185, 129, 0.3);
	}

	.badge-violet {
		background: rgba(139, 92, 246, 0.15);
		color: #a78bfa;
		border: 1px solid rgba(139, 92, 246, 0.3);
	}

	.local-status {
		display: flex;
		align-items: center;
		gap: 3px;
	}

	.status-dot-sm {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		flex-shrink: 0;
	}

	.status-text {
		font-size: 0.6rem;
		color: #6b7280;
	}

	.status-text.connected {
		color: #10b981;
	}

	.status-text.offline {
		color: #ef4444;
	}

	.local-banner {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 8px 12px;
		background: rgba(16, 185, 129, 0.08);
		border: 1px solid rgba(16, 185, 129, 0.2);
		border-radius: 6px;
		font-size: 0.78rem;
		color: #10b981;
		font-weight: 500;
	}

	.local-banner-icon {
		font-size: 0.9rem;
	}

	.local-offline-banner {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
		padding: 8px 12px;
		background: rgba(239, 68, 68, 0.08);
		border: 1px solid rgba(239, 68, 68, 0.2);
		border-radius: 6px;
		font-size: 0.78rem;
		color: #f87171;
	}

	.setup-link {
		color: #06b6d4;
		text-decoration: none;
		font-weight: 600;
		white-space: nowrap;
	}

	.setup-link:hover {
		text-decoration: underline;
	}

	.helper-text {
		font-size: 0.72rem;
		color: #6b7280;
		line-height: 1.5;
		padding: 6px 10px;
		background: rgba(255, 255, 255, 0.03);
		border-radius: 6px;
		border: 1px solid #2e2e3e;
	}

	.field-hint-sm {
		font-size: 0.68rem;
		color: #6b7280;
		line-height: 1.4;
	}

	.field-row {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.field-label {
		font-size: 0.75rem;
		color: #a6adc8;
		font-weight: 500;
	}

	.field-select,
	.field-input {
		background: #1e1e2e;
		border: 1px solid #2e2e3e;
		border-radius: 6px;
		color: #cdd6f4;
		padding: 6px 10px;
		font-size: 0.85rem;
		width: 100%;
		outline: none;
	}

	.field-select:focus,
	.field-input:focus {
		border-color: #06b6d4;
	}

	.api-key-row {
		display: flex;
		gap: 6px;
		align-items: center;
	}

	.api-key-row .field-input {
		flex: 1;
	}

	.show-hide-btn {
		background: #1e1e2e;
		border: 1px solid #2e2e3e;
		border-radius: 6px;
		color: #cdd6f4;
		padding: 6px 10px;
		cursor: pointer;
		font-size: 1rem;
		flex-shrink: 0;
	}

	.show-hide-btn:hover {
		border-color: #45475a;
		background: #252535;
	}

	.action-row {
		display: flex;
		gap: 8px;
		align-items: center;
	}

	.save-btn {
		background: #06b6d4;
		box-shadow: 0 0 8px #06b6d4;
		border: none;
		border-radius: 6px;
		color: #fff;
		padding: 7px 18px;
		font-size: 0.85rem;
		font-weight: 600;
		cursor: pointer;
		transition: opacity 0.15s;
	}

	.save-btn:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.test-btn {
		background: #252535;
		border: 1px solid #2e2e3e;
		border-radius: 6px;
		color: #cdd6f4;
		padding: 7px 18px;
		font-size: 0.85rem;
		cursor: pointer;
		transition: border-color 0.15s, background 0.15s;
	}

	.test-btn:hover:not(:disabled) {
		border-color: #45475a;
		background: #2e2e3e;
	}

	.test-btn:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.refresh-btn {
		background: #1e1e2e;
		border: 1px solid #2e2e3e;
		border-radius: 6px;
		color: #a6adc8;
		padding: 7px 10px;
		font-size: 1rem;
		cursor: pointer;
		transition: border-color 0.15s;
	}

	.refresh-btn:hover {
		border-color: #45475a;
		color: #cdd6f4;
	}
</style>
