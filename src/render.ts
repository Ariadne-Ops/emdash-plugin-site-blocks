import { isSafeLink } from "./model";

/** One run in a paragraph: plain text, a link, or a line break. Never HTML; the Astro component escapes the text. */
export type Part = { text: string; href?: string } | { br: true };

const LINK = /\[([^\]\n]+)\]\(([^)\s]+)\)/g;

function inline(line: string): Part[] {
	const parts: Part[] = [];
	let at = 0;
	for (const m of line.matchAll(LINK)) {
		if (!isSafeLink(m[2])) continue; // left in the text as typed
		if (m.index! > at) parts.push({ text: line.slice(at, m.index) });
		parts.push({ text: m[1], href: m[2] });
		at = m.index! + m[0].length;
	}
	if (at < line.length) parts.push({ text: line.slice(at) });
	return merge(parts);
}

/** Adjacent plain-text runs become one, so an unsafe link left as typed reads as a single piece of text. */
function merge(parts: Part[]): Part[] {
	const out: Part[] = [];
	for (const p of parts) {
		const last = out[out.length - 1];
		if ("text" in p && !p.href && last && "text" in last && !last.href) last.text += p.text;
		else out.push({ ...p });
	}
	return out;
}

export function parseRichText(src: string): Part[][] {
	if (typeof src !== "string") return [];
	return src
		.split(/\r?\n\s*\r?\n/)
		.map((para) => para.split(/\r?\n/).map((l) => l.trim()).filter(Boolean))
		.filter((lines) => lines.length)
		.map((lines) => merge(lines.flatMap((line, i) => (i ? [{ br: true } as Part, ...inline(line)] : inline(line)))));
}
