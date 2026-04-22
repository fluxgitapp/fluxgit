<script lang="ts">
	import { getPatchStatus, type PatchCommit } from "@fluxgit/shared/patches/types";
	import { CommitStatusBadge } from "@fluxgit/ui";

	interface Props {
		patchCommit: PatchCommit;
	}

	const { patchCommit }: Props = $props();

	const status = $derived(getPatchStatus(patchCommit));
</script>

<CommitStatusBadge {status} />
