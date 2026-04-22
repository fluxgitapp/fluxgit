import type { PageLoad } from "./$types";
import type { ProjectParameters } from "@fluxgit/shared/routing/webRoutes.svelte";

// eslint-disable-next-line func-style
export const load: PageLoad<ProjectParameters> = async ({ params }) => {
	return {
		ownerSlug: params.ownerSlug,
		projectSlug: params.projectSlug,
	};
};
