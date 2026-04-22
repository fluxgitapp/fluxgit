import { InjectionToken } from '@fluxgit/core/context';
import { load } from '@tauri-apps/plugin-store';
import type { Store } from '@tauri-apps/plugin-store';
import type { AIProvider, AIProviderClient, ProviderTestStatus } from './aiProviderClient';
import { GeminiProviderClient } from './geminiProviderClient';
import { OpenAICompatibleClient } from './openAICompatibleClient';

export type { AIProvider, ProviderTestStatus };

export interface AIProviderSettings {
	activeProvider: AIProvider | null;
	activeModel: string | null;
	useForCommitMessages: boolean;
	useForAgentChat: boolean;
	providerKeys: Record<AIProvider, string>;
	providerTestStatus: Record<AIProvider, ProviderTestStatus>;
}

const defaultSettings: AIProviderSettings = {
	activeProvider: null,
	activeModel: null,
	useForCommitMessages: true,
	useForAgentChat: true,
	providerKeys: { gemini: '', mistral: '', grok: '', deepseek: '' },
	providerTestStatus: { gemini: 'untested', mistral: 'untested', grok: 'untested', deepseek: 'untested' }
};

export class AIProviderService {
	settings: AIProviderSettings = $state(defaultSettings);

	private store: Store | null = null;

	async load(): Promise<void> {
		const store = await load('ai-settings.json', { defaults: {}, autoSave: true });
		this.store = store;

		const activeProvider = await store.get<AIProvider | null>('ai.activeProvider');
		const activeModel = await store.get<string | null>('ai.activeModel');
		const useForCommitMessages = await store.get<boolean>('ai.useForCommitMessages');
		const useForAgentChat = await store.get<boolean>('ai.useForAgentChat');

		const geminiKey = (await store.get<string>('ai.key.gemini')) ?? '';
		const mistralKey = (await store.get<string>('ai.key.mistral')) ?? '';
		const grokKey = (await store.get<string>('ai.key.grok')) ?? '';
		const deepseekKey = (await store.get<string>('ai.key.deepseek')) ?? '';

		const geminiStatus = (await store.get<ProviderTestStatus>('ai.testStatus.gemini')) ?? 'untested';
		const mistralStatus = (await store.get<ProviderTestStatus>('ai.testStatus.mistral')) ?? 'untested';
		const grokStatus = (await store.get<ProviderTestStatus>('ai.testStatus.grok')) ?? 'untested';
		const deepseekStatus = (await store.get<ProviderTestStatus>('ai.testStatus.deepseek')) ?? 'untested';

		this.settings = {
			activeProvider: activeProvider ?? null,
			activeModel: activeModel ?? null,
			useForCommitMessages: useForCommitMessages ?? true,
			useForAgentChat: useForAgentChat ?? true,
			providerKeys: { gemini: geminiKey, mistral: mistralKey, grok: grokKey, deepseek: deepseekKey },
			providerTestStatus: { gemini: geminiStatus, mistral: mistralStatus, grok: grokStatus, deepseek: deepseekStatus }
		};

		// Fallback: if no active provider, check env var for Gemini
		if (!this.settings.activeProvider) {
			const envKey = (import.meta as any).env?.GEMINI_API_KEY;
			if (envKey && envKey.length > 0) {
				this.settings.activeProvider = 'gemini';
				this.settings.activeModel = 'gemini-2.5-flash';
				this.settings.providerKeys.gemini = envKey;
				await store.set('ai.activeProvider', 'gemini');
				await store.set('ai.activeModel', 'gemini-2.5-flash');
				await store.set('ai.key.gemini', envKey);
				await store.save();
			}
		}
	}

	async save(update: Partial<AIProviderSettings>): Promise<void> {
		this.settings = { ...this.settings, ...update };

		if (!this.store) return;

		if (update.activeProvider !== undefined) {
			await this.store.set('ai.activeProvider', update.activeProvider);
		}
		if (update.activeModel !== undefined) {
			await this.store.set('ai.activeModel', update.activeModel);
		}
		if (update.useForCommitMessages !== undefined) {
			await this.store.set('ai.useForCommitMessages', update.useForCommitMessages);
		}
		if (update.useForAgentChat !== undefined) {
			await this.store.set('ai.useForAgentChat', update.useForAgentChat);
		}
		if (update.providerKeys) {
			for (const provider of ['gemini', 'mistral', 'grok', 'deepseek'] as AIProvider[]) {
				if (update.providerKeys[provider] !== undefined) {
					await this.store.set(`ai.key.${provider}`, update.providerKeys[provider]);
				}
			}
		}
		if (update.providerTestStatus) {
			for (const provider of ['gemini', 'mistral', 'grok', 'deepseek'] as AIProvider[]) {
				if (update.providerTestStatus[provider] !== undefined) {
					await this.store.set(`ai.testStatus.${provider}`, update.providerTestStatus[provider]);
				}
			}
		}

		await this.store.save();
	}

	async saveApiKey(provider: AIProvider, key: string): Promise<void> {
		if (!this.store) return;

		await this.store.set(`ai.key.${provider}`, key);
		this.settings.providerKeys[provider] = key;
		this.settings.providerTestStatus[provider] = 'untested';
		await this.store.set(`ai.testStatus.${provider}`, 'untested');
		await this.store.save();
	}

	async saveTestStatus(provider: AIProvider, status: ProviderTestStatus): Promise<void> {
		if (!this.store) return;

		await this.store.set(`ai.testStatus.${provider}`, status);
		this.settings.providerTestStatus[provider] = status;
		await this.store.save();
	}

	getActiveClient(): AIProviderClient | null {
		const { activeProvider, activeModel, providerKeys } = this.settings;

		if (!activeProvider) return null;

		const key = providerKeys[activeProvider];
		if (!key) return null;

		switch (activeProvider) {
			case 'gemini':
				return new GeminiProviderClient(key, activeModel ?? 'gemini-2.5-flash');
			case 'mistral':
				return new OpenAICompatibleClient(
					'https://api.mistral.ai/v1',
					key,
					activeModel ?? 'mistral-small-latest',
					'mistral'
				);
			case 'grok':
				return new OpenAICompatibleClient(
					'https://api.x.ai/v1',
					key,
					activeModel ?? 'grok-2-mini',
					'grok'
				);
			case 'deepseek':
				return new OpenAICompatibleClient(
					'https://api.deepseek.com',
					key,
					activeModel ?? 'deepseek-chat',
					'deepseek'
				);
		}
	}

	async testConnection(provider: AIProvider, apiKey: string, model: string): Promise<boolean> {
		let client: AIProviderClient;

		switch (provider) {
			case 'gemini':
				client = new GeminiProviderClient(apiKey, model);
				break;
			case 'mistral':
				client = new OpenAICompatibleClient('https://api.mistral.ai/v1', apiKey, model, 'mistral');
				break;
			case 'grok':
				client = new OpenAICompatibleClient('https://api.x.ai/v1', apiKey, model, 'grok');
				break;
			case 'deepseek':
				client = new OpenAICompatibleClient('https://api.deepseek.com', apiKey, model, 'deepseek');
				break;
		}

		try {
			await client.generateCommitMessage('test');
			await this.saveTestStatus(provider, 'passed');
			return true;
		} catch {
			await this.saveTestStatus(provider, 'failed');
			return false;
		}
	}
}

export const AI_PROVIDER_SERVICE = new InjectionToken<AIProviderService>('AI Provider Service');
