<script lang="ts">
	import GitForm from "$components/GitForm.svelte";
	import PreferencesForm from "$components/PreferencesForm.svelte";
	import SettingsModalLayout from "$components/SettingsModalLayout.svelte";
	import AISettingsPanel from "$components/projectSettings/AISettingsPanel.svelte";
	import AgentSettings from "$components/projectSettings/AgentSettings.svelte";
	import GeneralSettings from "$components/projectSettings/GeneralSettings.svelte";
	import StreamRulesSettings from "$components/projectSettings/StreamRulesSettings.svelte";
	import { projectDisableCodegen } from "$lib/config/config";
	import {
		projectSettingsPages,
		type ProjectSettingsPageId,
	} from "$lib/settings/projectSettingsPages";
	import type { ProjectSettingsModalState } from "$lib/state/uiState.svelte";

	type Props = {
		data: ProjectSettingsModalState;
	};

	const { data }: Props = $props();

	const codegenDisabled = $derived(projectDisableCodegen(data.projectId));
	const pages = $derived(
		projectSettingsPages.filter((page) => page.id !== "agent" || !$codegenDisabled),
	);

	let currentSelectedId = $derived(data.selectedId || pages.at(0)?.id);

	function selectPage(pageId: ProjectSettingsPageId) {
		currentSelectedId = pageId;
	}
</script>

<SettingsModalLayout
	title="Project settings"
	{pages}
	selectedId={currentSelectedId}
	onSelectPage={selectPage}
>
	{#snippet content({ currentPage })}
		{#if currentPage}
			{#if currentPage.id === "project"}
				<GeneralSettings projectId={data.projectId} />
			{:else if currentPage.id === "git"}
				<GitForm projectId={data.projectId} />
			{:else if currentPage.id === "ai"}
				<AISettingsPanel projectId={data.projectId} />
			{:else if currentPage.id === "agent"}
				<AgentSettings />
			{:else if currentPage.id === "rules"}
				<StreamRulesSettings projectId={data.projectId} />
			{:else if currentPage.id === "experimental"}
				<PreferencesForm projectId={data.projectId} />
			{:else}
				Settings page {currentPage.id} not Found.
			{/if}
		{:else}
			Settings page {currentSelectedId} not Found.
		{/if}
	{/snippet}
</SettingsModalLayout>
