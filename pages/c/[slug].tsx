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
	type CollectivePack,
	listCollectivePacks,
	readCollectivePack,
} from '@/lib/content';
import {type MarkStatus, markStatus} from '@/lib/distribute';

type Props = {
	pack: CollectivePack;
};

function classify(slug: string): FileTreeItem {
	if (slug.startsWith('personal:')) {
		const parts = slug.slice('personal:'.length).split(':');
		const label =
			parts.length === 2
				? `${parts[0]} / ${parts[1]}.md`
				: `${parts.join(':')}.md`;
		return {channel: slug, label, group: 'personal'};
	}
	return {channel: slug, label: `${slug}.md`, group: 'channels'};
}

function filenameFor(slug: string): string {
	if (slug.startsWith('personal:')) {
		const parts = slug.slice('personal:'.length).split(':');
		return parts.length === 2 ? `${parts[1]}.md` : `${parts[0]}.md`;
	}
	return `${slug}.md`;
}

function readField(
	frontmatter: Record<string, unknown>,
	key: string,
): string | null {
	const v = frontmatter[key];
	return typeof v === 'string' ? v : null;
}

export default function CollectivePackPage({pack}: Props) {
	const [distributedMap, setDistributedMap] = useState<
		Record<string, string | null>
	>(() => {
		const m: Record<string, string | null> = {};
		for (const f of pack.files) {
			m[f.channel] = readField(f.frontmatter, 'distributed_at');
		}
		return m;
	});
	const [wontUseMap, setWontUseMap] = useState<Record<string, string | null>>(
		() => {
			const m: Record<string, string | null> = {};
			for (const f of pack.files) {
				m[f.channel] = readField(f.frontmatter, 'wont_use_at');
			}
			return m;
		},
	);
	const items: FileTreeItem[] = pack.files.map(f => ({
		...classify(f.channel),
		distributed: !!distributedMap[f.channel],
		wontUse: !!wontUseMap[f.channel],
	}));
	const sections: FileTreeSection[] = [
		{key: 'collective', title: 'Channels', items},
	];
	const firstChannel = items[0]?.channel ?? '';
	const [selected, setSelected] = useState(firstChannel);
	const [marking, setMarking] = useState(false);
	const [markError, setMarkError] = useState<{
		channel: string;
		message: string;
	} | null>(null);

	const file = pack.files.find(f => f.channel === selected);
	const filename = filenameFor(selected);
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
		typeof pack.meta?.generated_at === 'string' ? pack.meta.generated_at : null;
	const model = typeof pack.meta?.model === 'string' ? pack.meta.model : null;

	return (
		<>
			<Head>
				<title>{pack.slug} · Collective · ContentForest</title>
			</Head>
			<main className="max-w-6xl mx-auto px-4 py-10">
				<Link
					href="/c"
					className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
				>
					<ArrowLeft className="h-4 w-4" />
					Collective
				</Link>

				<header className="mb-8">
					<p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
						Collective
					</p>
					<h1 className="text-3xl font-bold mb-1">{pack.slug}</h1>
					{generatedAt && (
						<p className="text-sm text-muted-foreground">
							Generated {new Date(generatedAt).toLocaleString()}
							{model ? ` · ${model}` : null}
						</p>
					)}
				</header>

				{pack.files.length === 0 ? (
					<p className="text-muted-foreground">No files in this pack yet.</p>
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
		paths: listCollectivePacks().map(p => ({params: {slug: p.slug}})),
		fallback: false,
	};
};

export const getStaticProps: GetStaticProps<Props> = async ({params}) => {
	const slug = params?.slug as string;
	return {props: {pack: readCollectivePack(slug)}};
};
