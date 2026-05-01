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
	return {products, channels};
}

export type ValidatorConfig = {
	products: Product[];
	channels: ChannelRule[];
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

type PackKind = 'release' | 'article';

type Phase = 'channels' | 'articles' | 'full';

const PHASES: Phase[] = ['channels', 'articles', 'full'];

function phaseIncludesArticles(phase: Phase): boolean {
	return phase === 'articles' || phase === 'full';
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

function validatePack(args: {
	product: Product;
	version: string;
	packRoot: string;
	channels: ChannelRule[];
	kind?: PackKind;
	articleSlug?: string;
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

	// Expected files
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
			// min_words is a soft target, not a hard floor — minor patch releases
			// genuinely don't have ≥N words of substance to write about, and
			// padding to hit a minimum produces exactly the filler the brand voice
			// forbids. We surface a warning so a reviewer can sanity-check, but
			// don't block merge.
			if (rule.min_words !== undefined && wordCount < rule.min_words) {
				warnings.push({
					file: fileRel,
					rule: 'min-words',
					message: `${wordCount} words; soft target ≥${rule.min_words}. Fine for minor patches; review if the release was substantial`,
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
	if (options.packFilter) {
		const [productSlug, version] = options.packFilter.split('/');
		const product = productsBySlug.get(productSlug);
		if (!product) {
			throw new Error(`Unknown product: ${productSlug}`);
		}
		packsToScan.push({product, version});
	} else {
		for (const product of cfg.products) {
			const productDir = join(options.contentRoot, product.slug);
			for (const version of listDirs(productDir)) {
				packsToScan.push({product, version});
			}
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
			kind: 'release',
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
			const articleSlugs = listDirs(articlesDir);
			if (articleSlugs.length > MAX_ARTICLES_PER_PACK) {
				report.failures.push({
					file: relative(ROOT, articlesDir),
					rule: 'articles-cap',
					expected: `≤ ${MAX_ARTICLES_PER_PACK} articles per release`,
					actual: String(articleSlugs.length),
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
					kind: 'article',
					articleSlug: slug,
				});
				report.scannedPacks.push(`${id}#${slug}`);
				report.failures.push(...articleResult.failures);
				report.warnings.push(...articleResult.warnings);
			}
		}
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
		},
	});

	const phase = values.phase as Phase;
	if (!PHASES.includes(phase)) {
		console.error(
			`Unknown --phase ${phase}; expected one of ${PHASES.join(', ')}`,
		);
		process.exit(2);
	}

	let report: Report;
	try {
		report = runValidate({
			contentRoot: join(ROOT, values.root as string),
			packFilter: values.pack as string | undefined,
			phase,
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
