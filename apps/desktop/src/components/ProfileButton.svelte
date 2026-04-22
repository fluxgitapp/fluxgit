<script lang="ts">
	import { useSettingsModal } from "$lib/settings/settingsModal.svelte";
	import { USER } from "$lib/user/user";
	import { inject } from "@fluxgit/core/context";
	import { ProfileButton } from "@fluxgit/ui";

	const user = inject(USER);
	const { openGeneralSettings } = useSettingsModal();
</script>

<ProfileButton srcUrl={$user?.picture ?? null} onclick={async () => openGeneralSettings()} />
