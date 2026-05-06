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
	rules?: string[];
};

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
};

export class TeamConfigError extends Error {}

const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const VALID_KINDS: TeamChannelKind[] = ['long-form', 'social'];

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
	let rules: string[] | undefined;
	if (obj.rules !== undefined) {
		if (!isStringArray(obj.rules)) {
			throw new TeamConfigError(
				`${path}.rules: expected string[], got ${JSON.stringify(obj.rules)}`,
			);
		}
		rules = obj.rules;
	}
	return {
		slug,
		kind: kind as TeamChannelKind,
		...(handle !== undefined && {handle}),
		...(min_words !== undefined && {min_words}),
		...(max_words !== undefined && {max_words}),
		...(max_chars !== undefined && {max_chars}),
		...(rules !== undefined && {rules}),
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
		members.push({slug, name, github, role, voice, channels});
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
