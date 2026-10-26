import { describe, it, expect } from "vitest";
import { parseRichText } from "./render";

describe("parseRichText", () => {
	it("splits paragraphs on blank lines and keeps single line breaks as breaks", () => {
		expect(parseRichText("one\ntwo\n\nthree")).toEqual([
			[{ text: "one" }, { br: true }, { text: "two" }],
			[{ text: "three" }],
		]);
	});
	it("turns [text](url) into links for https, http and site-relative addresses", () => {
		expect(parseRichText("see [the map](https://a.example/x?y=1) or [home](/)")).toEqual([[
			{ text: "see " }, { text: "the map", href: "https://a.example/x?y=1" }, { text: " or " }, { text: "home", href: "/" },
		]]);
	});
	it("leaves unsafe or protocol-relative addresses as plain text, never as links", () => {
		const out = parseRichText("[x](javascript:alert(1)) [y](//evil.example) [z](data:text/html,hi)");
		expect(JSON.stringify(out)).not.toContain("href");
		expect(out[0].map((p: any) => p.text).join("")).toContain("javascript:alert(1)");
	});
	it("never produces markup: angle brackets stay literal text", () => {
		expect(parseRichText("<script>alert(1)</script> & <b>x</b>")).toEqual([[{ text: "<script>alert(1)</script> & <b>x</b>" }]]);
	});
	it("ignores empty input and extra blank lines", () => {
		expect(parseRichText("")).toEqual([]);
		expect(parseRichText("\n\n  \n\na\n\n\n\nb\n")).toEqual([[{ text: "a" }], [{ text: "b" }]]);
		expect(parseRichText(undefined as any)).toEqual([]);
	});
	it("an unfinished link marker is plain text", () => {
		expect(parseRichText("a [b](https://x.example")).toEqual([[{ text: "a [b](https://x.example" }]]);
	});
});
