import { InjectionToken } from "@fluxgit/core/context";

export type ExternalLinkService = {
	open(href: string): void;
};

export const EXTERNAL_LINK_SERVICE = new InjectionToken<ExternalLinkService>("ExternalLinkService");
