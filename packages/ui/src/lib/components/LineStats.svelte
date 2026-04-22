<script lang="ts">
	import Tooltip from "$components/Tooltip.svelte";
	type Props = {
		linesAdded: number;
		linesRemoved: number;
	};

	const { linesAdded, linesRemoved }: Props = $props();
</script>

{#if linesAdded > 0 || linesRemoved > 0}
	<Tooltip text="Lines added/removed">
		<div class="line-stats text-11 text-semibold">
			{#if linesAdded > 0}
				<span class="added">+{linesAdded}</span>
			{/if}
			{#if linesRemoved > 0}
				<span class="removed">-{linesRemoved}</span>
			{/if}
		</div>
	</Tooltip>
{/if}

<style lang="postcss">
	.line-stats {
		display: flex;
		align-items: center;
		width: fit-content;
		padding: 2px 6px;
		gap: 6px;
		border: 1px solid var(--clr-border-1);
		border-radius: var(--radius-ml);
		background-color: var(--clr-bg-1);
		box-shadow: var(--clr-shadow);

		& .added {
			color: var(--clr-theme-safe-element);
		}
		& .removed {
			color: var(--clr-theme-danger-element);
		}
	}
</style>
