import { describe, it, expect } from "vitest";
import { experimental_AstroContainer as AstroContainer } from "astro/container";
import SponsorCard from "../../examples/SponsorCard.astro";
import NoticeCustom from "../../examples/NoticeCustom.astro";
// @ts-expect-error the sample is plain JavaScript
import example from "../../examples/astro.config.example.mjs";
import { resolveConfig } from "../config";
import { validateBlockInput } from "../model";

const block = (o: Record<string, unknown> = {}) => ({ id: "b1", type: "sponsor", style: "light", dismissible: true, width: "half", rev: "r", props: {}, ...o });
const html = async (C: any, props: any) => (await AstroContainer.create()).renderToString(C, { props, request: new Request("https://site.example/") });

describe("the examples", () => {
	it("SponsorCard renders inside the shell, escapes text and only links safe addresses", async () => {
		const out = await html(SponsorCard, { block: block({ props: { name: "<b>Acme</b>", tagline: "Slides & swings", url: "https://acme.example" } }) });
		expect(out).toContain('data-sb-width="half"');
		expect(out).toContain("&lt;b&gt;Acme");
		expect(out).toContain('href="https://acme.example"');
		expect(await html(SponsorCard, { block: block({ props: { name: "Acme", url: "javascript:alert(1)" } }) })).not.toContain("javascript:");
	});
	it("NoticeCustom replaces the built-in markup but keeps the shell", async () => {
		const out = await html(NoticeCustom, { block: block({ type: "notice", style: "coral", props: { badge: "NEW", heading: "Hi", text: "We grew.", linkText: "See", linkUrl: "/new" } }) });
		expect(out).toContain("my-notice__copy");
		expect(out).toContain('<a class="sb-btn sb-btn-primary" href="/new">See</a>');
		expect(out).toContain("sb-style-coral");
	});
	it("the example configuration is valid: its styles, regions and the sponsor type pass the plugin's own checks", () => {
		const opts = (example as any).integrations[0].options ?? undefined;
		expect(opts).toBeDefined();
		const cfg = resolveConfig(opts);
		expect(cfg.regions.map((r) => r.id)).toEqual(["above-header", "footer-top", "sidebar"]);
		const ok = validateBlockInput({ region: "sidebar", type: "sponsor", title: "Acme", status: "published", style: "dark", props: { name: "Acme", tier: "gold", url: "/sponsors" } }, cfg);
		expect(ok.ok).toBe(true);
		expect(validateBlockInput({ region: "sidebar", type: "sponsor", title: "Acme", status: "published", props: { name: "Acme", tier: "bronze" } }, cfg).ok).toBe(false);
		expect(validateBlockInput({ region: "above-header", type: "notice", title: "n", status: "published", style: "band", props: { text: "hi" } }, cfg).ok).toBe(true);
	});
});
