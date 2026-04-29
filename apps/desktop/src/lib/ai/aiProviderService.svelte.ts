import { InjectionToken } from '@fluxgit/core/context';
import { load } from '@tauri-apps/plugin-store';
import type { Store } from '@tauri-apps/plugin-store';
import type { AIProvider, AIProviderClient, ProviderTestStatus } from './aiProviderClient';
import { GeminiProviderClient } from './geminiProviderClient';
import { OpenAICompatibleClient } from './openAICompatibleClient';
import { PROVIDER_CATALOGUE } from './providerCatalogue';

export type { AIProvider, ProviderTestStatus };

const ALL_PROVIDERS: AIProvider[] = ['gemini', 'mistral', 'grok', 'deepseek', 'ollama', 'lmstudio'];

export interface AIProviderSettings {
	activeProvider: AIProvider | null;
	activeModel: string | null;
	useForCommitMessages: boolean;
	useForAgentChat: boolean;
	providerKeys: Record<AIProvider, string>;
	providerTestStatus: Record<AIProvider, ProviderTestStatus>;
	/** Custom model name for local providers when 'custom' is selected */
	customModelName: string;
}

const defaultSettings: AIProviderSettings = {
	activeProvider: null,
	activeModel: null,
	useForCommitMessages: true,
	useForAgentChat: true,
	providerKeys: {
		gemini: '',
		mistral: '',
		grok: '',
		deepseek: '',
		ollama: '',
		lmstudio: ''
	},
	providerTestStatus: {
		gemini: 'untested',
		mistral: 'untested',
		grok: 'untested',
		deepseek: 'untested',
		ollama: 'untested',
		lmstudio: 'untested'
	},
	customModelName: ''
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
		const customModelName = (await store.get<string>('ai.customModelName')) ?? '';

		const providerKeys: Record<AIProvider, string> = {
			gemini: '',
			mistral: '',
			grok: '',
			deepseek: '',
			ollama: '',
			lmstudio: ''
		};
		const providerTestStatus: Record<AIProvider, ProviderTestStatus> = {
			gemini: 'untested',
			mistral: 'untested',
			grok: 'untested',
			deepseek: 'untested',
			ollama: 'untested',
			lmstudio: 'untested'
		};

		for (const p of ALL_PROVIDERS) {
			providerKeys[p] = (await store.get<string>(`ai.key.${p}`)) ?? '';
			providerTestStatus[p] =
				(await store.get<ProviderTestStatus>(`ai.testStatus.${p}`)) ?? 'untested';
		}

		this.settings = {
			activeProvider: activeProvider ?? null,
			activeModel: activeModel ?? null,
			useForCommitMessages: useForCommitMessages ?? true,
			useForAgentChat: useForAgentChat ?? true,
			providerKeys,
			providerTestStatus,
			customModelName
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
		if (update.customModelName !== undefined) {
			await this.store.set('ai.customModelName', update.customModelName);
		}
		if (update.providerKeys) {
			for (const provider of ALL_PROVIDERS) {
				if (update.providerKeys[provider] !== undefined) {
					await this.store.set(`ai.key.${provider}`, update.providerKeys[provider]);
				}
			}
		}
		if (update.providerTestStatus) {
			for (const provider of ALL_PROVIDERS) {
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

	/** Resolve the actual model name — handles 'custom' by falling back to customModelName */
	private resolveModel(provider: AIProvider, model: string | null): string {
		const defaultModel = PROVIDER_CATALOGUE[provider].defaultModel;
		const resolved = model ?? defaultModel;
		if (resolved === 'custom') {
			return this.settings.customModelName || defaultModel;
		}
		return resolved;
	}

	/** Strip any path from a base URL — only keep scheme + host + port */
	private static cleanBaseUrl(url: string): string {
		try {
			const u = new URL(url);
			return `${u.protocol}//${u.host}`;
		} catch {
			return url;
		}
	}

	getActiveClient(): AIProviderClient | null {
		const { activeProvider, activeModel, providerKeys } = this.settings;

		if (!activeProvider) return null;

		const meta = PROVIDER_CATALOGUE[activeProvider];
		const model = this.resolveModel(activeProvider, activeModel);

		// Local providers don't need an API key
		if (meta.isLocal) {
			let endpoint = meta.endpoint!;
			// For LMStudio, use the user-configured URL if available
			if (activeProvider === 'lmstudio' && typeof localStorage !== 'undefined') {
				const customUrl = localStorage.getItem('lmstudio_url');
				if (customUrl) {
					// Strip any path, then append /v1 for OpenAI-compat
					const base = AIProviderService.cleanBaseUrl(customUrl);
					endpoint = `${base}/v1`;
				}
			}
			return new OpenAICompatibleClient(endpoint, '', model, activeProvider, true);
		}

		const key = providerKeys[activeProvider];
		if (!key) return null;

		switch (activeProvider) {
			case 'gemini':
				return new GeminiProviderClient(key, model);
			case 'mistral':
				return new OpenAICompatibleClient('https://api.mistral.ai/v1', key, model, 'mistral');
			case 'grok':
				return new OpenAICompatibleClient('https://api.x.ai/v1', key, model, 'grok');
			case 'deepseek':
				return new OpenAICompatibleClient('https://api.deepseek.com', key, model, 'deepseek');
		}

		return null;
	}

	async testConnection(provider: AIProvider, apiKey: string, model: string): Promise<boolean> {
		const meta = PROVIDER_CATALOGUE[provider];
		const resolvedModel = model === 'custom' ? this.settings.customModelName || meta.defaultModel : model;

		let client: AIProviderClient;

		if (meta.isLocal) {
			let endpoint = meta.endpoint!;
			// For LMStudio, respect the user-configured URL stored in localStorage
			if (provider === 'lmstudio' && typeof localStorage !== 'undefined') {
				const customUrl = localStorage.getItem('lmstudio_url');
				if (customUrl) {
					const base = AIProviderService.cleanBaseUrl(customUrl);
					endpoint = `${base}/v1`;
				}
			}
			client = new OpenAICompatibleClient(endpoint, '', resolvedModel, provider, true);
		} else {
			switch (provider) {
				case 'gemini':
					client = new GeminiProviderClient(apiKey, resolvedModel);
					break;
				case 'mistral':
					client = new OpenAICompatibleClient('https://api.mistral.ai/v1', apiKey, resolvedModel, 'mistral');
					break;
				case 'grok':
					client = new OpenAICompatibleClient('https://api.x.ai/v1', apiKey, resolvedModel, 'grok');
					break;
				case 'deepseek':
					client = new OpenAICompatibleClient('https://api.deepseek.com', apiKey, resolvedModel, 'deepseek');
					break;
				default:
					return false;
			}
		}

		try {
			// Use a minimal prompt for connection test — avoids long generation on slow local models
			await client.generateAgentResponse(
				[{ role: 'user', content: 'Reply with one word: ready' }],
				{ repoPath: '', currentBranch: '' }
			);
			await this.saveTestStatus(provider, 'passed');
			return true;
		} catch {
			await this.saveTestStatus(provider, 'failed');
			return false;
		}
	}
}

export const AI_PROVIDER_SERVICE = new InjectionToken<AIProviderService>('AI Provider Service');
