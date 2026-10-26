import { describe, it, expect } from "vitest";
import { regionBlocks } from "./public";
import { loadRegion } from "./client";
import { createStore, type Collection } from "./store";
import { BUILTIN_TYPES, DEFAULT_REGIONS, type BlockInput, type Config } from "./model";

const cfg: Config = { regions: DEFAULT_REGIONS, types: BUILTIN_TYPES, cacheSeconds: 30 };
const NOW = new Date("2026-10-26T12:00:00Z");
function setup() {
	const m = new Map<string, any>();
	const col: Collection<any> = {
		get: async (id) => m.get(id) ?? null, put: async (id, d) => void m.set(id, d), delete: async (id) => m.delete(id),
		query: async ({ where } = {}) => ({ items: [...m].filter(([, d]) => !where || Object.entries(where).every(([k, v]) => d[k] === v)).map(([id, data]) => ({ id, data })), hasMore: false }),
	};
	let n = 0;
	return createStore(col, { now: () => NOW, newId: () => `id${++n}` });
}
const blk = (o: Partial<BlockInput> = {}): BlockInput => ({ region: "above-header", type: "notice", title: "Admin only title", status: "published", weight: 0, show: "", hide: "", dismissible: true, style: "info", props: { text: "hi" }, ...o });

describe("regionBlocks", () => {
	it("returns the matching published blocks with only the fields a page needs", async () => {
		const s = setup();
		await s.create(blk({ show: "/playground/*" }));
		await s.create(blk({ status: "draft" }));
		await s.create(blk({ region: "footer-top" }));
		const r = await regionBlocks(s, cfg, { region: "above-header", path: "/playground/x" }, NOW);
		expect(r.blocks).toEqual([{ id: "id1", type: "notice", style: "info", dismissible: true, width: "full", props: { text: "hi" }, rev: "2026-10-26T12:00:00.000Z" }]);
		expect(JSON.stringify(r)).not.toContain("Admin only title");
		expect(JSON.stringify(r)).not.toContain("playground/*");
	});
	it("a path that is not shown gets nothing", async () => {
		const s = setup();
		await s.create(blk({ show: "/playground/*" }));
		expect((await regionBlocks(s, cfg, { region: "above-header", path: "/about" }, NOW)).blocks).toEqual([]);
	});
	it("treats an unknown region, junk input or a missing path safely", async () => {
		const s = setup();
		await s.create(blk());
		expect((await regionBlocks(s, cfg, { region: "nope", path: "/" }, NOW)).blocks).toEqual([]);
		expect((await regionBlocks(s, cfg, null, NOW)).blocks).toEqual([]);
		expect((await regionBlocks(s, cfg, { region: "above-header" }, NOW)).blocks).toHaveLength(1); // no path means the home page
		expect((await regionBlocks(s, cfg, { region: "above-header", path: "x".repeat(5000) }, NOW)).blocks).toHaveLength(1);
	});
});

describe("loadRegion (what the Astro component calls)", () => {
	const url = new URL("https://site.example/anything");
	it("calls the plugin route in-process and unwraps the response", async () => {
		const calls: any[] = [];
		const handler = async (...a: any[]) => { calls.push(a.slice(0, 3)); return { success: true, data: { blocks: [{ id: "a", type: "notice", style: "info", dismissible: true, props: { text: "t" }, rev: "r" }] } }; };
		const r = await loadRegion({ region: "above-header", path: "/x", baseUrl: url, handlePublicPluginApiRoute: handler as any });
		expect(r).toHaveLength(1);
		expect(calls[0]).toEqual(["site-blocks", "POST", "/region"]);
	});
	it("returns no blocks (never throws) when the route fails or answers with nonsense", async () => {
		expect(await loadRegion({ region: "r", path: "/", baseUrl: url, handlePublicPluginApiRoute: (async () => { throw new Error("boom"); }) as any })).toEqual([]);
		expect(await loadRegion({ region: "r", path: "/", baseUrl: url, handlePublicPluginApiRoute: (async () => ({ success: false })) as any })).toEqual([]);
		expect(await loadRegion({ region: "r", path: "/", baseUrl: url, handlePublicPluginApiRoute: (async () => ({ success: true, data: { blocks: [{ id: 1 }, "x", { id: "ok", type: "notice", style: "i", dismissible: false, props: {}, rev: "r" }] } })) as any })).toHaveLength(1);
	});
});

describe("width on the public block", () => {
	it("is passed on, and is full for a block stored before widths existed", async () => {
		const s = setup();
		await s.create(blk({ width: "half" }));
		await s.create(blk());
		const r = await regionBlocks(s, cfg, { region: "above-header", path: "/" }, NOW);
		expect(r.blocks.map((b) => b.width)).toEqual(["half", "full"]);
	});
});
