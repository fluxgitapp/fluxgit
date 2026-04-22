import { getBaseURL, type FluxGit, startFluxGit } from "../src/setup.ts";
import { clickByTestId, sleep, waitForTestId, waitForTestIdToNotExist } from "../src/util.ts";
import { test } from "@playwright/test";

let fluxgit: FluxGit;

test.use({
	baseURL: getBaseURL(),
});

test.afterEach(async () => {
	await fluxgit?.destroy();
});

test("should be able to delete the last project gracefuly", async ({ page, context }, testInfo) => {
	const workdir = testInfo.outputPath("workdir");
	const configdir = testInfo.outputPath("config");
	fluxgit = await startFluxGit(workdir, configdir, context, undefined, {
		onboardingComplete: true,
	});

	await fluxgit.runScript("project-with-remote-branches.sh");

	await page.goto("/");

	// Should load the workspace
	await waitForTestId(page, "workspace-view");

	// Open project settings
	await clickByTestId(page, "chrome-sidebar-project-settings-button");

	await waitForTestId(page, "project-settings-modal");

	const deleteProjectButton = await waitForTestId(page, "project-delete-button");
	await deleteProjectButton.scrollIntoViewIfNeeded();
	await deleteProjectButton.click();

	await clickByTestId(page, "project-delete-modal-confirm");

	await waitForTestIdToNotExist(page, "project-delete-modal-confirm");
	await waitForTestIdToNotExist(page, "project-delete-button");
	await waitForTestIdToNotExist(page, "project-settings-modal");

	await waitForTestId(page, "welcome-page");
});

test("should be able to delete a project when multiple exist", async ({
	page,
	context,
}, testInfo) => {
	const workdir = testInfo.outputPath("workdir");
	const configdir = testInfo.outputPath("config");
	fluxgit = await startFluxGit(workdir, configdir, context, undefined, {
		onboardingComplete: true,
	});

	await fluxgit.runScript("two-projects-with-remote-branches.sh");

	await page.goto("/");

	// Should load the workspace
	await waitForTestId(page, "workspace-view");

	// Open project settings
	await clickByTestId(page, "chrome-sidebar-project-settings-button");

	await waitForTestId(page, "project-settings-modal");

	const deleteProjectButton = await waitForTestId(page, "project-delete-button");
	await deleteProjectButton.scrollIntoViewIfNeeded();
	await deleteProjectButton.click();

	await clickByTestId(page, "project-delete-modal-confirm");

	await waitForTestIdToNotExist(page, "project-delete-modal-confirm");
	await waitForTestIdToNotExist(page, "project-delete-button");
	await waitForTestIdToNotExist(page, "project-settings-modal");

	// Should still be in the workspace
	await waitForTestId(page, "workspace-view");

	await sleep(10000); // Wait for the project list to update
});
