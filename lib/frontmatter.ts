/**
 * Tiny YAML-frontmatter mutator. ContentForest files all use a flat shape
 * (top-level scalar keys, no nesting), so we can set/read a single field
 * with string ops instead of pulling gray-matter into the Cloudflare
 * Worker bundle.
 *
 * If a file has no frontmatter block, `setFrontmatterField` inserts one.
 * Existing keys are replaced in place; new keys are appended at the end of
 * the block. Values are always double-quoted on write — fine for ISO
 * timestamps and most scalars; do not use this for values containing
 * unescaped double quotes or newlines.
 */
const FENCE_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n/;

function escapeRegex(s: string): string {
	return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function keyLineRe(key: string): RegExp {
	return new RegExp(`^${escapeRegex(key)}:[ \\t].*$`, 'm');
}

export function setFrontmatterField(
	raw: string,
	key: string,
	value: string,
): string {
	const newLine = `${key}: "${value}"`;
	const match = raw.match(FENCE_RE);
	if (!match) {
		return `---\n${newLine}\n---\n\n${raw}`;
	}
	const block = match[1];
	const fence = match[0];
	const lineRe = keyLineRe(key);
	const newBlock = lineRe.test(block)
		? block.replace(lineRe, newLine)
		: `${block}\n${newLine}`;
	return `---\n${newBlock}\n---\n${raw.slice(fence.length)}`;
}

export function getFrontmatterField(raw: string, key: string): string | null {
	const match = raw.match(FENCE_RE);
	if (!match) return null;
	const lineRe = new RegExp(`^${escapeRegex(key)}:[ \\t]+(.*)$`, 'm');
	const m = match[1].match(lineRe);
	if (!m) return null;
	const v = m[1].trim();
	if (
		(v.startsWith('"') && v.endsWith('"')) ||
		(v.startsWith("'") && v.endsWith("'"))
	) {
		return v.slice(1, -1);
	}
	return v;
}
