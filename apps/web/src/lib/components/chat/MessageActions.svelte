<script lang="ts">
	import { inject } from "@fluxgit/core/context";
	import { CHAT_CHANNELS_SERVICE } from "@fluxgit/shared/chat/chatChannelsService";

	import { Button } from "@fluxgit/ui";
	import type { ChatMessage } from "@fluxgit/shared/chat/types";

	interface Props {
		projectId: string;
		changeId?: string;
		message: ChatMessage;
	}

	const { message, projectId, changeId }: Props = $props();

	const chatChannelService = inject(CHAT_CHANNELS_SERVICE);

	let isResolving = $state<boolean>(false);

	async function resolveIssue() {
		if (isResolving) return;
		isResolving = true;
		try {
			await chatChannelService.patchChatMessage({
				projectId,
				changeId,
				messageUuid: message.uuid,
				resolved: true,
			});
		} finally {
			isResolving = false;
		}
	}
</script>

{#if message.issue && !message.resolved}
	<div class="chat-message-actions">
		<Button style="gray" kind="outline" icon="tick" loading={isResolving} onclick={resolveIssue}
			>Resolve issue</Button
		>
	</div>
{/if}
