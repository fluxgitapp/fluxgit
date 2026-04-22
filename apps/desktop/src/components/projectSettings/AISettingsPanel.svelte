<script lang="ts">
	import { AI_PROVIDER_SERVICE } from '$lib/ai/aiProviderService.svelte';
	import { PROVIDER_CATALOGUE, getModelsForProvider } from '$lib/ai/providerCatalogue';
	import { computeStatusColor } from '$lib/ai/providerStatus';
	import { inject } from '@fluxgit/core/context';
	import { CardGroup, Spacer, Toggle } from '@fluxgit/ui';
	import type { AIProvider } from '$lib/ai/aiProviderClient';

	const { projectId }: { projectId: string } = $props();

	const aiProviderService = inject(AI_PROVIDER_SERVICE);

	// Local state
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
	let showApiKey: boolean = $state(false);
	let testStatus: 'idle' | 'loading' | 'success' | 'error' = $state('idle');
	let isSaving: boolean = $state(false);

	// Initialize from service settings — only once on mount
	let initialized = $state(false);
	$effect(() => {
		if (!initialized) {
			selectedProvider = aiProviderService.settings.activeProvider ?? 'gemini';
			selectedModel =
				aiProviderService.settings.activeModel ??
				PROVIDER_CATALOGUE[selectedProvider].defaultModel;
			apiKeyInput = aiProviderService.settings.providerKeys[selectedProvider] ?? '';
			initialized = true;
		}
	});

	// When selectedProvider changes, update apiKeyInput and selectedModel
	$effect(() => {
		apiKeyInput = aiProviderService.settings.providerKeys[selectedProvider] ?? '';
		selectedModel = PROVIDER_CATALOGUE[selectedProvider].defaultModel;
		testStatus = 'idle';
	});

	const providers: { id: AIProvider; icon: string }[] = [
		{ id: 'gemini', icon: '🟦' },
		{ id: 'mistral', icon: '🟧' },
		{ id: 'grok', icon: '⬛' },
		{ id: 'deepseek', icon: '🟩' }
	];

	function selectProvider(provider: AIProvider) {
		selectedProvider = provider;
	}

	function statusDotStyle(provider: AIProvider): string {
		const hasKey = !!aiProviderService.settings.providerKeys[provider];
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

	async function handleSave() {
		isSaving = true;
		try {
			await aiProviderService.saveApiKey(selectedProvider, apiKeyInput);
			await aiProviderService.save({
				activeProvider: selectedProvider,
				activeModel: selectedModel
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
	<!-- Provider Cards -->
	<div class="provider-grid">
		{#each providers as { id, icon }}
			<button
				class="provider-card"
				class:selected={selectedProvider === id}
				onclick={() => selectProvider(id)}
				type="button"
			>
				<span class="provider-icon">{icon}</span>
				<span class="provider-name">{PROVIDER_CATALOGUE[id].name}</span>
				<span class="status-dot" style={statusDotStyle(id)}></span>
			</button>
		{/each}
	</div>

	<Spacer margin={12} dotted />

	<!-- Model Dropdown -->
	<div class="field-row">
		<label class="field-label" for="model-select">Model</label>
		<select id="model-select" class="field-select" bind:value={selectedModel}>
			{#each getModelsForProvider(selectedProvider) as model}
				<option value={model}>{model}</option>
			{/each}
		</select>
	</div>

	<!-- API Key Input -->
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

	<!-- Action Buttons -->
	<div class="action-row">
		<button
			class="save-btn"
			type="button"
			disabled={isSaving}
			onclick={handleSave}
		>
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
	</div>

	<Spacer margin={12} dotted />

	<!-- Use-for Toggles -->
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

	.provider-grid {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 8px;
	}

	.provider-card {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 6px;
		padding: 12px 8px;
		background: #1e1e2e;
		border: 1px solid #2e2e3e;
		border-radius: 8px;
		cursor: pointer;
		color: #cdd6f4;
		transition:
			border-color 0.15s,
			background 0.15s;
		position: relative;
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
		font-size: 1.4rem;
		line-height: 1;
	}

	.provider-name {
		font-size: 0.7rem;
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
		transition:
			border-color 0.15s,
			background 0.15s;
	}

	.test-btn:hover:not(:disabled) {
		border-color: #45475a;
		background: #2e2e3e;
	}

	.test-btn:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}
</style>
