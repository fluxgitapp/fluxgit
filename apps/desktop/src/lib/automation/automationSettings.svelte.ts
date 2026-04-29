import { InjectionToken } from '@fluxgit/core/context';
import { load } from '@tauri-apps/plugin-store';
import type { Store } from '@tauri-apps/plugin-store';

export type CommitMessageStyle = 'ai' | 'conventional' | 'timestamp';

export interface AutomationSettings {
	autoSnapshotBeforeChanges: boolean;
	autoCommitAfterAiChanges: boolean;
	commitMessageStyle: CommitMessageStyle;
	autoPushAfterCommit: boolean;
	autoOpenPrAfterPush: boolean;
}

const DEFAULTS: AutomationSettings = {
	autoSnapshotBeforeChanges: true,
	autoCommitAfterAiChanges: false,
	commitMessageStyle: 'conventional',
	autoPushAfterCommit: false,
	autoOpenPrAfterPush: false
};

export class AutomationSettingsService {
	settings: AutomationSettings = $state({ ...DEFAULTS });
	private store: Store | null = null;

	async load(): Promise<void> {
		const store = await load('automation-settings.json', { defaults: {}, autoSave: true });
		this.store = store;

		this.settings = {
			autoSnapshotBeforeChanges:
				(await store.get<boolean>('auto.snapshotBeforeChanges')) ?? DEFAULTS.autoSnapshotBeforeChanges,
			autoCommitAfterAiChanges:
				(await store.get<boolean>('auto.commitAfterAiChanges')) ?? DEFAULTS.autoCommitAfterAiChanges,
			commitMessageStyle:
				(await store.get<CommitMessageStyle>('auto.commitMessageStyle')) ?? DEFAULTS.commitMessageStyle,
			autoPushAfterCommit:
				(await store.get<boolean>('auto.pushAfterCommit')) ?? DEFAULTS.autoPushAfterCommit,
			autoOpenPrAfterPush:
				(await store.get<boolean>('auto.openPrAfterPush')) ?? DEFAULTS.autoOpenPrAfterPush
		};
	}

	async save(update: Partial<AutomationSettings>): Promise<void> {
		this.settings = { ...this.settings, ...update };
		if (!this.store) return;

		if (update.autoSnapshotBeforeChanges !== undefined)
			await this.store.set('auto.snapshotBeforeChanges', update.autoSnapshotBeforeChanges);
		if (update.autoCommitAfterAiChanges !== undefined)
			await this.store.set('auto.commitAfterAiChanges', update.autoCommitAfterAiChanges);
		if (update.commitMessageStyle !== undefined)
			await this.store.set('auto.commitMessageStyle', update.commitMessageStyle);
		if (update.autoPushAfterCommit !== undefined)
			await this.store.set('auto.pushAfterCommit', update.autoPushAfterCommit);
		if (update.autoOpenPrAfterPush !== undefined)
			await this.store.set('auto.openPrAfterPush', update.autoOpenPrAfterPush);

		await this.store.save();
	}
}

export const AUTOMATION_SETTINGS_SERVICE = new InjectionToken<AutomationSettingsService>(
	'AutomationSettingsService'
);
