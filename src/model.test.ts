import { describe, it, expect } from "vitest";
import { BUILTIN_TYPES, validateBlockInput, type Config } from "./model";

const cfg: Config = {
	regions: [{ id: "above-header", label: "Above header" }, { id: "footer-top", label: "Footer top" }],
	types: [...BUILTIN_TYPES, { id: "sponsor", label: "Sponsor", fields: [{ id: "name", label: "Name", kind: "text", required: true }, { id: "tier", label: "Tier", kind: "select", options: [{ value: "a", label: "A" }] }] }],
};
const ok = (o: Record<string, unknown> = {}) => ({ region: "above-header", type: "notice", title: "Beta notice", status: "published", props: { text: "We are still adding playgrounds." }, ...o });
const errs = (o: Record<string, unknown>) => { const r = validateBlockInput(o, cfg); return r.ok ? [] : r.errors; };

describe("validateBlockInput", () => {
	it("accepts a minimal notice and fills defaults", () => {
		const r = validateBlockInput(ok(), cfg);
		expect(r.ok).toBe(true);
		if (r.ok) expect(r.value).toMatchObject({ region: "above-header", type: "notice", status: "published", weight: 0, show: "", hide: "", dismissible: true, style: "info", props: { text: "We are still adding playgrounds." } });
	});
	it("rejects junk that is not an object", () => {
		expect(validateBlockInput(null, cfg).ok).toBe(false);
		expect(validateBlockInput("x", cfg).ok).toBe(false);
	});
	it("rejects an unknown region or type", () => {
		expect(errs(ok({ region: "nope" }))).toContain("Choose one of the regions this site defines.");
		expect(errs(ok({ type: "nope" }))).toContain("Choose a block type this site supports.");
	});
	it("needs an admin title of at most 120 characters and a valid status", () => {
		expect(errs(ok({ title: "  " }))).toContain("Give the block a name (shown only in the admin).");
		expect(errs(ok({ title: "x".repeat(121) }))).toContain("The name can be at most 120 characters.");
		expect(errs(ok({ status: "live" }))).toContain("Status must be published or draft.");
	});
	it("keeps weight an integer in range", () => {
		expect(errs(ok({ weight: 1.5 }))).toContain("Weight must be a whole number from -1000 to 1000.");
		expect(errs(ok({ weight: 5000 }))).toContain("Weight must be a whole number from -1000 to 1000.");
		const r = validateBlockInput(ok({ weight: "7" }), cfg);
		expect(r.ok && r.value.weight).toBe(7);
	});
	it("limits path rules", () => {
		expect(errs(ok({ show: "x".repeat(2001) }))).toContain("Show paths are too long.");
		expect(errs(ok({ hide: Array.from({ length: 51 }, (_, i) => `/p${i}`).join("\n") }))).toContain("Hide paths can have at most 50 lines.");
	});
	it("checks dates and their order", () => {
		expect(errs(ok({ startsAt: "soon" }))).toContain("Start must be a date and time.");
		expect(errs(ok({ startsAt: "2026-11-02T00:00:00Z", endsAt: "2026-11-01T00:00:00Z" }))).toContain("End must be after start.");
		const r = validateBlockInput(ok({ startsAt: "", endsAt: "2026-11-01T00:00:00Z" }), cfg);
		expect(r.ok && r.value.startsAt).toBeUndefined();
	});
	it("validates props against the type's fields: required, length, select options, safe urls", () => {
		expect(errs(ok({ props: {} }))).toContain("Message is required.");
		expect(errs(ok({ props: { text: "x".repeat(501) } }))).toContain("Message can be at most 500 characters.");
		expect(errs(ok({ props: { text: "hi", linkUrl: "javascript:alert(1)" } }))).toContain("Link address must start with https://, http:// or /.");
		expect(errs(ok({ props: { text: "hi", linkUrl: "//evil.example" } }))).toContain("Link address must start with https://, http:// or /.");
		expect(errs(ok({ type: "sponsor", props: { name: "A", tier: "z" } }))).toContain("Tier must be one of the listed choices.");
		expect(errs(ok({ type: "sponsor", props: { name: "A", tier: "a" } }))).toEqual([]);
	});
	it("drops props the type does not define and trims the rest", () => {
		const r = validateBlockInput(ok({ props: { text: "  hi  ", bogus: "x" } }), cfg);
		expect(r.ok && r.value.props).toEqual({ text: "hi" });
	});
	it("only accepts a style the type offers", () => {
		expect(errs(ok({ style: "neon" }))).toContain("Choose one of the listed styles.");
		const r = validateBlockInput(ok({ style: "warning", dismissible: false }), cfg);
		expect(r.ok && [r.value.style, r.value.dismissible]).toEqual(["warning", false]);
	});
});
