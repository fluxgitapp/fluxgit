export type AIProvider = 'gemini' | 'mistral' | 'grok' | 'deepseek' | 'ollama' | 'lmstudio';

export type ProviderTestStatus = 'untested' | 'passed' | 'failed';

export interface ChatMessage {
	role: 'user' | 'assistant' | 'system';
	content: string;
}

export interface RepoContext {
	repoPath: string;
	currentBranch: string;
	recentCommits?: string[];
}

export interface AIProviderClient {
	generateCommitMessage(diff: string): Promise<string>;
	generateAgentResponse(messages: ChatMessage[], context: RepoContext): Promise<string>;
}
