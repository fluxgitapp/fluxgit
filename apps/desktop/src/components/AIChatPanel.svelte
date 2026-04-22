<script lang="ts">
	import PreviewHeader from '$components/PreviewHeader.svelte';
	import { AI_PROVIDER_SERVICE } from '$lib/ai/aiProviderService.svelte';
	import { PROVIDER_CATALOGUE } from '$lib/ai/providerCatalogue';
	import type { ChatMessage, RepoContext } from '$lib/ai/aiProviderClient';
	import { inject } from '@fluxgit/core/context';
	import { Button } from '@fluxgit/ui';
	import { focusable } from '@fluxgit/ui/focus/focusable';
	import { tick } from 'svelte';

	type Props = {
		projectId: string;
		branchName: string;
		onclose?: () => void;
	};

	const { projectId, branchName, onclose }: Props = $props();

	const aiProviderService = inject(AI_PROVIDER_SERVICE);

	// Chat state
	let messages = $state<ChatMessage[]>([]);
	let inputText = $state('');
	let isLoading = $state(false);
	let errorMessage = $state<string | null>(null);
	let messagesEl = $state<HTMLDivElement>();
	let inputEl = $state<HTMLTextAreaElement>();

	const activeClient = $derived(aiProviderService.getActiveClient());
	const settings = $derived(aiProviderService.settings);

	const providerLabel = $derived.by(() => {
		const { activeProvider, activeModel } = settings;
		if (!activeProvider) return 'No AI provider configured';
		const providerName = PROVIDER_CATALOGUE[activeProvider].name;
		const modelName = activeModel ?? PROVIDER_CATALOGUE[activeProvider].defaultModel;
		return `FluxGit AI — ${providerName} ${modelName}`;
	});

	const repoContext = $derived<RepoContext>({
		repoPath: projectId,
		currentBranch: branchName
	});

	async function sendMessage() {
		const text = inputText.trim();
		if (!text || isLoading) return;

		if (!activeClient) {
			errorMessage = 'Configure AI in Settings → AI options';
			return;
		}

		errorMessage = null;
		const userMsg: ChatMessage = { role: 'user', content: text };
		messages = [...messages, userMsg];
		inputText = '';
		isLoading = true;

		await tick();
		scrollToBottom();

		try {
			const response = await activeClient.generateAgentResponse(messages, repoContext);
			const assistantMsg: ChatMessage = { role: 'assistant', content: response };
			messages = [...messages, assistantMsg];
		} catch (err) {
			errorMessage = err instanceof Error ? err.message : 'An error occurred';
		} finally {
			isLoading = false;
			await tick();
			scrollToBottom();
			inputEl?.focus();
		}
	}

	function scrollToBottom() {
		if (messagesEl) {
			messagesEl.scrollTop = messagesEl.scrollHeight;
		}
	}

	function handleKeyDown(e: KeyboardEvent) {
		if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
			e.preventDefault();
			sendMessage();
		}
	}

	function clearChat() {
		messages = [];
		errorMessage = null;
	}
</script>

<div class="ai-chat" use:focusable={{ vertical: true }}>
	<PreviewHeader {onclose}>
		{#snippet content()}
			<div class="chat-header-title">
				<h3 class="text-14 text-semibold truncate">Chat for {branchName}</h3>
				<span class="text-11 clr-text-2 truncate">{providerLabel}</span>
			</div>
		{/snippet}
		{#snippet actions()}
			{#if messages.length > 0}
				<Button kind="ghost" icon="eraser" tooltip="Clear chat" onclick={clearChat} />
			{/if}
		{/snippet}
	</PreviewHeader>

	<div class="chat-messages" bind:this={messagesEl}>
		{#if !activeClient}
			<div class="chat-empty">
				<p class="text-13 clr-text-2">
					No AI provider configured.<br />
					Go to <strong>Settings → AI options</strong> to set up a provider.
				</p>
			</div>
		{:else if messages.length === 0}
			<div class="chat-empty">
				<p class="text-13 clr-text-2">
					Ask anything about your code, branch, or changes.<br />
					<span class="text-11">Press ⌘↵ to send</span>
				</p>
			</div>
		{:else}
			{#each messages as message}
				{#if message.role === 'user'}
					<div class="message message-user">
						<div class="message-bubble message-bubble--user text-13 text-body">
							{message.content}
						</div>
					</div>
				{:else}
					<div class="message message-assistant">
						<div class="message-bubble message-bubble--assistant text-13 text-body">
							{message.content}
						</div>
					</div>
				{/if}
			{/each}
			{#if isLoading}
				<div class="message message-assistant">
					<div class="message-bubble message-bubble--assistant message-bubble--loading text-13">
						<span class="loading-dot"></span>
						<span class="loading-dot"></span>
						<span class="loading-dot"></span>
					</div>
				</div>
			{/if}
		{/if}
	</div>

	{#if errorMessage}
		<div class="chat-error text-12">
			{errorMessage}
		</div>
	{/if}

	<div class="chat-input-wrapper">
		<textarea
			bind:this={inputEl}
			bind:value={inputText}
			class="chat-input text-13"
			placeholder="Ask anything… (⌘↵ to send)"
			rows="3"
			disabled={isLoading || !activeClient}
			onkeydown={handleKeyDown}
		></textarea>
		<div class="chat-input-actions">
			<Button
				kind="solid"
				style="pop"
				disabled={!inputText.trim() || isLoading || !activeClient}
				onclick={sendMessage}
				loading={isLoading}
			>
				Send
			</Button>
		</div>
	</div>
</div>

<style lang="postcss">
	.ai-chat {
		display: flex;
		flex-direction: column;
		width: 100%;
		height: 100%;
		overflow: hidden;
	}

	.chat-header-title {
		display: flex;
		flex-direction: column;
		gap: 1px;
		min-width: 0;
	}

	.chat-messages {
		display: flex;
		flex: 1;
		flex-direction: column;
		overflow-y: auto;
		padding: 16px 20px;
		gap: 12px;
		min-height: 0;
	}

	.chat-empty {
		display: flex;
		flex: 1;
		align-items: center;
		justify-content: center;
		text-align: center;
		padding: 32px;
	}

	.message {
		display: flex;
		width: 100%;
	}

	.message-user {
		justify-content: flex-end;
	}

	.message-assistant {
		justify-content: flex-start;
	}

	.message-bubble {
		max-width: 85%;
		padding: 10px 14px;
		border-radius: var(--radius-ml);
		white-space: pre-wrap;
		word-break: break-word;
		line-height: 1.5;
	}

	.message-bubble--user {
		background-color: var(--clr-bg-2);
		border-bottom-right-radius: 0;
	}

	.message-bubble--assistant {
		background-color: var(--clr-theme-pop-soft, #1a2535);
		color: var(--clr-text-1);
		border-bottom-left-radius: 0;
	}

	.message-bubble--loading {
		display: flex;
		align-items: center;
		gap: 4px;
		padding: 12px 16px;
	}

	.loading-dot {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background-color: var(--clr-text-2);
		animation: bounce 1.2s ease-in-out infinite;

		&:nth-child(2) {
			animation-delay: 0.2s;
		}

		&:nth-child(3) {
			animation-delay: 0.4s;
		}
	}

	@keyframes bounce {
		0%, 80%, 100% { transform: translateY(0); opacity: 0.4; }
		40% { transform: translateY(-6px); opacity: 1; }
	}

	.chat-error {
		margin: 0 16px 8px;
		padding: 8px 12px;
		border-radius: var(--radius-m);
		background-color: var(--clr-theme-danger-soft);
		color: var(--clr-theme-danger-on-soft);
	}

	.chat-input-wrapper {
		display: flex;
		flex-direction: column;
		flex-shrink: 0;
		gap: 8px;
		padding: 12px 16px 16px;
		border-top: 1px solid var(--clr-border-2);
	}

	.chat-input {
		width: 100%;
		padding: 8px 12px;
		border: 1px solid var(--clr-border-2);
		border-radius: var(--radius-m);
		background-color: var(--clr-bg-1);
		color: var(--clr-text-1);
		font-size: 0.8125rem;
		line-height: 1.5;
		resize: none;
		outline: none;
		font-family: inherit;
		transition: border-color var(--transition-fast);

		&:focus {
			border-color: var(--clr-theme-pop-element);
		}

		&:disabled {
			opacity: 0.5;
			cursor: not-allowed;
		}
	}

	.chat-input-actions {
		display: flex;
		justify-content: flex-end;
	}
</style>
