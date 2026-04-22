import { GoogleGenAI } from '@google/genai';
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

export class GeminiProviderClient implements AIProviderClient {
	private client: GoogleGenAI;
	private modelName: string;

	constructor(apiKey: string, model: string) {
		this.client = new GoogleGenAI({ apiKey });
		this.modelName = model;
	}

	async generateCommitMessage(diff: string): Promise<string> {
		const prompt = COMMIT_MESSAGE_PROMPT.replace('%{diff}', diff);

		const result = await this.client.models.generateContent({
			model: this.modelName,
			contents: prompt
		});
		return (result.text ?? '').trim();
	}

	async generateAgentResponse(messages: ChatMessage[], context: RepoContext): Promise<string> {
		const systemMessages = messages.filter((m) => m.role === 'system');
		const nonSystemMessages = messages.filter((m) => m.role !== 'system');

		const systemInstruction = [
			`Repository: ${context.repoPath}`,
			`Current branch: ${context.currentBranch}`,
			...systemMessages.map((m) => m.content)
		].join('\n');

		const history = nonSystemMessages.slice(0, -1).map((m) => ({
			role: m.role === 'assistant' ? ('model' as const) : ('user' as const),
			parts: [{ text: m.content }]
		}));

		const lastMessage = nonSystemMessages[nonSystemMessages.length - 1];
		if (!lastMessage) {
			throw new Error('No messages to send');
		}

		const chat = this.client.chats.create({
			model: this.modelName,
			history,
			config: { systemInstruction }
		});

		const result = await chat.sendMessage({ message: lastMessage.content });
		return result.text ?? '';
	}
}
