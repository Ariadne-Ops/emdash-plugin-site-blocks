// How a site adds its own styles, select options and block types. Everything here is plain data.
import { BUILTIN_TYPES, siteBlocks } from "emdash-plugin-site-blocks";

// 1. Restyle a built-in type: keep its fields, offer your own styles. (A type with a built-in's id replaces it.)
const notice = {
	...BUILTIN_TYPES.find((t) => t.id === "notice"),
	styles: [
		{ value: "dark", label: "Dark strip" }, // the first style is the default
		{ value: "coral", label: "Coral announcement" },
		{ value: "band", label: "Call-to-action band" },
	],
};

// 2. A new type: fields (text, textarea, url, select), styles, and the text editors see.
const sponsor = {
	id: "sponsor",
	label: "Sponsor card",
	styles: [{ value: "light", label: "Light" }, { value: "dark", label: "Dark" }],
	fields: [
		{ id: "name", label: "Sponsor", kind: "text", required: true, max: 80 },
		{ id: "tagline", label: "One line about them", kind: "text", max: 120 },
		{ id: "url", label: "Website", kind: "url", help: "Starts with https://, http:// or /" },
		// A select becomes a dropdown; the value is what your template receives.
		{ id: "tier", label: "Tier", kind: "select", options: [{ value: "gold", label: "Gold" }, { value: "silver", label: "Silver" }] },
	],
};

export default {
	integrations: [
		// emdash({ plugins: [ ... ] }) in a real config:
		siteBlocks({
			// 3. Your own placements. Each needs a <BlockRegion name="..."> in a layout.
			regions: [
				{ id: "above-header", label: "Above header" },
				{ id: "footer-top", label: "Footer top" },
				{ id: "sidebar", label: "Sidebar" },
			],
			types: [notice, sponsor],
			cacheSeconds: 30,
		}),
	],
};
