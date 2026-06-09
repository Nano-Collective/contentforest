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
	listXDailyBuckets,
	readXDailyBucket,
	type XDailyBucket,
} from '@/lib/content';
import {type MarkStatus, markStatus} from '@/lib/distribute';

type Props = {
	bucket: XDailyBucket;
};

function readField(
	frontmatter: Record<string, unknown>,
	key: string,
): string | null {
	const v = frontmatter[key];
	return typeof v === 'string' ? v : null;
}

/**
 * Tree label for a post: prefer the frontmatter source (e.g. "nanocoder",
 * "collective"), falling back to the filename stem. Collective posts are
 * numbered, so keep the filename to disambiguate them.
 */
function labelFor(
	channel: string,
	frontmatter: Record<string, unknown>,
): string {
	const source = readField(frontmatter, 'source');
	if (source && source !== 'collective') return `${source}.md`;
	return `${channel}.md`;
}

export default function XDailyBucketPage({bucket}: Props) {
	const [distributedMap, setDistributedMap] = useState<
		Record<string, string | null>
	>(() => {
		const m: Record<string, string | null> = {};
		for (const f of bucket.files) {
			m[f.channel] = readField(f.frontmatter, 'distributed_at');
		}
		return m;
	});
	const [wontUseMap, setWontUseMap] = useState<Record<string, string | null>>(
		() => {
			const m: Record<string, string | null> = {};
			for (const f of bucket.files) {
				m[f.channel] = readField(f.frontmatter, 'wont_use_at');
			}
			return m;
		},
	);
	const items: FileTreeItem[] = bucket.files.map(f => ({
		channel: f.channel,
		label: labelFor(f.channel, f.frontmatter),
		group: 'posts',
		distributed: !!distributedMap[f.channel],
		wontUse: !!wontUseMap[f.channel],
	}));
	const sections: FileTreeSection[] = [{key: 'posts', title: 'Posts', items}];
	const firstChannel = items[0]?.channel ?? '';
	const [selected, setSelected] = useState(firstChannel);
	const [marking, setMarking] = useState(false);
	const [markError, setMarkError] = useState<{
		channel: string;
		message: string;
	} | null>(null);

	const file = bucket.files.find(f => f.channel === selected);
	const filename = file ? labelFor(file.channel, file.frontmatter) : '';
	const distributedAt = file ? (distributedMap[file.channel] ?? null) : null;
	const wontUseAt = file ? (wontUseMap[file.channel] ?? null) : null;
	const visibleMarkError =
		markError && markError.channel === selected ? markError.message : null;

	const handleMark = async (status: MarkStatus) => {
		if (!file || marking || distributedAt || wontUseAt) return;
		const channel = file.channel;
		const repoPath = file.repoPath;
		const optimistic = new Date().toISOString();
		const setMap = status === 'distributed' ? setDistributedMap : setWontUseMap;
		setMap(m => ({...m, [channel]: optimistic}));
		setMarking(true);
		setMarkError(null);
		try {
			const result = await markStatus(repoPath, status, optimistic);
			setMap(m => ({...m, [channel]: result.markedAt}));
		} catch (err) {
			setMap(m => ({...m, [channel]: null}));
			setMarkError({
				channel,
				message:
					err instanceof Error
						? err.message
						: status === 'distributed'
							? 'Failed to mark distributed'
							: "Failed to mark won't use",
			});
		} finally {
			setMarking(false);
		}
	};

	const generatedAt =
		typeof bucket.meta?.generated_at === 'string'
			? bucket.meta.generated_at
			: null;
	const model =
		typeof bucket.meta?.model === 'string' ? bucket.meta.model : null;

	return (
		<>
			<Head>
				<title>{bucket.date} · Daily X posts · ContentForest</title>
			</Head>
			<main className="max-w-6xl mx-auto px-4 py-10">
				<Link
					href="/x"
					className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
				>
					<ArrowLeft className="h-4 w-4" />
					Daily X posts
				</Link>

				<header className="mb-8">
					<p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
						Daily X posts
					</p>
					<h1 className="text-3xl font-bold mb-1">{bucket.date}</h1>
					{generatedAt && (
						<p className="text-sm text-muted-foreground">
							Generated {new Date(generatedAt).toLocaleString()}
							{model ? ` · ${model}` : null}
						</p>
					)}
				</header>

				{bucket.files.length === 0 ? (
					<p className="text-muted-foreground">No posts in this bucket yet.</p>
				) : (
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
									wontUseAt={wontUseAt}
									marking={marking}
									markError={visibleMarkError}
									onMarkDistributed={() => handleMark('distributed')}
									onMarkWontUse={() => handleMark('wont_use')}
								/>
							) : (
								<p className="text-muted-foreground">No file selected.</p>
							)}
						</section>
					</div>
				)}
			</main>
		</>
	);
}

export const getStaticPaths: GetStaticPaths = async () => {
	return {
		paths: listXDailyBuckets().map(b => ({params: {date: b.date}})),
		fallback: false,
	};
};

export const getStaticProps: GetStaticProps<Props> = async ({params}) => {
	const date = params?.date as string;
	return {props: {bucket: readXDailyBucket(date)}};
};
