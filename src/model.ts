/** What a site configures (regions, block types) and the checks every block an editor saves goes through. */
export interface Region { id: string; label: string }
export interface FieldDef {
	id: string;
	label: string;
	kind: "text" | "textarea" | "url" | "select";
	required?: boolean;
	/** Most characters allowed; 500 when not set. */
	max?: number;
	options?: Array<{ value: string; label: string }>;
	help?: string;
}
export interface BlockTypeDef {
	id: string;
	label: string;
	fields: FieldDef[];
	/** Style choices; the first is the default. A type without any has the single style "default". */
	styles?: Array<{ value: string; label: string }>;
}
export interface Config { regions: Region[]; types: BlockTypeDef[]; cacheSeconds: number }

export const BUILTIN_TYPES: BlockTypeDef[] = [
	{
		id: "notice",
		label: "Notice",
		styles: [{ value: "info", label: "Info" }, { value: "warning", label: "Warning" }, { value: "promo", label: "Promo" }],
		fields: [
			{ id: "badge", label: "Label (optional)", kind: "text", max: 20, help: "A short tag before the message, such as BETA or NEW" },
			{ id: "heading", label: "Heading (optional)", kind: "text", max: 120 },
			{ id: "text", label: "Message", kind: "textarea", required: true, max: 1000, help: "To link words, write [the words](/page) or [the words](https://example.com)" },
			{ id: "linkText", label: "Link text", kind: "text", max: 60 },
			{ id: "linkUrl", label: "Link address", kind: "url", max: 500, help: "Starts with https://, http:// or /" },
			{ id: "link2Text", label: "Second link text", kind: "text", max: 60 },
			{ id: "link2Url", label: "Second link address", kind: "url", max: 500, help: "Starts with https://, http:// or /" },
			{ id: "linkLook", label: "Links look like", kind: "select", options: [{ value: "links", label: "Text links" }, { value: "buttons", label: "Buttons (the second one stands out)" }] },
		],
	},
	{
		id: "richtext",
		label: "Rich text",
		styles: [{ value: "plain", label: "Plain" }, { value: "card", label: "Card" }],
		fields: [{ id: "body", label: "Text", kind: "textarea", required: true, max: 4000, help: "A blank line starts a new paragraph. Links: [text](https://example.com)" }],
	},
];

export const DEFAULT_REGIONS: Region[] = [
	{ id: "above-header", label: "Above header" },
	{ id: "below-header", label: "Below header" },
	{ id: "playground-top", label: "Playground top" },
	{ id: "playground-bottom", label: "Playground bottom" },
	{ id: "footer-top", label: "Footer top" },
];

/** The stored shape of one block. */
export interface BlockInput {
	region: string;
	type: string;
	title: string;
	status: "published" | "draft";
	weight: number;
	show: string;
	hide: string;
	startsAt?: string;
	endsAt?: string;
	dismissible: boolean;
	/** "half" blocks that follow each other sit side by side (on wide screens); the default is the full width. */
	width?: "full" | "half";
	style: string;
	props: Record<string, string>;
}

export type Validated = { ok: true; value: BlockInput } | { ok: false; errors: string[] };

/** https://, http:// or a path on this site. No spaces, control characters or backslashes: browsers read "/\\host" as "//host". */
export const isSafeLink = (u: string) => !/[\s\\\u0000-\u001f\u007f]/.test(u) && (/^https?:\/\//i.test(u) || (u.startsWith("/") && !u.startsWith("//")));

const str = (v: unknown) => (typeof v === "string" ? v : v == null ? "" : String(v));
const isoOrNaN = (v: unknown) => { const s = str(v).trim(); return s ? Date.parse(s) : undefined; };

export function validateBlockInput(raw: unknown, cfg: Config): Validated {
	if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return { ok: false, errors: ["The block is missing."] };
	const o = raw as Record<string, unknown>;
	const errors: string[] = [];

	const region = str(o.region);
	if (!cfg.regions.some((r) => r.id === region)) errors.push("Choose one of the regions this site defines.");
	const def = cfg.types.find((t) => t.id === str(o.type));
	if (!def) errors.push("Choose a block type this site supports.");

	const title = str(o.title).trim();
	if (!title) errors.push("Give the block a name (shown only in the admin).");
	else if (title.length > 120) errors.push("The name can be at most 120 characters.");

	const status = str(o.status || "published");
	if (status !== "published" && status !== "draft") errors.push("Status must be published or draft.");

	const weightRaw = str(o.weight).trim();
	const weight = weightRaw === "" ? 0 : Number(weightRaw);
	if (!Number.isInteger(weight) || weight < -1000 || weight > 1000) errors.push("Weight must be a whole number from -1000 to 1000.");

	const rules = (key: "show" | "hide", label: string) => {
		const v = str(o[key]);
		if (v.length > 2000) errors.push(`${label} paths are too long.`);
		else if (v.split(/\r?\n/).length > 50) errors.push(`${label} paths can have at most 50 lines.`);
		return v;
	};
	const show = rules("show", "Show"), hide = rules("hide", "Hide");

	const s = isoOrNaN(o.startsAt), e = isoOrNaN(o.endsAt);
	if (s !== undefined && Number.isNaN(s)) errors.push("Start must be a date and time.");
	if (e !== undefined && Number.isNaN(e)) errors.push("End must be a date and time.");
	if (s !== undefined && e !== undefined && !Number.isNaN(s) && !Number.isNaN(e) && e <= s) errors.push("End must be after start.");

	const styles = def?.styles?.length ? def.styles : [{ value: "default", label: "Default" }];
	const style = str(o.style).trim() || styles[0].value;
	if (def && !styles.some((x) => x.value === style)) errors.push("Choose one of the listed styles.");

	const width = str(o.width).trim() || "full";
	if (width !== "full" && width !== "half") errors.push("Width must be full or half.");

	const props: Record<string, string> = {};
	const given = typeof o.props === "object" && o.props !== null ? (o.props as Record<string, unknown>) : {};
	for (const f of def?.fields ?? []) {
		const v = Object.hasOwn(given, f.id) ? str(given[f.id]).trim() : "";
		if (!v) { if (f.required) errors.push(`${f.label} is required.`); continue; }
		if (v.length > (f.max ?? 500)) { errors.push(`${f.label} can be at most ${f.max ?? 500} characters.`); continue; }
		if (f.kind === "url" && !isSafeLink(v)) { errors.push(`${f.label} must start with https://, http:// or /.`); continue; }
		if (f.kind === "select" && !f.options?.some((x) => x.value === v)) { errors.push(`${f.label} must be one of the listed choices.`); continue; }
		props[f.id] = v;
	}

	if (errors.length) return { ok: false, errors };
	return {
		ok: true,
		value: {
			region, type: def!.id, title, status: status as "published" | "draft", weight, show, hide,
			...(s !== undefined ? { startsAt: new Date(s).toISOString() } : {}),
			...(e !== undefined ? { endsAt: new Date(e).toISOString() } : {}),
			dismissible: o.dismissible === undefined ? true : o.dismissible === true || o.dismissible === "true",
			width: width as "full" | "half", style, props,
		},
	};
}
