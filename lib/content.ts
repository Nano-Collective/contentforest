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

const COLLECTIVE_DIR = '_collective';

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
