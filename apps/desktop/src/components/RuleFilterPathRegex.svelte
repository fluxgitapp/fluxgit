<script lang="ts">
	import { Textbox } from "@fluxgit/ui";

	type Props = {
		value: string | undefined;
	};

	let { value = $bindable() }: Props = $props();
</script>

<Textbox {value} onchange={(v) => (value = v)} placeholder="Path: e.g. src/components" />
