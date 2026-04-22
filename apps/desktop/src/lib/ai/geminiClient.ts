import {
	SHORT_DEFAULT_BRANCH_TEMPLATE,
	SHORT_DEFAULT_COMMIT_TEMPLATE,
	SHORT_DEFAULT_PR_TEMPLATE,
} from "$lib/ai/prompts";
import { type AIEvalOptions, type AIClient, type Prompt, type GeminiModelName } from "$lib/ai/types";
import { GoogleGenAI } from "@google/genai";

const DEFAULT_MAX_TOKENS = 1024;

export class GeminiClient implements AIClient {
	defaultCommitTemplate = SHORT_DEFAULT_COMMIT_TEMPLATE;
	defaultBranchTemplate = SHORT_DEFAULT_BRANCH_TEMPLATE;
	defaultPRTemplate = SHORT_DEFAULT_PR_TEMPLATE;

	private client: GoogleGenAI;
	private modelName: GeminiModelName;

	constructor(apiKey: string, modelName: GeminiModelName) {
		this.modelName = modelName;
		this.client = new GoogleGenAI({ apiKey });
	}

	async evaluate(prompt: Prompt, options?: AIEvalOptions): Promise<string> {
		const model = this.client.getGenerativeModel({
			model: this.modelName,
			generationConfig: {
				maxOutputTokens: options?.maxTokens ?? DEFAULT_MAX_TOKENS,
			},
		});

		// Map Prompt to Gemini's history format
		// Note: Gemini expects 'user' and 'model' roles.
		// Our PromptMessage has 'system', 'user', 'assistant'.
		const systemMessage = prompt.find((m) => m.role === "system");
		const otherMessages = prompt.filter((m) => m.role !== "system");

		const history = otherMessages.map((m) => ({
			role: m.role === "assistant" ? "model" as const : "user" as const,
			parts: [{ text: m.content }],
		}));

		// Create a chat session
		const chat = model.startChat({
			history: history.slice(0, -1),
			systemInstruction: systemMessage ? { parts: [{ text: systemMessage.content }] } : undefined,
		});

		const lastMessage = history[history.length - 1];
		if (!lastMessage) {
			throw new Error("No messages in history to evaluate");
		}

		if (options?.onToken) {
			const result = await chat.sendMessageStream(lastMessage.parts);
			const buffer: string[] = [];
			for await (const chunk of result.stream) {
				const chunkText = chunk.text();
				options.onToken(chunkText);
				buffer.push(chunkText);
			}
			return buffer.join("");
		} else {
			const result = await chat.sendMessage(lastMessage.parts);
			return result.response.text();
		}
	}
}
