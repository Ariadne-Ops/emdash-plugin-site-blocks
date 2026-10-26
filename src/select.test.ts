import { describe, it, expect } from "vitest";
import { selectBlocks, type Block } from "./select";

const b = (o: Partial<Block> & { id: string }): Block => ({ region: "above-header", type: "notice", status: "published", weight: 0, show: "", hide: "", ...o });
const NOW = new Date("2026-10-26T12:00:00Z");

describe("selectBlocks", () => {
	it("returns only the asked region's published blocks, ordered by weight then id", () => {
		const blocks = [b({ id: "c", weight: 1 }), b({ id: "a", weight: 0 }), b({ id: "x", region: "footer-top" }), b({ id: "d", status: "draft" }), b({ id: "b", weight: 0 })];
		expect(selectBlocks(blocks, { region: "above-header", path: "/", now: NOW }).map((x) => x.id)).toEqual(["a", "b", "c"]);
	});
	it("applies show and hide path rules", () => {
		const blocks = [b({ id: "all" }), b({ id: "pg", show: "/playground/*" }), b({ id: "nosubmit", hide: "/submit" })];
		const ids = (path: string) => selectBlocks(blocks, { region: "above-header", path, now: NOW }).map((x) => x.id);
		expect(ids("/playground/x")).toEqual(["all", "nosubmit", "pg"]);
		expect(ids("/submit")).toEqual(["all"]);
		expect(ids("/about")).toEqual(["all", "nosubmit"]);
	});
	it("honors start and end dates (start inclusive, end exclusive) and ignores bad dates", () => {
		const blocks = [b({ id: "future", startsAt: "2026-11-01T00:00:00Z" }), b({ id: "past", endsAt: "2026-10-01T00:00:00Z" }), b({ id: "now", startsAt: "2026-10-26T12:00:00Z", endsAt: "2026-10-27T00:00:00Z" }), b({ id: "junk", startsAt: "not a date" })];
		expect(selectBlocks(blocks, { region: "above-header", path: "/", now: NOW }).map((x) => x.id)).toEqual(["junk", "now"]);
	});
});
