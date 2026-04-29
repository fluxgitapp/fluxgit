<script lang="ts">
	import { RULES_SERVICE, workspaceRulesSelectors } from '$lib/rules/rulesService.svelte';
	import { STACK_SERVICE } from '$lib/stacks/stackService.svelte';
	import { UNCOMMITTED_SERVICE } from '$lib/selection/uncommittedService.svelte';
	import { inject } from '@fluxgit/core/context';
	import { CardGroup, Spacer, Toggle, Button, Modal, Icon } from '@fluxgit/ui';
	import type { WorkspaceRule } from '$lib/rules/rule';

	const { projectId }: { projectId: string } = $props();

	const rulesService = inject(RULES_SERVICE);
	const stackService = inject(STACK_SERVICE);
	const uncommittedService = inject(UNCOMMITTED_SERVICE);

	// ─── Mutations ────────────────────────────────────────────────────────────
	const [createRule, creatingRule] = rulesService.createWorkspaceRule;
	const [updateRule, updatingRule] = rulesService.updateWorkspaceRule;
	const [deleteRule, deletingRule] = rulesService.deleteWorkspaceRule;

	// ─── Queries ──────────────────────────────────────────────────────────────
	const rulesQuery = $derived(rulesService.workspaceRules(projectId));
	const stacksQuery = $derived(stackService.stacks(projectId));

	// ─── Derived data ─────────────────────────────────────────────────────────
	const allRules = $derived.by(() => {
		const result = rulesQuery.result;
		if (!result.isSuccess) return [] as WorkspaceRule[];
		return workspaceRulesSelectors.selectAll(result.data);
	});

	const allStacks = $derived(stacksQuery.response ?? []);

	/** Only filesystem-change rules with an explicit assign action */
	const streamRules = $derived(
		allRules.filter(
			(r) =>
				r.trigger === 'fileSytemChange' &&
				r.action.type === 'explicit' &&
				r.action.subject.type === 'assign',
		),
	);

	// ─── Modal state ──────────────────────────────────────────────────────────
	let addRuleModal = $state<Modal>();
	let deleteConfirmModal = $state<Modal>();
	let ruleToDelete = $state<WorkspaceRule | null>(null);

	let suggestOpen = $state(false);

	// ─── Add-rule form state ──────────────────────────────────────────────────
	let patternInput = $state('');
	let selectedStackId = $state('');

	// Pre-select first stack when stacks load
	$effect(() => {
		if (allStacks.length > 0 && !selectedStackId) {
			selectedStackId = allStacks[0]?.id ?? '';
		}
	});

	const selectedStackName = $derived(
		allStacks.find((s) => s.id === selectedStackId)?.heads[0]?.name ?? '',
	);

	// ─── Suggest state ────────────────────────────────────────────────────────
	const BUILT_IN_SUGGESTIONS = [
		{ pattern: '*.css, *.scss', suggestion: 'styles', description: 'Style files' },
		{ pattern: '*.test.ts, *.spec.ts', suggestion: 'testing', description: 'Test files' },
		{ pattern: 'src/api/*', suggestion: 'backend', description: 'API files' },
		{ pattern: 'src/components/*', suggestion: 'frontend', description: 'Component files' },
	];

	/** Suggestions derived from actual changed files */
	const fileSuggestions = $derived.by(() => {
		const changes = uncommittedService.getChangesByStackId(null);
		const extMap = new Map<string, number>();

		for (const change of changes) {
			const path = change.path;
			const dotIdx = path.lastIndexOf('.');
			if (dotIdx !== -1) {
				const ext = path.slice(dotIdx + 1);
				if (ext) extMap.set(ext, (extMap.get(ext) ?? 0) + 1);
			}
		}

		const dynamic: typeof BUILT_IN_SUGGESTIONS = [];
		for (const [ext, count] of extMap) {
			if (count >= 2) {
				dynamic.push({
					pattern: `*.${ext}`,
					suggestion: ext,
					description: `${ext.toUpperCase()} files (${count} changed)`,
				});
			}
		}
		return dynamic;
	});

	const allSuggestions = $derived([...BUILT_IN_SUGGESTIONS, ...fileSuggestions]);
	let skippedSuggestions = $state<Set<string>>(new Set());

	const visibleSuggestions = $derived(
		allSuggestions.filter((s) => !skippedSuggestions.has(s.pattern)),
	);

	// ─── Helpers ──────────────────────────────────────────────────────────────
	function globToRegex(glob: string): string {
		return glob
			.trim()
			.replace(/\./g, '\\.')
			.replace(/\*/g, '.*')
			.replace(/\?/g, '.')
			+ '$';
	}

	function getStackName(stackId: string): string {
		const stack = allStacks.find((s) => s.id === stackId);
		return stack?.heads[0]?.name ?? stackId;
	}

	function getPatternFromRule(rule: WorkspaceRule): string {
		const filter = rule.filters[0];
		if (filter?.type === 'pathMatchesRegex') {
			// Convert regex back to a readable form (best-effort)
			return filter.subject
				.replace(/\\\./g, '.')
				.replace(/\.\*/g, '*')
				.replace(/\$$/, '');
		}
		return '(no pattern)';
	}

	function getStackIdFromRule(rule: WorkspaceRule): string | null {
		if (
			rule.action.type === 'explicit' &&
			rule.action.subject.type === 'assign' &&
			rule.action.subject.subject.target.type === 'stackId'
		) {
			return rule.action.subject.subject.target.subject;
		}
		return null;
	}

	function getPriorityLabel(index: number, total: number): string {
		if (total <= 1) return 'HIGH';
		if (index === 0) return 'HIGH';
		if (index === total - 1) return 'LOW';
		return 'MEDIUM';
	}

	function getPriorityClass(index: number, total: number): string {
		return getPriorityLabel(index, total).toLowerCase();
	}

	// ─── Mutation helpers ─────────────────────────────────────────────────────
	async function createPatternRule(patterns: string, stackId: string) {
		const regexPatterns = patterns.split(',').map((p) => globToRegex(p.trim()));
		const filters = regexPatterns.map((r) => ({ type: 'pathMatchesRegex' as const, subject: r }));
		await createRule({
			projectId,
			request: {
				trigger: 'fileSytemChange',
				filters,
				action: {
					type: 'explicit',
					subject: {
						type: 'assign',
						subject: { target: { type: 'stackId', subject: stackId } },
					},
				},
			},
		});
	}

	async function handleSaveRule(close: () => void) {
		if (!patternInput.trim() || !selectedStackId) return;
		await createPatternRule(patternInput, selectedStackId);
		patternInput = '';
		close();
	}

	async function handleToggleRule(rule: WorkspaceRule, enabled: boolean) {
		await updateRule({
			projectId,
			request: {
				id: rule.id,
				enabled,
				trigger: null,
				filters: null,
				action: null,
			},
		});
	}

	async function handleDeleteRule(close: () => void) {
		if (!ruleToDelete) return;
		await deleteRule({ projectId, ruleId: ruleToDelete.id });
		ruleToDelete = null;
		close();
	}

	function openDeleteConfirm(rule: WorkspaceRule) {
		ruleToDelete = rule;
		deleteConfirmModal?.show();
	}

	async function handleAcceptSuggestion(pattern: string) {
		const targetStackId = allStacks[0]?.id;
		if (!targetStackId) return;
		await createPatternRule(pattern, targetStackId);
		skippedSuggestions = new Set([...skippedSuggestions, pattern]);
	}

	function handleSkipSuggestion(pattern: string) {
		skippedSuggestions = new Set([...skippedSuggestions, pattern]);
	}

	function openAddRule() {
		patternInput = '';
		addRuleModal?.show();
	}
</script>

<!-- ── Header ──────────────────────────────────────────────────────────────── -->
<div class="stream-rules">
	<div class="header">
		<div class="header-text">
			<span class="header-title">Smart File Assignment</span>
			<span class="header-subtitle">
				Files matching these patterns are automatically assigned to the right Flux Stream when you
				make changes
			</span>
		</div>
	</div>

	<Spacer margin={8} dotted />

	<!-- ── Rules list ──────────────────────────────────────────────────────── -->
	{#if streamRules.length === 0}
		<div class="empty-state">
			<Icon name="list" />
			<span class="empty-title">No rules yet</span>
			<button class="btn-cyan" type="button" onclick={openAddRule}>Add your first rule</button>
		</div>
	{:else}
		<div class="rules-list">
			{#each streamRules as rule, i (rule.id)}
				{@const stackId = getStackIdFromRule(rule)}
				{@const pattern = getPatternFromRule(rule)}
				{@const priorityLabel = getPriorityLabel(i, streamRules.length)}
				{@const priorityClass = getPriorityClass(i, streamRules.length)}
				<div class="rule-card" class:disabled={!rule.enabled}>
					<div class="rule-main">
						<span class="pattern-chip">{pattern}</span>
						<span class="arrow">→</span>
						<span class="stack-name">{stackId ? getStackName(stackId) : '(unknown)'}</span>
						<span class="priority-badge priority-{priorityClass}">{priorityLabel}</span>
					</div>
					<div class="rule-actions">
						<Toggle
							id="rule-toggle-{rule.id}"
							checked={rule.enabled}
							onchange={(v) => handleToggleRule(rule, v)}
						/>
						<button
							class="delete-btn"
							type="button"
							title="Delete rule"
							onclick={() => openDeleteConfirm(rule)}
						>
							<Icon name="bin" />
						</button>
					</div>
				</div>
			{/each}
		</div>
	{/if}

	<Spacer margin={8} dotted />

	<!-- ── Action buttons ──────────────────────────────────────────────────── -->
	<div class="action-row">
		<button class="btn-cyan" type="button" onclick={openAddRule}>Add Rule</button>
		<button
			class="btn-secondary"
			type="button"
			onclick={() => (suggestOpen = !suggestOpen)}
		>
			{suggestOpen ? 'Hide Suggestions' : 'Suggest Rules'}
		</button>
	</div>

	<!-- ── Suggest section ─────────────────────────────────────────────────── -->
	{#if suggestOpen}
		<div class="suggest-section">
			<div class="suggest-header">
				<span class="suggest-title">Suggested Rules</span>
				<span class="suggest-subtitle">Based on common file patterns</span>
			</div>
			{#if visibleSuggestions.length === 0}
				<div class="suggest-empty">All suggestions accepted or skipped.</div>
			{:else}
				{#each visibleSuggestions as s (s.pattern)}
					<div class="suggest-card">
						<div class="suggest-info">
							<span class="pattern-chip">{s.pattern}</span>
							<span class="arrow">→</span>
							<span class="suggest-stream">{s.suggestion}</span>
							<span class="suggest-desc">{s.description}</span>
						</div>
						<div class="suggest-btns">
							<button
								class="btn-cyan btn-sm"
								type="button"
								onclick={() => handleAcceptSuggestion(s.pattern)}
							>
								Accept
							</button>
							<button
								class="btn-secondary btn-sm"
								type="button"
								onclick={() => handleSkipSuggestion(s.pattern)}
							>
								Skip
							</button>
						</div>
					</div>
				{/each}
			{/if}
		</div>
	{/if}
</div>

<!-- ── Add Rule Modal ──────────────────────────────────────────────────────── -->
<Modal
	bind:this={addRuleModal}
	title="Add Stream Rule"
	width="medium"
	onSubmit={handleSaveRule}
>
	<div class="modal-body">
		<div class="field-row">
			<label class="field-label" for="pattern-input">File Pattern</label>
			<input
				id="pattern-input"
				class="field-input"
				type="text"
				bind:value={patternInput}
				placeholder="*.css, src/auth/*, *.test.ts"
				autocomplete="off"
			/>
			<span class="field-hint">
				Separate multiple patterns with commas. Use * as wildcard.
			</span>
		</div>

		<div class="field-row">
			<label class="field-label" for="stack-select">Target Stream</label>
			<select id="stack-select" class="field-select" bind:value={selectedStackId}>
				{#each allStacks as stack (stack.id)}
					<option value={stack.id}>{stack.heads[0]?.name ?? stack.id}</option>
				{/each}
			</select>
		</div>

		{#if patternInput.trim() && selectedStackName}
			<div class="preview-text">
				Files matching <span class="preview-pattern">{patternInput.trim()}</span> will go to →
				<span class="preview-stream">{selectedStackName}</span>
			</div>
		{/if}
	</div>

	{#snippet controls(close)}
		<Button kind="outline" onclick={close}>Cancel</Button>
		<Button
			type="submit"
			kind="solid"
			style="pop"
			disabled={!patternInput.trim() || !selectedStackId}
			loading={creatingRule.current.isLoading}
		>
			Save Rule
		</Button>
	{/snippet}
</Modal>

<!-- ── Delete Confirm Modal ────────────────────────────────────────────────── -->
<Modal
	bind:this={deleteConfirmModal}
	title="Delete rule"
	width="small"
	type="warning"
	onSubmit={handleDeleteRule}
>
	{#if ruleToDelete}
		Are you sure you want to delete the rule for
		<strong>"{getPatternFromRule(ruleToDelete)}"</strong>? This action cannot be undone.
	{/if}

	{#snippet controls(close)}
		<Button kind="outline" onclick={close}>Cancel</Button>
		<Button
			type="submit"
			style="danger"
			loading={deletingRule.current.isLoading}
		>
			Delete
		</Button>
	{/snippet}
</Modal>

<style>
	.stream-rules {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	/* ── Header ── */
	.header {
		display: flex;
		align-items: flex-start;
		gap: 10px;
	}

	.header-text {
		display: flex;
		flex-direction: column;
		gap: 3px;
	}

	.header-title {
		font-size: 0.9rem;
		font-weight: 700;
		color: #cdd6f4;
	}

	.header-subtitle {
		font-size: 0.75rem;
		color: #6b7280;
		line-height: 1.5;
	}

	/* ── Rules list ── */
	.rules-list {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.rule-card {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 10px;
		padding: 10px 12px;
		background: #1e1e2e;
		border: 1px solid #2e2e3e;
		border-radius: 8px;
		transition: border-color 0.15s, opacity 0.15s;
	}

	.rule-card:hover {
		border-color: #45475a;
	}

	.rule-card.disabled {
		opacity: 0.5;
	}

	.rule-main {
		display: flex;
		align-items: center;
		gap: 8px;
		flex: 1;
		min-width: 0;
		flex-wrap: wrap;
	}

	.rule-actions {
		display: flex;
		align-items: center;
		gap: 8px;
		flex-shrink: 0;
	}

	/* ── Pattern chip ── */
	.pattern-chip {
		font-size: 0.75rem;
		font-family: monospace;
		background: rgba(6, 182, 212, 0.1);
		border: 1px solid rgba(6, 182, 212, 0.25);
		color: #06b6d4;
		padding: 2px 8px;
		border-radius: 4px;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		max-width: 180px;
	}

	.arrow {
		color: #45475a;
		font-size: 0.85rem;
		flex-shrink: 0;
	}

	.stack-name {
		font-size: 0.8rem;
		color: #a6adc8;
		font-weight: 500;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		max-width: 140px;
	}

	/* ── Priority badge ── */
	.priority-badge {
		font-size: 0.6rem;
		font-weight: 700;
		letter-spacing: 0.06em;
		padding: 2px 6px;
		border-radius: 4px;
		flex-shrink: 0;
	}

	.priority-high {
		background: rgba(239, 68, 68, 0.12);
		color: #f87171;
		border: 1px solid rgba(239, 68, 68, 0.25);
	}

	.priority-medium {
		background: rgba(245, 158, 11, 0.12);
		color: #fbbf24;
		border: 1px solid rgba(245, 158, 11, 0.25);
	}

	.priority-low {
		background: rgba(107, 114, 128, 0.12);
		color: #9ca3af;
		border: 1px solid rgba(107, 114, 128, 0.25);
	}

	/* ── Delete button ── */
	.delete-btn {
		background: transparent;
		border: 1px solid transparent;
		border-radius: 5px;
		color: #6b7280;
		padding: 4px 6px;
		cursor: pointer;
		display: flex;
		align-items: center;
		transition: color 0.15s, border-color 0.15s, background 0.15s;
	}

	.delete-btn:hover {
		color: #f87171;
		border-color: rgba(239, 68, 68, 0.3);
		background: rgba(239, 68, 68, 0.08);
	}

	/* ── Empty state ── */
	.empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 10px;
		padding: 28px 16px;
		background: #1e1e2e;
		border: 1px dashed #2e2e3e;
		border-radius: 8px;
		color: #6b7280;
	}

	.empty-title {
		font-size: 0.85rem;
		color: #a6adc8;
	}

	/* ── Action row ── */
	.action-row {
		display: flex;
		gap: 8px;
		align-items: center;
	}

	/* ── Buttons ── */
	.btn-cyan {
		background: #06b6d4;
		box-shadow: 0 0 8px rgba(6, 182, 212, 0.4);
		border: none;
		border-radius: 6px;
		color: #fff;
		padding: 7px 16px;
		font-size: 0.82rem;
		font-weight: 600;
		cursor: pointer;
		transition: opacity 0.15s, box-shadow 0.15s;
		white-space: nowrap;
	}

	.btn-cyan:hover:not(:disabled) {
		box-shadow: 0 0 14px rgba(6, 182, 212, 0.6);
	}

	.btn-cyan:disabled {
		opacity: 0.5;
		cursor: not-allowed;
		box-shadow: none;
	}

	.btn-secondary {
		background: #252535;
		border: 1px solid #2e2e3e;
		border-radius: 6px;
		color: #a6adc8;
		padding: 7px 16px;
		font-size: 0.82rem;
		cursor: pointer;
		transition: border-color 0.15s, background 0.15s;
		white-space: nowrap;
	}

	.btn-secondary:hover {
		border-color: #45475a;
		background: #2e2e3e;
		color: #cdd6f4;
	}

	.btn-sm {
		padding: 4px 10px;
		font-size: 0.75rem;
	}

	/* ── Suggest section ── */
	.suggest-section {
		display: flex;
		flex-direction: column;
		gap: 8px;
		padding: 12px;
		background: rgba(255, 255, 255, 0.02);
		border: 1px solid #2e2e3e;
		border-radius: 8px;
	}

	.suggest-header {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.suggest-title {
		font-size: 0.78rem;
		font-weight: 700;
		color: #cdd6f4;
	}

	.suggest-subtitle {
		font-size: 0.7rem;
		color: #6b7280;
	}

	.suggest-empty {
		font-size: 0.78rem;
		color: #6b7280;
		text-align: center;
		padding: 12px 0;
	}

	.suggest-card {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 10px;
		padding: 8px 10px;
		background: #1e1e2e;
		border: 1px solid #2e2e3e;
		border-radius: 6px;
		transition: border-color 0.15s;
	}

	.suggest-card:hover {
		border-color: #45475a;
	}

	.suggest-info {
		display: flex;
		align-items: center;
		gap: 8px;
		flex: 1;
		min-width: 0;
		flex-wrap: wrap;
	}

	.suggest-stream {
		font-size: 0.78rem;
		color: #a6adc8;
		font-weight: 500;
	}

	.suggest-desc {
		font-size: 0.7rem;
		color: #6b7280;
	}

	.suggest-btns {
		display: flex;
		gap: 6px;
		flex-shrink: 0;
	}

	/* ── Modal body ── */
	.modal-body {
		display: flex;
		flex-direction: column;
		gap: 14px;
		padding: 4px 0;
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

	.field-input,
	.field-select {
		background: #1e1e2e;
		border: 1px solid #2e2e3e;
		border-radius: 6px;
		color: #cdd6f4;
		padding: 7px 10px;
		font-size: 0.85rem;
		width: 100%;
		outline: none;
		transition: border-color 0.15s;
	}

	.field-input:focus,
	.field-select:focus {
		border-color: #06b6d4;
	}

	.field-hint {
		font-size: 0.7rem;
		color: #6b7280;
		line-height: 1.4;
	}

	.preview-text {
		font-size: 0.78rem;
		color: #a6adc8;
		padding: 8px 10px;
		background: rgba(6, 182, 212, 0.06);
		border: 1px solid rgba(6, 182, 212, 0.15);
		border-radius: 6px;
		line-height: 1.5;
	}

	.preview-pattern {
		font-family: monospace;
		color: #06b6d4;
		font-weight: 600;
	}

	.preview-stream {
		color: #06b6d4;
		font-weight: 600;
	}
</style>
