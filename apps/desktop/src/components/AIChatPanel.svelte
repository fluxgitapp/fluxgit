<script lang="ts">
	import PreviewHeader from '$components/PreviewHeader.svelte';
	import { AI_PROVIDER_SERVICE } from '$lib/ai/aiProviderService.svelte';
	import { PROVIDER_CATALOGUE } from '$lib/ai/providerCatalogue';
	import type { ChatMessage, RepoContext } from '$lib/ai/aiProviderClient';
	import { DEFAULT_FORGE_FACTORY } from '$lib/forge/forgeFactory.svelte';
	import { inject } from '@fluxgit/core/context';
	import { Button } from '@fluxgit/ui';
	import { focusable } from '@fluxgit/ui/focus/focusable';
	import { invoke } from '@tauri-apps/api/core';
	import { tick } from 'svelte';
	import type { TreeChanges } from '$lib/hunks/change';
	import { showError, showToast } from '$lib/notifications/toasts';

	type Props = {
		projectId: string;
		branchName: string;
		onclose?: () => void;
	};

	const { projectId, branchName, onclose }: Props = $props();

	const aiProviderService = inject(AI_PROVIDER_SERVICE);
	const forge = inject(DEFAULT_FORGE_FACTORY);

	// Chat state
	let messages = $state<ChatMessage[]>([]);
	let inputText = $state('');
	let isLoading = $state(false);
	let errorMessage = $state<string | null>(null);
	let messagesEl = $state<HTMLDivElement>();
	let inputEl = $state<HTMLTextAreaElement>();

	// Branch context — fetched once on mount
	let branchDiffSummary = $state<string | null>(null);
	let diffStats = $state<{ files: number; added: number; removed: number } | null>(null);
	let contextLoading = $state(true);

	// PR creation state — extracted from last AI response
	let pendingPr = $state<{ title: string; body: string } | null>(null);
	let prCreating = $state(false);
	let prCreated = $state<{ number: number; url: string } | null>(null);

	const activeClient = $derived(aiProviderService.getActiveClient());
	const settings = $derived(aiProviderService.settings);
	const prService = $derived(forge.current.prService);

	const providerLabel = $derived.by(() => {
		const { activeProvider, activeModel } = settings;
		if (!activeProvider) return 'No AI provider configured';
		const providerName = PROVIDER_CATALOGUE[activeProvider].name;
		const modelName = activeModel ?? PROVIDER_CATALOGUE[activeProvider].defaultModel;
		return `FluxGit AI — ${providerName} ${modelName}`;
	});

	// Fetch branch diff on mount
	$effect(() => {
		loadBranchContext();
	});

	async function loadBranchContext() {
		contextLoading = true;
		try {
			const result = await invoke<TreeChanges>('branch_diff', {
				projectId,
				branch: `refs/heads/${branchName}`
			});
			diffStats = {
				files: result.stats?.filesChanged ?? result.changes.length,
				added: result.stats?.linesAdded ?? 0,
				removed: result.stats?.linesRemoved ?? 0
			};
			const fileList = result.changes
				.slice(0, 50)
				.map((c) => `  ${c.status?.type ?? 'modified'}: ${c.path}`)
				.join('\n');
			branchDiffSummary = fileList || '(no changes on this branch)';
		} catch {
			branchDiffSummary = null;
		} finally {
			contextLoading = false;
		}
	}

	function buildSystemPrompt(): string {
		const base = `You are a helpful git assistant embedded in FluxGit, a desktop Git application.

IMPORTANT:
- You CAN see the changed files on this branch (listed below)
- You CAN generate commit messages, PR descriptions, code explanations, and code reviews
- You CANNOT directly create PRs or push code — FluxGit will handle that with a button
- When asked to create a PR, respond with EXACTLY this format so FluxGit can parse it:

PR_TITLE: <one line title here>
PR_BODY:
<full PR description here, can be multiple lines>

Branch: ${branchName}`;

		if (branchDiffSummary) {
			return `${base}

Changed files (${diffStats?.files ?? 0} files, +${diffStats?.added ?? 0} -${diffStats?.removed ?? 0}):
${branchDiffSummary}

Be concise and specific. Use the actual file names in your answers.`;
		}
		return `${base}\n\nNo file changes detected yet.`;
	}

	// Parse PR title + body from AI response if it used the structured format
	function parsePrFromResponse(text: string): { title: string; body: string } | null {
		const titleMatch = text.match(/PR_TITLE:\s*(.+)/);
		const bodyMatch = text.match(/PR_BODY:\s*([\s\S]+)/);
		if (titleMatch?.[1] && bodyMatch?.[1]) {
			return {
				title: titleMatch[1].trim(),
				body: bodyMatch[1].trim()
			};
		}
		return null;
	}

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
		pendingPr = null;
		prCreated = null;
		const userMsg: ChatMessage = { role: 'user', content: text };
		messages = [...messages, userMsg];
		inputText = '';
		isLoading = true;

		await tick();
		scrollToBottom();

		try {
			const systemMsg: ChatMessage = { role: 'system', content: buildSystemPrompt() };
			const allMessages = [systemMsg, ...messages];
			const response = await activeClient.generateAgentResponse(allMessages, repoContext);
			const assistantMsg: ChatMessage = { role: 'assistant', content: response };
			messages = [...messages, assistantMsg];

			// Check if the AI returned a structured PR format
			const parsed = parsePrFromResponse(response);
			if (parsed) {
				pendingPr = parsed;
			}
		} catch (err) {
			errorMessage = err instanceof Error ? err.message : 'An error occurred';
		} finally {
			isLoading = false;
			await tick();
			scrollToBottom();
			inputEl?.focus();
		}
	}

	// Actually create the PR via the forge service
	async function createPr() {
		if (!pendingPr || !prService) return;
		prCreating = true;
		try {
			const pr = await prService.createPr({
				title: pendingPr.title,
				body: pendingPr.body,
				draft: false,
				baseBranchName: 'main',
				upstreamName: branchName
			});
			prCreated = { number: pr.number, url: pr.htmlUrl };
			pendingPr = null;
			showToast({ message: `PR #${pr.number} created successfully`, style: 'success' });
		} catch (err) {
			showError('Failed to create PR', err);
		} finally {
			prCreating = false;
		}
	}

	function scrollToBottom() {
		if (messagesEl) messagesEl.scrollTop = messagesEl.scrollHeight;
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
		pendingPr = null;
		prCreated = null;
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
			{#if diffStats}
				<span class="diff-stats text-11">
					<span class="stat-files">{diffStats.files}f</span>
					<span class="stat-added">+{diffStats.added}</span>
					<span class="stat-removed">-{diffStats.removed}</span>
				</span>
			{/if}
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
				{#if contextLoading}
					<p class="text-13 clr-text-2">Loading branch context…</p>
				{:else}
					<p class="text-13 clr-text-2">
						{#if branchDiffSummary}
							Ask anything about <strong>{branchName}</strong> — I can see the {diffStats?.files ?? 0} changed files.<br />
						{:else}
							Ask anything about your code, branch, or changes.<br />
						{/if}
						<span class="text-11">Press ⌘↵ to send</span>
					</p>
				{/if}
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

	<!-- PR action bar — shown when AI generated a structured PR -->
	{#if pendingPr && prService}
		<div class="pr-action-bar">
			<div class="pr-action-info">
				<span class="text-12 text-semibold">Ready to create PR:</span>
				<span class="text-12 clr-text-2 truncate">{pendingPr.title}</span>
			</div>
			<Button
				kind="solid"
				style="pop"
				loading={prCreating}
				onclick={createPr}
			>
				Create Pull Request
			</Button>
		</div>
	{/if}

	{#if prCreated}
		<div class="pr-created-bar">
			<span class="text-12">✅ PR #{prCreated.number} created</span>
			<a href={prCreated.url} target="_blank" rel="noopener noreferrer" class="pr-link text-12">
				View on GitHub →
			</a>
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

	.diff-stats {
		display: flex;
		align-items: center;
		gap: 6px;
		font-family: var(--font-mono);
		flex-shrink: 0;
	}

	.stat-files { color: var(--clr-text-3); }
	.stat-added { color: #10b981; }
	.stat-removed { color: #ef4444; }

	.pr-action-bar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
		margin: 0 16px 8px;
		padding: 10px 14px;
		background: rgba(6, 182, 212, 0.08);
		border: 1px solid rgba(6, 182, 212, 0.25);
		border-radius: var(--radius-m);
		flex-shrink: 0;
	}

	.pr-action-info {
		display: flex;
		flex-direction: column;
		gap: 2px;
		min-width: 0;
		flex: 1;
	}

	.pr-created-bar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
		margin: 0 16px 8px;
		padding: 8px 14px;
		background: rgba(16, 185, 129, 0.08);
		border: 1px solid rgba(16, 185, 129, 0.25);
		border-radius: var(--radius-m);
		flex-shrink: 0;
	}

	.pr-link {
		color: #06b6d4;
		text-decoration: none;
		font-weight: 600;
		white-space: nowrap;
	}

	.pr-link:hover {
		text-decoration: underline;
	}
</style>
