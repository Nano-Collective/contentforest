'use client';

import {ArrowLeft} from 'lucide-react';
import type {GetStaticPaths, GetStaticProps} from 'next';
import Head from 'next/head';
import Link from 'next/link';
import {useState} from 'react';
import FileTree, {
	type FileTreeItem,
	type FileTreeSection,
} from '@/components/FileTree';
import MarkdownPane from '@/components/MarkdownPane';
import {
	listProducts,
	listVersions,
	readVersionPack,
	type VersionPack,
} from '@/lib/content';
import {markDistributed} from '@/lib/distribute';

type Props = {
	pack: VersionPack;
};

/**
 * Strips the section prefix from a channel slug and returns a label + group.
 * The slug format depends on where the file came from:
 *   "linkedin"                          → channels group, label "linkedin.md"
 *   "personal:will:linkedin"            → personal group, label "will / linkedin.md"
 *   "article:mcp-support:linkedin"      → channels group (within article), label "linkedin.md"
 *   "article:mcp-support:personal:will:linkedin" → personal group, label "will / linkedin.md"
 */
function classify(slug: string): {item: FileTreeItem; section: string} {
	// Strip the article: prefix if present, remembering which article we're in.
	let section = 'release';
	let rest = slug;
	if (slug.startsWith('article:')) {
		const parts = slug.slice('article:'.length).split(':');
		section = `article:${parts[0]}`;
		rest = parts.slice(1).join(':');
	}

	if (rest.startsWith('personal:')) {
		const personalRest = rest.slice('personal:'.length);
		const parts = personalRest.split(':');
		const label =
			parts.length === 2
				? `${parts[0]} / ${parts[1]}.md`
				: `${personalRest}.md`;
		return {
			item: {channel: slug, label, group: 'personal'},
			section,
		};
	}

	return {
		item: {channel: slug, label: `${rest}.md`, group: 'channels'},
		section,
	};
}

function buildSections(
	pack: VersionPack,
	distributedMap: Record<string, string | null>,
): FileTreeSection[] {
	const release: FileTreeItem[] = [];
	const byArticle: Map<string, FileTreeItem[]> = new Map();

	for (const f of pack.files) {
		const {item, section} = classify(f.channel);
		item.distributed = !!distributedMap[f.channel];
		if (section === 'release') {
			release.push(item);
		} else {
			const slug = section.slice('article:'.length);
			const arr = byArticle.get(slug) ?? [];
			arr.push(item);
			byArticle.set(slug, arr);
		}
	}

	const sections: FileTreeSection[] = [
		{key: 'release', title: 'Release', items: release},
	];
	for (const article of pack.articles) {
		const items = byArticle.get(article.slug) ?? [];
		const title =
			typeof article.meta?.title === 'string'
				? (article.meta.title as string)
				: article.slug;
		sections.push({
			key: `article:${article.slug}`,
			title,
			subtitle:
				typeof article.meta?.focus === 'string'
					? (article.meta.focus as string)
					: `articles/${article.slug}`,
			items,
		});
	}
	return sections;
}

function filenameFor(slug: string): string {
	// Drop article: prefix for filename purposes.
	let rest = slug;
	if (slug.startsWith('article:')) {
		rest = slug.slice('article:'.length).split(':').slice(1).join(':');
	}
	if (rest.startsWith('personal:')) {
		const parts = rest.slice('personal:'.length).split(':');
		return parts.length === 2 ? `${parts[1]}.md` : `${parts[0]}.md`;
	}
	return `${rest}.md`;
}

export default function VersionPage({pack}: Props) {
	const [distributedMap, setDistributedMap] = useState<
		Record<string, string | null>
	>(() => {
		const m: Record<string, string | null> = {};
		for (const f of pack.files) {
			m[f.channel] =
				typeof f.frontmatter.distributed_at === 'string'
					? f.frontmatter.distributed_at
					: null;
		}
		return m;
	});
	const sections = buildSections(pack, distributedMap);
	const firstChannel = sections.flatMap(s => s.items)[0]?.channel ?? '';
	const [selected, setSelected] = useState(firstChannel);
	const [marking, setMarking] = useState(false);
	const [markError, setMarkError] = useState<{
		channel: string;
		message: string;
	} | null>(null);

	const file = pack.files.find(f => f.channel === selected);
	const filename = filenameFor(selected);
	const distributedAt = file ? (distributedMap[file.channel] ?? null) : null;
	const visibleMarkError =
		markError && markError.channel === selected ? markError.message : null;

	const handleMark = async () => {
		if (!file || marking || distributedAt) return;
		const channel = file.channel;
		const repoPath = file.repoPath;
		const optimistic = new Date().toISOString();
		const previous = distributedMap[channel] ?? null;
		setDistributedMap(m => ({...m, [channel]: optimistic}));
		setMarking(true);
		setMarkError(null);
		try {
			const result = await markDistributed(repoPath, optimistic);
			setDistributedMap(m => ({...m, [channel]: result.distributedAt}));
		} catch (err) {
			setDistributedMap(m => ({...m, [channel]: previous}));
			setMarkError({
				channel,
				message:
					err instanceof Error ? err.message : 'Failed to mark distributed',
			});
		} finally {
			setMarking(false);
		}
	};

	return (
		<>
			<Head>
				<title>
					{pack.product} v{pack.version} · ContentForest
				</title>
			</Head>
			<main className="max-w-6xl mx-auto px-4 py-10">
				<Link
					href={`/p/${pack.product}`}
					className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
				>
					<ArrowLeft className="h-4 w-4" />
					{pack.product}
				</Link>

				<header className="mb-8">
					<h1 className="text-3xl font-bold mb-1">
						{pack.product}{' '}
						<span className="font-mono text-2xl text-muted-foreground">
							v{pack.version}
						</span>
					</h1>
					{(() => {
						const generatedAt =
							typeof pack.meta?.generated_at === 'string'
								? pack.meta.generated_at
								: null;
						const model =
							typeof pack.meta?.model === 'string' ? pack.meta.model : null;
						if (!generatedAt) return null;
						return (
							<p className="text-sm text-muted-foreground">
								Generated {new Date(generatedAt).toLocaleString()}
								{model ? ` · ${model}` : null}
							</p>
						);
					})()}
				</header>

				<div className="grid gap-6 md:grid-cols-[220px_1fr]">
					<aside className="md:sticky md:top-20 md:self-start">
						<FileTree
							sections={sections}
							selected={selected}
							onSelect={setSelected}
						/>
					</aside>
					<section className="min-w-0">
						{file ? (
							<MarkdownPane
								key={file.repoPath}
								filename={filename}
								raw={file.raw}
								body={file.body}
								distributedAt={distributedAt}
								marking={marking}
								markError={visibleMarkError}
								onMark={handleMark}
							/>
						) : (
							<p className="text-muted-foreground">No file selected.</p>
						)}
					</section>
				</div>
			</main>
		</>
	);
}

export const getStaticPaths: GetStaticPaths = async () => {
	const paths: {params: {product: string; version: string}}[] = [];
	for (const product of listProducts()) {
		for (const version of listVersions(product.slug)) {
			paths.push({params: {product: product.slug, version}});
		}
	}
	return {paths, fallback: false};
};

export const getStaticProps: GetStaticProps<Props> = async ({params}) => {
	const product = params?.product as string;
	const version = params?.version as string;
	return {props: {pack: readVersionPack(product, version)}};
};
