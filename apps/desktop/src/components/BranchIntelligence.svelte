<script lang="ts">
	import { AI_PROVIDER_SERVICE } from '$lib/ai/aiProviderService.svelte';
	import { PROVIDER_CATALOGUE } from '$lib/ai/providerCatalogue';
	import { inject } from '@fluxgit/core/context';
	import { invoke } from '@tauri-apps/api/core';
	import type { TreeChanges } from '$lib/hunks/change';

	type Props = {
		projectId: string;
		stackId: string;
		branchName: string;
		onclose: () => void;
	};

	const { projectId, stackId, branchName, onclose }: Props = $props();

	const aiProviderService = inject(AI_PROVIDER_SERVICE);

	// ─── State ────────────────────────────────────────────────────────────────
	type ActionId = 'explain' | 'pr' | 'issues' | 'commit';

	interface ActionResult {
		id: ActionId;
		content: string;
		cachedDiff: string;
	}

	let loading = $state<ActionId | null>(null);
	let results = $state<Map<ActionId, ActionResult>>(new Map());
	let diffCache = $state<string | null>(null);
	let stats = $state<{ files: number; added: number; removed: number } | null>(null);
	let error = $state<string | null>(null);
	let copiedId = $state<ActionId | null>(null);

	// ─── Provider label ───────────────────────────────────────────────────────
	const providerLabel = $derived.by(() => {
		const { activeProvider, activeModel } = aiProviderService.settings;
		if (!activeProvider) return 'No AI configured';
		const name = PROVIDER_CATALOGUE[activeProvider].name;
		const model = activeModel ?? PROVIDER_CATALOGUE[activeProvider].defaultModel;
		return `${name} — ${model}`;
	});

	// ─── Prompts ──────────────────────────────────────────────────────────────
	const PROMPTS: Record<ActionId, (diff: string) => string> = {
		explain: (diff) =>
			`You are a senior developer. Explain what these git changes do in plain English for a code review. Be concise and clear.\n\nChanges:\n${diff}`,
		pr: (diff) =>
			`Write a professional GitHub Pull Request description for these changes. Include: title, summary, changes made, testing notes. Use markdown formatting.\n\nChanges:\n${diff}`,
		issues: (diff) =>
			`Review these git changes as a senior engineer. List any bugs, security issues, performance problems, or code quality concerns. Be specific with line references where possible.\n\nChanges:\n${diff}`,
		commit: (diff) =>
			`Generate a conventional commit message (type(scope): description) for these changes. Examples: feat(auth): add login validation\nfix(ui): resolve navbar overflow on mobile\n\nChanges:\n${diff}`
	};

	const ACTIONS: { id: ActionId; label: string; icon: string }[] = [
		{ id: 'explain', label: 'Explain Changes', icon: '💡' },
		{ id: 'pr', label: 'Generate PR Description', icon: '📝' },
		{ id: 'issues', label: 'Find Issues', icon: '🔍' },
		{ id: 'commit', label: 'Suggest Commit Message', icon: '✍️' }
	];

	// ─── Fetch diff ───────────────────────────────────────────────────────────
	async function getDiff(): Promise<string> {
		if (diffCache !== null) return diffCache;

		try {
			const result = await invoke<TreeChanges>('branch_diff', {
				projectId,
				branch: `refs/heads/${branchName}`
			});

			stats = {
				files: result.stats.filesChanged,
				added: result.stats.linesAdded,
				removed: result.stats.linesRemoved
			};

			// Build a readable diff summary from the changes list
			const diffText = result.changes
				.map((c) => `${c.status.type}: ${c.path}`)
				.join('\n');

			diffCache = diffText || '(no changes)';
			return diffCache;
		} catch (e) {
			const msg = e instanceof Error ? e.message : String(e);
			throw new Error(`Failed to get branch diff: ${msg}`);
		}
	}

	// ─── Run action ───────────────────────────────────────────────────────────
	async function runAction(id: ActionId) {
		const client = aiProviderService.getActiveClient();
		if (!client) {
			error = 'No AI provider configured. Go to Project Settings → AI Options.';
			return;
		}

		error = null;
		loading = id;

		try {
			const diff = await getDiff();

			// Check cache — don't regenerate if diff unchanged
			const cached = results.get(id);
			if (cached && cached.cachedDiff === diff) {
				loading = null;
				return;
			}

			const prompt = PROMPTS[id](diff);
			const response = await client.generateAgentResponse(
				[{ role: 'user', content: prompt }],
				{ repoPath: projectId, currentBranch: branchName }
			);

			results = new Map(results).set(id, { id, content: response, cachedDiff: diff });
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
		} finally {
			loading = null;
		}
	}

	// ─── Copy ─────────────────────────────────────────────────────────────────
	async function copyResult(id: ActionId) {
		const result = results.get(id);
		if (!result) return;
		await navigator.clipboard.writeText(result.content);
		copiedId = id;
		setTimeout(() => { copiedId = null; }, 2000);
	}
</script>

<!-- Slide-in panel -->
<div class="bi-panel">
	<!-- Header -->
	<div class="bi-header">
		<div class="bi-header-left">
			<span class="bi-title">Branch Intelligence</span>
			<span class="bi-provider-badge">{providerLabel}</span>
		</div>
		<button class="bi-close" type="button" onclick={onclose} title="Close">✕</button>
	</div>

	<!-- Branch stats -->
	<div class="bi-branch-info">
		<span class="bi-branch-name">{branchName}</span>
		{#if stats}
			<div class="bi-stats">
				<span class="stat-files">{stats.files} files</span>
				<span class="stat-added">+{stats.added}</span>
				<span class="stat-removed">-{stats.removed}</span>
			</div>
		{/if}
	</div>

	{#if error}
		<div class="bi-error">{error}</div>
	{/if}

	<!-- Action buttons -->
	<div class="bi-actions">
		{#each ACTIONS as action (action.id)}
			<button
				class="bi-action-btn"
				class:active={results.has(action.id)}
				type="button"
				disabled={loading !== null}
				onclick={() => runAction(action.id)}
			>
				{#if loading === action.id}
					<span class="bi-loading">
						<span class="dot"></span>
						<span class="dot"></span>
						<span class="dot"></span>
					</span>
				{:else}
					<span class="bi-action-icon">{action.icon}</span>
				{/if}
				<span class="bi-action-label">{action.label}</span>
			</button>
		{/each}
	</div>

	<!-- Results -->
	<div class="bi-results">
		{#each ACTIONS as action (action.id)}
			{@const result = results.get(action.id)}
			{#if result}
				<div class="bi-result-card">
					<div class="bi-result-header">
						<span class="bi-result-title">{action.icon} {action.label}</span>
						<div class="bi-result-actions">
							<button
								class="bi-copy-btn"
								type="button"
								onclick={() => copyResult(action.id)}
								title="Copy"
							>
								{copiedId === action.id ? '✅ Copied' : '📋 Copy'}
							</button>
						</div>
					</div>
					<div class="bi-result-content">
						{result.content}
					</div>
				</div>
			{/if}
		{/each}
	</div>
</div>

<style>
	.bi-panel {
		display: flex;
		flex-direction: column;
		width: 100%;
		height: 100%;
		background: var(--clr-bg-1);
		border-left: 1px solid var(--clr-border-2);
		overflow: hidden;
	}

	/* ── Header ── */
	.bi-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 12px 16px;
		border-bottom: 1px solid var(--clr-border-2);
		background: var(--clr-bg-2);
		flex-shrink: 0;
	}

	.bi-header-left {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.bi-title {
		font-size: 0.85rem;
		font-weight: 700;
		color: var(--clr-text-1);
	}

	.bi-provider-badge {
		font-size: 0.65rem;
		color: #06b6d4;
		font-weight: 500;
	}

	.bi-close {
		background: transparent;
		border: none;
		color: var(--clr-text-3);
		cursor: pointer;
		font-size: 0.85rem;
		padding: 4px 6px;
		border-radius: 4px;
		transition: color 0.12s, background 0.12s;
	}

	.bi-close:hover {
		color: var(--clr-text-1);
		background: var(--clr-bg-3);
	}

	/* ── Branch info ── */
	.bi-branch-info {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 8px 16px;
		border-bottom: 1px solid var(--clr-border-3);
		flex-shrink: 0;
	}

	.bi-branch-name {
		font-size: 0.78rem;
		font-family: var(--font-mono);
		color: var(--clr-text-2);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		max-width: 60%;
	}

	.bi-stats {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 0.72rem;
		font-family: var(--font-mono);
	}

	.stat-files { color: var(--clr-text-3); }
	.stat-added { color: #10b981; }
	.stat-removed { color: #ef4444; }

	/* ── Error ── */
	.bi-error {
		margin: 8px 16px;
		padding: 8px 12px;
		background: rgba(239, 68, 68, 0.08);
		border: 1px solid rgba(239, 68, 68, 0.2);
		border-radius: 6px;
		font-size: 0.75rem;
		color: #f87171;
		flex-shrink: 0;
	}

	/* ── Action buttons ── */
	.bi-actions {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 6px;
		padding: 12px 16px;
		border-bottom: 1px solid var(--clr-border-3);
		flex-shrink: 0;
	}

	.bi-action-btn {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 8px 10px;
		background: var(--clr-bg-2);
		border: 1px solid var(--clr-border-2);
		border-radius: 7px;
		cursor: pointer;
		transition: background 0.12s, border-color 0.12s;
		text-align: left;
	}

	.bi-action-btn:hover:not(:disabled) {
		background: var(--clr-bg-3);
		border-color: #06b6d4;
	}

	.bi-action-btn.active {
		border-color: rgba(6, 182, 212, 0.3);
		background: rgba(6, 182, 212, 0.05);
	}

	.bi-action-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.bi-action-icon {
		font-size: 0.9rem;
		flex-shrink: 0;
	}

	.bi-action-label {
		font-size: 0.72rem;
		font-weight: 600;
		color: var(--clr-text-2);
		line-height: 1.2;
	}

	/* ── Loading dots ── */
	.bi-loading {
		display: flex;
		align-items: center;
		gap: 3px;
		flex-shrink: 0;
	}

	.dot {
		width: 5px;
		height: 5px;
		border-radius: 50%;
		background: #06b6d4;
		animation: bounce 1.2s ease-in-out infinite;
	}

	.dot:nth-child(2) { animation-delay: 0.2s; }
	.dot:nth-child(3) { animation-delay: 0.4s; }

	@keyframes bounce {
		0%, 80%, 100% { transform: translateY(0); opacity: 0.4; }
		40% { transform: translateY(-4px); opacity: 1; }
	}

	/* ── Results ── */
	.bi-results {
		flex: 1;
		overflow-y: auto;
		padding: 12px 16px;
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.bi-result-card {
		background: var(--clr-bg-2);
		border: 1px solid var(--clr-border-2);
		border-radius: 8px;
		overflow: hidden;
	}

	.bi-result-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 8px 12px;
		background: var(--clr-bg-3);
		border-bottom: 1px solid var(--clr-border-3);
	}

	.bi-result-title {
		font-size: 0.75rem;
		font-weight: 700;
		color: var(--clr-text-2);
	}

	.bi-result-actions {
		display: flex;
		gap: 6px;
	}

	.bi-copy-btn {
		font-size: 0.68rem;
		padding: 3px 8px;
		background: transparent;
		border: 1px solid var(--clr-border-2);
		border-radius: 4px;
		color: var(--clr-text-3);
		cursor: pointer;
		transition: color 0.12s, border-color 0.12s;
	}

	.bi-copy-btn:hover {
		color: var(--clr-text-1);
		border-color: #06b6d4;
	}

	.bi-result-content {
		padding: 10px 12px;
		font-size: 0.78rem;
		color: var(--clr-text-2);
		line-height: 1.6;
		white-space: pre-wrap;
		word-break: break-word;
	}
</style>
