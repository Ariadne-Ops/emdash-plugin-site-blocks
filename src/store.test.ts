import { describe, it, expect } from "vitest";
import { createStore, type Collection } from "./store";
import type { BlockInput } from "./model";

function fake(): Collection<any> {
	const m = new Map<string, any>();
	return {
		get: async (id) => m.get(id) ?? null,
		put: async (id, d) => void m.set(id, d),
		delete: async (id) => m.delete(id),
		query: async ({ where, limit = 50, cursor } = {}) => {
			const all = [...m].filter(([, d]) => !where || Object.entries(where).every(([k, v]) => d[k] === v)).map(([id, data]) => ({ id, data }));
			const start = cursor ? Number(cursor) : 0;
			const items = all.slice(start, start + limit);
			return { items, hasMore: start + limit < all.length, cursor: start + limit < all.length ? String(start + limit) : undefined };
		},
	};
}
const input = (o: Partial<BlockInput> = {}): BlockInput => ({ region: "above-header", type: "notice", title: "T", status: "published", weight: 0, show: "", hide: "", dismissible: true, style: "info", props: { text: "hi" }, ...o });
let n = 0;
const mk = () => createStore(fake(), { now: () => new Date("2026-10-26T12:00:00Z"), newId: () => `b${++n}` });

describe("store", () => {
	it("creates, reads, updates and removes a block, stamping times", async () => {
		const s = mk();
		const a = await s.create(input());
		expect(a).toMatchObject({ id: expect.any(String), createdAt: "2026-10-26T12:00:00.000Z", updatedAt: "2026-10-26T12:00:00.000Z" });
		expect((await s.get(a.id))?.title).toBe("T");
		const b = await s.update(a.id, input({ title: "New" }));
		expect(b).toMatchObject({ id: a.id, title: "New", createdAt: a.createdAt });
		expect(await s.update("missing", input())).toBeNull();
		expect(await s.remove(a.id)).toBe(true);
		expect(await s.remove(a.id)).toBe(false);
		expect(await s.get(a.id)).toBeNull();
	});
	it("lists every block across pages, and only published ones on request", async () => {
		const s = mk();
		for (let i = 0; i < 130; i++) await s.create(input({ status: i % 2 ? "draft" : "published" }));
		expect((await s.list()).length).toBe(130);
		expect((await s.listPublished()).length).toBe(65);
	});
	it("sets status", async () => {
		const s = mk();
		const a = await s.create(input());
		expect((await s.setStatus(a.id, "draft"))?.status).toBe("draft");
		expect(await s.setStatus("missing", "draft")).toBeNull();
	});
	it("moves a block up or down within its region, renumbering weights, and ignores the ends", async () => {
		const s = mk();
		const a = await s.create(input({ title: "A", weight: 0 }));
		const b = await s.create(input({ title: "B", weight: 0 }));
		const c = await s.create(input({ title: "C", weight: 5 }));
		const other = await s.create(input({ title: "X", region: "footer-top" }));
		const order = async () => (await s.list()).filter((x) => x.region === "above-header").sort((p, q) => p.weight - q.weight || p.id.localeCompare(q.id)).map((x) => x.title);
		expect(await order()).toEqual(["A", "B", "C"]);
		await s.move(c.id, "up");
		expect(await order()).toEqual(["A", "C", "B"]);
		await s.move(a.id, "up"); // already first
		await s.move(b.id, "down"); // already last
		expect(await order()).toEqual(["A", "C", "B"]);
		await s.move(a.id, "down");
		expect(await order()).toEqual(["C", "A", "B"]);
		expect((await s.get(other.id))?.weight).toBe(0); // other regions untouched
	});
});

describe("rev", () => {
	it("changes when a block's content is edited, not when it is moved or its status toggled", async () => {
		let t = 0;
		const s = createStore(fake(), { now: () => new Date(Date.UTC(2026, 9, 26, 12, 0, ++t)), newId: () => `r${t}` });
		const a = await s.create(input({ weight: 0 }));
		const b = await s.create(input({ weight: 10 }));
		const revA = (await s.get(a.id))!.rev, revB = (await s.get(b.id))!.rev;
		await s.move(a.id, "down");
		await s.setStatus(a.id, "draft");
		await s.setStatus(a.id, "published");
		expect((await s.get(a.id))!.rev).toBe(revA);
		expect((await s.get(b.id))!.rev).toBe(revB);
		await s.update(a.id, input({ props: { text: "changed" } }));
		expect((await s.get(a.id))!.rev).not.toBe(revA);
	});
});
