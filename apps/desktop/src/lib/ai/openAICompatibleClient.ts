import type { AIProviderClient, ChatMessage, RepoContext } from './aiProviderClient';

const COMMIT_MESSAGE_PROMPT = `Please could you write a commit message for my changes.
Only respond with the commit message. Don't give any notes.
Explain what were the changes and why the changes were done.
Focus the most important changes.
Use the present tense.
Use a semantic commit prefix.
Hard wrap lines at 72 characters.
Ensure the title is only 50 characters.
Do not start any lines with the hash symbol.

Here is my git diff:
\`\`\`
%{diff}
\`\`\`
`;

export class OpenAICompatibleClient implements AIProviderClient {
	constructor(
		private baseUrl: string,
		private apiKey: string,
		private model: string,
		private providerName: string,
		/** If true, skip the Authorization header (for local providers like Ollama/LMStudio) */
		private skipAuth: boolean = false
	) {}

	private async chat(messages: Array<{ role: string; content: string }>): Promise<string> {
		const headers: Record<string, string> = {
			'Content-Type': 'application/json'
		};

		// Only add Authorization header for cloud providers that require an API key
		if (!this.skipAuth && this.apiKey) {
			headers['Authorization'] = `Bearer ${this.apiKey}`;
		}

		const response = await fetch(`${this.baseUrl}/chat/completions`, {
			method: 'POST',
			headers,
			body: JSON.stringify({ model: this.model, messages, max_tokens: 1024 }),
			signal: AbortSignal.timeout(30_000) // longer timeout for local models
		});

		if (!response.ok) {
			const body = await response.text();
			throw new Error(`[${this.providerName}] HTTP ${response.status}: ${body}`);
		}

		const data = await response.json();
		return data.choices[0].message.content as string;
	}

	async generateCommitMessage(diff: string): Promise<string> {
		const commitPrompt = COMMIT_MESSAGE_PROMPT.replace('%{diff}', diff);
		const result = await this.chat([{ role: 'user', content: commitPrompt }]);
		return result.trim();
	}

	async generateAgentResponse(messages: ChatMessage[], context: RepoContext): Promise<string> {
		const systemMessage = {
			role: 'system',
			content: `You are a helpful git assistant. Repository: ${context.repoPath}, Branch: ${context.currentBranch}`
		};
		const allMessages = [systemMessage, ...messages];
		return this.chat(allMessages);
	}
}
