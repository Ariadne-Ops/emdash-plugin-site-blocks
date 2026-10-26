import { describe, it, expect } from "vitest";
import { createAdmin } from "./admin";
import { createStore, type Collection } from "./store";
import { BUILTIN_TYPES, DEFAULT_REGIONS, type Config } from "./model";

const cfg: Config = { regions: DEFAULT_REGIONS, types: BUILTIN_TYPES };
function setup() {
	const m = new Map<string, any>();
	const col: Collection<any> = {
		get: async (id) => m.get(id) ?? null, put: async (id, d) => void m.set(id, d), delete: async (id) => m.delete(id),
		query: async ({ where } = {}) => ({ items: [...m].filter(([, d]) => !where || Object.entries(where).every(([k, v]) => d[k] === v)).map(([id, data]) => ({ id, data })), hasMore: false }),
	};
	let n = 0;
	const store = createStore(col, { now: () => new Date("2026-10-26T12:00:00Z"), newId: () => `id${++n}` });
	const admin = createAdmin({ store, config: cfg });
	const send = (input: unknown) => admin.handle({ input });
	return { store, send, m };
}
const find = (res: any, type: string, pred: (b: any) => boolean = () => true) => (res.blocks as any[]).filter((b) => b.type === type && pred(b));
const form = (res: any, action: string) => find(res, "form", (b) => b.submit.action_id === action)[0];
const field = (f: any, id: string) => f.fields.find((x: any) => x.action_id === id);
const saveValues = (o: Record<string, unknown> = {}) => ({ block: "new", type: "notice", region: "above-header", title: "Beta", status: "published", weight: "0", show: "", hide: "", style: "info", dismissible: true, p_text: "We are still adding playgrounds.", p_linkText: "", p_linkUrl: "", ...o });

describe("admin", () => {
	it("page_load lists every region with its blocks and an add-block form", async () => {
		const { send, store } = setup();
		await store.create({ region: "above-header", type: "notice", title: "Beta notice", status: "published", weight: 0, show: "", hide: "", dismissible: true, style: "info", props: { text: "hi" } });
		const res: any = await send({ type: "page_load" });
		const headers = find(res, "header").map((h) => h.text);
		expect(headers).toEqual(expect.arrayContaining(["Above header", "Footer top"]));
		const tables = find(res, "table");
		expect(tables).toHaveLength(DEFAULT_REGIONS.length);
		expect(tables[0].rows[0]).toMatchObject({ name: "Beta notice", type: "Notice", status: "Published" });
		const add = form(res, "add_block");
		expect(field(add, "region").options.map((o: any) => o.value)).toEqual(DEFAULT_REGIONS.map((r) => r.id));
		expect(field(add, "type").options.map((o: any) => o.value)).toEqual(["notice", "richtext"]);
	});
	it("add_block opens a blank form for the chosen type and region", async () => {
		const { send } = setup();
		const res: any = await send({ type: "form_submit", action_id: "add_block", values: { region: "footer-top", type: "richtext" } });
		const f = form(res, "save_block");
		expect(field(f, "region").initial_value).toBe("footer-top");
		expect(field(f, "block").options).toEqual([{ label: "New block", value: "new" }]);
		expect(field(f, "type").options).toEqual([{ label: "Rich text", value: "richtext" }]);
		expect(field(f, "p_body").multiline).toBe(true);
		expect(field(f, "p_text")).toBeUndefined();
	});
	it("add_block with an unknown region or type just shows the list", async () => {
		const { send } = setup();
		const res: any = await send({ type: "form_submit", action_id: "add_block", values: { region: "x", type: "y" } });
		expect(form(res, "save_block")).toBeUndefined();
		expect(res.toast.type).toBe("error");
	});
	it("save_block creates a valid block and returns to the list", async () => {
		const { send, store } = setup();
		const res: any = await send({ type: "form_submit", action_id: "save_block", values: saveValues() });
		expect(res.toast).toMatchObject({ type: "success" });
		const all = await store.list();
		expect(all).toHaveLength(1);
		expect(all[0]).toMatchObject({ title: "Beta", props: { text: "We are still adding playgrounds." }, dismissible: true });
		expect(form(res, "add_block")).toBeDefined();
	});
	it("save_block with a problem keeps the editor open with what was typed and says what is wrong", async () => {
		const { send, store } = setup();
		const res: any = await send({ type: "form_submit", action_id: "save_block", values: saveValues({ p_text: "", title: "Keep me", p_linkUrl: "javascript:x" }) });
		expect(res.toast.type).toBe("error");
		expect(res.toast.message).toContain("Message is required.");
		const f = form(res, "save_block");
		expect(field(f, "title").initial_value).toBe("Keep me");
		expect(await store.list()).toHaveLength(0);
	});
	it("save_block with an id updates that block", async () => {
		const { send, store } = setup();
		await send({ type: "form_submit", action_id: "save_block", values: saveValues() });
		const [b] = await store.list();
		const res: any = await send({ type: "form_submit", action_id: "save_block", values: saveValues({ block: b.id, title: "Renamed", weight: "5" }) });
		expect(res.toast.type).toBe("success");
		expect(await store.list()).toHaveLength(1);
		expect(await store.get(b.id)).toMatchObject({ title: "Renamed", weight: 5 });
	});
	it("a save for a block that is gone says so instead of creating one", async () => {
		const { send, store } = setup();
		const res: any = await send({ type: "form_submit", action_id: "save_block", values: saveValues({ block: "ghost" }) });
		expect(res.toast.type).toBe("error");
		expect(await store.list()).toHaveLength(0);
	});
	it("row menu: edit opens the stored values; up/down reorder; toggle flips status", async () => {
		const { send, store } = setup();
		await send({ type: "form_submit", action_id: "save_block", values: saveValues({ title: "A" }) });
		await send({ type: "form_submit", action_id: "save_block", values: saveValues({ title: "B", weight: "1" }) });
		const [a, b] = (await store.list()).sort((p, q) => p.weight - q.weight);
		const edit: any = await send({ type: "block_action", action_id: "row", value: `edit:${a.id}` });
		expect(field(form(edit, "save_block"), "title").initial_value).toBe("A");
		expect(field(form(edit, "save_block"), "p_text").initial_value).toBe("We are still adding playgrounds.");
		await send({ type: "block_action", action_id: "row", value: `down:${a.id}` });
		const after = (await store.list()).sort((p, q) => p.weight - q.weight).map((x) => x.title);
		expect(after).toEqual(["B", "A"]);
		await send({ type: "block_action", action_id: "row", value: `toggle:${b.id}` });
		expect((await store.get(b.id))?.status).toBe("draft");
		await send({ type: "block_action", action_id: "row", value: `toggle:${b.id}` });
		expect((await store.get(b.id))?.status).toBe("published");
	});
	it("delete_block removes the block; cancel returns to the list", async () => {
		const { send, store } = setup();
		await send({ type: "form_submit", action_id: "save_block", values: saveValues() });
		const [b] = await store.list();
		const edit: any = await send({ type: "block_action", action_id: "row", value: `edit:${b.id}` });
		const del = find(edit, "actions").flatMap((a) => a.elements).find((e: any) => e.action_id === "delete_block");
		expect(del.confirm).toBeDefined();
		const res: any = await send({ type: "block_action", action_id: "delete_block", value: b.id });
		expect(res.toast.type).toBe("success");
		expect(await store.list()).toHaveLength(0);
		const back: any = await send({ type: "block_action", action_id: "cancel_edit" });
		expect(form(back, "add_block")).toBeDefined();
	});
	it("ignores junk input and unknown actions", async () => {
		const { send } = setup();
		expect(await send(null)).toEqual({ blocks: [] });
		expect(await send({ type: "block_action", action_id: "row", value: "nonsense" })).toEqual({ blocks: [] });
		expect(await send({ type: "block_action", action_id: "row", value: "edit:ghost" })).toMatchObject({ toast: { type: "error" } });
		expect(await send({ type: "wat" })).toEqual({ blocks: [] });
	});
});

import { validateBlocks } from "@emdash-cms/blocks";
describe("admin output against EmDash's own Block Kit validator", () => {
	it("every view the admin can produce is a valid block response", async () => {
		const { send, store } = setup();
		await send({ type: "form_submit", action_id: "save_block", values: saveValues() });
		const [b] = await store.list();
		const views = [
			await send({ type: "page_load" }),
			await send({ type: "form_submit", action_id: "add_block", values: { region: "footer-top", type: "richtext" } }),
			await send({ type: "block_action", action_id: "row", value: `edit:${b.id}` }),
			await send({ type: "form_submit", action_id: "save_block", values: saveValues({ p_text: "" }) }),
		];
		for (const v of views) {
			const r = validateBlocks((v as any).blocks);
			expect(r.valid, JSON.stringify((r as any).errors)).toBe(true);
		}
	});
});
