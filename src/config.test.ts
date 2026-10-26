import { describe, it, expect } from "vitest";
import { resolveConfig } from "./config";
import { BUILTIN_TYPES, DEFAULT_REGIONS } from "./model";

describe("resolveConfig", () => {
	it("defaults to the built-in types and the default regions", () => {
		const c = resolveConfig();
		expect(c.regions).toEqual(DEFAULT_REGIONS);
		expect(c.types.map((t) => t.id)).toEqual(BUILTIN_TYPES.map((t) => t.id));
	});
	it("uses the site's regions instead of the defaults, and adds its own types after the built-ins", () => {
		const c = resolveConfig({ regions: [{ id: "top", label: "Top" }], types: [{ id: "sponsor", label: "Sponsor", fields: [] }] });
		expect(c.regions).toEqual([{ id: "top", label: "Top" }]);
		expect(c.types.map((t) => t.id)).toEqual(["notice", "richtext", "sponsor"]);
	});
	it("a site type with a built-in's id replaces it", () => {
		const c = resolveConfig({ types: [{ id: "notice", label: "Banner", fields: [{ id: "text", label: "Message", kind: "text", required: true }] }] });
		expect(c.types.filter((t) => t.id === "notice")).toEqual([{ id: "notice", label: "Banner", fields: [{ id: "text", label: "Message", kind: "text", required: true }] }]);
	});
	it("drops malformed region and type entries and duplicate ids instead of failing the site", () => {
		const c = resolveConfig({ regions: [{ id: "a", label: "A" }, { id: "a", label: "Again" }, { id: "Bad Id!", label: "x" }, null as any, { id: "b" } as any], types: [{ id: "ok", label: "Ok", fields: [] }, { label: "no id" } as any] });
		expect(c.regions).toEqual([{ id: "a", label: "A" }]);
		expect(c.types.map((t) => t.id)).toEqual(["notice", "richtext", "ok"]);
	});
	it("falls back to the default regions when every given region is malformed", () => {
		expect(resolveConfig({ regions: [null as any] }).regions).toEqual(DEFAULT_REGIONS);
	});
	it("caches for 30 seconds unless told otherwise, and ignores a nonsense value", () => {
		expect(resolveConfig().cacheSeconds).toBe(30);
		expect(resolveConfig({ cacheSeconds: 0 }).cacheSeconds).toBe(0);
		expect(resolveConfig({ cacheSeconds: 120 }).cacheSeconds).toBe(120);
		expect(resolveConfig({ cacheSeconds: -5 }).cacheSeconds).toBe(30);
		expect(resolveConfig({ cacheSeconds: Number.NaN }).cacheSeconds).toBe(30);
		expect(resolveConfig({ cacheSeconds: 999999 }).cacheSeconds).toBe(3600);
	});
});
