import { selectBlocks } from "./select";
import type { Config } from "./model";
import type { createStore } from "./store";

/** The only fields a visitor's page gets: no admin title, no path rules. */
export interface PublicBlock {
	id: string;
	type: string;
	style: string;
	dismissible: boolean;
	width: "full" | "half";
	props: Record<string, string>;
	/** Changes whenever the block is edited, so a dismissed block comes back when its content changes. */
	rev: string;
}

export async function regionBlocks(store: ReturnType<typeof createStore>, config: Config, input: unknown, now: Date = new Date()): Promise<{ blocks: PublicBlock[] }> {
	const i = typeof input === "object" && input !== null ? (input as Record<string, unknown>) : {};
	const region = typeof i.region === "string" ? i.region : "";
	if (!config.regions.some((r) => r.id === region)) return { blocks: [] };
	const path = typeof i.path === "string" && i.path.length <= 2000 ? i.path : "/";
	const chosen = selectBlocks(await store.listPublished(), { region, path, now });
	return { blocks: chosen.map((b) => ({ id: b.id, type: b.type, style: b.style, dismissible: b.dismissible, width: b.width ?? "full", props: b.props, rev: b.rev ?? b.updatedAt })) };
}
