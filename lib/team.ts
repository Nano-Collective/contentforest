/**
 * Loader and helpers for `config/team.json` — the single source of truth for
 * team members, the channels they publish to, and the per-channel validation
 * rules used when generating personal-content packs.
 *
 * The personal-pack pipeline is opt-in: if `config/team.json` is missing or
 * empty, `loadTeam()` returns `[]` and nothing else fires. This is the hook
 * that lets the upcoming `@nanocollective/contentforest-core` whitelabel
 * version drop into a consumer repo with no team file at all.
 *
 * Channel rules here OVERRIDE / EXTEND `config/channels.json` for files
 * with `kind: personal` — `channels.json` is not consulted for personal
 * files. A member's `channels[]` is also the allowlist: a channel a member
 * doesn't list will not be generated for them, even if it appears in
 * `channels.json`.
 *
 * Validation is hand-rolled (the project does not use Zod elsewhere); errors
 * surface as `TeamConfigError` with the offending path and a concrete
 * "expected X, got Y" message.
 */
import {existsSync, readFileSync} from 'node:fs';
import {join} from 'node:path';

const DEFAULT_TEAM_PATH = join(process.cwd(), 'config/team.json');

export type TeamChannelKind = 'long-form' | 'social';

export type TeamChannel = {
	slug: string;
	kind: TeamChannelKind;
	handle?: string;
	min_words?: number;
	max_words?: number;
	max_chars?: number;
	/**
	 * Number of files the personal-channels agent must produce for this
	 * channel per run. Defaults to 1. When > 1, files are written as
	 * `<slug>1.md`..`<slug>N.md` (no unnumbered `<slug>.md`). The validator
	 * enforces both the count and the filename shape.
	 */
	count?: number;
	rules?: string[];
	bundle_with?: string[];
};

export type AgentMode = 'bundled' | 'per-channel';

export type TeamMemberVoice = {
	tone: string;
	do: string[];
	dont: string[];
	samples: string[];
};

export type TeamMember = {
	slug: string;
	name: string;
	github: string;
	role: string;
	voice: TeamMemberVoice;
	channels: TeamChannel[];
	agent_mode: AgentMode;
};

export class TeamConfigError extends Error {}

const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const VALID_KINDS: TeamChannelKind[] = ['long-form', 'social'];
const VALID_AGENT_MODES: AgentMode[] = ['bundled', 'per-channel'];

function isStringArray(v: unknown): v is string[] {
	return Array.isArray(v) && v.every(x => typeof x === 'string');
}

function requireString(
	obj: Record<string, unknown>,
	key: string,
	path: string,
): string {
	const v = obj[key];
	if (typeof v !== 'string' || v.length === 0) {
		throw new TeamConfigError(
			`${path}.${key}: expected non-empty string, got ${JSON.stringify(v)}`,
		);
	}
	return v;
}

function optionalNumber(
	obj: Record<string, unknown>,
	key: string,
	path: string,
): number | undefined {
	const v = obj[key];
	if (v === undefined) return undefined;
	if (typeof v !== 'number' || !Number.isFinite(v) || v < 0) {
		throw new TeamConfigError(
			`${path}.${key}: expected non-negative number, got ${JSON.stringify(v)}`,
		);
	}
	return v;
}

function parseChannel(raw: unknown, path: string): TeamChannel {
	if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
		throw new TeamConfigError(`${path}: expected object`);
	}
	const obj = raw as Record<string, unknown>;
	const slug = requireString(obj, 'slug', path);
	if (!SLUG_RE.test(slug)) {
		throw new TeamConfigError(
			`${path}.slug: expected kebab-case, got "${slug}"`,
		);
	}
	const kind = requireString(obj, 'kind', path);
	if (!(VALID_KINDS as string[]).includes(kind)) {
		throw new TeamConfigError(
			`${path}.kind: expected one of ${VALID_KINDS.join(', ')}, got "${kind}"`,
		);
	}
	const handle =
		obj.handle === undefined ? undefined : requireString(obj, 'handle', path);
	const min_words = optionalNumber(obj, 'min_words', path);
	const max_words = optionalNumber(obj, 'max_words', path);
	const max_chars = optionalNumber(obj, 'max_chars', path);
	const count = optionalNumber(obj, 'count', path);
	if (count !== undefined && (!Number.isInteger(count) || count < 1)) {
		throw new TeamConfigError(
			`${path}.count: expected positive integer, got ${JSON.stringify(count)}`,
		);
	}
	let rules: string[] | undefined;
	if (obj.rules !== undefined) {
		if (!isStringArray(obj.rules)) {
			throw new TeamConfigError(
				`${path}.rules: expected string[], got ${JSON.stringify(obj.rules)}`,
			);
		}
		rules = obj.rules;
	}
	let bundle_with: string[] | undefined;
	if (obj.bundle_with !== undefined) {
		if (!isStringArray(obj.bundle_with)) {
			throw new TeamConfigError(
				`${path}.bundle_with: expected string[], got ${JSON.stringify(obj.bundle_with)}`,
			);
		}
		bundle_with = obj.bundle_with;
	}
	return {
		slug,
		kind: kind as TeamChannelKind,
		...(handle !== undefined && {handle}),
		...(min_words !== undefined && {min_words}),
		...(max_words !== undefined && {max_words}),
		...(max_chars !== undefined && {max_chars}),
		...(count !== undefined && {count}),
		...(rules !== undefined && {rules}),
		...(bundle_with !== undefined && {bundle_with}),
	};
}

function parseVoice(raw: unknown, path: string): TeamMemberVoice {
	if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
		throw new TeamConfigError(`${path}: expected object`);
	}
	const obj = raw as Record<string, unknown>;
	const tone = requireString(obj, 'tone', path);
	if (!isStringArray(obj.do)) {
		throw new TeamConfigError(`${path}.do: expected string[]`);
	}
	if (!isStringArray(obj.dont)) {
		throw new TeamConfigError(`${path}.dont: expected string[]`);
	}
	if (!isStringArray(obj.samples)) {
		throw new TeamConfigError(`${path}.samples: expected string[]`);
	}
	return {tone, do: obj.do, dont: obj.dont, samples: obj.samples};
}

export function parseTeam(raw: unknown): TeamMember[] {
	if (!Array.isArray(raw)) {
		throw new TeamConfigError('team.json: expected top-level array');
	}
	const members: TeamMember[] = [];
	const seen = new Set<string>();
	for (let i = 0; i < raw.length; i++) {
		const path = `team[${i}]`;
		const entry = raw[i];
		if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
			throw new TeamConfigError(`${path}: expected object`);
		}
		const obj = entry as Record<string, unknown>;
		const slug = requireString(obj, 'slug', path);
		if (!SLUG_RE.test(slug)) {
			throw new TeamConfigError(
				`${path}.slug: expected kebab-case, got "${slug}"`,
			);
		}
		if (seen.has(slug)) {
			throw new TeamConfigError(`${path}.slug: duplicate "${slug}"`);
		}
		seen.add(slug);
		const name = requireString(obj, 'name', path);
		const github = requireString(obj, 'github', path);
		const role = requireString(obj, 'role', path);
		const voice = parseVoice(obj.voice, `${path}.voice`);
		if (!Array.isArray(obj.channels)) {
			throw new TeamConfigError(`${path}.channels: expected array`);
		}
		const channels = obj.channels.map((c, j) =>
			parseChannel(c, `${path}.channels[${j}]`),
		);
		const channelSeen = new Set<string>();
		for (const c of channels) {
			if (channelSeen.has(c.slug)) {
				throw new TeamConfigError(
					`${path}.channels: duplicate channel slug "${c.slug}"`,
				);
			}
			channelSeen.add(c.slug);
		}
		// bundle_with must reference sibling channels on the same member and
		// must not reference the channel itself.
		for (const c of channels) {
			if (!c.bundle_with) continue;
			for (const ref of c.bundle_with) {
				if (ref === c.slug) {
					throw new TeamConfigError(
						`${path}.channels[${c.slug}].bundle_with: cannot reference self`,
					);
				}
				if (!channelSeen.has(ref)) {
					throw new TeamConfigError(
						`${path}.channels[${c.slug}].bundle_with: unknown channel "${ref}"`,
					);
				}
			}
		}
		let agent_mode: AgentMode = 'bundled';
		if (obj.agent_mode !== undefined) {
			if (
				typeof obj.agent_mode !== 'string' ||
				!(VALID_AGENT_MODES as string[]).includes(obj.agent_mode)
			) {
				throw new TeamConfigError(
					`${path}.agent_mode: expected one of ${VALID_AGENT_MODES.join(', ')}, got ${JSON.stringify(obj.agent_mode)}`,
				);
			}
			agent_mode = obj.agent_mode as AgentMode;
		}
		members.push({slug, name, github, role, voice, channels, agent_mode});
	}
	return members;
}

/**
 * Loads `config/team.json`. Missing file or empty array is a non-error: the
 * personal-pack pipeline is opt-in, and consumers of `@nanocollective/
 * contentforest-core` may not ship a team file at all.
 */
export function loadTeam(path: string = DEFAULT_TEAM_PATH): TeamMember[] {
	if (!existsSync(path)) return [];
	const raw = JSON.parse(readFileSync(path, 'utf8')) as unknown;
	return parseTeam(raw);
}

export function findMember(
	team: TeamMember[],
	slug: string,
): TeamMember | undefined {
	return team.find(m => m.slug === slug);
}

/**
 * Resolves the channel set for a personal pack. Returns the union of:
 *   1. Member channels that ALSO appear in the base pack (1:1 personal version).
 *   2. Member channels NOT in the base pack (member-only channels — e.g. a
 *      personal Medium post when the base pack didn't target Medium).
 *
 * Channels in the base pack that the member doesn't publish to are skipped —
 * the member's `channels[]` is the source of truth, not the base pack.
 */
export function expandChannels(
	member: TeamMember,
	basePackChannelSlugs: string[],
): {
	mirrored: TeamChannel[];
	additional: TeamChannel[];
} {
	const baseSet = new Set(basePackChannelSlugs);
	const mirrored: TeamChannel[] = [];
	const additional: TeamChannel[] = [];
	for (const c of member.channels) {
		if (baseSet.has(c.slug)) mirrored.push(c);
		else additional.push(c);
	}
	return {mirrored, additional};
}

/**
 * Groups channels into agent-spawn units based on `bundle_with`. Channels with
 * `bundle_with: ["x"]` end up in the same group as `x`. Transitive: A bundles
 * B and B bundles C → A, B, C in one group. Channels with no `bundle_with`
 * (and not referenced by any) form singleton groups.
 *
 * Used by `personal-request.ts` when `agent_mode === "per-channel"` to decide
 * how many Nanocoder spawns to run and which channels each one handles.
 *
 * Returns groups preserving the input order of the first channel in each
 * group, so callers get a stable iteration order.
 */
export function partitionChannelGroups(
	channels: TeamChannel[],
): TeamChannel[][] {
	const slugIndex = new Map(channels.map((c, i) => [c.slug, i]));
	const parent = channels.map((_, i) => i);
	const find = (i: number): number => {
		while (parent[i] !== i) {
			parent[i] = parent[parent[i]];
			i = parent[i];
		}
		return i;
	};
	const union = (a: number, b: number) => {
		const ra = find(a);
		const rb = find(b);
		if (ra !== rb) parent[Math.max(ra, rb)] = Math.min(ra, rb);
	};
	for (let i = 0; i < channels.length; i++) {
		const refs = channels[i].bundle_with ?? [];
		for (const ref of refs) {
			const j = slugIndex.get(ref);
			if (j !== undefined) union(i, j);
		}
	}
	const groups = new Map<number, TeamChannel[]>();
	for (let i = 0; i < channels.length; i++) {
		const root = find(i);
		let bucket = groups.get(root);
		if (!bucket) {
			bucket = [];
			groups.set(root, bucket);
		}
		bucket.push(channels[i]);
	}
	return [...groups.values()];
}
