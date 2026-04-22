<script lang="ts">
	import { goto } from "$app/navigation";
	import CreateBranchModal from "$components/CreateBranchModal.svelte";
	import IntegrateUpstreamModal from "$components/IntegrateUpstreamModal.svelte";
	import SyncButton from "$components/SyncButton.svelte";
	import { BACKEND } from "$lib/backend";
	import { BASE_BRANCH_SERVICE } from "$lib/baseBranch/baseBranchService.svelte";
	import { SETTINGS_SERVICE } from "$lib/config/appSettingsV2";
	import { projectDisableCodegen } from "$lib/config/config";
	import { ircEnabled } from "$lib/config/uiFeatureFlags";
	import { IRC_SERVICE } from "$lib/irc/ircService.svelte";
	import { MODE_SERVICE } from "$lib/mode/modeService";
	import { handleAddProjectOutcome } from "$lib/project/project";
	import { PROJECTS_SERVICE } from "$lib/project/projectsService";
	import { ircPath, isWorkspacePath, projectPath } from "$lib/routes/routes.svelte";
	import { SHORTCUT_SERVICE } from "$lib/shortcuts/shortcutService";
	import { useCreateAiStack } from "$lib/stacks/createAiStack.svelte";
	import { inject } from "@fluxgit/core/context";
	import { reactive } from "@fluxgit/shared/reactiveUtils.svelte";
	import {
		Button,
		Icon,
		NotificationButton,
		OptionsGroup,
		Select,
		SelectItem,
		TestId,
		Tooltip,
	} from "@fluxgit/ui";
	import { focusable } from "@fluxgit/ui/focus/focusable";

	type Props = {
		projectId: string;
		projectTitle: string;
		actionsDisabled?: boolean;
	};

	const { projectId, projectTitle, actionsDisabled = false }: Props = $props();

	const { createAiStack } = useCreateAiStack(reactive(() => projectId));

	const projectsService = inject(PROJECTS_SERVICE);
	const baseBranchService = inject(BASE_BRANCH_SERVICE);
	const ircService = inject(IRC_SERVICE);
	const settingsService = inject(SETTINGS_SERVICE);
	const modeService = inject(MODE_SERVICE);
	const shortcutService = inject(SHORTCUT_SERVICE);
	const baseReponse = $derived(projectId ? baseBranchService.baseBranch(projectId) : undefined);
	const base = $derived(baseReponse?.response);
	const settingsStore = $derived(settingsService.appSettings);
	const singleBranchMode = $derived($settingsStore?.featureFlags.singleBranch ?? false);
	const useCustomTitleBar = $derived(!($settingsStore?.ui.useNativeTitleBar ?? false));
	const backend = inject(BACKEND);
	const codegenDisabled = $derived(projectDisableCodegen(projectId));

	const mode = $derived(modeService.mode(projectId));
	const currentMode = $derived(mode.response);
	const currentBranchName = $derived.by(() => {
		if (currentMode?.type === "OpenWorkspace") {
			return "fluxgit/workspace";
		} else if (currentMode?.type === "OutsideWorkspace") {
			return currentMode.subject.branchName || "detached HEAD";
		} else if (currentMode?.type === "Edit") {
			return "fluxgit/edit";
		}
		return "fluxgit/workspace";
	});

	const isNotInWorkspace = $derived(
		currentMode?.type !== "OpenWorkspace" && currentMode?.type !== "Edit",
	);
	const [switchBackToWorkspace, workspaceSwitch] = baseBranchService.switchBackToWorkspace;

	async function switchToWorkspace() {
		if (base) {
			await switchBackToWorkspace({
				projectId,
			});
		}
	}

	const upstreamCommits = $derived(base?.behind ?? 0);
	const isHasUpstreamCommits = $derived(upstreamCommits > 0);

	let modal = $state<ReturnType<typeof IntegrateUpstreamModal>>();

	const projects = $derived(projectsService.projects());

	const mappedProjects = $derived(
		projects.response?.map((project) => ({
			value: project.id,
			label: project.title,
		})) || [],
	);

	let newProjectLoading = $state(false);
	let projectSelectorOpen = $state(false);

	const unreadCount = $derived(ircService.unreadCount());
	const isNotificationsUnread = $derived(unreadCount.current > 0);

	const isOnWorkspacePage = $derived(!!isWorkspacePath());

	function openModal() {
		modal?.show();
	}

	let createBranchModal = $state<CreateBranchModal>();

	$effect(() => shortcutService.on("create-branch", () => createBranchModal?.show()));
	$effect(() =>
		shortcutService.on("create-dependent-branch", () => createBranchModal?.show("dependent")),
	);
</script>

{#if projectId}
	<IntegrateUpstreamModal bind:this={modal} {projectId} />
{/if}

<div
	class="chrome-header"
	class:mac={backend.platformName === "macos"}
	data-tauri-drag-region={useCustomTitleBar}
	class:single-branch={singleBranchMode}
	use:focusable
>
	<div class="chrome-left" data-tauri-drag-region={useCustomTitleBar}>
		<div class="chrome-left-buttons" class:has-traffic-lights={useCustomTitleBar}>
			<div class="chrome-header-item">
				<SyncButton {projectId} disabled={actionsDisabled} />
			</div>

			{#if isHasUpstreamCommits}
				<div class="chrome-header-item">
					<Button
						testId={TestId.IntegrateUpstreamCommitsButton}
						kind="outline"
						style="pop"
						onclick={openModal}
						disabled={!projectId || actionsDisabled}
					>
						{upstreamCommits} upstream {upstreamCommits === 1 ? "commit" : "commits"}
					</Button>
				</div>
			{:else}
				<div class="chrome-up-to-date-pill">
					<Icon name="tick" />
					<span class="text-12">You’re up to date</span>
				</div>
			{/if}
		</div>
	</div>

	<div class="chrome-center" data-tauri-drag-region={useCustomTitleBar}>
		<div class="chrome-selector-wrapper">
			<Select
				searchable
				value={projectId}
				options={mappedProjects}
				loading={newProjectLoading}
				disabled={newProjectLoading}
				onselect={(value: string, modifiers?) => {
					if (modifiers?.meta) {
						projectsService.openProjectInNewWindow(value);
					} else {
						goto(projectPath(value));
					}
				}}
				ontoggle={(isOpen) => (projectSelectorOpen = isOpen)}
				popupAlign="center"
				customWidth={280}
			>
				{#snippet customSelectButton()}
					<Button
						testId={TestId.ChromeHeaderProjectSelector}
						reversedDirection
						width="auto"
						kind="outline"
						isDropdown
						dropdownOpen={projectSelectorOpen}
						class="project-selector-btn"
					>
						{#snippet custom()}
							<div class="project-selector-btn__content">
								<Icon name="repo" color="var(--clr-text-2)" />
								<span class="text-12 text-bold">{projectTitle}</span>
							</div>
						{/snippet}
					</Button>
				{/snippet}

				{#snippet itemSnippet({ item, highlighted })}
					<SelectItem selected={item.value === projectId} {highlighted}>
						{item.label}
					</SelectItem>
				{/snippet}

				<OptionsGroup>
					<SelectItem
						icon="plus"
						testId={TestId.ChromeHeaderProjectSelectorAddLocalProject}
						loading={newProjectLoading}
						onClick={async () => {
							newProjectLoading = true;
							try {
								const outcome = await projectsService.addProject();
								if (!outcome) {
									// User cancelled the project creation
									newProjectLoading = false;
									return;
								}

								handleAddProjectOutcome(outcome, (project) => goto(projectPath(project.id)));
							} finally {
								newProjectLoading = false;
							}
						}}
					>
						Add local repository
					</SelectItem>
					<SelectItem
						icon="clone"
						onClick={() => {
							goto("/onboarding/clone");
						}}
					>
						Clone repository
					</SelectItem>
				</OptionsGroup>
			</Select>
			{#if singleBranchMode}
				<Tooltip text="Current branch">
					<div class="chrome-current-branch">
						<div class="chrome-current-branch__content">
							<Icon name="branch" color="var(--clr-text-2)" />
							<span class="text-12 text-bold clr-text-2 truncate">{currentBranchName}</span>
							{#if isNotInWorkspace}
								<span class="text-12 text-bold clr-text-2 op-60"> read-only </span>
							{/if}
						</div>
					</div>
				</Tooltip>
			{/if}
		</div>

		{#if currentMode && isNotInWorkspace}
			<Tooltip text="Switch back to fluxgit/workspace">
				<Button
					kind="outline"
					testId={TestId.ChromeHeaderSwitchBackToWorkspaceButton}
					icon="undo"
					style="warning"
					onclick={switchToWorkspace}
					reversedDirection
					disabled={workspaceSwitch.current.isLoading}
				>
					Back to workspace
				</Button>
			</Tooltip>
		{/if}
	</div>

	<div class="chrome-right" data-tauri-drag-region={useCustomTitleBar}>
		{#if $ircEnabled}
			<NotificationButton
				hasUnread={isNotificationsUnread}
				onclick={() => {
					goto(ircPath(projectId));
				}}
			/>
		{/if}
		{#if isOnWorkspacePage}
			<Button
				testId={TestId.ChromeHeaderCreateBranchButton}
				kind="outline"
				style="pop"
				icon="plus"
				hotkey="⌘B"
				reversedDirection
				onclick={() => createBranchModal?.show()}
			>
				Create branch
			</Button>
			{#if !$codegenDisabled}
				<Button
					testId={TestId.ChromeHeaderCreateCodegenSessionButton}
					kind="outline"
					style="purple"
					tooltip="New Codegen Session"
					icon="ai-plus"
					onclick={() => {
						createAiStack();
					}}
				/>
			{/if}
		{/if}
	</div>
</div>

<CreateBranchModal bind:this={createBranchModal} {projectId} />

<style>
	.chrome-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 10px 14px;
		overflow: hidden;
		gap: 12px;
		background-color: var(--clr-bg-1);
		border-bottom: 1px solid var(--clr-border-1);
	}

	.chrome-selector-wrapper {
		display: flex;
		position: relative;
		overflow: hidden;
	}

	.chrome-current-branch {
		display: flex;
		align-items: center;
		padding: 0 16px;
		height: 32px;
		overflow: hidden;
		border: 1px solid var(--clr-border-1);
		border-radius: 100px;
		background-color: var(--clr-bg-2);
		margin-left: -16px;
		z-index: 1;
	}

	.chrome-up-to-date-pill {
		display: flex;
		align-items: center;
		padding: 0 12px;
		height: 32px;
		gap: 6px;
		border-radius: 100px;
		background-color: var(--clr-bg-2);
		border: 1px solid var(--clr-border-1);
		color: var(--clr-text-2);
	}

	.chrome-header-item {
		display: flex;
		align-items: center;
	}

	:global(.chrome-header .project-selector-btn) {
		border-radius: 100px;
		padding-left: 16px;
		padding-right: 12px;
		height: 32px;
		background-color: var(--clr-bg-1);
		border: 1px solid var(--clr-border-1);
		z-index: 2;
	}

	:global(.chrome-header.single-branch .project-selector-btn) {
		border-top-right-radius: 0;
		border-bottom-right-radius: 0;
		border-right: none;
	}

	.chrome-current-branch__content {
		display: flex;
		align-items: center;
		overflow: hidden;
		gap: 4px;
		text-wrap: nowrap;
	}

	.chrome-left {
		display: flex;
		gap: 14px;
	}

	.chrome-center {
		display: flex;
		flex-shrink: 1;
		overflow: hidden;
		gap: 8px;
	}

	.chrome-right {
		display: flex;
		justify-content: right;
		gap: 4px;
	}

	/** Flex basis 0 means they grow by the same amount. */
	.chrome-right,
	.chrome-left {
		flex-grow: 1;
		flex-basis: 0;
		min-width: max-content;
	}

	.chrome-left-buttons {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	/** Mac padding added here to not affect header flex-box sizing, only applied when using custom title bar. */
	.mac .chrome-left-buttons.has-traffic-lights {
		padding-left: 70px;
	}

	.chrome-you-are-up-to-date {
		display: flex;
		align-items: center;
		padding: 0 4px;
		gap: 4px;
		color: var(--clr-text-2);
	}
</style>
