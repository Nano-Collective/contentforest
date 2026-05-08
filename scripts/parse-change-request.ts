/**
 * Parses a GitHub issue-form body (markdown produced by an issue template)
 * into a JSON job spec consumable by `scripts/change-request.ts`.
 *
 * Issue forms produce predictable markdown — each field becomes a
 * `### <Field label>` heading followed by the value (or `_No response_`
 * when left blank). This script reads the body from stdin, extracts the
 * known fields, normalises the scope dropdown to an enum, and emits the
 * spec on stdout.
 *
 *   echo "$ISSUE_BODY" | pnpm --silent parse-change-request \
 *     --requester willlamerton --issue-number 123
 *
 * Exits non-zero on missing required fields with a human-readable error
 * on stderr — the workflow surfaces that as a step failure.
 *
 * Target shape: `<product>/<version>` for a pack target, or
 * `<product>/<version>/articles/<slug>` for an article target. The parser
 * derives `product`, `version`, and (when present) `articleSlug` from the
 * picked target — kept on the JobSpec so downstream code reads them
 * directly without reparsing the path.
 */

import {parseArgs} from 'node:util';

export type Scope = 'whole-pack' | 'channels' | 'article' | 'file';

export type JobSpec = {
	product: string;
	version: string;
	scope: Scope;
	articleSlug: string | null;
	filePath: string | null;
	request: string;
	context: string | null;
	requester: string;
	issueNumber: number;
};

// Scope dropdown labels in the issue form → enum values used by the
// orchestrator. The "whole" label covers both pack and article targets;
// scope=article is derived from the Target shape, not picked separately.
const SCOPE_MAP: Record<string, Scope> = {
	'whole pack / article': 'whole-pack',
	'headline channels (channels/*.md)': 'channels',
	'specific file': 'file',
};

// Issue-form field labels → JobSpec keys. Order is the section order in the
// rendered markdown; the parser tolerates any order in practice.
const FIELDS = {
	Target: 'target',
	Scope: 'scope',
	'File path': 'filePath',
	Request: 'request',
	'Additional context': 'context',
} as const;

const TARGET_PACK_RE = /^([a-z0-9]+(?:-[a-z0-9]+)*)\/([A-Za-z0-9._-]+)$/;
const TARGET_ARTICLE_RE =
	/^([a-z0-9]+(?:-[a-z0-9]+)*)\/([A-Za-z0-9._-]+)\/articles\/([a-z0-9]+(?:-[a-z0-9]+)*)$/;

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

type ParsedTarget = {
	product: string;
	version: string;
	articleSlug: string | null;
};

function parseTarget(raw: string): ParsedTarget {
	const articleMatch = raw.match(TARGET_ARTICLE_RE);
	if (articleMatch) {
		return {
			product: articleMatch[1],
			version: articleMatch[2],
			articleSlug: articleMatch[3],
		};
	}
	const packMatch = raw.match(TARGET_PACK_RE);
	if (packMatch) {
		return {
			product: packMatch[1],
			version: packMatch[2],
			articleSlug: null,
		};
	}
	throw new ParseError(
		`Target must be "<product>/<version>" or "<product>/<version>/articles/<slug>"; got "${raw}"`,
	);
}

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

	const targetRaw = required('Target').trim();
	const target = parseTarget(targetRaw);

	const scopeLabel = required('Scope');
	let scope = SCOPE_MAP[scopeLabel.toLowerCase()];
	if (!scope) {
		throw new ParseError(
			`unknown scope "${scopeLabel}"; expected one of: ${Object.keys(SCOPE_MAP).join(', ')}`,
		);
	}

	// "Whole" against an article target maps to the article scope downstream;
	// against a pack target, it stays whole-pack. The orchestrator scopes
	// agent file access accordingly.
	if (scope === 'whole-pack' && target.articleSlug) {
		scope = 'article';
	}

	const filePath = fields.get('File path') ?? null;
	const request = required('Request');
	const context = fields.get('Additional context') ?? null;

	if (scope === 'file' && !filePath) {
		throw new ParseError('scope = "Specific file" requires a File path');
	}

	return {
		product: target.product,
		version: target.version,
		scope,
		articleSlug: target.articleSlug,
		filePath,
		request,
		context,
		requester,
		issueNumber,
	};
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
			'parse-change-request: --requester and --issue-number are required',
		);
		process.exit(2);
	}
	const issueNumber = Number.parseInt(issueNumberRaw, 10);
	if (!Number.isFinite(issueNumber)) {
		console.error(`parse-change-request: --issue-number must be an integer`);
		process.exit(2);
	}

	const body = await readStdin();
	if (!body.trim()) {
		console.error('parse-change-request: empty issue body on stdin');
		process.exit(2);
	}

	try {
		const fields = extractFields(body);
		const spec = buildJobSpec({fields, requester, issueNumber});
		process.stdout.write(`${JSON.stringify(spec)}\n`);
	} catch (e) {
		if (e instanceof ParseError) {
			console.error(`parse-change-request: ${e.message}`);
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
