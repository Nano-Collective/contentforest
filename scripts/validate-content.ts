/**
 * Validates committed content packs against the rules defined in `planning.md`
 * §6.6. Hard rules block merge; soft rules emit a warning. The structured
 * report at `validation-report.json` powers the auto-fix loop (planning §6.7).
 *
 * Hard rules:
 *  - Frontmatter has the required fields with the right shapes.
 *  - Every expected file exists (one file per channel in config/channels.json).
 *  - X post is ≤ max_chars; long-form/social channels meet min/max words.
 *  - No forbidden brand-doc terms.
 *  - No unresolved placeholders ({{TODO}}, {{RELEASE_URL}}, etc).
 *  - Body links to the product GitHub repo root URL, not a release URL.
 *  - meta.json exists and parses.
 *
 * Soft rules:
 *  - Marketing-register words ("transformative", "revolutionary", …) — warn.
 *
 * Skips packs whose meta.json has `final_status: "sample"` so the seed pack
 * we ship for the UI doesn't fail the gate.
 *
 * --phase scopes the expected-files contract for the v2 two-agent pipeline
 * (planning §6.4.3). Phases are cumulative supersets:
 *   channels  → meta.json + channels/*.md
 *   articles  → above + articles/<slug>/{meta.json,channels/*.md} per slug
 *   (omitted) → equivalent to "full" (channels + articles — used by CI
 *               Layer 2 and the seed-fixtures path)
 * Per-file rules (frontmatter shape, length, forbidden terms, link policy,
 * placeholders) apply uniformly to every .md actually present, regardless
 * of phase. Legacy personal/<member>/<channel>.md files in older packs are
 * still parsed cleanly (channelSlugFromPath handles them) but no longer
 * required by any phase.
 *
 *   pnpm validate                          # all packs (full phase)
 *   pnpm validate -- --pack nanocoder/0.0.0
 *   pnpm validate -- --pack nanocoder/1.25.2 --phase channels
 *   pnpm validate -- --report validation-report.json
 */
import {
	existsSync,
	readdirSync,
	readFileSync,
	statSync,
	writeFileSync,
} from 'node:fs';
import {join, relative} from 'node:path';
import {fileURLToPath} from 'node:url';
import {parseArgs} from 'node:util';
import matter from 'gray-matter';
import {loadTeam, type TeamChannel, type TeamMember} from '../lib/team.js';

type ChannelKind = 'long-form' | 'social';

type ChannelRule = {
	slug: string;
	kind: ChannelKind;
	min_words?: number;
	max_words?: number;
	max_chars?: number;
};

type Product = {slug: string; repo: string};

type Failure = {
	file: string;
	rule: string;
	expected: string;
	actual: string;
};

type Warning = {
	file: string;
	rule: string;
	message: string;
};

type Report = {
	scannedPacks: string[];
	skippedPacks: string[];
	failures: Failure[];
	warnings: Warning[];
};

const ROOT = process.cwd();

const FORBIDDEN_HARD = [
	'Sovereign AI',
	'Trustless AI',
	'Intimate Technology',
	'Intelligent Infrastructure',
];

const FORBIDDEN_SOFT = [
	'transformative',
	'revolutionary',
	'game-changing',
	'game changing',
	'unleash',
	'supercharge',
	'effortless',
	'seamless',
	'next-generation',
	'next generation',
	'cutting-edge',
	'cutting edge',
	'world-class',
	'leverage',
	'empower',
	'democratize',
	'democratise',
	'disrupt',
	'disruptive',
];

const PLACEHOLDER_PATTERNS = [
	/\{\{[^}]+\}\}/, // {{TODO}}, {{RELEASE_URL}}, …
	/\bTODO\b/i,
];

function readJson<T>(path: string): T {
	return JSON.parse(readFileSync(path, 'utf8')) as T;
}

function loadConfig() {
	const products = readJson<Product[]>(join(ROOT, 'config/products.json'));
	const channels = readJson<ChannelRule[]>(join(ROOT, 'config/channels.json'));
	const team = loadTeam(join(ROOT, 'config/team.json'));
	return {products, channels, team};
}

export type ValidatorConfig = {
	products: Product[];
	channels: ChannelRule[];
	team?: TeamMember[];
};

function findChannel(channels: ChannelRule[], slug: string) {
	return channels.find(c => c.slug === slug);
}

function countWords(body: string) {
	return body.trim().split(/\s+/).filter(Boolean).length;
}

function listDirs(path: string): string[] {
	if (!existsSync(path)) return [];
	return readdirSync(path).filter(entry =>
		statSync(join(path, entry)).isDirectory(),
	);
}

function listMarkdownRecursive(
	path: string,
	excludeDirs: string[] = [],
): string[] {
	const out: string[] = [];
	if (!existsSync(path)) return out;
	for (const entry of readdirSync(path)) {
		const full = join(path, entry);
		const stat = statSync(full);
		if (stat.isDirectory()) {
			if (excludeDirs.includes(entry)) continue;
			out.push(...listMarkdownRecursive(full, excludeDirs));
		} else if (entry.endsWith('.md')) {
			out.push(full);
		}
	}
	return out;
}

const KEBAB_CASE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const MAX_ARTICLES_PER_PACK = 3;

const COLLECTIVE_DIR = '_collective';
const COLLECTIVE_URL = 'https://nanocollective.org';

type PackKind = 'release' | 'article';

type Phase = 'channels' | 'articles' | 'full' | 'personal';

const PHASES: Phase[] = ['channels', 'articles', 'full', 'personal'];

function phaseIncludesArticles(phase: Phase): boolean {
	return phase === 'articles' || phase === 'full' || phase === 'personal';
}

function phaseIncludesNonPersonal(phase: Phase): boolean {
	return phase !== 'personal';
}

/**
 * Channel slug from a file path inside content/<product>/<version>/.
 * - channels/linkedin.md                → "linkedin"
 * - personal/will/linkedin.md           → "personal:will:linkedin"
 * - personal/will-linkedin.md           → "personal:will:linkedin" (flat fallback)
 */
function channelSlugFromPath(packRoot: string, file: string): string {
	const rel = relative(packRoot, file).replaceAll('\\', '/');

	const channelsMatch = rel.match(/^channels\/(.+)\.md$/);
	if (channelsMatch) return channelsMatch[1];

	const personalNested = rel.match(/^personal\/([^/]+)\/(.+)\.md$/);
	if (personalNested)
		return `personal:${personalNested[1]}:${personalNested[2]}`;

	const personalFlat = rel.match(/^personal\/([^/]+)-([^/]+)\.md$/);
	if (personalFlat) return `personal:${personalFlat[1]}:${personalFlat[2]}`;

	const personalSingle = rel.match(/^personal\/(.+)\.md$/);
	if (personalSingle) return `personal:${personalSingle[1]}`;

	return rel;
}

function channelRuleFor(
	channels: ChannelRule[],
	channelSlug: string,
): ChannelRule | undefined {
	if (channelSlug.startsWith('personal:')) {
		const parts = channelSlug.split(':');
		return findChannel(channels, parts[2] ?? parts[1]);
	}
	return findChannel(channels, channelSlug);
}

/**
 * Extracts (member, channel) from a path of shape
 *   <pack-root>/personal/<member>/<channel>.md
 * Returns null if the file isn't under personal/. Does not handle the legacy
 * flat layout (`personal/<member>-<channel>.md`); new `kind: personal` files
 * always use the nested layout.
 */
function personalContextFromPath(
	packRoot: string,
	file: string,
): {member: string; channel: string} | null {
	const rel = relative(packRoot, file).replaceAll('\\', '/');
	const m = rel.match(/^personal\/([^/]+)\/([^/]+)\.md$/);
	if (!m) return null;
	return {member: m[1], channel: m[2]};
}

/**
 * Validates a single `kind: personal` file. Member rules from team.json are
 * the source of truth — channels.json is not consulted. Link policy is
 * permissive: personal posts may link wherever the member chooses.
 *
 * Returns failures/warnings; never throws. The caller iterates files; this
 * function is per-file.
 */
function validatePersonalFile(args: {
	file: string;
	body: string;
	fm: Record<string, unknown>;
	pathContext: {member: string; channel: string};
	team: TeamMember[];
	requireProductVersion?: {product: string; version: string};
	requireCollectiveSlug?: string;
}): {failures: Failure[]; warnings: Warning[]} {
	const failures: Failure[] = [];
	const warnings: Warning[] = [];
	const fileRel = relative(ROOT, args.file);

	const baseFields = [
		'kind',
		'member',
		'channel',
		'generated_at',
		'model',
		'char_count',
	];
	const requiredFields = [...baseFields];
	if (args.requireProductVersion) requiredFields.push('product', 'version');
	if (args.requireCollectiveSlug) requiredFields.push('slug');
	for (const field of requiredFields) {
		if (args.fm[field] === undefined || args.fm[field] === null) {
			failures.push({
				file: fileRel,
				rule: 'frontmatter-shape',
				expected: `field "${field}" present`,
				actual: 'missing',
			});
		}
	}

	if (args.fm.kind !== undefined && args.fm.kind !== 'personal') {
		failures.push({
			file: fileRel,
			rule: 'frontmatter-kind',
			expected: 'personal',
			actual: String(args.fm.kind),
		});
	}

	if (
		args.fm.member !== undefined &&
		args.fm.member !== args.pathContext.member
	) {
		failures.push({
			file: fileRel,
			rule: 'frontmatter-member',
			expected: args.pathContext.member,
			actual: String(args.fm.member),
		});
	}

	if (args.requireProductVersion) {
		if (
			args.fm.product !== undefined &&
			args.fm.product !== args.requireProductVersion.product
		) {
			failures.push({
				file: fileRel,
				rule: 'frontmatter-product',
				expected: args.requireProductVersion.product,
				actual: String(args.fm.product),
			});
		}
		if (
			args.fm.version !== undefined &&
			String(args.fm.version) !== args.requireProductVersion.version
		) {
			failures.push({
				file: fileRel,
				rule: 'frontmatter-version',
				expected: args.requireProductVersion.version,
				actual: String(args.fm.version),
			});
		}
	}
	if (args.requireCollectiveSlug && args.fm.slug !== undefined) {
		if (args.fm.slug !== args.requireCollectiveSlug) {
			failures.push({
				file: fileRel,
				rule: 'frontmatter-slug',
				expected: args.requireCollectiveSlug,
				actual: String(args.fm.slug),
			});
		}
	}

	const member = args.team.find(m => m.slug === args.pathContext.member);
	if (!member) {
		failures.push({
			file: fileRel,
			rule: 'team-member-known',
			expected: `member "${args.pathContext.member}" present in config/team.json`,
			actual: 'missing',
		});
	}

	const channelSlug =
		typeof args.fm.channel === 'string'
			? args.fm.channel
			: args.pathContext.channel;
	let memberChannel: TeamChannel | undefined;
	if (member) {
		memberChannel = member.channels.find(c => c.slug === channelSlug);
		if (!memberChannel) {
			failures.push({
				file: fileRel,
				rule: 'team-channel-known',
				expected: `channel "${channelSlug}" listed in team.json for "${member.slug}"`,
				actual: 'missing',
			});
		}
	}

	if (memberChannel) {
		const charCount = args.body.trim().length;
		const wordCount = countWords(args.body);
		if (
			memberChannel.max_chars !== undefined &&
			charCount > memberChannel.max_chars
		) {
			failures.push({
				file: fileRel,
				rule: 'max-chars',
				expected: `≤${memberChannel.max_chars}`,
				actual: String(charCount),
			});
		}
		if (
			memberChannel.min_words !== undefined &&
			wordCount < memberChannel.min_words
		) {
			failures.push({
				file: fileRel,
				rule: 'min-words',
				expected: `≥${memberChannel.min_words}`,
				actual: String(wordCount),
			});
		}
		if (
			memberChannel.max_words !== undefined &&
			wordCount > memberChannel.max_words
		) {
			failures.push({
				file: fileRel,
				rule: 'max-words',
				expected: `≤${memberChannel.max_words}`,
				actual: String(wordCount),
			});
		}
	}

	for (const term of FORBIDDEN_HARD) {
		const re = new RegExp(`\\b${term}\\b`, 'i');
		if (re.test(args.body)) {
			failures.push({
				file: fileRel,
				rule: 'forbidden-term',
				expected: `no "${term}"`,
				actual: 'present',
			});
		}
	}
	for (const term of FORBIDDEN_SOFT) {
		const re = new RegExp(`\\b${term}\\b`, 'i');
		if (re.test(args.body)) {
			warnings.push({
				file: fileRel,
				rule: 'marketing-register',
				message: `"${term}" — consider replacing with a plainer phrasing`,
			});
		}
	}
	if (args.body.includes('—')) {
		failures.push({
			file: fileRel,
			rule: 'em-dash',
			expected: 'no em-dash (use hyphen, comma, parenthesis, or full stop)',
			actual: 'em-dash present',
		});
	}
	for (const pattern of PLACEHOLDER_PATTERNS) {
		if (pattern.test(args.body)) {
			failures.push({
				file: fileRel,
				rule: 'no-placeholder',
				expected: `no ${pattern.source}`,
				actual: 'present',
			});
		}
	}

	return {failures, warnings};
}

function expectedFiles(args: {
	product: string;
	version: string;
	channels: ChannelRule[];
}): {rel: string; reason: string}[] {
	const expected: {rel: string; reason: string}[] = [];
	expected.push({rel: 'meta.json', reason: 'meta.json missing'});
	for (const channel of args.channels) {
		expected.push({
			rel: `channels/${channel.slug}.md`,
			reason: `channels/${channel.slug}.md missing`,
		});
	}
	return expected;
}

function fileExistsAny(packRoot: string, rel: string): boolean {
	if (existsSync(join(packRoot, rel))) return true;
	// Flat fallback for personal/<member>/<channel>.md
	const m = rel.match(/^personal\/([^/]+)\/(.+)\.md$/);
	if (m && existsSync(join(packRoot, `personal/${m[1]}-${m[2]}.md`))) {
		return true;
	}
	return false;
}

/**
 * Expected filenames for a personal channel: `<slug>.md` when count is 1
 * (or unset), `<slug>1.md`..`<slug>N.md` when count > 1. Numbered files
 * are 1-indexed; unnumbered `<slug>.md` is NOT accepted in the numbered
 * case (avoids ambiguity between "the canonical post" and "the first
 * post").
 */
function expectedPersonalFiles(channel: TeamChannel): string[] {
	const count = channel.count ?? 1;
	if (count === 1) return [`${channel.slug}.md`];
	return Array.from({length: count}, (_, i) => `${channel.slug}${i + 1}.md`);
}

/**
 * For each member's `personal/<member>/` subtree, group .md files by their
 * frontmatter `channel` and compare actual filenames to the expected set
 * derived from `member.channels[].count`. Missing files emit `file-exists`,
 * extras emit `file-unexpected` — reusing existing rule names so auto-fix
 * keeps a single set of recipes.
 *
 * Files whose channel isn't listed in `member.channels` are skipped here;
 * `team-channel-known` fires for those elsewhere. Files for members not in
 * `team.json` are skipped; `team-member-known` covers that case.
 *
 * Scope: when `personalChannels` is set, only those channels are checked,
 * mirroring the per-file filter so per-channel agent spawns don't see
 * count failures for channels they don't own.
 */
function checkPersonalFileCounts(args: {
	packRoot: string;
	team: TeamMember[];
	personalChannels?: string[];
}): Failure[] {
	const failures: Failure[] = [];
	const personalDir = join(args.packRoot, 'personal');
	if (!existsSync(personalDir)) return failures;

	for (const memberSlug of readdirSync(personalDir)) {
		const memberDir = join(personalDir, memberSlug);
		if (!statSync(memberDir).isDirectory()) continue;
		const member = args.team.find(m => m.slug === memberSlug);
		if (!member) continue;

		// Group files by frontmatter.channel. Skip files that aren't kind:
		// personal — the personal directory shouldn't contain other shapes,
		// but if it does they're handled by the main per-file loop.
		const filesByChannel = new Map<string, string[]>();
		for (const entry of readdirSync(memberDir)) {
			if (!entry.endsWith('.md')) continue;
			const filePath = join(memberDir, entry);
			const raw = readFileSync(filePath, 'utf8');
			const fm = matter(raw).data as Record<string, unknown>;
			if (fm.kind !== 'personal') continue;
			const channel =
				typeof fm.channel === 'string'
					? fm.channel
					: entry.replace(/\.md$/, '');
			if (args.personalChannels && !args.personalChannels.includes(channel)) {
				continue;
			}
			const list = filesByChannel.get(channel) ?? [];
			list.push(entry);
			filesByChannel.set(channel, list);
		}

		// Decide which channels to check. Two sources:
		//   1. Member channels with count > 1 are STRICTLY REQUIRED — the agent
		//      must produce exactly N files. Zero files is a fail, not a skip.
		//      Without this, the agent can silently drop a multi-post channel
		//      and the validator passes (we saw this on PR #68 where Ben's
		//      x channel produced 0 files instead of 7).
		//   2. Channels with files on disk are checked for correct shape
		//      regardless of count — catches "wrong filename" / extra files.
		// Single-file channels (count = 1, default) stay permissive: zero
		// files is OK, but if any exist they must match `<slug>.md`.
		const inFilter = (slug: string) =>
			!args.personalChannels || args.personalChannels.includes(slug);
		const channelsToCheck = new Set<string>();
		for (const c of member.channels) {
			if ((c.count ?? 1) > 1 && inFilter(c.slug)) {
				channelsToCheck.add(c.slug);
			}
		}
		for (const channelSlug of filesByChannel.keys()) {
			channelsToCheck.add(channelSlug);
		}

		for (const channelSlug of channelsToCheck) {
			const channel = member.channels.find(c => c.slug === channelSlug);
			if (!channel) continue;
			const expected = expectedPersonalFiles(channel);
			const expectedSet = new Set(expected);
			const actualFiles = filesByChannel.get(channelSlug) ?? [];
			const actualSet = new Set(actualFiles);
			for (const exp of expected) {
				if (!actualSet.has(exp)) {
					failures.push({
						file: relative(ROOT, join(memberDir, exp)),
						rule: 'file-exists',
						expected: exp,
						actual: 'missing',
					});
				}
			}
			for (const actual of actualFiles) {
				if (!expectedSet.has(actual)) {
					const count = channel.count ?? 1;
					failures.push({
						file: relative(ROOT, join(memberDir, actual)),
						rule: 'file-unexpected',
						expected:
							count === 1
								? `${channelSlug}.md (count: 1)`
								: `${channelSlug}1.md..${channelSlug}${count}.md (count: ${count})`,
						actual: 'extra file (delete or rename)',
					});
				}
			}
		}
	}

	return failures;
}

function validatePack(args: {
	product: Product;
	version: string;
	packRoot: string;
	channels: ChannelRule[];
	team: TeamMember[];
	phase: Phase;
	kind?: PackKind;
	articleSlug?: string;
	personalChannels?: string[];
}): {failures: Failure[]; warnings: Warning[]; skipped: boolean} {
	const failures: Failure[] = [];
	const warnings: Warning[] = [];
	const kind: PackKind = args.kind ?? 'release';

	// meta.json
	const metaPath = join(args.packRoot, 'meta.json');
	let meta: Record<string, unknown> | null = null;
	if (!existsSync(metaPath)) {
		failures.push({
			file: relative(ROOT, metaPath),
			rule: 'meta-exists',
			expected: 'meta.json present',
			actual: 'missing',
		});
	} else {
		try {
			meta = readJson(metaPath);
		} catch (e) {
			failures.push({
				file: relative(ROOT, metaPath),
				rule: 'meta-parses',
				expected: 'valid JSON',
				actual: (e as Error).message,
			});
		}
	}

	// Sample-content escape hatch — skip the gate entirely for hand-authored
	// seed packs used to bootstrap the UI. Only applies to release packs;
	// articles inside a sample release wouldn't exist in practice.
	if (
		kind === 'release' &&
		meta &&
		typeof meta.final_status === 'string' &&
		meta.final_status === 'sample'
	) {
		return {failures: [], warnings: [], skipped: true};
	}

	// Article meta-shape: slug must match dir name, plus title/focus required.
	if (kind === 'article' && meta) {
		if (typeof meta.slug !== 'string' || meta.slug !== args.articleSlug) {
			failures.push({
				file: relative(ROOT, metaPath),
				rule: 'article-slug-matches',
				expected: `slug === "${args.articleSlug}"`,
				actual: String(meta.slug ?? '<missing>'),
			});
		}
		for (const field of ['title', 'focus', 'generated_at', 'model']) {
			if (
				typeof meta[field] !== 'string' ||
				(meta[field] as string).length === 0
			) {
				failures.push({
					file: relative(ROOT, metaPath),
					rule: 'article-meta-shape',
					expected: `field "${field}" is a non-empty string`,
					actual: String(meta[field] ?? '<missing>'),
				});
			}
		}
	}

	// Expected files — only checked when validating non-personal phases.
	// `--phase personal` validates only the personal/ subtree of an existing
	// pack; we trust the base pack already passed its own validation.
	if (phaseIncludesNonPersonal(args.phase)) {
		for (const exp of expectedFiles({
			product: args.product.slug,
			version: args.version,
			channels: args.channels,
		})) {
			if (!fileExistsAny(args.packRoot, exp.rel)) {
				failures.push({
					file: relative(ROOT, join(args.packRoot, exp.rel)),
					rule: 'file-exists',
					expected: exp.rel,
					actual: 'missing',
				});
			}
		}

		// Extra channel files. `channel-known` fires on the frontmatter slug;
		// this fires on the path, so it catches LLM over-generation (stray
		// combined-posts file, leftover from a prior pass) even when the
		// frontmatter inside happens to be valid. Auto-fix needs to delete
		// these by path, not rewrite them.
		const channelsDir = join(args.packRoot, 'channels');
		if (existsSync(channelsDir)) {
			const expectedSlugs = new Set(args.channels.map(c => c.slug));
			for (const entry of readdirSync(channelsDir)) {
				if (!entry.endsWith('.md')) continue;
				const slug = entry.slice(0, -3);
				if (!expectedSlugs.has(slug)) {
					failures.push({
						file: relative(ROOT, join(channelsDir, entry)),
						rule: 'file-unexpected',
						expected: `file path matches a slug in config/channels.json (${[...expectedSlugs].join(', ')})`,
						actual: 'extra file (delete it, or rename to a configured slug)',
					});
				}
			}
		}
	}

	// Per-file content checks
	const repoUrl = `https://github.com/${args.product.repo}`;
	// nosemgrep: javascript.lang.security.audit.detect-non-literal-regexp.detect-non-literal-regexp -- repoUrl is sourced from config/products.json (our own config), not user input
	const releaseTagPattern = new RegExp(
		`${repoUrl.replaceAll('/', '\\/')}\\/releases\\/(tag|download)\\/`,
		'i',
	);

	// Don't recurse into articles/ at the release level — articles are
	// validated as separate sub-packs by the caller.
	const excludeDirs = kind === 'release' ? ['articles'] : [];
	for (const file of listMarkdownRecursive(args.packRoot, excludeDirs)) {
		const fileRel = relative(ROOT, file);
		const raw = readFileSync(file, 'utf8');
		const parsed = matter(raw);
		const fm = parsed.data as Record<string, unknown>;
		const body = parsed.content;

		// Personal route: kind: personal files use team.json rules and a
		// permissive link policy. Routed before any of the standard
		// release/article checks fire (which would demand product/version
		// frontmatter the personal file doesn't carry).
		if (fm.kind === 'personal') {
			const ctx = personalContextFromPath(args.packRoot, file);
			if (!ctx) {
				failures.push({
					file: fileRel,
					rule: 'personal-path-shape',
					expected: 'personal/<member>/<channel>.md',
					actual: 'unrecognised path shape for kind: personal file',
				});
				continue;
			}
			// When personalChannels is set (per-channel agent spawn), skip
			// personal files outside the spawn's channel scope so the report
			// doesn't surface failures the current agent can't fix. Filter on
			// fm.channel — for count > 1 channels the filename slug includes a
			// trailing digit (`x1.md`) but the canonical channel id sits in
			// frontmatter.
			const fmChannel =
				typeof fm.channel === 'string' ? fm.channel : ctx.channel;
			if (args.personalChannels && !args.personalChannels.includes(fmChannel)) {
				continue;
			}
			const result = validatePersonalFile({
				file,
				body,
				fm,
				pathContext: ctx,
				team: args.team,
				requireProductVersion: {
					product: args.product.slug,
					version: args.version,
				},
			});
			failures.push(...result.failures);
			warnings.push(...result.warnings);
			continue;
		}

		// Skip non-personal files when only validating personal — saves
		// re-running the (already-passed) base-pack rules during the
		// personal-pack agent's self-check.
		if (args.phase === 'personal') continue;

		// Frontmatter shape
		const requiredFields = [
			'product',
			'version',
			'channel',
			'generated_at',
			'model',
			'char_count',
		];
		for (const field of requiredFields) {
			if (fm[field] === undefined || fm[field] === null) {
				failures.push({
					file: fileRel,
					rule: 'frontmatter-shape',
					expected: `field "${field}" present`,
					actual: 'missing',
				});
			}
		}
		if (fm.product !== undefined && fm.product !== args.product.slug) {
			failures.push({
				file: fileRel,
				rule: 'frontmatter-product',
				expected: args.product.slug,
				actual: String(fm.product),
			});
		}
		if (fm.version !== undefined && String(fm.version) !== args.version) {
			failures.push({
				file: fileRel,
				rule: 'frontmatter-version',
				expected: args.version,
				actual: String(fm.version),
			});
		}

		// Channel rule (length checks)
		const slug =
			typeof fm.channel === 'string'
				? fm.channel
				: channelSlugFromPath(args.packRoot, file);
		const rule = channelRuleFor(args.channels, slug);
		if (!rule) {
			failures.push({
				file: fileRel,
				rule: 'channel-known',
				expected: 'slug listed in config/channels.json',
				actual: slug,
			});
		} else {
			const charCount = body.trim().length;
			const wordCount = countWords(body);
			if (rule.max_chars !== undefined && charCount > rule.max_chars) {
				failures.push({
					file: fileRel,
					rule: 'max-chars',
					expected: `≤${rule.max_chars}`,
					actual: String(charCount),
				});
			}
			if (rule.min_words !== undefined && wordCount < rule.min_words) {
				failures.push({
					file: fileRel,
					rule: 'min-words',
					expected: `≥${rule.min_words}`,
					actual: String(wordCount),
				});
			}
			if (rule.max_words !== undefined && wordCount > rule.max_words) {
				failures.push({
					file: fileRel,
					rule: 'max-words',
					expected: `≤${rule.max_words}`,
					actual: String(wordCount),
				});
			}
		}

		// Forbidden terms (hard)
		for (const term of FORBIDDEN_HARD) {
			const re = new RegExp(`\\b${term}\\b`, 'i');
			if (re.test(body)) {
				failures.push({
					file: fileRel,
					rule: 'forbidden-term',
					expected: `no "${term}"`,
					actual: 'present',
				});
			}
		}

		// Marketing register (soft)
		for (const term of FORBIDDEN_SOFT) {
			const re = new RegExp(`\\b${term}\\b`, 'i');
			if (re.test(body)) {
				warnings.push({
					file: fileRel,
					rule: 'marketing-register',
					message: `"${term}" — consider replacing with a plainer phrasing`,
				});
			}
		}

		// Em-dash (hard fail) — engineering-doc register requires hyphens
		if (body.includes('—')) {
			failures.push({
				file: fileRel,
				rule: 'em-dash',
				expected: 'no em-dash (use hyphen, comma, parenthesis, or full stop)',
				actual: 'em-dash present',
			});
		}

		// Unresolved placeholders
		for (const pattern of PLACEHOLDER_PATTERNS) {
			if (pattern.test(body)) {
				failures.push({
					file: fileRel,
					rule: 'no-placeholder',
					expected: `no ${pattern.source}`,
					actual: 'present',
				});
			}
		}

		// Link target — must include repo root, must NOT include release URL
		if (!body.includes(repoUrl)) {
			failures.push({
				file: fileRel,
				rule: 'link-product-repo',
				expected: `link to ${repoUrl}`,
				actual: 'missing',
			});
		}
		if (releaseTagPattern.test(body)) {
			failures.push({
				file: fileRel,
				rule: 'link-not-release',
				expected:
					'link to repo root, never /releases/tag/* or /releases/download/*',
				actual: 'release URL present',
			});
		}
	}

	failures.push(
		...checkPersonalFileCounts({
			packRoot: args.packRoot,
			team: args.team,
			personalChannels: args.personalChannels,
		}),
	);

	return {failures, warnings, skipped: false};
}

/**
 * Validates a collective-level pack at content/_collective/<slug>/.
 *
 * Collective packs are product-independent: no product / version, no
 * articles, no release-tag link policy. The shared rules (channel length,
 * forbidden terms, placeholders, sample-pack skip) still apply, but
 * frontmatter is `kind: collective` + `slug` instead of product/version,
 * and the link policy points to nanocollective.org.
 */
function validateCollectivePack(args: {
	slug: string;
	packRoot: string;
	channels: ChannelRule[];
	team: TeamMember[];
	phase: Phase;
	personalChannels?: string[];
}): {failures: Failure[]; warnings: Warning[]; skipped: boolean} {
	const failures: Failure[] = [];
	const warnings: Warning[] = [];

	const metaPath = join(args.packRoot, 'meta.json');
	let meta: Record<string, unknown> | null = null;
	if (!existsSync(metaPath)) {
		failures.push({
			file: relative(ROOT, metaPath),
			rule: 'meta-exists',
			expected: 'meta.json present',
			actual: 'missing',
		});
	} else {
		try {
			meta = readJson(metaPath);
		} catch (e) {
			failures.push({
				file: relative(ROOT, metaPath),
				rule: 'meta-parses',
				expected: 'valid JSON',
				actual: (e as Error).message,
			});
		}
	}

	if (
		meta &&
		typeof meta.final_status === 'string' &&
		meta.final_status === 'sample'
	) {
		return {failures: [], warnings: [], skipped: true};
	}

	// Expected files: meta.json + one .md per channel — only when not running
	// the personal-only phase (the base pack has already passed validation).
	if (phaseIncludesNonPersonal(args.phase)) {
		const expected: {rel: string; reason: string}[] = [
			{rel: 'meta.json', reason: 'meta.json missing'},
			...args.channels.map(c => ({
				rel: `channels/${c.slug}.md`,
				reason: `channels/${c.slug}.md missing`,
			})),
		];
		for (const exp of expected) {
			if (!existsSync(join(args.packRoot, exp.rel))) {
				failures.push({
					file: relative(ROOT, join(args.packRoot, exp.rel)),
					rule: 'file-exists',
					expected: exp.rel,
					actual: 'missing',
				});
			}
		}

		// Extra channel files — see validatePack for the rationale.
		const channelsDir = join(args.packRoot, 'channels');
		if (existsSync(channelsDir)) {
			const expectedSlugs = new Set(args.channels.map(c => c.slug));
			for (const entry of readdirSync(channelsDir)) {
				if (!entry.endsWith('.md')) continue;
				const slug = entry.slice(0, -3);
				if (!expectedSlugs.has(slug)) {
					failures.push({
						file: relative(ROOT, join(channelsDir, entry)),
						rule: 'file-unexpected',
						expected: `file path matches a slug in config/channels.json (${[...expectedSlugs].join(', ')})`,
						actual: 'extra file (delete it, or rename to a configured slug)',
					});
				}
			}
		}
	}

	for (const file of listMarkdownRecursive(args.packRoot)) {
		const fileRel = relative(ROOT, file);
		const raw = readFileSync(file, 'utf8');
		const parsed = matter(raw);
		const fm = parsed.data as Record<string, unknown>;
		const body = parsed.content;

		// Personal route: collective personal files reuse the same shape as
		// product personal files but with a `slug` instead of product/version.
		if (fm.kind === 'personal') {
			const ctx = personalContextFromPath(args.packRoot, file);
			if (!ctx) {
				failures.push({
					file: fileRel,
					rule: 'personal-path-shape',
					expected: 'personal/<member>/<channel>.md',
					actual: 'unrecognised path shape for kind: personal file',
				});
				continue;
			}
			const fmChannel =
				typeof fm.channel === 'string' ? fm.channel : ctx.channel;
			if (args.personalChannels && !args.personalChannels.includes(fmChannel)) {
				continue;
			}
			const result = validatePersonalFile({
				file,
				body,
				fm,
				pathContext: ctx,
				team: args.team,
				requireCollectiveSlug: args.slug,
			});
			failures.push(...result.failures);
			warnings.push(...result.warnings);
			continue;
		}

		// Skip non-personal files when only validating personal.
		if (args.phase === 'personal') continue;

		const requiredFields = [
			'kind',
			'slug',
			'channel',
			'generated_at',
			'model',
			'char_count',
		];
		for (const field of requiredFields) {
			if (fm[field] === undefined || fm[field] === null) {
				failures.push({
					file: fileRel,
					rule: 'frontmatter-shape',
					expected: `field "${field}" present`,
					actual: 'missing',
				});
			}
		}
		if (fm.kind !== undefined && fm.kind !== 'collective') {
			failures.push({
				file: fileRel,
				rule: 'frontmatter-kind',
				expected: 'collective',
				actual: String(fm.kind),
			});
		}
		if (fm.slug !== undefined && fm.slug !== args.slug) {
			failures.push({
				file: fileRel,
				rule: 'frontmatter-slug',
				expected: args.slug,
				actual: String(fm.slug),
			});
		}

		const slug =
			typeof fm.channel === 'string'
				? fm.channel
				: channelSlugFromPath(args.packRoot, file);
		const rule = channelRuleFor(args.channels, slug);
		if (!rule) {
			failures.push({
				file: fileRel,
				rule: 'channel-known',
				expected: 'slug listed in config/channels.json',
				actual: slug,
			});
		} else {
			const charCount = body.trim().length;
			const wordCount = countWords(body);
			if (rule.max_chars !== undefined && charCount > rule.max_chars) {
				failures.push({
					file: fileRel,
					rule: 'max-chars',
					expected: `≤${rule.max_chars}`,
					actual: String(charCount),
				});
			}
			if (rule.min_words !== undefined && wordCount < rule.min_words) {
				failures.push({
					file: fileRel,
					rule: 'min-words',
					expected: `≥${rule.min_words}`,
					actual: String(wordCount),
				});
			}
			if (rule.max_words !== undefined && wordCount > rule.max_words) {
				failures.push({
					file: fileRel,
					rule: 'max-words',
					expected: `≤${rule.max_words}`,
					actual: String(wordCount),
				});
			}
		}

		for (const term of FORBIDDEN_HARD) {
			const re = new RegExp(`\\b${term}\\b`, 'i');
			if (re.test(body)) {
				failures.push({
					file: fileRel,
					rule: 'forbidden-term',
					expected: `no "${term}"`,
					actual: 'present',
				});
			}
		}

		for (const term of FORBIDDEN_SOFT) {
			const re = new RegExp(`\\b${term}\\b`, 'i');
			if (re.test(body)) {
				warnings.push({
					file: fileRel,
					rule: 'marketing-register',
					message: `"${term}" — consider replacing with a plainer phrasing`,
				});
			}
		}

		if (body.includes('—')) {
			failures.push({
				file: fileRel,
				rule: 'em-dash',
				expected: 'no em-dash (use hyphen, comma, parenthesis, or full stop)',
				actual: 'em-dash present',
			});
		}

		for (const pattern of PLACEHOLDER_PATTERNS) {
			if (pattern.test(body)) {
				failures.push({
					file: fileRel,
					rule: 'no-placeholder',
					expected: `no ${pattern.source}`,
					actual: 'present',
				});
			}
		}

		if (!body.includes(COLLECTIVE_URL)) {
			failures.push({
				file: fileRel,
				rule: 'link-collective',
				expected: `link to ${COLLECTIVE_URL}`,
				actual: 'missing',
			});
		}
	}

	failures.push(
		...checkPersonalFileCounts({
			packRoot: args.packRoot,
			team: args.team,
			personalChannels: args.personalChannels,
		}),
	);

	return {failures, warnings, skipped: false};
}

/**
 * Programmatic entry point — used by the CLI `main()` and by `*.spec.ts`
 * tests. Returns the structured Report; never prints, never exits, never
 * writes files. The CLI wraps this with arg parsing, output formatting,
 * report writing, and exit codes.
 */
export function runValidate(options: {
	contentRoot: string;
	packFilter?: string;
	phase?: Phase;
	config?: ValidatorConfig;
	personalChannels?: string[];
	/**
	 * Restrict the articles iteration to these slugs. Used by the per-article
	 * writer agent's self-check (and the orchestrator's per-article gate) so a
	 * single failing sibling doesn't surface in another article's report.
	 *
	 * Also suppresses the pack-level `articles-cap` check — that's a planner
	 * concern, not a per-article one, and would fire spuriously when the pack
	 * already has 3 dirs on disk and we're rerunning one of them.
	 */
	articleSlugs?: string[];
}): Report {
	const phase = options.phase ?? 'full';
	if (!PHASES.includes(phase)) {
		throw new Error(
			`Unknown phase ${phase}; expected one of ${PHASES.join(', ')}`,
		);
	}

	const cfg = options.config ?? loadConfig();
	const productsBySlug = new Map(cfg.products.map(p => [p.slug, p]));

	const report: Report = {
		scannedPacks: [],
		skippedPacks: [],
		failures: [],
		warnings: [],
	};

	const packsToScan: {product: Product; version: string}[] = [];
	const collectivePacksToScan: {slug: string}[] = [];
	if (options.packFilter) {
		const [first, second] = options.packFilter.split('/');
		if (first === COLLECTIVE_DIR) {
			if (!second) {
				throw new Error(
					`Collective pack filter must be "${COLLECTIVE_DIR}/<slug>"`,
				);
			}
			collectivePacksToScan.push({slug: second});
		} else {
			const product = productsBySlug.get(first);
			if (!product) {
				throw new Error(`Unknown product: ${first}`);
			}
			packsToScan.push({product, version: second});
		}
	} else {
		for (const product of cfg.products) {
			const productDir = join(options.contentRoot, product.slug);
			for (const version of listDirs(productDir)) {
				packsToScan.push({product, version});
			}
		}
		const collectiveDir = join(options.contentRoot, COLLECTIVE_DIR);
		for (const slug of listDirs(collectiveDir)) {
			collectivePacksToScan.push({slug});
		}
	}

	for (const {product, version} of packsToScan) {
		const packRoot = join(options.contentRoot, product.slug, version);
		if (!existsSync(packRoot)) {
			report.failures.push({
				file: relative(ROOT, packRoot),
				rule: 'pack-exists',
				expected: 'directory present',
				actual: 'missing',
			});
			continue;
		}
		const result = validatePack({
			product,
			version,
			packRoot,
			channels: cfg.channels,
			team: cfg.team ?? [],
			phase,
			kind: 'release',
			personalChannels: options.personalChannels,
		});
		const id = `${product.slug}/${version}`;
		if (result.skipped) {
			report.skippedPacks.push(id);
			continue;
		}
		report.scannedPacks.push(id);
		report.failures.push(...result.failures);
		report.warnings.push(...result.warnings);

		// Articles: validate each subdir under articles/ as a sub-pack — only at
		// the articles / full phases. The earlier `channels` phase runs before
		// the article agent has produced anything.
		if (!phaseIncludesArticles(phase)) continue;
		const articlesDir = join(packRoot, 'articles');
		if (existsSync(articlesDir)) {
			const allSlugs = listDirs(articlesDir);
			const filterSet = options.articleSlugs
				? new Set(options.articleSlugs)
				: null;
			const articleSlugs = filterSet
				? allSlugs.filter(s => filterSet.has(s))
				: allSlugs;
			// articles-cap is a pack-level concern; suppress it when the caller
			// is scoping to a subset (the planner enforces the cap separately).
			if (!filterSet && allSlugs.length > MAX_ARTICLES_PER_PACK) {
				report.failures.push({
					file: relative(ROOT, articlesDir),
					rule: 'articles-cap',
					expected: `≤ ${MAX_ARTICLES_PER_PACK} articles per release`,
					actual: String(allSlugs.length),
				});
			}
			for (const slug of articleSlugs) {
				if (!KEBAB_CASE.test(slug)) {
					report.failures.push({
						file: relative(ROOT, join(articlesDir, slug)),
						rule: 'article-slug-kebab-case',
						expected: 'kebab-case (lowercase letters, digits, single hyphens)',
						actual: slug,
					});
					continue;
				}
				const articleResult = validatePack({
					product,
					version,
					packRoot: join(articlesDir, slug),
					channels: cfg.channels,
					team: cfg.team ?? [],
					phase,
					kind: 'article',
					articleSlug: slug,
					personalChannels: options.personalChannels,
				});
				report.scannedPacks.push(`${id}#${slug}`);
				report.failures.push(...articleResult.failures);
				report.warnings.push(...articleResult.warnings);
			}
		}
	}

	for (const {slug} of collectivePacksToScan) {
		const packRoot = join(options.contentRoot, COLLECTIVE_DIR, slug);
		const id = `${COLLECTIVE_DIR}/${slug}`;
		if (!existsSync(packRoot)) {
			report.failures.push({
				file: relative(ROOT, packRoot),
				rule: 'pack-exists',
				expected: 'directory present',
				actual: 'missing',
			});
			continue;
		}
		if (!KEBAB_CASE.test(slug)) {
			report.failures.push({
				file: relative(ROOT, packRoot),
				rule: 'collective-slug-kebab-case',
				expected: 'kebab-case (lowercase letters, digits, single hyphens)',
				actual: slug,
			});
			continue;
		}
		const result = validateCollectivePack({
			slug,
			packRoot,
			channels: cfg.channels,
			team: cfg.team ?? [],
			phase,
			personalChannels: options.personalChannels,
		});
		if (result.skipped) {
			report.skippedPacks.push(id);
			continue;
		}
		report.scannedPacks.push(id);
		report.failures.push(...result.failures);
		report.warnings.push(...result.warnings);
	}

	return report;
}

function main() {
	const {values} = parseArgs({
		allowPositionals: true,
		options: {
			pack: {type: 'string'},
			root: {type: 'string', default: 'content'},
			report: {type: 'string', default: 'validation-report.json'},
			phase: {type: 'string', default: 'full'},
			quiet: {type: 'boolean', default: false},
			'personal-channels': {type: 'string'},
			articles: {type: 'string'},
		},
	});

	const phase = values.phase as Phase;
	if (!PHASES.includes(phase)) {
		console.error(
			`Unknown --phase ${phase}; expected one of ${PHASES.join(', ')}`,
		);
		process.exit(2);
	}

	const personalChannelsArg = values['personal-channels'] as string | undefined;
	const personalChannels = personalChannelsArg
		? personalChannelsArg
				.split(',')
				.map(s => s.trim())
				.filter(s => s.length > 0)
		: undefined;

	const articlesArg = values.articles as string | undefined;
	const articleSlugs = articlesArg
		? articlesArg
				.split(',')
				.map(s => s.trim())
				.filter(s => s.length > 0)
		: undefined;

	let report: Report;
	try {
		report = runValidate({
			contentRoot: join(ROOT, values.root as string),
			packFilter: values.pack as string | undefined,
			phase,
			personalChannels,
			articleSlugs,
		});
	} catch (e) {
		console.error((e as Error).message);
		process.exit(2);
	}

	const reportPath = values.report as string;
	writeFileSync(reportPath, JSON.stringify(report, null, 2));

	if (!values.quiet) {
		if (report.skippedPacks.length > 0) {
			console.log(
				`Skipped ${report.skippedPacks.length} sample pack(s): ${report.skippedPacks.join(', ')}`,
			);
		}
		console.log(
			`Scanned ${report.scannedPacks.length} pack(s): ${report.scannedPacks.join(', ') || '(none)'}`,
		);
		if (report.warnings.length > 0) {
			console.log(`\n⚠ ${report.warnings.length} warning(s):`);
			for (const w of report.warnings) {
				console.log(`  ${w.file} [${w.rule}] ${w.message}`);
			}
		}
		if (report.failures.length > 0) {
			console.log(`\n✗ ${report.failures.length} failure(s):`);
			for (const f of report.failures) {
				console.log(
					`  ${f.file} [${f.rule}] expected ${f.expected}, got ${f.actual}`,
				);
			}
		} else {
			console.log('\n✓ All hard rules passed.');
		}
		console.log(`\nReport: ${reportPath}`);
	}

	process.exit(report.failures.length > 0 ? 1 : 0);
}

// Only run the CLI when this file is the entry point. When imported from a
// spec, the file's other exports (`runValidate`, `ValidatorConfig`) are used
// without firing the CLI's top-level side effects.
if (process.argv[1] && process.argv[1] === fileURLToPath(import.meta.url)) {
	main();
}
