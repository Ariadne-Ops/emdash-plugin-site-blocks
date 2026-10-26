/**
 * Path rules for block visibility, modeled on Drupal's block "Pages" setting.
 * One pattern per line; `*` matches any run of characters (slashes included); `<front>` is the home page.
 * A block shows when it matches the show list (an empty list means every page) and does not match the hide list.
 */
export interface PathRules { show: string[]; hide: string[] }

export function parsePatterns(input: unknown): string[] {
	const lines = typeof input === "string" ? input.split(/\r?\n/) : Array.isArray(input) ? input : [];
	const out: string[] = [];
	for (const raw of lines) {
		if (typeof raw !== "string") continue;
		const line = raw.trim();
		if (!line || line.startsWith("#")) continue;
		if (line.toLowerCase() === "<front>") out.push("/");
		else out.push(line === "*" || line.startsWith("/") || line.startsWith("*") ? line : `/${line}`);
	}
	return out;
}

/** Lowercase, no query or hash, no trailing slash (except the root), always a leading slash. */
function normalize(path: string): string {
	let p = path.split("#")[0].split("?")[0].toLowerCase();
	if (!p.startsWith("/")) p = `/${p}`;
	return p.length > 1 ? p.replace(/\/+$/, "") || "/" : p;
}

const toRegExp = (pattern: string) =>
	new RegExp(`^${normalize(pattern === "*" ? "/*" : pattern).replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*")}$`);

export function matchesPath(path: string, patterns: string[]): boolean {
	const p = normalize(path);
	return patterns.some((pattern) => toRegExp(pattern).test(p));
}

export function isVisible(path: string, rules: PathRules): boolean {
	if (matchesPath(path, rules.hide)) return false;
	return rules.show.length === 0 || matchesPath(path, rules.show);
}
