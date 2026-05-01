import {ArrowLeft, ArrowRight, Megaphone} from 'lucide-react';
import type {GetStaticProps} from 'next';
import Head from 'next/head';
import Link from 'next/link';
import {Card, CardContent, CardHeader, CardTitle} from '@/components/ui/card';
import {type CollectivePackSummary, listCollectivePacks} from '@/lib/content';

type Props = {
	packs: CollectivePackSummary[];
};

function formatDate(meta: Record<string, unknown> | null): string | null {
	const v = meta?.generated_at;
	if (typeof v !== 'string') return null;
	const d = new Date(v);
	if (Number.isNaN(d.getTime())) return null;
	return d.toLocaleDateString();
}

export default function CollectiveIndexPage({packs}: Props) {
	return (
		<>
			<Head>
				<title>Collective · ContentForest</title>
			</Head>
			<main className="max-w-6xl mx-auto px-4 py-10">
				<Link
					href="/"
					className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
				>
					<ArrowLeft className="h-4 w-4" />
					All products
				</Link>

				<header className="mb-10">
					<h1 className="text-3xl font-bold mb-2">Collective</h1>
					<p className="text-muted-foreground">
						{packs.length} pack{packs.length === 1 ? '' : 's'} of cross-product
						content about the collective itself.
					</p>
				</header>

				{packs.length === 0 ? (
					<p className="text-muted-foreground">
						No collective packs yet. Open a{' '}
						<a
							href="https://github.com/Nano-Collective/contentforest/issues/new?template=collective-request.yml"
							target="_blank"
							rel="noopener noreferrer"
							className="underline hover:text-foreground"
						>
							collective-request issue
						</a>{' '}
						to create one.
					</p>
				) : (
					<ul className="flex flex-col gap-3">
						{packs.map(pack => {
							const generated = formatDate(pack.meta);
							return (
								<li key={pack.slug}>
									<Link href={`/c/${pack.slug}`} className="block group">
										<Card className="transition-colors group-hover:border-primary/50">
											<CardHeader>
												<CardTitle className="flex items-center justify-between text-base font-mono">
													<span className="flex items-center gap-2">
														<Megaphone className="h-4 w-4 text-primary" />
														{pack.slug}
													</span>
													<span className="flex items-center gap-3 text-sm text-muted-foreground font-sans">
														{generated && <span>{generated}</span>}
														<ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
													</span>
												</CardTitle>
											</CardHeader>
											<CardContent />
										</Card>
									</Link>
								</li>
							);
						})}
					</ul>
				)}
			</main>
		</>
	);
}

export const getStaticProps: GetStaticProps<Props> = async () => {
	return {props: {packs: listCollectivePacks()}};
};
