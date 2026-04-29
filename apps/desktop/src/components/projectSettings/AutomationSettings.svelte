<script lang="ts">
	import { AUTOMATION_SETTINGS_SERVICE } from '$lib/automation/automationSettings.svelte';
	import type { CommitMessageStyle } from '$lib/automation/automationSettings.svelte';
	import { inject } from '@fluxgit/core/context';
	import { CardGroup, Spacer, Toggle } from '@fluxgit/ui';

	const automationService = inject(AUTOMATION_SETTINGS_SERVICE);
	const settings = $derived(automationService.settings);

	async function toggle(key: keyof typeof settings, value: boolean) {
		await automationService.save({ [key]: value } as any);
	}

	async function setStyle(style: CommitMessageStyle) {
		await automationService.save({ commitMessageStyle: style });
	}
</script>

<div class="automation-settings">
	<div class="section-label">Automation</div>

	<CardGroup.Item standalone labelFor="autoSnapshot">
		{#snippet title()}
			Auto-snapshot before changes
		{/snippet}
		{#snippet caption()}
			Creates a restore point in the oplog before any automated action. Free — uses the existing
			snapshot system.
		{/snippet}
		{#snippet actions()}
			<Toggle
				id="autoSnapshot"
				checked={settings.autoSnapshotBeforeChanges}
				onchange={(v) => toggle('autoSnapshotBeforeChanges', v)}
			/>
		{/snippet}
	</CardGroup.Item>

	<CardGroup.Item standalone labelFor="autoCommit">
		{#snippet title()}
			Auto-commit after AI changes
		{/snippet}
		{#snippet caption()}
			Automatically commit when AI finishes making changes.
		{/snippet}
		{#snippet actions()}
			<Toggle
				id="autoCommit"
				checked={settings.autoCommitAfterAiChanges}
				onchange={(v) => toggle('autoCommitAfterAiChanges', v)}
			/>
		{/snippet}
	</CardGroup.Item>

	{#if settings.autoCommitAfterAiChanges}
		<div class="sub-options">
			<div class="sub-label">Commit message style</div>
			<div class="style-options">
				{#each [
					{ id: 'ai', label: 'AI Generated', desc: 'Uses active AI provider' },
					{ id: 'conventional', label: 'Conventional', desc: 'feat/fix/chore: N files changed' },
					{ id: 'timestamp', label: 'Timestamp', desc: 'changes: 2026-04-28T... (zero AI cost)' }
				] as opt (opt.id)}
					<button
						class="style-option"
						class:selected={settings.commitMessageStyle === opt.id}
						type="button"
						onclick={() => setStyle(opt.id as CommitMessageStyle)}
					>
						<span class="style-radio">
							{#if settings.commitMessageStyle === opt.id}●{:else}○{/if}
						</span>
						<span class="style-text">
							<span class="style-name">{opt.label}</span>
							<span class="style-desc">{opt.desc}</span>
						</span>
					</button>
				{/each}
			</div>
		</div>
	{/if}

	<CardGroup.Item standalone labelFor="autoPush">
		{#snippet title()}
			Auto-push after commit
		{/snippet}
		{#snippet caption()}
			Automatically push to remote after committing.
		{/snippet}
		{#snippet actions()}
			<Toggle
				id="autoPush"
				checked={settings.autoPushAfterCommit}
				onchange={(v) => toggle('autoPushAfterCommit', v)}
			/>
		{/snippet}
	</CardGroup.Item>

	<CardGroup.Item standalone labelFor="autoOpenPr">
		{#snippet title()}
			Auto-open PR after push
		{/snippet}
		{#snippet caption()}
			Opens the pull request URL in your browser after pushing.
		{/snippet}
		{#snippet actions()}
			<Toggle
				id="autoOpenPr"
				checked={settings.autoOpenPrAfterPush}
				onchange={(v) => toggle('autoOpenPrAfterPush', v)}
			/>
		{/snippet}
	</CardGroup.Item>
</div>

<style>
	.automation-settings {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.section-label {
		font-size: 0.7rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: #6b7280;
		padding: 8px 0 4px;
	}

	.sub-options {
		margin: 4px 0 4px 16px;
		padding: 10px 12px;
		background: rgba(255, 255, 255, 0.02);
		border: 1px solid #2e2e3e;
		border-radius: 8px;
	}

	.sub-label {
		font-size: 0.72rem;
		color: #6b7280;
		font-weight: 600;
		margin-bottom: 8px;
		text-transform: uppercase;
		letter-spacing: 0.06em;
	}

	.style-options {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.style-option {
		display: flex;
		align-items: flex-start;
		gap: 8px;
		padding: 7px 10px;
		background: transparent;
		border: 1px solid transparent;
		border-radius: 6px;
		cursor: pointer;
		text-align: left;
		transition: background 0.12s, border-color 0.12s;
		width: 100%;
	}

	.style-option:hover {
		background: rgba(255, 255, 255, 0.03);
		border-color: #2e2e3e;
	}

	.style-option.selected {
		background: rgba(6, 182, 212, 0.06);
		border-color: rgba(6, 182, 212, 0.2);
	}

	.style-radio {
		font-size: 0.85rem;
		color: #06b6d4;
		flex-shrink: 0;
		margin-top: 1px;
	}

	.style-text {
		display: flex;
		flex-direction: column;
		gap: 1px;
	}

	.style-name {
		font-size: 0.8rem;
		font-weight: 600;
		color: #cdd6f4;
	}

	.style-desc {
		font-size: 0.7rem;
		color: #6b7280;
	}
</style>
