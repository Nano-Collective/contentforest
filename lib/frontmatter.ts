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

const SPACE = ' '.charCodeAt(0);
const TAB = '\t'.charCodeAt(0);

/**
 * Returns the body of the first line in `block` that starts with
 * `key:` followed by a space or tab. The body is everything after the
 * colon+whitespace separator, trimmed of leading/trailing whitespace. Used
 * to look up a single frontmatter value. Returns null when no such line
 * exists.
 *
 * Implemented with string ops rather than a `new RegExp(\`^${key}...\`)` to
 * avoid the non-literal-regex lint warning: `key` is caller-supplied and
 * could carry regex metacharacters, so we'd have to escape it. Splitting
 * the block into lines and using `startsWith` / indexed slicing is no
 * slower in practice and removes the need for an escape pass.
 */
function findKeyLine(block: string, key: string): string | null {
	const prefix = `${key}:`;
	for (const line of block.split('\n')) {
		if (!line.startsWith(prefix)) continue;
		// First char after the colon must be a space or tab; anything else
		// means we matched a longer key by prefix (e.g. "channel" vs
		// "channel_slug").
		const i = prefix.length;
		const sep = line.charCodeAt(i);
		if (sep !== SPACE && sep !== TAB) continue;
		return line.slice(i + 1);
	}
	return null;
}

/**
 * Returns the index of the first line in `block` that starts with
 * `key:` followed by a space or tab, or -1 if no such line exists. Used by
 * `setFrontmatterField` to replace the line in place. Uses the same
 * `startsWith` + colon-lookahead rule as `findKeyLine` so the two
 * functions agree on what counts as a match.
 */
function indexOfKeyLine(block: string, key: string): number {
	const prefix = `${key}:`;
	const lines = block.split('\n');
	let offset = 0;
	for (const line of lines) {
		if (line.startsWith(prefix)) {
			const i = prefix.length;
			const sep = line.charCodeAt(i);
			if (sep === SPACE || sep === TAB) {
				return offset;
			}
		}
		offset += line.length + 1; // +1 for the consumed '\n'
	}
	return -1;
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
	const at = indexOfKeyLine(block, key);
	const newBlock =
		at >= 0 ? replaceLineAt(block, at, newLine) : `${block}\n${newLine}`;
	return `---\n${newBlock}\n---\n${raw.slice(fence.length)}`;
}

/**
 * Replaces the line that starts at `offset` in `block` with `newLine`.
 * The line runs to the next '\n' (or to the end of `block`).
 */
function replaceLineAt(block: string, offset: number, newLine: string): string {
	const nl = block.indexOf('\n', offset);
	if (nl === -1) {
		return block.slice(0, offset) + newLine;
	}
	return block.slice(0, offset) + newLine + block.slice(nl);
}

export function getFrontmatterField(raw: string, key: string): string | null {
	const match = raw.match(FENCE_RE);
	if (!match) return null;
	const body = findKeyLine(match[1], key);
	if (body === null) return null;
	const v = body.trim();
	if (
		(v.startsWith('"') && v.endsWith('"')) ||
		(v.startsWith("'") && v.endsWith("'"))
	) {
		return v.slice(1, -1);
	}
	return v;
}
