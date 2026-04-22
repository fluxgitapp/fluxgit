import { listProjectsNapi } from "@fluxgit/but-sdk";

export function listProjects() {
	return listProjectsNapi([]);
}
