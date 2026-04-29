import { InjectionToken } from '@fluxgit/core/context';
import { showToast } from '$lib/notifications/toasts';
import type { HistoryService } from '$lib/history/history';
import type { StackService } from '$lib/stacks/stackService.svelte';
import type { AIProviderService } from '$lib/ai/aiProviderService.svelte';
import type { AutomationSettingsService } from './automationSettings.svelte';

export type WorkflowStep = 'snapshot' | 'commit' | 'push' | 'pr';
export type WorkflowType = 'snapshot' | 'commit' | 'commit-push' | 'full-flow';

export interface WorkflowActivity {
	stackId: string;
	action: string;
	timestamp: Date;
	fileCount?: number;
}

export class QuickWorkflowService {
	/** Per-stack last activity log */
	private activityLog = $state<Map<string, WorkflowActivity>>(new Map());

	constructor(
		private historyService: HistoryService,
		private stackService: StackService,
		private aiProviderService: AIProviderService,
		private automationSettings: AutomationSettingsService
	) {}

	getLastActivity(stackId: string): WorkflowActivity | undefined {
		return this.activityLog.get(stackId);
	}

	private setActivity(stackId: string, action: string, fileCount?: number) {
		this.activityLog = new Map(this.activityLog).set(stackId, {
			stackId,
			action,
			timestamp: new Date(),
			fileCount
		});
	}

	private toast(message: string, style: 'info' | 'success' | 'warning' = 'info') {
		showToast({ message, style: style === 'success' ? 'pop' : style });
	}

	async runWorkflow(
		projectId: string,
		stackId: string,
		branchName: string,
		workflowType: WorkflowType,
		changedFileCount: number = 0
	): Promise<void> {
		const settings = this.automationSettings.settings;

		try {
			// ── Snapshot ──────────────────────────────────────────────────────
			if (workflowType === 'snapshot' || (settings.autoSnapshotBeforeChanges && workflowType !== 'snapshot')) {
				this.toast('⚡ Creating snapshot...');
				await this.historyService.createSnapshot(projectId, `Before: ${branchName}`);
				this.setActivity(stackId, 'Snapshot created');

				if (workflowType === 'snapshot') {
					this.toast('✅ Snapshot created', 'success');
					return;
				}
			}

			// ── Commit ────────────────────────────────────────────────────────
			if (workflowType === 'commit' || workflowType === 'commit-push' || workflowType === 'full-flow') {
				const message = await this.buildCommitMessage(branchName, changedFileCount, settings.commitMessageStyle);
				this.toast(`⚡ Committing ${changedFileCount} files...`);

				// Use the existing create commit mutation
				await this.stackService.createCommitMutation({
					projectId,
					stackId,
					message,
					parentId: undefined,
					stackBranchName: branchName,
					worktreeChanges: [] // empty = commit all staged
				});

				this.setActivity(stackId, `Auto-committed ${changedFileCount} files`, changedFileCount);

				if (workflowType === 'commit') {
					this.toast('✅ Committed successfully', 'success');
					return;
				}
			}

			// ── Push ──────────────────────────────────────────────────────────
			if (workflowType === 'commit-push' || workflowType === 'full-flow') {
				this.toast(`⚡ Pushing to origin/${branchName}...`);
				await this.stackService.pushStack.mutate({
					projectId,
					stackId,
					withForce: false
				});
				this.setActivity(stackId, `Pushed to origin/${branchName}`);

				if (workflowType === 'commit-push') {
					this.toast('✅ Pushed successfully', 'success');
					return;
				}
			}

			// ── Open PR ───────────────────────────────────────────────────────
			if (workflowType === 'full-flow') {
				this.toast('✅ Done! PR ready to open', 'success');
				this.setActivity(stackId, 'Full flow complete');
			}
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			showToast({ title: 'Workflow failed', message: msg, style: 'danger' });
		}
	}

	private async buildCommitMessage(
		branchName: string,
		fileCount: number,
		style: string
	): Promise<string> {
		if (style === 'timestamp') {
			return `changes: ${new Date().toISOString()}`;
		}

		if (style === 'conventional') {
			const type = branchName.startsWith('fix') ? 'fix' : 'feat';
			const scope = branchName.replace(/^(feat|fix|chore)[-/]?/, '').slice(0, 30) || 'update';
			return `${type}(${scope}): ${fileCount} file${fileCount !== 1 ? 's' : ''} changed`;
		}

		// AI style — try active provider, fall back to conventional
		const client = this.aiProviderService.getActiveClient();
		if (client) {
			try {
				return await client.generateCommitMessage(`${fileCount} files changed in ${branchName}`);
			} catch {
				// fall through to conventional
			}
		}

		return `feat: ${fileCount} file${fileCount !== 1 ? 's' : ''} changed`;
	}
}

export const QUICK_WORKFLOW_SERVICE = new InjectionToken<QuickWorkflowService>(
	'QuickWorkflowService'
);
