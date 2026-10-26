import { definePlugin } from "emdash";
import type { PluginDescriptor, ResolvedPlugin } from "emdash";
import { version } from "../package.json";
import { createAdmin } from "./admin";
import { resolveConfig, type SiteBlocksOptions } from "./config";
import { PLUGIN_ID } from "./constants";
import { regionBlocks } from "./public";
import { createStore, type Collection, type StoredBlock } from "./store";

export type { SiteBlocksOptions } from "./config";
export type { BlockTypeDef, FieldDef, Region } from "./model";
export { BUILTIN_TYPES, DEFAULT_REGIONS } from "./model";

const STORAGE = { blocks: { indexes: ["region", "status", "createdAt"] } };

/**
 * The descriptor a site lists in its EmDash integration:
 *
 *   emdash({ plugins: [siteBlocks({ regions: [{ id: "above-header", label: "Above header" }] })] })
 *
 * Regions and extra block types are plain data. How a custom type looks on the page is decided in the theme,
 * with the `types` prop of <BlockRegion>.
 */
export function siteBlocks(options: SiteBlocksOptions = {}): PluginDescriptor<SiteBlocksOptions> {
	return {
		id: PLUGIN_ID,
		version,
		format: "native",
		entrypoint: "emdash-plugin-site-blocks",
		options,
		adminPages: [{ path: "/", label: "Site blocks", icon: "squares-four" }],
		storage: { blocks: { indexes: ["region", "status", "createdAt"] } },
	};
}

const storeFor = (ctx: { storage: Record<string, unknown> }) => createStore(ctx.storage.blocks as Collection<StoredBlock>);

export function createPlugin(options: SiteBlocksOptions = {}): ResolvedPlugin {
	const config = resolveConfig(options);
	return definePlugin({
		id: PLUGIN_ID,
		version,
		storage: STORAGE,
		routes: {
			// Read by <BlockRegion> on every page it renders: published blocks for one region and path, nothing else.
			region: { public: true, handler: async (ctx: any) => regionBlocks(storeFor(ctx), config, ctx.input) },
			// The Block Kit admin page.
			admin: { permission: "plugins:manage", handler: async (ctx: any) => createAdmin({ store: storeFor(ctx), config }).handle(ctx) },
		},
		admin: { pages: [{ path: "/", label: "Site blocks", icon: "squares-four" }] },
	}) as ResolvedPlugin;
}

export default createPlugin;
