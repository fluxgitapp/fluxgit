<script lang="ts">
	import { inject } from "@fluxgit/core/context";
	import RegisterInterest from "@fluxgit/shared/interest/RegisterInterest.svelte";
	import Loading from "@fluxgit/shared/network/Loading.svelte";
	import { HTTP_CLIENT } from "@fluxgit/shared/network/httpClient";
	import CreateOrganizationModal from "@fluxgit/shared/organizations/CreateOrganizationModal.svelte";
	import JoinOrganizationModal from "@fluxgit/shared/organizations/JoinOrganizationModal.svelte";
	import OrganizationModal from "@fluxgit/shared/organizations/OrganizationModal.svelte";
	import { ORGANIZATION_SERVICE } from "@fluxgit/shared/organizations/organizationService";
	import { organizationTable } from "@fluxgit/shared/organizations/organizationsSlice";
	import { APP_STATE } from "@fluxgit/shared/redux/store.svelte";
	import { Button, CardGroup } from "@fluxgit/ui";

	const organizationService = inject(ORGANIZATION_SERVICE);
	const appState = inject(APP_STATE);
	const httpClient = inject(HTTP_CLIENT);
	const authenticated = httpClient.authenticationAvailable;

	const organizationsInterest = organizationService.getOrganizationListingInterest();
	const organizations = $derived(organizationTable.selectors.selectAll(appState.organizations));

	let createOrganizationModal = $state<CreateOrganizationModal>();
</script>

{#if $authenticated}
	<RegisterInterest interest={organizationsInterest} />
{/if}

<CreateOrganizationModal bind:this={createOrganizationModal} />

<JoinOrganizationModal />
<Button onclick={() => createOrganizationModal?.show()}>Create an Organizaton</Button>

<CardGroup>
	{#each organizations as loadableOrganization}
		<CardGroup.Item alignment="center">
			{#snippet title()}
				<Loading loadable={loadableOrganization}>
					{#snippet children(organization)}
						<div class="inline">
							<p class="text-15 text-bold">{organization.name || organization.slug}</p>
							{#if organization.name}
								<p class="text-13">{organization.slug}</p>
							{/if}
						</div>
					{/snippet}
				</Loading>
			{/snippet}

			{#snippet actions()}
				<OrganizationModal slug={loadableOrganization.id} />
			{/snippet}
		</CardGroup.Item>
	{/each}
</CardGroup>

<style lang="postcss">
	.inline {
		display: flex;
		flex-grow: 1;
		align-items: center;
		gap: 8px;
	}
</style>
