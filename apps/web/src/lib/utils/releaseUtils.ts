import type { Build, Release } from "$lib/types/releases";

const GITHUB_API_URL = "https://api.github.com/repos/fluxgitapp/fluxgit/releases";

export const RELEASE_OS_ORDER = ["darwin", "linux", "windows"] as const;

// ─── Asset → Build mapping ────────────────────────────────────────────────────

/**
 * Detect OS from a GitHub release asset filename.
 */
function detectOS(filename: string): Build["os"] | null {
	const f = filename.toLowerCase();
	if (f.includes("darwin") || f.includes("macos") || f.includes(".dmg") || f.includes(".app")) return "darwin";
	if (f.includes("linux") || f.includes(".deb") || f.includes(".rpm") || f.includes(".appimage")) return "linux";
	if (f.includes("windows") || f.includes("win") || f.includes(".msi") || f.includes(".exe") || f.includes("setup")) return "windows";
	return null;
}

/**
 * Detect architecture from a GitHub release asset filename.
 */
function detectArch(filename: string): Build["arch"] {
	const f = filename.toLowerCase();
	if (f.includes("aarch64") || f.includes("arm64")) return "aarch64";
	return "x86_64";
}

/**
 * Map a GitHub release asset to a Build object. Returns null if the asset
 * is not a recognized installer (e.g. source archives, checksums, etc.).
 */
function assetToBuild(asset: { name: string; browser_download_url: string }): Build | null {
	const os = detectOS(asset.name);
	if (!os) return null;

	// Skip updater zip bundles — they're not direct installers
	if (asset.name.endsWith(".zip") && !asset.name.includes("AppImage")) return null;
	// Skip checksum files
	if (asset.name.endsWith(".sig") || asset.name.endsWith(".sha256") || asset.name.endsWith(".sha512")) return null;

	const arch = detectArch(asset.name);

	return {
		os,
		arch,
		url: asset.browser_download_url,
		file: asset.name,
		platform: `${os}-${arch}`,
	};
}

/**
 * Map a GitHub API release object to our Release type.
 */
function githubReleaseToRelease(ghRelease: any): Release | null {
	// Skip draft releases
	if (ghRelease.draft) return null;

	const version: string = ghRelease.tag_name?.replace(/^v/, "") ?? "";
	if (!version) return null;

	const isNightly = ghRelease.prerelease || ghRelease.tag_name?.includes("nightly");
	const channel = isNightly ? "nightly" : "release";

	const builds: Build[] = (ghRelease.assets ?? [])
		.map(assetToBuild)
		.filter((b: Build | null): b is Build => b !== null);

	return {
		version,
		notes: ghRelease.body ?? null,
		sha: ghRelease.target_commitish ?? "",
		channel,
		build_version: version,
		released_at: ghRelease.published_at ?? ghRelease.created_at ?? new Date().toISOString(),
		builds,
	};
}

// ─── Core fetch ───────────────────────────────────────────────────────────────

/**
 * Fetch releases from the GitHub Releases API.
 */
export async function fetchReleases(
	limit: number = 10,
	channel: "release" | "nightly" = "release",
): Promise<Release[]> {
	const perPage = Math.min(limit * 2, 100); // fetch extra to account for filtering
	const response = await fetch(`${GITHUB_API_URL}?per_page=${perPage}`, {
		headers: {
			Accept: "application/vnd.github+json",
			"X-GitHub-Api-Version": "2022-11-28",
		},
	});

	if (!response.ok) {
		console.error(`GitHub releases API error: ${response.status}`);
		return [];
	}

	const data = await response.json();
	if (!Array.isArray(data)) return [];

	return data
		.map(githubReleaseToRelease)
		.filter((r): r is Release => r !== null)
		.filter((r) => (channel === "nightly" ? r.channel === "nightly" : r.channel === "release"))
		.slice(0, limit);
}

// ─── Utilities ────────────────────────────────────────────────────────────────

/**
 * Process builds by filtering out .zip files, removing duplicates, and sorting by platform.
 */
export function processBuilds(builds: Build[]): Build[] {
	return builds
		.filter((build) => !build.url.endsWith(".zip"))
		.filter((build, index, self) => self.findIndex((b) => b.url === build.url) === index)
		.sort((a, b) => b.platform.localeCompare(a.platform));
}

/**
 * Find a specific build based on OS, architecture, and optional file includes criteria.
 */
export function findBuild(
	builds: Build[],
	os: string,
	arch?: "x86_64" | "aarch64",
	fileIncludes?: string,
): Build | undefined {
	return builds.find(
		(build: Build) =>
			build.os === os &&
			(!arch || build.arch === arch) &&
			(!fileIncludes || build.file.includes(fileIncludes)),
	);
}

/**
 * Remove duplicate releases based on version, keeping the first occurrence.
 */
export function deduplicateReleases(releases: Release[]): Release[] {
	return releases.filter(
		(release, index, self) => self.findIndex((r) => r.version === release.version) === index,
	);
}

/**
 * Process all releases by applying processBuilds to each release's builds array and removing duplicates.
 */
export function processAllReleases(releases: Release[]): Release[] {
	const processedReleases = releases.map((release) => ({
		...release,
		builds: processBuilds(release.builds),
	}));
	return deduplicateReleases(processedReleases);
}

/**
 * Fetch and process releases from GitHub.
 */
export async function fetchAndProcessReleases(
	limit: number = 10,
	channel: "release" | "nightly" = "release",
): Promise<Release[]> {
	const releases = await fetchReleases(limit, channel);
	return processAllReleases(releases);
}

// ─── Latest release build map ─────────────────────────────────────────────────

export interface LatestReleaseBuilds {
	darwin_x86_64: Build | undefined;
	darwin_aarch64: Build | undefined;
	windows_x86_64: Build | undefined;
	linux_appimage_x86_64: Build | undefined;
	linux_deb_x86_64: Build | undefined;
	linux_rpm_x86_64: Build | undefined;
	linux_appimage_aarch64: Build | undefined;
	linux_deb_aarch64: Build | undefined;
	linux_rpm_aarch64: Build | undefined;
	linux_cli_x86_64: Build | undefined;
	linux_cli_aarch64: Build | undefined;
}

/**
 * Find a Linux-specific CLI-only build (not AppImage, deb, or rpm) for a given arch.
 */
export function findLinuxCliBuild(builds: Build[], arch: "x86_64" | "aarch64"): Build | undefined {
	return builds.find(
		(build) => build.os === "linux" && build.arch === arch && build.file.toLowerCase() === "but",
	);
}

export function createLatestReleaseBuilds(latestRelease: Release): LatestReleaseBuilds {
	return {
		darwin_x86_64: findBuild(latestRelease.builds, "darwin", "x86_64"),
		darwin_aarch64: findBuild(latestRelease.builds, "darwin", "aarch64"),
		windows_x86_64: findBuild(latestRelease.builds, "windows", "x86_64"),
		linux_appimage_x86_64: findBuild(latestRelease.builds, "linux", "x86_64", "AppImage"),
		linux_deb_x86_64: findBuild(latestRelease.builds, "linux", "x86_64", "deb"),
		linux_rpm_x86_64: findBuild(latestRelease.builds, "linux", "x86_64", "rpm"),
		linux_appimage_aarch64: findBuild(latestRelease.builds, "linux", "aarch64", "AppImage"),
		linux_deb_aarch64: findBuild(latestRelease.builds, "linux", "aarch64", "deb"),
		linux_rpm_aarch64: findBuild(latestRelease.builds, "linux", "aarch64", "rpm"),
		linux_cli_x86_64: findLinuxCliBuild(latestRelease.builds, "x86_64"),
		linux_cli_aarch64: findLinuxCliBuild(latestRelease.builds, "aarch64"),
	};
}
