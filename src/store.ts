import type { BlockInput } from "./model";

/** The slice of EmDash's plugin storage collection this plugin uses. */
export interface Collection<T> {
	get(id: string): Promise<T | null>;
	put(id: string, data: T): Promise<void>;
	delete(id: string): Promise<boolean>;
	query(o?: { where?: Record<string, string | number | boolean | null>; orderBy?: Record<string, "asc" | "desc">; limit?: number; cursor?: string }): Promise<{ items: Array<{ id: string; data: T }>; cursor?: string; hasMore: boolean }>;
}

/** `rev` changes only when the content is edited (not on a move or status change), so a dismissed block stays dismissed until its content changes. */
export interface StoredBlock extends BlockInput { id: string; createdAt: string; updatedAt: string; rev?: string }

export function createStore(col: Collection<StoredBlock>, deps: { now?: () => Date; newId?: () => string } = {}) {
	const now = deps.now ?? (() => new Date());
	const newId = deps.newId ?? (() => crypto.randomUUID());

	async function all(where?: Record<string, string>): Promise<StoredBlock[]> {
		const out: StoredBlock[] = [];
		let cursor: string | undefined;
		do {
			const page = await col.query({ where, limit: 100, cursor });
			out.push(...page.items.map((i) => ({ ...i.data, id: i.id })));
			cursor = page.hasMore ? page.cursor : undefined;
		} while (cursor);
		return out;
	}

	const sorted = (xs: StoredBlock[]) => [...xs].sort((a, b) => a.weight - b.weight || a.id.localeCompare(b.id));

	return {
		list: () => all(),
		listPublished: () => all({ status: "published" }),
		get: (id: string) => col.get(id).then((b) => (b ? { ...b, id } : null)),
		async create(input: BlockInput): Promise<StoredBlock> {
			const at = now().toISOString();
			const block: StoredBlock = { ...input, id: newId(), createdAt: at, updatedAt: at, rev: at };
			await col.put(block.id, block);
			return block;
		},
		async update(id: string, input: BlockInput): Promise<StoredBlock | null> {
			const prev = await col.get(id);
			if (!prev) return null;
			const block: StoredBlock = { ...input, id, createdAt: prev.createdAt, updatedAt: now().toISOString(), rev: now().toISOString() };
			await col.put(id, block);
			return block;
		},
		remove: (id: string) => col.delete(id),
		async setStatus(id: string, status: "published" | "draft"): Promise<StoredBlock | null> {
			const prev = await col.get(id);
			if (!prev) return null;
			const block: StoredBlock = { ...prev, id, status, updatedAt: now().toISOString() };
			await col.put(id, block);
			return block;
		},
		/** Swap a block with its neighbour in the same region; weights are renumbered 0, 10, 20 … so ties never decide the order. */
		async move(id: string, dir: "up" | "down"): Promise<void> {
			const target = await col.get(id);
			if (!target) return;
			const peers = sorted((await all()).filter((b) => b.region === target.region));
			const at = peers.findIndex((b) => b.id === id), to = dir === "up" ? at - 1 : at + 1;
			if (at < 0 || to < 0 || to >= peers.length) return;
			[peers[at], peers[to]] = [peers[to], peers[at]];
			const stamp = now().toISOString();
			for (const [i, b] of peers.entries()) if (b.weight !== i * 10) await col.put(b.id, { ...b, weight: i * 10, updatedAt: stamp });
		},
	};
}
