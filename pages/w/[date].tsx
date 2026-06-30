import {ArrowLeft} from 'lucide-react';
import type {GetStaticPaths, GetStaticProps} from 'next';
import Head from 'next/head';
import Link from 'next/link';
import MarkdownPane from '@/components/MarkdownPane';
import {listWeeklyPacks, readWeeklyPack, type WeeklyPack} from '@/lib/content';

type Props = {
	pack: WeeklyPack;
};

export default function WeeklyPackPage({pack}: Props) {
	const generatedAt =
		typeof pack.meta?.generated_at === 'string' ? pack.meta.generated_at : null;
	const model = typeof pack.meta?.model === 'string' ? pack.meta.model : null;

	return (
		<>
			<Head>
				<title>{pack.date} · Weekly content pack · ContentForest</title>
			</Head>
			<main className="max-w-4xl mx-auto px-4 py-10">
				<Link
					href="/w"
					className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
				>
					<ArrowLeft className="h-4 w-4" />
					Weekly content packs
				</Link>

				<header className="mb-8">
					<p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
						Weekly content pack
					</p>
					<h1 className="text-3xl font-bold mb-1">{pack.date}</h1>
					{generatedAt && (
						<p className="text-sm text-muted-foreground">
							Generated {new Date(generatedAt).toLocaleString()}
							{model ? ` · ${model}` : null}
						</p>
					)}
				</header>

				{pack.digest ? (
					<MarkdownPane
						filename="digest.md"
						raw={pack.digest.raw}
						body={pack.digest.body}
						distributedAt={null}
						wontUseAt={null}
						marking={false}
						markError={null}
						openLinksInNewTab
					/>
				) : (
					<p className="text-muted-foreground">
						No unused content was found to recommend this week.
					</p>
				)}
			</main>
		</>
	);
}

export const getStaticPaths: GetStaticPaths = async () => {
	return {
		paths: listWeeklyPacks().map(p => ({params: {date: p.date}})),
		fallback: false,
	};
};

export const getStaticProps: GetStaticProps<Props> = async ({params}) => {
	const date = params?.date as string;
	return {props: {pack: readWeeklyPack(date)}};
};
