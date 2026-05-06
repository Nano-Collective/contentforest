/**
 * Parses a GitHub issue-form body for a personal-pack request into a JSON
 * job spec consumable by `scripts/personal-request.ts`.
 *
 * Sister script to `parse-collective-request.ts` and `parse-change-request.ts`;
 * shares the heading-driven extraction mechanics. The personal-request fields
 * differ: instead of a slug + scope, the requester picks a member (synced
 * dropdown of team.json slugs) and a base pack (kind + id), and the agent
 * mirrors that pack 1:1 into `personal/<member>/`.
 *
 *   echo "$ISSUE_BODY" | pnpm --silent parse-personal-request \
 *     --requester willlamerton --issue-number 123
 *
 * Exits non-zero on missing required fields with a human-readable error
 * on stderr. Anyone-can-request-for-anyone is allowed by design — the
 * `requester` field is recorded in the sidecar but does not have to match
 * the picked member.
 */

import {parseArgs} from 'node:util';

export type BasePackKind = 'product' | 'collective';

export type JobSpec = {
	memberSlug: string;
	basePackKind: BasePackKind;
	basePackId: string;
	context: string | null;
	requester: string;
	issueNumber: number;
};

const KIND_MAP: Record<string, BasePackKind> = {
	'product release': 'product',
	'collective pack': 'collective',
};

const FIELDS = {
	Member: 'memberSlug',
	'Base pack kind': 'basePackKind',
	'Base pack id': 'basePackId',
	'Additional context': 'context',
} as const;

const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
// product/version  e.g.  nanocoder/1.25.0
const PRODUCT_PACK_RE = /^[a-z0-9]+(-[a-z0-9]+)*\/[A-Za-z0-9._-]+$/;
// collective slug  e.g.  contentforest-launch
const COLLECTIVE_PACK_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

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
			flush();
			const label = heading[1].trim();
			currentField =
				Object.keys(FIELDS).find(
					k => k.toLowerCase() === label.toLowerCase(),
				) ?? null;
			buffer = [];
			continue;
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

	const memberSlug = required('Member').trim().toLowerCase();
	if (!SLUG_RE.test(memberSlug)) {
		throw new ParseError(
			`Member must be kebab-case (lowercase letters, digits, single hyphens); got "${memberSlug}"`,
		);
	}

	const kindLabel = required('Base pack kind');
	const basePackKind = KIND_MAP[kindLabel.toLowerCase()];
	if (!basePackKind) {
		throw new ParseError(
			`unknown base pack kind "${kindLabel}"; expected one of: ${Object.keys(KIND_MAP).join(', ')}`,
		);
	}

	const basePackId = required('Base pack id').trim();
	if (basePackKind === 'product' && !PRODUCT_PACK_RE.test(basePackId)) {
		throw new ParseError(
			`Base pack id for a product release must be "<product>/<version>"; got "${basePackId}"`,
		);
	}
	if (basePackKind === 'collective' && !COLLECTIVE_PACK_RE.test(basePackId)) {
		throw new ParseError(
			`Base pack id for a collective pack must be a kebab-case slug; got "${basePackId}"`,
		);
	}

	const context = fields.get('Additional context') ?? null;

	return {
		memberSlug,
		basePackKind,
		basePackId,
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
			'parse-personal-request: --requester and --issue-number are required',
		);
		process.exit(2);
	}
	const issueNumber = Number.parseInt(issueNumberRaw, 10);
	if (!Number.isFinite(issueNumber)) {
		console.error('parse-personal-request: --issue-number must be an integer');
		process.exit(2);
	}

	const body = await readStdin();
	if (!body.trim()) {
		console.error('parse-personal-request: empty issue body on stdin');
		process.exit(2);
	}

	try {
		const fields = extractFields(body);
		const spec = buildJobSpec({fields, requester, issueNumber});
		process.stdout.write(`${JSON.stringify(spec)}\n`);
	} catch (e) {
		if (e instanceof ParseError) {
			console.error(`parse-personal-request: ${e.message}`);
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
