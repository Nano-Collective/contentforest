import {ArrowLeft, ArrowRight, CalendarRange} from 'lucide-react';
import type {GetStaticProps} from 'next';
import Head from 'next/head';
import Link from 'next/link';
import {Card, CardHeader, CardTitle} from '@/components/ui/card';
import {listWeeklyPacks, type WeeklyPackSummary} from '@/lib/content';

type Props = {
	packs: WeeklyPackSummary[];
};

function pickCount(meta: Record<string, unknown> | null): number | null {
	const picks = meta?.picks;
	return Array.isArray(picks) ? picks.length : null;
}

export default function WeeklyIndexPage({packs}: Props) {
	return (
		<>
			<Head>
				<title>Weekly content packs · ContentForest</title>
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
					<h1 className="text-3xl font-bold mb-2">Weekly content packs</h1>
					<p className="text-muted-foreground">
						{packs.length} week{packs.length === 1 ? '' : 's'} of curated picks:
						one recommended unused piece per channel, gathered from across the
						product and collective packs. A fresh pack lands each Monday.
					</p>
				</header>

				{packs.length === 0 ? (
					<p className="text-muted-foreground">
						No weekly packs yet. The weekly workflow opens a PR each Monday when
						there is unused content to recommend.
					</p>
				) : (
					<ul className="flex flex-col gap-3">
						{packs.map(pack => {
							const count = pickCount(pack.meta);
							return (
								<li key={pack.date}>
									<Link href={`/w/${pack.date}`} className="block group">
										<Card className="transition-colors group-hover:border-primary/50">
											<CardHeader>
												<CardTitle className="flex items-center justify-between text-base font-mono">
													<span className="flex items-center gap-2">
														<CalendarRange className="h-4 w-4 text-primary" />
														{pack.date}
													</span>
													<span className="flex items-center gap-3 text-sm text-muted-foreground font-sans">
														{count !== null && (
															<span>
																{count} pick{count === 1 ? '' : 's'}
															</span>
														)}
														<ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
													</span>
												</CardTitle>
											</CardHeader>
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
	return {
		props: {
			packs: listWeeklyPacks(),
		},
	};
};
