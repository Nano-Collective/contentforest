import {readdirSync, readFileSync, statSync} from 'node:fs';
import {join, relative} from 'node:path';
import matter from 'gray-matter';

const DEFAULT_CONTENT_DIR = join(process.cwd(), 'content');

export type ContentFile = {
	path: string;
	repoPath: string;
	channel: string;
	raw: string;
	body: string;
	frontmatter: Record<string, unknown>;
};

export type Article = {
	slug: string;
	meta: Record<string, unknown> | null;
};

export type VersionPack = {
	product: string;
	version: string;
	meta: Record<string, unknown> | null;
	files: ContentFile[];
	articles: Article[];
};

export type ProductSummary = {
	slug: string;
	latestVersion: string | null;
	versions: string[];
};

export type CollectivePackSummary = {
	slug: string;
	meta: Record<string, unknown> | null;
};

export type CollectivePack = {
	slug: string;
	meta: Record<string, unknown> | null;
	files: ContentFile[];
};

export type XDailyBucketSummary = {
	date: string;
	meta: Record<string, unknown> | null;
};

export type XDailyBucket = {
	date: string;
	meta: Record<string, unknown> | null;
	files: ContentFile[];
};

export type WeeklyPackSummary = {
	date: string;
	meta: Record<string, unknown> | null;
};

export type WeeklyPack = {
	date: string;
	meta: Record<string, unknown> | null;
	digest: ContentFile | null;
};

const COLLECTIVE_DIR = '_collective';
const X_DAILY_DIR = '_x-daily';
const WEEKLY_DIR = '_weekly';

function listDirs(path: string): string[] {
	try {
		return readdirSync(path).filter(entry => {
			const full = join(path, entry);
			return statSync(full).isDirectory() && !entry.startsWith('_');
		});
	} catch {
		return [];
	}
}

export function compareVersionsDesc(a: string, b: string): number {
	const pa = a.split('.').map(n => Number.parseInt(n, 10) || 0);
	const pb = b.split('.').map(n => Number.parseInt(n, 10) || 0);
	for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
		const diff = (pb[i] ?? 0) - (pa[i] ?? 0);
		if (diff !== 0) return diff;
	}
	return 0;
}

export function listProducts(
	contentDir: string = DEFAULT_CONTENT_DIR,
): ProductSummary[] {
	const slugs = listDirs(contentDir);
	return slugs.map(slug => {
		const versions = listDirs(join(contentDir, slug)).sort(compareVersionsDesc);
		return {
			slug,
			latestVersion: versions[0] ?? null,
			versions,
		};
	});
}

export function listVersions(
	product: string,
	contentDir: string = DEFAULT_CONTENT_DIR,
): string[] {
	return listDirs(join(contentDir, product)).sort(compareVersionsDesc);
}

function readMetaJson(dir: string): Record<string, unknown> | null {
	try {
		return JSON.parse(readFileSync(join(dir, 'meta.json'), 'utf8'));
	} catch {
		return null;
	}
}

function generatedAtOf(meta: Record<string, unknown> | null): string {
	const v = meta?.generated_at;
	return typeof v === 'string' ? v : '';
}

export function listCollectivePacks(
	contentDir: string = DEFAULT_CONTENT_DIR,
): CollectivePackSummary[] {
	const root = join(contentDir, COLLECTIVE_DIR);
	let entries: string[];
	try {
		entries = readdirSync(root).filter(entry => {
			try {
				return statSync(join(root, entry)).isDirectory();
			} catch {
				return false;
			}
		});
	} catch {
		return [];
	}
	const packs = entries.map(slug => ({
		slug,
		meta: readMetaJson(join(root, slug)),
	}));
	packs.sort((a, b) => {
		const diff = generatedAtOf(b.meta).localeCompare(generatedAtOf(a.meta));
		return diff !== 0 ? diff : a.slug.localeCompare(b.slug);
	});
	return packs;
}

function readMarkdown(filePath: string, channel: string): ContentFile {
	const raw = readFileSync(filePath, 'utf8');
	const parsed = matter(raw);
	// gray-matter parses ISO date strings into JS Date objects via js-yaml, but
	// Next's getStaticProps requires JSON-serializable props. Round-trip through
	// JSON so dates become ISO strings.
	const frontmatter = JSON.parse(JSON.stringify(parsed.data));
	return {
		path: filePath,
		repoPath: relative(process.cwd(), filePath),
		channel,
		raw,
		body: parsed.content,
		frontmatter,
	};
}

/**
 * True when the pack has at least one file AND every file has either a
 * `distributed_at` or `wont_use_at` ISO string in its frontmatter. Mirrors
 * the per-file checks the detail pages use to decide whether to strike
 * individual posts in the file tree. Empty packs are not "dealt with" — a
 * pack with no files has no work to mark, so we leave it un-striked.
 */
export function isPackDealtWith(files: ContentFile[]): boolean {
	if (files.length === 0) return false;
	for (const f of files) {
		const distributedAt =
			typeof f.frontmatter.distributed_at === 'string'
				? (f.frontmatter.distributed_at as string)
				: null;
		const wontUseAt =
			typeof f.frontmatter.wont_use_at === 'string'
				? (f.frontmatter.wont_use_at as string)
				: null;
		if (!distributedAt && !wontUseAt) return false;
	}
	return true;
}

/**
 * Reads channels/*.md and personal/<member>/<channel>.md from the given root,
 * pushing each as a ContentFile. Channel slug is prefixed with `prefix` so we
 * can disambiguate top-level files from per-article files.
 */
function readChannelsAndPersonal(
	root: string,
	prefix: string,
	files: ContentFile[],
) {
	// channels/*.md (flat)
	const channelsPath = join(root, 'channels');
	try {
		const entries = readdirSync(channelsPath).filter(e => e.endsWith('.md'));
		for (const entry of entries) {
			const channel = entry.replace(/\.md$/, '');
			files.push(
				readMarkdown(join(channelsPath, entry), `${prefix}${channel}`),
			);
		}
	} catch {
		// channels/ may not exist
	}

	// personal/<member>/<channel>.md (nested) + flat fallback
	const personalPath = join(root, 'personal');
	try {
		for (const memberEntry of readdirSync(personalPath)) {
			const memberPath = join(personalPath, memberEntry);
			const stat = statSync(memberPath);
			if (stat.isDirectory()) {
				for (const channelFile of readdirSync(memberPath)) {
					if (!channelFile.endsWith('.md')) continue;
					const channelSlug = channelFile.replace(/\.md$/, '');
					files.push(
						readMarkdown(
							join(memberPath, channelFile),
							`${prefix}personal:${memberEntry}:${channelSlug}`,
						),
					);
				}
			} else if (memberEntry.endsWith('.md')) {
				const stem = memberEntry.replace(/\.md$/, '');
				const dash = stem.indexOf('-');
				const channelSuffix =
					dash > 0
						? `personal:${stem.slice(0, dash)}:${stem.slice(dash + 1)}`
						: `personal:${stem}`;
				files.push(readMarkdown(memberPath, `${prefix}${channelSuffix}`));
			}
		}
	} catch {
		// personal/ may not exist
	}
}

export function readVersionPack(
	product: string,
	version: string,
	contentDir: string = DEFAULT_CONTENT_DIR,
): VersionPack {
	const root = join(contentDir, product, version);
	const files: ContentFile[] = [];

	readChannelsAndPersonal(root, '', files);

	// articles/<slug>/{channels,personal} — each article becomes its own
	// sub-pack with files keyed under `article:<slug>:` so the viewer can
	// group them.
	const articles: Article[] = [];
	const articlesPath = join(root, 'articles');
	try {
		for (const slug of readdirSync(articlesPath)) {
			const articleRoot = join(articlesPath, slug);
			const stat = statSync(articleRoot);
			if (!stat.isDirectory()) continue;
			let articleMeta: Record<string, unknown> | null = null;
			try {
				articleMeta = JSON.parse(
					readFileSync(join(articleRoot, 'meta.json'), 'utf8'),
				);
			} catch {
				// meta optional during in-flight generation
			}
			articles.push({slug, meta: articleMeta});
			readChannelsAndPersonal(articleRoot, `article:${slug}:`, files);
		}
	} catch {
		// articles/ may not exist
	}

	// Stable order: by slug
	articles.sort((a, b) => a.slug.localeCompare(b.slug));

	const meta = readMetaJson(root);

	return {product, version, meta, files, articles};
}

export function readCollectivePack(
	slug: string,
	contentDir: string = DEFAULT_CONTENT_DIR,
): CollectivePack {
	const root = join(contentDir, COLLECTIVE_DIR, slug);
	const files: ContentFile[] = [];
	readChannelsAndPersonal(root, '', files);
	return {slug, meta: readMetaJson(root), files};
}

/**
 * Lists the daily X-post buckets at content/_x-daily/<date>/, newest first.
 * Date dirs sort lexically, which is chronological for YYYY-MM-DD. The
 * sibling ledger.json is a file, not a dir, so listDirs skips it.
 */
export function listXDailyBuckets(
	contentDir: string = DEFAULT_CONTENT_DIR,
): XDailyBucketSummary[] {
	const root = join(contentDir, X_DAILY_DIR);
	let entries: string[];
	try {
		entries = readdirSync(root).filter(entry => {
			try {
				return statSync(join(root, entry)).isDirectory();
			} catch {
				return false;
			}
		});
	} catch {
		return [];
	}
	const buckets = entries.map(date => ({
		date,
		meta: readMetaJson(join(root, date)),
	}));
	buckets.sort((a, b) => b.date.localeCompare(a.date));
	return buckets;
}

export function readXDailyBucket(
	date: string,
	contentDir: string = DEFAULT_CONTENT_DIR,
): XDailyBucket {
	const root = join(contentDir, X_DAILY_DIR, date);
	const files: ContentFile[] = [];
	// Every post is a flat .md under posts/. The channel key is the filename
	// stem (e.g. "nanocoder", "collective-1") — unique within a bucket.
	const postsPath = join(root, 'posts');
	try {
		const entries = readdirSync(postsPath).filter(e => e.endsWith('.md'));
		for (const entry of entries) {
			const channel = entry.replace(/\.md$/, '');
			files.push(readMarkdown(join(postsPath, entry), channel));
		}
	} catch {
		// posts/ may not exist
	}
	files.sort((a, b) => a.channel.localeCompare(b.channel));
	return {date, meta: readMetaJson(root), files};
}

/**
 * Lists the weekly content packs at content/_weekly/<date>/, newest first.
 * Each pack is the Monday-curated digest of unused content from across the
 * product and collective packs — see scripts/weekly-pack.ts. Date dirs sort
 * lexically, which is chronological for YYYY-MM-DD.
 */
export function listWeeklyPacks(
	contentDir: string = DEFAULT_CONTENT_DIR,
): WeeklyPackSummary[] {
	const root = join(contentDir, WEEKLY_DIR);
	let entries: string[];
	try {
		entries = readdirSync(root).filter(entry => {
			try {
				return statSync(join(root, entry)).isDirectory();
			} catch {
				return false;
			}
		});
	} catch {
		return [];
	}
	const packs = entries.map(date => ({
		date,
		meta: readMetaJson(join(root, date)),
	}));
	packs.sort((a, b) => b.date.localeCompare(a.date));
	return packs;
}

/**
 * Reads a single weekly pack. The pack is a single `digest.md` (a curation
 * that links out to the source files in their own packs) plus meta.json. The
 * digest is a reference doc, not distributable content, so it has no
 * distributed_at/wont_use_at lifecycle of its own.
 */
export function readWeeklyPack(
	date: string,
	contentDir: string = DEFAULT_CONTENT_DIR,
): WeeklyPack {
	const root = join(contentDir, WEEKLY_DIR, date);
	let digest: ContentFile | null = null;
	try {
		digest = readMarkdown(join(root, 'digest.md'), 'digest');
	} catch {
		// digest.md may not exist for an in-flight or empty pack
	}
	return {date, meta: readMetaJson(root), digest};
}
