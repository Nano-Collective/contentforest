/**
 * Parses a GitHub issue-form body (markdown produced by an issue template)
 * into a JSON job spec consumable by `scripts/generate-content.ts` — the
 * new-release-content path. Sister to `parse-change-request.ts`; the two
 * share the field-extraction shape but produce different specs (this one
 * generates a fresh release pack, that one edits an existing one).
 *
 * Issue forms produce predictable markdown — each field becomes a
 * `### <Field label>` heading followed by the value (or `_No response_`
 * when left blank). This script reads the body from stdin, extracts the
 * known fields, and emits the spec on stdout.
 *
 *   echo "$ISSUE_BODY" | pnpm --silent parse-release-request \
 *     --requester willlamerton --issue-number 123
 *
 * Exits non-zero on missing/invalid required fields with a human-readable
 * error on stderr — the workflow surfaces that as a step failure.
 *
 * The emitted spec is deliberately small: `product`, `version`, an optional
 * `context`, and the requester/issue metadata. The release body itself is
 * NOT carried on the spec — `generate` fetches the canonical GitHub release
 * body at run time, so we never round-trip multi-KB markdown through the
 * shell. `context` (when present) is appended to that body by the
 * orchestrator so it steers the agent.
 */

import {parseArgs} from 'node:util';

export type JobSpec = {
	product: string;
	version: string;
	context: string | null;
	requester: string;
	issueNumber: number;
};

// Issue-form field labels → JobSpec keys. Order is the section order in the
// rendered markdown; the parser tolerates any order in practice.
const FIELDS = {
	Product: 'product',
	Version: 'version',
	'Additional context': 'context',
} as const;

// Product slugs are kebab-case (see config/products.json); the dropdown only
// ever emits a known slug, but we validate defensively in case someone hand
// -edits the issue body before a `/retry`.
const PRODUCT_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
// Versions are release tags without the `v` prefix — semver plus the usual
// pre-release/build suffixes (e.g. `1.28.0`, `1.28.0-beta.1`). No slashes or
// whitespace, because the value becomes a path segment and a branch name.
const VERSION_RE = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

/* c8 ignore start */
function readStdin(): Promise<string> {
	return new Promise(resolve => {
		const chunks: Buffer[] = [];
		process.stdin.on('data', chunk => chunks.push(chunk as Buffer));
		process.stdin.on('end', () =>
			resolve(Buffer.concat(chunks).toString('utf8')),
		);
	});
}
/* c8 ignore stop */

/**
 * Walks the body line by line. When we hit `### <known-field>` we capture
 * everything until the next known-field heading or EOF, trim, and store. A
 * `###` line whose label is NOT a known field is treated as content of the
 * current field — users routinely paste markdown subheadings inside textarea
 * fields and we must not let those eat the surrounding value. The sentinel
 * `_No response_` is mapped to null.
 */
export function extractFields(body: string): Map<string, string | null> {
	const lines = body.split(/\r?\n/);
	const out = new Map<string, string | null>();
	let currentField: string | null = null;
	let buffer: string[] = [];

	const flush = () => {
		if (currentField === null) return;
		const raw = buffer.join('\n').trim();
		out.set(currentField, raw === '_No response_' || raw === '' ? null : raw);
	};

	for (const line of lines) {
		const heading = line.match(/^###\s+(.+?)\s*$/);
		if (heading) {
			const label = heading[1].trim();
			const matched = Object.keys(FIELDS).find(
				k => k.toLowerCase() === label.toLowerCase(),
			);
			if (matched) {
				flush();
				currentField = matched;
				buffer = [];
				continue;
			}
		}
		if (currentField !== null) buffer.push(line);
	}
	flush();
	return out;
}

export class ParseError extends Error {}

export function buildJobSpec(args: {
	fields: Map<string, string | null>;
	requester: string;
	issueNumber: number;
}): JobSpec {
	const {fields, requester, issueNumber} = args;

	const required = (label: keyof typeof FIELDS): string => {
		const value = fields.get(label);
		if (!value) {
			throw new ParseError(`required field missing: "${label}"`);
		}
		return value;
	};

	const product = required('Product').trim();
	if (!PRODUCT_RE.test(product)) {
		throw new ParseError(
			`Product must be a kebab-case slug (lowercase letters, digits, single hyphens); got "${product}"`,
		);
	}

	// Tolerate a pasted `v` prefix — release tags carry it, humans copy it.
	const version = required('Version').trim().replace(/^v/, '');
	if (!VERSION_RE.test(version)) {
		throw new ParseError(
			`Version must be a release tag without slashes or spaces (e.g. "1.28.0"); got "${version}"`,
		);
	}

	const context = fields.get('Additional context') ?? null;

	return {product, version, context, requester, issueNumber};
}

/* c8 ignore start */
async function main() {
	const {values} = parseArgs({
		allowPositionals: true,
		options: {
			requester: {type: 'string'},
			'issue-number': {type: 'string'},
		},
	});
	const requester = values.requester as string | undefined;
	const issueNumberRaw = values['issue-number'] as string | undefined;
	if (!requester || !issueNumberRaw) {
		console.error(
			'parse-release-request: --requester and --issue-number are required',
		);
		process.exit(2);
	}
	const issueNumber = Number.parseInt(issueNumberRaw, 10);
	if (!Number.isFinite(issueNumber)) {
		console.error(`parse-release-request: --issue-number must be an integer`);
		process.exit(2);
	}

	const body = await readStdin();
	if (!body.trim()) {
		console.error('parse-release-request: empty issue body on stdin');
		process.exit(2);
	}

	try {
		const fields = extractFields(body);
		const spec = buildJobSpec({fields, requester, issueNumber});
		process.stdout.write(`${JSON.stringify(spec)}\n`);
	} catch (e) {
		if (e instanceof ParseError) {
			console.error(`parse-release-request: ${e.message}`);
			process.exit(2);
		}
		throw e;
	}
}

if (process.env.NODE_ENV !== 'test') {
	main().catch(e => {
		console.error(e);
		process.exit(1);
	});
}
/* c8 ignore stop */
