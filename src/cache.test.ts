import { describe, it, expect } from "vitest";
import { ttlCache } from "./cache";

function counter() {
	let n = 0, t = 0;
	return { load: async () => ++n, calls: () => n, tick: (ms: number) => void (t += ms), now: () => t };
}

describe("ttlCache", () => {
	it("serves a fresh value without loading again, and loads again once it is stale", async () => {
		const c = counter(), cache = ttlCache<number>(30_000, c.now);
		expect(await cache.get(c.load)).toBe(1);
		c.tick(29_999);
		expect(await cache.get(c.load)).toBe(1);
		c.tick(2);
		expect(await cache.get(c.load)).toBe(2);
	});
	it("clear() forces the next read to load", async () => {
		const c = counter(), cache = ttlCache<number>(30_000, c.now);
		await cache.get(c.load);
		cache.clear();
		expect(await cache.get(c.load)).toBe(2);
	});
	it("a ttl of 0 never caches", async () => {
		const c = counter(), cache = ttlCache<number>(0, c.now);
		await cache.get(c.load);
		expect(await cache.get(c.load)).toBe(2);
	});
	it("shares one load between reads that arrive together", async () => {
		const c = counter(), cache = ttlCache<number>(30_000, c.now);
		expect(await Promise.all([cache.get(c.load), cache.get(c.load), cache.get(c.load)])).toEqual([1, 1, 1]);
		expect(c.calls()).toBe(1);
	});
	it("does not remember a failure: the next read tries again", async () => {
		let n = 0;
		const cache = ttlCache<number>(30_000), load = async () => { if (++n === 1) throw new Error("down"); return n; };
		await expect(cache.get(load)).rejects.toThrow("down");
		expect(await cache.get(load)).toBe(2);
	});
	it("a clear() during a load keeps that stale result from being cached", async () => {
		let release!: (v: number) => void, n = 0;
		const cache = ttlCache<number>(30_000), load = () => (++n === 1 ? new Promise<number>((r) => (release = r)) : Promise.resolve(n));
		const first = cache.get(load);
		cache.clear();
		release(1);
		await first;
		expect(await cache.get(load)).toBe(2);
	});
});
