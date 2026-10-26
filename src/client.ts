import { PLUGIN_ID } from "./constants";
import type { PublicBlock } from "./public";

type Handler = (pluginId: string, method: string, path: string, request: Request) => Promise<unknown>;

const isBlock = (b: unknown): b is PublicBlock =>
	typeof b === "object" && b !== null && typeof (b as any).id === "string" && typeof (b as any).type === "string" && typeof (b as any).style === "string" &&
	typeof (b as any).dismissible === "boolean" && typeof (b as any).rev === "string" && typeof (b as any).props === "object" && (b as any).props !== null;

/** What <BlockRegion> uses on the server. A broken or missing route means an empty region, never a broken page. */
export async function loadRegion(o: { region: string; path: string; baseUrl: URL; handlePublicPluginApiRoute?: Handler }): Promise<PublicBlock[]> {
	try {
		const request = new Request(new URL(`/_emdash/api/plugins/${PLUGIN_ID}/region`, o.baseUrl), {
			method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ region: o.region, path: o.path }),
		});
		let payload: unknown;
		if (o.handlePublicPluginApiRoute) payload = await o.handlePublicPluginApiRoute(PLUGIN_ID, "POST", "/region", request);
		else { const res = await fetch(request); payload = res.ok ? await res.json() : null; }
		const p = payload as { success?: unknown; data?: { blocks?: unknown } } | null;
		if (!p || p.success !== true || !Array.isArray(p.data?.blocks)) return [];
		return p.data!.blocks.filter(isBlock);
	} catch {
		return [];
	}
}
