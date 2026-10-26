import { BUILTIN_TYPES, DEFAULT_REGIONS, type BlockTypeDef, type Config, type Region } from "./model";

/** What a site passes to siteBlocks(). Both parts are plain data, so they survive being serialized into the plugin descriptor. */
export interface SiteBlocksOptions {
	regions?: Region[];
	types?: BlockTypeDef[];
	/** How long a server keeps the published blocks in memory before reading them again. Default 30; 0 turns the cache off. Edits made in the admin show at once on the server that took them. */
	cacheSeconds?: number;
}

const ID = /^[a-z][a-z0-9-]{0,40}$/;
const isRegion = (r: unknown): r is Region => !!r && typeof r === "object" && ID.test((r as Region).id) && typeof (r as Region).label === "string" && !!(r as Region).label.trim();
const isType = (t: unknown): t is BlockTypeDef => !!t && typeof t === "object" && ID.test((t as BlockTypeDef).id) && typeof (t as BlockTypeDef).label === "string" && Array.isArray((t as BlockTypeDef).fields);

export function resolveConfig(options: SiteBlocksOptions = {}): Config {
	const seen = new Set<string>();
	const regions = (options.regions ?? []).filter((r) => isRegion(r) && !seen.has(r.id) && !!seen.add(r.id));
	const own = new Map<string, BlockTypeDef>();
	for (const t of options.types ?? []) if (isType(t) && !own.has(t.id)) own.set(t.id, t);
	const cs = options.cacheSeconds;
	return {
		cacheSeconds: typeof cs === "number" && Number.isFinite(cs) && cs >= 0 ? Math.min(cs, 3600) : 30,
		regions: regions.length ? regions : DEFAULT_REGIONS,
		types: [...BUILTIN_TYPES.filter((t) => !own.has(t.id)), ...own.values()],
	};
}
