<script lang="ts">
	import { QUICK_WORKFLOW_SERVICE } from '$lib/automation/quickWorkflow.svelte';
	import type { WorkflowType } from '$lib/automation/quickWorkflow.svelte';
	import { UNCOMMITTED_SERVICE } from '$lib/selection/uncommittedService.svelte';
	import { inject } from '@fluxgit/core/context';
	import { Icon } from '@fluxgit/ui';

	type Props = {
		projectId: string;
		stackId: string;
		branchName: string;
	};

	const { projectId, stackId, branchName }: Props = $props();

	const quickWorkflow = inject(QUICK_WORKFLOW_SERVICE);
	const uncommittedService = inject(UNCOMMITTED_SERVICE);

	let menuOpen = $state(false);
	let running = $state(false);

	const lastActivity = $derived(quickWorkflow.getLastActivity(stackId));

	const lastActivityText = $derived.by(() => {
		if (!lastActivity) return null;
		const diff = Date.now() - lastActivity.timestamp.getTime();
		const mins = Math.floor(diff / 60000);
		const timeStr = mins < 1 ? 'just now' : `${mins} min ago`;
		return `Last action: ${lastActivity.action} · ${timeStr}`;
	});

	const changedFileCount = $derived(
		uncommittedService.getChangesByStackId(stackId).length
	);

	const workflows: { id: WorkflowType; label: string; icon: string }[] = [
		{ id: 'snapshot', label: 'Snapshot', icon: '📸' },
		{ id: 'commit', label: 'Commit All', icon: '✅' },
		{ id: 'commit-push', label: 'Commit + Push', icon: '🚀' },
		{ id: 'full-flow', label: 'Full Flow', icon: '⚡' }
	];

	async function run(workflowType: WorkflowType) {
		menuOpen = false;
		running = true;
		try {
			await quickWorkflow.runWorkflow(projectId, stackId, branchName, workflowType, changedFileCount);
		} finally {
			running = false;
		}
	}

	function handleClickOutside(e: MouseEvent) {
		const target = e.target as HTMLElement;
		if (!target.closest('.qw-wrapper')) {
			menuOpen = false;
		}
	}
</script>

<svelte:window onclick={handleClickOutside} />

<div class="qw-wrapper">
	<button
		class="qw-btn"
		class:running
		type="button"
		title="Quick Workflow"
		onclick={(e) => { e.stopPropagation(); menuOpen = !menuOpen; }}
		disabled={running}
	>
		{#if running}
			<Icon name="spinner" />
		{:else}
			⚡
		{/if}
	</button>

	{#if menuOpen}
		<div class="qw-menu">
			{#each workflows as wf (wf.id)}
				<button
					class="qw-item"
					type="button"
					onclick={() => run(wf.id)}
				>
					<span class="qw-icon">{wf.icon}</span>
					<span class="qw-label">{wf.label}</span>
				</button>
			{/each}
		</div>
	{/if}

	{#if lastActivityText}
		<span class="qw-activity">{lastActivityText}</span>
	{/if}
</div>

<style>
	.qw-wrapper {
		position: relative;
		display: flex;
		align-items: center;
		gap: 6px;
	}

	.qw-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 26px;
		height: 26px;
		background: rgba(255, 255, 255, 0.04);
		border: 1px solid #2e2e3e;
		border-radius: 6px;
		cursor: pointer;
		font-size: 0.85rem;
		color: #a6adc8;
		transition: background 0.12s, border-color 0.12s;
		flex-shrink: 0;
	}

	.qw-btn:hover:not(:disabled) {
		background: rgba(6, 182, 212, 0.1);
		border-color: rgba(6, 182, 212, 0.3);
		color: #06b6d4;
	}

	.qw-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.qw-btn.running {
		border-color: rgba(6, 182, 212, 0.4);
		color: #06b6d4;
	}

	.qw-menu {
		position: absolute;
		top: calc(100% + 4px);
		left: 0;
		z-index: 100;
		background: #1e1e2e;
		border: 1px solid #2e2e3e;
		border-radius: 8px;
		padding: 4px;
		min-width: 160px;
		box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
	}

	.qw-item {
		display: flex;
		align-items: center;
		gap: 8px;
		width: 100%;
		padding: 7px 10px;
		background: transparent;
		border: none;
		border-radius: 5px;
		cursor: pointer;
		text-align: left;
		transition: background 0.1s;
	}

	.qw-item:hover {
		background: rgba(255, 255, 255, 0.06);
	}

	.qw-icon {
		font-size: 0.85rem;
		flex-shrink: 0;
	}

	.qw-label {
		font-size: 0.8rem;
		color: #cdd6f4;
		font-weight: 500;
	}

	.qw-activity {
		font-size: 0.68rem;
		color: #6b7280;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		max-width: 200px;
	}
</style>
