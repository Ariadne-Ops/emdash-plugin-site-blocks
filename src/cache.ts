/**
 * Remembers one async value (the caller passes the loader to each get, so it can use the current request's storage) for `ttlMs`. Reads that arrive together share one load, a failed load is never remembered,
 * and clear() (called after the admin changes a block) drops the value, including one still loading.
 */
export function ttlCache<T>(ttlMs: number, now: () => number = Date.now) {
	let hit: { value: T; at: number } | undefined;
	let inflight: Promise<T> | undefined;
	let epoch = 0;
	return {
		async get(load: () => Promise<T>): Promise<T> {
			if (ttlMs <= 0) return load();
			if (hit && now() - hit.at < ttlMs) return hit.value;
			if (inflight) return inflight;
			const started = epoch;
			const p = load().then((value) => {
				if (started === epoch) hit = { value, at: now() };
				return value;
			}).finally(() => { if (inflight === p) inflight = undefined; });
			inflight = p;
			return p;
		},
		clear() { hit = undefined; inflight = undefined; epoch++; },
	};
}
