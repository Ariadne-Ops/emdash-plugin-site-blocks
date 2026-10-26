import { describe, it, expect } from "vitest";
import { isVisible, matchesPath, parsePatterns } from "./paths";

describe("parsePatterns", () => {
	it("splits lines, trims, drops blanks and # comments, and adds the leading slash", () => {
		expect(parsePatterns("  /blog/*  \n\n# note\nabout\n*")).toEqual(["/blog/*", "/about", "*"]);
	});
	it("treats <front> as the home page", () => {
		expect(parsePatterns("<front>")).toEqual(["/"]);
	});
	it("accepts an array and non-strings safely", () => {
		expect(parsePatterns(["/a", " /b "])).toEqual(["/a", "/b"]);
		expect(parsePatterns(undefined)).toEqual([]);
		expect(parsePatterns(7 as any)).toEqual([]);
	});
});

describe("matchesPath", () => {
	it("matches exactly, ignoring case, query, hash and a trailing slash", () => {
		expect(matchesPath("/About/?x=1#top", ["/about"])).toBe(true);
		expect(matchesPath("/about-us", ["/about"])).toBe(false);
	});
	it("* matches any run of characters, slashes included", () => {
		expect(matchesPath("/playground/a/b", ["/playground/*"])).toBe(true);
		expect(matchesPath("/playground", ["/playground/*"])).toBe(false);
		expect(matchesPath("/anything/at/all", ["*"])).toBe(true);
		expect(matchesPath("/", ["*"])).toBe(true);
	});
	it("treats regex characters in a pattern as plain text", () => {
		expect(matchesPath("/a.b", ["/a.b"])).toBe(true);
		expect(matchesPath("/axb", ["/a.b"])).toBe(false);
		expect(matchesPath("/a(b", ["/a(b"])).toBe(true);
	});
	it("the home page is /", () => {
		expect(matchesPath("/", ["/"])).toBe(true);
		expect(matchesPath("", ["/"])).toBe(true);
		expect(matchesPath("/x", ["/"])).toBe(false);
	});
});

describe("isVisible", () => {
	it("an empty show list means every page", () => {
		expect(isVisible("/x", { show: [], hide: [] })).toBe(true);
	});
	it("shows only on listed paths when a show list is given", () => {
		expect(isVisible("/blog/a", { show: ["/blog/*"], hide: [] })).toBe(true);
		expect(isVisible("/about", { show: ["/blog/*"], hide: [] })).toBe(false);
	});
	it("a hide match always wins over a show match", () => {
		expect(isVisible("/blog/private", { show: ["*"], hide: ["/blog/private"] })).toBe(false);
		expect(isVisible("/blog/ok", { show: ["*"], hide: ["/blog/private"] })).toBe(true);
	});
	it("hide-only means everywhere except", () => {
		expect(isVisible("/submit", { show: [], hide: ["/submit"] })).toBe(false);
		expect(isVisible("/about", { show: [], hide: ["/submit"] })).toBe(true);
	});
});

describe("matchesPath on hostile input", () => {
	it("stays fast with many wildcards and a long path that almost matches", () => {
		const path = `/blog/${"a".repeat(1900)}`;
		const t = Date.now();
		expect(matchesPath(path, ["/blog/*a*a*a*a*a*b"])).toBe(false);
		expect(matchesPath(path, ["*a*a*a*a*a*a*a*b"])).toBe(false);
		expect(Date.now() - t).toBeLessThan(200);
	});
	it("still matches wildcards in the middle and several in a row", () => {
		expect(matchesPath("/blog/a-b-c", ["/blog/*-*-*"])).toBe(true);
		expect(matchesPath("/blog/a-b", ["/blog/*-*-*"])).toBe(false);
		expect(matchesPath("/x/y/z", ["/x/**/z"])).toBe(true);
		expect(matchesPath("/playground", ["/playground/*"])).toBe(false);
	});
});
