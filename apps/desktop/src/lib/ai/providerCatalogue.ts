import type { AIProvider } from './aiProviderClient';

export interface ProviderMeta {
	name: string;
	models: readonly string[];
	defaultModel: string;
}

export const PROVIDER_CATALOGUE = {
	gemini: {
		name: 'Google Gemini',
		models: ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.0-flash'],
		defaultModel: 'gemini-2.5-flash'
	},
	mistral: {
		name: 'Mistral AI',
		models: ['mistral-small-latest', 'mistral-medium-latest', 'mistral-large-latest'],
		defaultModel: 'mistral-small-latest'
	},
	grok: {
		name: 'Grok (xAI)',
		models: ['grok-2', 'grok-2-mini'],
		defaultModel: 'grok-2-mini'
	},
	deepseek: {
		name: 'DeepSeek',
		models: ['deepseek-chat', 'deepseek-reasoner'],
		defaultModel: 'deepseek-chat'
	}
} as const satisfies Record<AIProvider, ProviderMeta>;

export function getModelsForProvider(provider: AIProvider): string[] {
	return [...PROVIDER_CATALOGUE[provider].models];
}
