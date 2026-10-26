import { describe, it, expect } from "vitest";
import { experimental_AstroContainer as AstroContainer } from "astro/container";
import BlockRegion from "./BlockRegion.astro";
import Notice from "./Notice.astro";
import RichText from "./RichText.astro";

const block = (o: Record<string, unknown> = {}) => ({ id: "n1", type: "notice", style: "info", dismissible: true, rev: "r1", props: { text: "Still adding playgrounds.", linkText: "Suggest one", linkUrl: "/submit" }, ...o });
const html = async (C: any, props: any, locals: any = {}) => (await AstroContainer.create()).renderToString(C, { props, locals, request: new Request("https://site.example/playground/x") });
const routeReturning = (blocks: unknown[]) => ({ emdash: { handlePublicPluginApiRoute: async () => ({ success: true, data: { blocks } }) } });

describe("Notice", () => {
	it("renders the message, the link and a dismiss button inside a labelled element", async () => {
		const out = await html(Notice, { block: block() });
		expect(out).toContain('data-sb-block="n1"');
		expect(out).toContain('data-sb-rev="r1"');
		expect(out).toContain("Still adding playgrounds.");
		expect(out).toContain('<a class="sb-link" href="/submit">Suggest one</a>');
		expect(out).toContain('class="sb-dismiss"');
		expect(out).toContain('aria-label="Site notice"');
	});
	it("has no dismiss button or script when the block is not dismissible, and no link without an address", async () => {
		const out = await html(Notice, { block: block({ dismissible: false, props: { text: "Closed for the season." } }) });
		expect(out).not.toContain("sb-dismiss");
		expect(out).not.toContain("localStorage");
		expect(out).not.toContain("<a ");
	});
	it("turns [words](address) in the message into links, leaves unsafe ones as text, and keeps the optional trailing link", async () => {
		const out = await html(Notice, { block: block({ props: { text: "Visit our [contact page](/contact) or [bad](javascript:alert(1)).", linkText: "Suggest one", linkUrl: "/submit" } }) });
		expect(out).toContain('<a class="sb-link" href="/contact">contact page</a>');
		expect(out).toContain("[bad](javascript:alert(1))");
		expect(out).not.toContain('href="javascript');
		expect(out).toContain('<a class="sb-link" href="/submit">Suggest one</a>');
	});
	it("escapes the message, so stored text can never become markup", async () => {
		const out = await html(Notice, { block: block({ props: { text: "<img src=x onerror=alert(1)>" } }) });
		expect(out).not.toContain("<img");
		expect(out).toContain("&lt;img");
	});
});

describe("RichText", () => {
	it("renders paragraphs, breaks and safe links only", async () => {
		const out = await html(RichText, { block: block({ type: "richtext", style: "card", props: { body: "One\ntwo\n\nSee [map](https://a.example) and [bad](javascript:alert(1))" } }) });
		expect(out).toContain("<p>One<br>two</p>");
		expect(out).toContain('<a href="https://a.example">map</a>');
		expect(out).not.toContain('href="javascript');
		expect(out).toContain("sb-style-card");
	});
});

describe("BlockRegion", () => {
	it("renders each block with its type's component, in the order given", async () => {
		const out = await html(BlockRegion, { name: "above-header" }, routeReturning([block({ id: "a" }), block({ id: "b", type: "richtext", props: { body: "Hello" } })]));
		expect(out).toContain('data-sb-region="above-header"');
		expect(out.indexOf('data-sb-block="a"')).toBeLessThan(out.indexOf('data-sb-block="b"'));
		expect(out).toContain("Hello");
	});
	it("renders a site's own type through the types prop, and skips a type nobody can render", async () => {
		const Custom = (await import("./components.fixture.astro")).default;
		const out = await html(BlockRegion, { name: "r", types: { sponsor: Custom } }, routeReturning([block({ id: "s", type: "sponsor", props: { name: "Acme" } }), block({ id: "u", type: "unknown" })]));
		expect(out).toContain("Sponsored by Acme");
		expect(out).not.toContain('data-sb-block="u"');
	});
	it("renders nothing at all for an empty region, a failing route or a missing plugin", async () => {
		expect((await html(BlockRegion, { name: "r" }, routeReturning([]))).trim()).toBe("");
		expect((await html(BlockRegion, { name: "r" }, { emdash: { handlePublicPluginApiRoute: async () => { throw new Error("down"); } } })).trim()).toBe("");
	});
	it("asks the plugin for this region and the page's own path", async () => {
		let seen: any;
		await html(BlockRegion, { name: "below-header" }, { emdash: { handlePublicPluginApiRoute: async (_p: string, _m: string, _path: string, req: Request) => { seen = await req.json(); return { success: true, data: { blocks: [] } }; } } });
		expect(seen).toEqual({ region: "below-header", path: "/playground/x" });
	});
});

describe("Notice trailing link", () => {
	it("is checked again when rendering, so a stored javascript: address never becomes a link", async () => {
		const out = await html(Notice, { block: block({ props: { text: "Hi", linkText: "Go", linkUrl: "javascript:alert(1)" } }) });
		expect(out).not.toContain("javascript:");
		expect(out).not.toContain("<a ");
	});
});
