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

	private async chat(
		messages: Array<{ role: string; content: string }>,
		options: { maxTokens?: number; timeoutMs?: number } = {}
	): Promise<string> {
		const headers: Record<string, string> = {
			'Content-Type': 'application/json'
		};

		if (!this.skipAuth && this.apiKey) {
			headers['Authorization'] = `Bearer ${this.apiKey}`;
		}

		const timeoutMs = options.timeoutMs ?? (this.skipAuth ? 120_000 : 30_000);
		const maxTokens = options.maxTokens ?? 1024;

		const response = await fetch(`${this.baseUrl}/chat/completions`, {
			method: 'POST',
			headers,
			mode: 'cors',
			body: JSON.stringify({ model: this.model, messages, max_tokens: maxTokens }),
			signal: AbortSignal.timeout(timeoutMs)
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
		const result = await this.chat([{ role: 'user', content: commitPrompt }], { maxTokens: 1024 });
		return result.trim();
	}

	async generateAgentResponse(messages: ChatMessage[], context: RepoContext): Promise<string> {
		// If the caller already included a system message, use messages as-is
		// Otherwise build a basic system message from context
		const hasSystemMsg = messages.length > 0 && messages[0].role === 'system';
		const isPing = context.repoPath === '' && context.currentBranch === '';

		let allMessages: Array<{ role: string; content: string }>;
		if (hasSystemMsg || isPing) {
			allMessages = messages;
		} else {
			const systemMessage = {
				role: 'system',
				content: `You are a helpful git assistant. Repository: ${context.repoPath}, Branch: ${context.currentBranch}`
			};
			allMessages = [systemMessage, ...messages];
		}

		return this.chat(allMessages, {
			maxTokens: isPing ? 5 : 1024,
			timeoutMs: isPing ? 30_000 : (this.skipAuth ? 120_000 : 30_000)
		});
	}
}
