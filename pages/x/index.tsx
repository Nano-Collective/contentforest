import {ArrowLeft, ArrowRight, MessageSquare} from 'lucide-react';
import type {GetStaticProps} from 'next';
import Head from 'next/head';
import Link from 'next/link';
import {Card, CardHeader, CardTitle} from '@/components/ui/card';
import {
	isPackDealtWith,
	listXDailyBuckets,
	readXDailyBucket,
	type XDailyBucketSummary,
} from '@/lib/content';
import {cn} from '@/lib/utils';

type BucketEntry = XDailyBucketSummary & {allMarked: boolean};

type Props = {
	buckets: BucketEntry[];
};

function postCount(meta: Record<string, unknown> | null): number | null {
	const posts = meta?.posts;
	return Array.isArray(posts) ? posts.length : null;
}

export default function XDailyIndexPage({buckets}: Props) {
	return (
		<>
			<Head>
				<title>Daily X posts · ContentForest</title>
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
					<h1 className="text-3xl font-bold mb-2">Daily X posts</h1>
					<p className="text-muted-foreground">
						{buckets.length} day{buckets.length === 1 ? '' : 's'} of generated X
						posts for the Nano Collective account, one per product plus a couple
						about the collective.
					</p>
				</header>

				{buckets.length === 0 ? (
					<p className="text-muted-foreground">
						No daily X posts yet. The daily workflow opens a PR each morning.
					</p>
				) : (
					<ul className="flex flex-col gap-3">
						{buckets.map(bucket => {
							const count = postCount(bucket.meta);
							return (
								<li key={bucket.date}>
									<Link href={`/x/${bucket.date}`} className="block group">
										<Card
											className={cn(
												'transition-colors group-hover:border-primary/50',
												bucket.allMarked && 'opacity-60',
											)}
										>
											<CardHeader>
												<CardTitle className="flex items-center justify-between text-base font-mono">
													<span
														className={cn(
															'flex items-center gap-2',
															bucket.allMarked && 'line-through',
														)}
													>
														<MessageSquare className="h-4 w-4 text-primary" />
														{bucket.date}
													</span>
													<span className="flex items-center gap-3 text-sm text-muted-foreground font-sans">
														{count !== null && (
															<span>
																{count} post{count === 1 ? '' : 's'}
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
			buckets: listXDailyBuckets().map(bucket => ({
				...bucket,
				allMarked: isPackDealtWith(readXDailyBucket(bucket.date).files),
			})),
		},
	};
};
