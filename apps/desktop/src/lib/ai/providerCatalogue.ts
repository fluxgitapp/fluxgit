import type { AIProvider } from './aiProviderClient';

export interface ModelOption {
	id: string;
	name: string;
}

export interface ProviderMeta {
	name: string;
	models: readonly string[];
	modelOptions?: readonly ModelOption[];
	defaultModel: string;
	badge?: string;
	badgeColor?: 'green' | 'violet' | 'cyan' | 'orange';
	requiresApiKey: boolean;
	endpoint?: string;
	setupUrl?: string;
	helperText?: string;
	isLocal?: boolean;
}

// Type guard helpers for template use
export function getProviderBadge(provider: AIProvider): string | undefined {
	return (PROVIDER_CATALOGUE[provider] as ProviderMeta).badge;
}
export function getProviderBadgeColor(provider: AIProvider): string | undefined {
	return (PROVIDER_CATALOGUE[provider] as ProviderMeta).badgeColor;
}
export function getProviderSetupUrl(provider: AIProvider): string | undefined {
	return (PROVIDER_CATALOGUE[provider] as ProviderMeta).setupUrl;
}
export function getProviderHelperText(provider: AIProvider): string | undefined {
	return (PROVIDER_CATALOGUE[provider] as ProviderMeta).helperText;
}

export const PROVIDER_CATALOGUE = {
	gemini: {
		name: 'Google Gemini',
		models: ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.0-flash'],
		defaultModel: 'gemini-2.5-flash',
		requiresApiKey: true
	},
	mistral: {
		name: 'Mistral AI',
		models: ['mistral-small-latest', 'mistral-medium-latest', 'mistral-large-latest'],
		defaultModel: 'mistral-small-latest',
		requiresApiKey: true
	},
	grok: {
		name: 'Grok (xAI)',
		models: ['grok-2', 'grok-2-mini'],
		defaultModel: 'grok-2-mini',
		requiresApiKey: true
	},
	deepseek: {
		name: 'DeepSeek',
		models: ['deepseek-chat', 'deepseek-reasoner'],
		defaultModel: 'deepseek-chat',
		requiresApiKey: true
	},
	ollama: {
		name: 'Ollama (Local)',
		badge: 'FREE • LOCAL',
		badgeColor: 'green',
		models: [
			'gemma4:e4b',
			'gemma4:e2b',
			'llama3.2',
			'llama3.2:7b',
			'codellama',
			'mistral',
			'gemma2',
			'custom'
		],
		modelOptions: [
			{ id: 'gemma4:e4b', name: 'Gemma 4 E4B (Recommended)' },
			{ id: 'gemma4:e2b', name: 'Gemma 4 E2B (Lightweight)' },
			{ id: 'llama3.2', name: 'Llama 3.2 3B' },
			{ id: 'llama3.2:7b', name: 'Llama 3.2 7B' },
			{ id: 'codellama', name: 'Code Llama' },
			{ id: 'mistral', name: 'Mistral 7B' },
			{ id: 'gemma2', name: 'Gemma 2' },
			{ id: 'custom', name: 'Custom (type model name)' }
		],
		defaultModel: 'gemma4:e4b',
		requiresApiKey: false,
		endpoint: 'http://localhost:11434/v1/chat/completions',
		setupUrl: 'https://ollama.ai',
		isLocal: true
	},
	lmstudio: {
		name: 'LMStudio (Local)',
		badge: 'FREE • PRIVATE',
		badgeColor: 'violet',
		models: [
			'google/gemma-4-e4b',
			'google/gemma-4-e2b',
			'google/gemma-4-26b-a4b',
			'custom'
		],
		modelOptions: [
			{ id: 'google/gemma-4-e4b', name: 'Gemma 4 E4B — Recommended (5.9GB)' },
			{ id: 'google/gemma-4-e2b', name: 'Gemma 4 E2B — Lightweight (4.2GB)' },
			{ id: 'google/gemma-4-26b-a4b', name: 'Gemma 4 26B — Best Quality (17GB)' },
			{ id: 'custom', name: 'Custom (type loaded model name)' }
		],
		defaultModel: 'google/gemma-4-e4b',
		requiresApiKey: false,
		endpoint: 'http://127.0.0.1:1234/v1',
		setupUrl: 'https://lmstudio.ai',
		helperText:
			'Tip: Download Gemma 4 E4B from LMStudio for best results. Supports code generation, reasoning, and 128K context window. Apache 2.0 license — free for any use.',
		isLocal: true
	}
} as const satisfies Record<AIProvider, ProviderMeta>;

export function getModelsForProvider(provider: AIProvider): string[] {
	return [...PROVIDER_CATALOGUE[provider].models];
}

export function getModelOptionsForProvider(provider: AIProvider): ModelOption[] {
	const meta = PROVIDER_CATALOGUE[provider];
	if (meta.modelOptions) {
		return [...meta.modelOptions];
	}
	return meta.models.map((m) => ({ id: m, name: m }));
}

export function isLocalProvider(provider: AIProvider): boolean {
	return PROVIDER_CATALOGUE[provider].isLocal === true;
}

export function requiresApiKey(provider: AIProvider): boolean {
	return PROVIDER_CATALOGUE[provider].requiresApiKey;
}
