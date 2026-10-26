import { isVisible, parsePatterns } from "./paths";

export interface Block {
	id: string;
	region: string;
	type: string;
	status: "published" | "draft";
	weight: number;
	/** Show/hide path rules, one pattern per line (see paths.ts). */
	show: string;
	hide: string;
	startsAt?: string;
	endsAt?: string;
}

const time = (iso?: string) => { const t = iso ? Date.parse(iso) : NaN; return Number.isNaN(t) ? undefined : t; };

/** The blocks a region renders for `path` at `now`, in weight order (ties by id). */
export function selectBlocks<T extends Block>(blocks: T[], ctx: { region: string; path: string; now: Date }): T[] {
	const at = ctx.now.getTime();
	return blocks
		.filter((blk) => blk.region === ctx.region && blk.status === "published")
		.filter((blk) => { const s = time(blk.startsAt), e = time(blk.endsAt); return (s === undefined || at >= s) && (e === undefined || at < e); })
		.filter((blk) => isVisible(ctx.path, { show: parsePatterns(blk.show), hide: parsePatterns(blk.hide) }))
		.sort((a, c) => a.weight - c.weight || a.id.localeCompare(c.id));
}
