<script lang="ts">
	import { focusable } from "@fluxgit/ui/focus/focusable";
	import type { Snippet } from "svelte";

	type Props = {
		content: Snippet;
		details: Snippet;
		selected?: boolean;
		onclick?: () => void;
		testId?: string;
	};

	const { content, details, selected, onclick, testId }: Props = $props();
</script>

<div
	data-testid={testId}
	role="presentation"
	{onclick}
	class="branches-list-card"
	class:selected
	use:focusable={{
		focusable: true,
		onAction: () => onclick?.(),
	}}
>
	<div class="branches-list-card__content">
		{@render content()}
	</div>

	<div class="text-12 branches-list-card__details">
		{@render details()}
	</div>
</div>

<style lang="postcss">
	/* TARGET CARD */
	.branches-list-card {
		display: flex;
		position: relative;
		flex-direction: column;
		padding: 14px;
		gap: 10px;
		background-color: var(--clr-bg-1);
		cursor: pointer;
		border-radius: var(--radius-m);
		box-shadow: var(--clr-shadow);
		margin: 8px;
		border: 1px solid var(--clr-border-1);

		&::after {
			position: absolute;
			top: 0;
			left: 0;
			width: 4px;
			height: 100%;
			border-radius: var(--radius-m) 0 0 var(--radius-m);
			background-color: var(--clr-theme-pop-element);
			content: "";
			opacity: 0;
			transition: opacity var(--transition-medium);
		}

		&:hover {
			background-color: var(--hover-bg-1);
		}
	}

	.branches-list-card__content {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.branches-list-card__details {
		display: flex;
		position: relative;
		align-items: center;
		margin-top: 2px;
		padding-top: 10px;
		gap: 6px;
		color: var(--clr-text-2);

		&::before {
			position: absolute;
			top: 0;
			left: 0;
			flex-shrink: 0;
			width: 100%;
			height: 1px;
			background-color: var(--clr-border-1);
			content: "";
		}

		&:empty {
			display: none;
		}
	}

	.selected {
		background-color: #E8F9FF;
		border-color: var(--clr-theme-pop-element);

		&::after {
			opacity: 1;
		}
	}
</style>
