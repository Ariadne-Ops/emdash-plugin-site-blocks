import { describe, it, expect } from "vitest";
import { createPlugin } from "./index";
import type { Collection } from "./store";

function storage() {
	const m = new Map<string, any>();
	let reads = 0;
	const col: Collection<any> = {
		get: async (id) => m.get(id) ?? null, put: async (id, d) => void m.set(id, d), delete: async (id) => m.delete(id),
		query: async ({ where } = {}) => { reads++; return { items: [...m].filter(([, d]) => !where || Object.entries(where).every(([k, v]) => d[k] === v)).map(([id, data]) => ({ id, data })), hasMore: false }; },
	};
	return { ctx: (input: unknown) => ({ input, storage: { blocks: col } }), reads: () => reads };
}
const add = (text: string) => ({ type: "form_submit", action_id: "save_block", values: { block: "new", type: "notice", region: "above-header", title: text, status: "published", weight: "0", show: "", hide: "", style: "info", dismissible: true, p_text: text, p_linkText: "", p_linkUrl: "" } });
const routes = (o?: any) => (createPlugin(o) as any).routes;
const region = (r: any, s: ReturnType<typeof storage>) => r.region.handler(s.ctx({ region: "above-header", path: "/" }));

describe("the plugin's routes", () => {
	it("read storage once for repeated page renders, not once per render", async () => {
		const s = storage(), r = routes();
		await region(r, s); await region(r, s); await region(r, s);
		expect(s.reads()).toBe(1);
	});
	it("show an edit made in the admin at once, even inside the cache window", async () => {
		const s = storage(), r = routes();
		expect((await region(r, s)).blocks).toHaveLength(0);
		await r.admin.handler(s.ctx(add("Hello")));
		expect((await region(r, s)).blocks.map((b: any) => b.props.text)).toEqual(["Hello"]);
	});
	it("do not drop the cache when the admin page is only viewed", async () => {
		const s = storage(), r = routes();
		await region(r, s);
		await r.admin.handler(s.ctx({ type: "page_load" }));
		await region(r, s);
		expect(s.reads()).toBe(2); // one for the first region read, one for the admin list; the second region read hit the cache
	});
	it("read every time when the cache is turned off", async () => {
		const s = storage(), r = routes({ cacheSeconds: 0 });
		await region(r, s); await region(r, s);
		expect(s.reads()).toBe(2);
	});
});

describe("the fallback fetch", () => {
	it("gives up after a short time instead of stalling the page", async () => {
		const { loadRegion } = await import("./client");
		const real = globalThis.fetch;
		globalThis.fetch = ((req: Request) => new Promise((_, reject) => req.signal.addEventListener("abort", () => reject(new Error("aborted"))))) as any;
		const t = Date.now();
		try { expect(await loadRegion({ region: "above-header", path: "/", baseUrl: new URL("https://x.example/"), timeoutMs: 30 })).toEqual([]); } finally { globalThis.fetch = real; }
		expect(Date.now() - t).toBeLessThan(1000);
	});
});
