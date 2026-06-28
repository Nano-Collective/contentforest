import {
	ArrowRight,
	CalendarRange,
	Megaphone,
	MessageSquare,
	Package,
} from 'lucide-react';
import Link from 'next/link';
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from '@/components/ui/card';
import type {ProductSummary} from '@/lib/content';

type Props = {
	products: ProductSummary[];
	collectivePackCount: number;
	xDailyBucketCount: number;
	weeklyPackCount: number;
};

export function ProductGrid({
	products,
	collectivePackCount,
	xDailyBucketCount,
	weeklyPackCount,
}: Props) {
	return (
		<section id="products" className="max-w-6xl mx-auto px-4 py-16">
			<header className="mb-8">
				<h2 className="text-2xl font-bold mb-2">Products</h2>
				<p className="text-muted-foreground">
					Browse generated release packs and evergreen content for every Nano
					Collective product.
				</p>
			</header>

			<ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
				{products.map(product => (
					<li key={product.slug}>
						<Link href={`/p/${product.slug}`} className="block group">
							<Card className="h-full transition-colors group-hover:border-primary/50 card-hover-glow">
								<CardHeader>
									<CardTitle className="flex items-center gap-2">
										<Package className="h-5 w-5 text-primary" />
										{product.slug}
									</CardTitle>
									<CardDescription>
										{product.latestVersion
											? `Latest: v${product.latestVersion}`
											: 'No content yet'}
									</CardDescription>
								</CardHeader>
								<CardContent>
									<div className="flex items-center justify-between text-sm text-muted-foreground">
										<span>
											{product.versions.length} version
											{product.versions.length === 1 ? '' : 's'}
										</span>
										<ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
									</div>
								</CardContent>
							</Card>
						</Link>
					</li>
				))}

				<li key="_collective">
					<Link href="/c" className="block group">
						<Card className="h-full transition-colors group-hover:border-primary/50 card-hover-glow">
							<CardHeader>
								<CardTitle className="flex items-center gap-2">
									<Megaphone className="h-5 w-5 text-primary" />
									Collective
								</CardTitle>
								<CardDescription>
									Cross-product packs about the collective
								</CardDescription>
							</CardHeader>
							<CardContent>
								<div className="flex items-center justify-between text-sm text-muted-foreground">
									<span>
										{collectivePackCount} pack
										{collectivePackCount === 1 ? '' : 's'}
									</span>
									<ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
								</div>
							</CardContent>
						</Card>
					</Link>
				</li>

				<li key="_x-daily">
					<Link href="/x" className="block group">
						<Card className="h-full transition-colors group-hover:border-primary/50 card-hover-glow">
							<CardHeader>
								<CardTitle className="flex items-center gap-2">
									<MessageSquare className="h-5 w-5 text-primary" />
									Daily X posts
								</CardTitle>
								<CardDescription>
									Daily X posts for the collective account
								</CardDescription>
							</CardHeader>
							<CardContent>
								<div className="flex items-center justify-between text-sm text-muted-foreground">
									<span>
										{xDailyBucketCount} day
										{xDailyBucketCount === 1 ? '' : 's'}
									</span>
									<ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
								</div>
							</CardContent>
						</Card>
					</Link>
				</li>

				<li key="_weekly">
					<Link href="/w" className="block group">
						<Card className="h-full transition-colors group-hover:border-primary/50 card-hover-glow">
							<CardHeader>
								<CardTitle className="flex items-center gap-2">
									<CalendarRange className="h-5 w-5 text-primary" />
									Weekly pack
								</CardTitle>
								<CardDescription>
									Weekly picks of unused content
								</CardDescription>
							</CardHeader>
							<CardContent>
								<div className="flex items-center justify-between text-sm text-muted-foreground">
									<span>
										{weeklyPackCount} week
										{weeklyPackCount === 1 ? '' : 's'}
									</span>
									<ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
								</div>
							</CardContent>
						</Card>
					</Link>
				</li>
			</ul>
		</section>
	);
}
