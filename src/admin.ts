import { validateBlockInput, type BlockTypeDef, type Config, type FieldDef } from "./model";
import type { createStore, StoredBlock } from "./store";

type Store = ReturnType<typeof createStore>;
type Block = Record<string, unknown>;
type Toast = { message: string; type: "success" | "error" | "info" };
interface Ctx { input: unknown }

/** What the editor form shows: a stored block, or what was typed when a save was refused. */
interface Draft {
	block: string; // "new" or a block id
	type: string; region: string; title: string; status: string; weight: number | string;
	show: string; hide: string; startsAt: string; endsAt: string; style: string; dismissible: boolean;
	props: Record<string, string>;
}

const STATUS_LABEL = { published: "Published", draft: "Draft" } as const;
const day = (iso?: string) => (iso ? iso.slice(0, 10) : "");
const str = (v: unknown) => (typeof v === "string" ? v : v == null ? "" : String(v));

export function createAdmin(deps: { store: Store; config: Config }) {
	const { store, config } = deps;
	const typeOf = (id: string): BlockTypeDef | undefined => config.types.find((t) => t.id === id);
	const regionLabel = (id: string) => config.regions.find((r) => r.id === id)?.label ?? id;

	const summary = (b: StoredBlock) => {
		const parts = [b.show.trim() ? `Only: ${b.show.trim().split(/\r?\n/).join(", ")}` : "Everywhere", b.hide.trim() ? `Not: ${b.hide.trim().split(/\r?\n/).join(", ")}` : ""].filter(Boolean).join(" · ");
		return parts.length > 90 ? `${parts.slice(0, 87)}…` : parts;
	};

	async function listView(toast?: Toast) {
		const blocks = await store.list();
		const sections: Block[] = config.regions.flatMap((region) => {
			const mine = blocks.filter((b) => b.region === region.id).sort((a, c) => a.weight - c.weight || a.id.localeCompare(c.id));
			return [
				{ type: "header", text: region.label },
				{
					type: "table", block_id: `region-${region.id}`, page_action_id: "noop", empty_text: "No blocks in this region yet.",
					columns: [{ key: "name", label: "Name" }, { key: "type", label: "Type" }, { key: "status", label: "Status", format: "badge" }, { key: "paths", label: "Shows on" }, { key: "actions", label: "", format: "element" }],
					rows: mine.map((b) => ({
						name: b.title, type: typeOf(b.type)?.label ?? b.type, status: STATUS_LABEL[b.status] ?? b.status, paths: summary(b),
						actions: { type: "menu", action_id: "row", label: "Actions", items: [
							{ label: "Edit", value: `edit:${b.id}` }, { label: "Move up", value: `up:${b.id}` }, { label: "Move down", value: `down:${b.id}` },
							{ label: b.status === "published" ? "Unpublish" : "Publish", value: `toggle:${b.id}` },
						] },
					})),
				},
			];
		});
		return {
			blocks: [
				{ type: "header", text: "Site blocks" },
				{ type: "context", text: "Blocks appear in the regions your theme defines. Order within a region follows the weight; use Move up and Move down." },
				{ type: "form", block_id: "add-form", submit: { label: "Add block", action_id: "add_block" }, fields: [
					{ type: "select", action_id: "region", label: "Region", initial_value: config.regions[0]?.id, options: config.regions.map((r) => ({ label: r.label, value: r.id })) },
					{ type: "select", action_id: "type", label: "Type", initial_value: config.types[0]?.id, options: config.types.map((t) => ({ label: t.label, value: t.id })) },
				] },
				...sections,
			],
			...(toast ? { toast } : {}),
		};
	}

	function fieldElement(f: FieldDef, value: string): Block {
		const base = { action_id: `p_${f.id}`, label: f.label, initial_value: value };
		if (f.kind === "select") return { type: "select", ...base, options: [{ label: "—", value: "" }, ...(f.options ?? [])] };
		if (f.kind === "textarea") return { type: "text_input", ...base, multiline: true };
		return { type: "text_input", ...base, ...(f.help ? { placeholder: f.help } : {}) };
	}

	function editView(d: Draft, toast?: Toast) {
		const def = typeOf(d.type)!;
		const styles = def.styles?.length ? def.styles : [{ value: "default", label: "Default" }];
		const isNew = d.block === "new";
		return {
			blocks: [
				{ type: "header", text: isNew ? `New ${def.label.toLowerCase()} block` : `Edit ${def.label.toLowerCase()} block` },
				{ type: "context", text: "Paths: one per line. * matches anything (for example /playground/*). <front> is the home page. A block shows when it matches Show on (empty means every page) and does not match Hide on." },
				{ type: "form", block_id: "edit-form", submit: { label: isNew ? "Create block" : "Save block", action_id: "save_block" }, fields: [
					{ type: "select", action_id: "block", label: "Block", initial_value: d.block, options: [{ label: isNew ? "New block" : d.title || d.block, value: d.block }] },
					{ type: "select", action_id: "type", label: "Type", initial_value: d.type, options: [{ label: def.label, value: d.type }] },
					{ type: "select", action_id: "region", label: "Region", initial_value: d.region, options: config.regions.map((r) => ({ label: r.label, value: r.id })) },
					{ type: "text_input", action_id: "title", label: "Name (shown only in this admin)", initial_value: d.title },
					...def.fields.map((f) => fieldElement(f, d.props[f.id] ?? "")),
					{ type: "select", action_id: "style", label: "Style", initial_value: d.style, options: styles.map((s) => ({ label: s.label, value: s.value })) },
					{ type: "toggle", action_id: "dismissible", label: "Visitors can dismiss it", initial_value: d.dismissible },
					{ type: "text_input", action_id: "show", label: "Show on (paths)", multiline: true, initial_value: d.show, placeholder: "Leave empty for every page" },
					{ type: "text_input", action_id: "hide", label: "Hide on (paths)", multiline: true, initial_value: d.hide },
					{ type: "select", action_id: "status", label: "Status", initial_value: d.status, options: [{ label: "Published", value: "published" }, { label: "Draft", value: "draft" }] },
					{ type: "number_input", action_id: "weight", label: "Weight (lower comes first)", initial_value: Number(d.weight) || 0 },
					{ type: "date_input", action_id: "startsAt", label: "Show from (date, UTC; optional)", initial_value: d.startsAt },
					{ type: "date_input", action_id: "endsAt", label: "Show until (date, UTC; optional, ends at the start of that day)", initial_value: d.endsAt },
				] },
				{ type: "actions", elements: [
					{ type: "button", action_id: "cancel_edit", label: "Cancel" },
					...(isNew ? [] : [{ type: "button", action_id: "delete_block", label: "Delete block", style: "danger", value: d.block, confirm: { title: "Delete this block?", text: "It disappears from the site and cannot be restored.", confirm: "Delete", deny: "Keep" } }]),
				] },
			],
			...(toast ? { toast } : {}),
		};
	}

	const draftFromStored = (b: StoredBlock): Draft => ({ block: b.id, type: b.type, region: b.region, title: b.title, status: b.status, weight: b.weight, show: b.show, hide: b.hide, startsAt: day(b.startsAt), endsAt: day(b.endsAt), style: b.style, dismissible: b.dismissible, props: b.props });
	const draftFromValues = (v: Record<string, unknown>): Draft => ({
		block: str(v.block) || "new", type: str(v.type), region: str(v.region), title: str(v.title), status: str(v.status) || "published", weight: str(v.weight),
		show: str(v.show), hide: str(v.hide), startsAt: str(v.startsAt), endsAt: str(v.endsAt), style: str(v.style), dismissible: v.dismissible === true || v.dismissible === "true",
		props: Object.fromEntries(Object.entries(v).filter(([k]) => k.startsWith("p_")).map(([k, x]) => [k.slice(2), str(x)])),
	});

	async function save(values: Record<string, unknown>) {
		const d = draftFromValues(values);
		const parsed = validateBlockInput({ ...d, props: d.props }, config);
		if (!parsed.ok) return typeOf(d.type) ? editView(d, { message: parsed.errors.join(" "), type: "error" }) : listView({ message: parsed.errors.join(" "), type: "error" });
		const saved = d.block === "new" ? await store.create(parsed.value) : await store.update(d.block, parsed.value);
		if (!saved) return listView({ message: "That block no longer exists, so nothing was saved.", type: "error" });
		return listView({ message: d.block === "new" ? "Block created" : "Block saved", type: "success" });
	}

	async function row(value: string) {
		const [verb, ...rest] = value.split(":");
		const id = rest.join(":");
		if (!id || !["edit", "up", "down", "toggle"].includes(verb)) return { blocks: [] };
		const b = await store.get(id);
		if (!b) return listView({ message: "That block no longer exists.", type: "error" });
		if (verb === "edit") return editView(draftFromStored(b));
		if (verb === "toggle") { await store.setStatus(id, b.status === "published" ? "draft" : "published"); return listView({ message: b.status === "published" ? "Unpublished" : "Published", type: "success" }); }
		await store.move(id, verb as "up" | "down");
		return listView();
	}

	return {
		async handle(ctx: Ctx) {
			const i = ctx.input as { type?: unknown; action_id?: unknown; value?: unknown; values?: unknown } | null;
			if (!i || typeof i !== "object" || typeof i.type !== "string") return { blocks: [] };
			if (i.type === "page_load") return listView();
			const values = typeof i.values === "object" && i.values !== null ? (i.values as Record<string, unknown>) : {};
			if (i.type === "form_submit") {
				if (i.action_id === "add_block") {
					const region = str(values.region), type = str(values.type), def = typeOf(type);
					if (!def || !config.regions.some((r) => r.id === region)) return listView({ message: "Choose a region and a type.", type: "error" });
					return editView({ block: "new", type, region, title: "", status: "published", weight: 0, show: "", hide: "", startsAt: "", endsAt: "", style: def.styles?.[0]?.value ?? "default", dismissible: true, props: {} });
				}
				if (i.action_id === "save_block") return save(values);
				return { blocks: [] };
			}
			if (i.type !== "block_action") return { blocks: [] };
			if (i.action_id === "row") return row(str(i.value));
			if (i.action_id === "cancel_edit") return listView();
			if (i.action_id === "delete_block") {
				const ok = await store.remove(str(i.value));
				return listView(ok ? { message: "Block deleted", type: "success" } : { message: "That block no longer exists.", type: "error" });
			}
			return { blocks: [] };
		},
	};
}
