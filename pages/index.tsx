import type {GetStaticProps} from 'next';
import Head from 'next/head';
import {Hero} from '@/components/home/Hero';
import {ProductGrid} from '@/components/home/ProductGrid';
import {
	listCollectivePacks,
	listProducts,
	listWeeklyPacks,
	listXDailyBuckets,
	type ProductSummary,
} from '@/lib/content';

type Props = {
	products: ProductSummary[];
	collectivePackCount: number;
	xDailyBucketCount: number;
	weeklyPackCount: number;
};

export default function Home({
	products,
	collectivePackCount,
	xDailyBucketCount,
	weeklyPackCount,
}: Props) {
	return (
		<>
			<Head>
				<title>ContentForest · Nano Collective</title>
			</Head>
			<Hero />
			<ProductGrid
				products={products}
				collectivePackCount={collectivePackCount}
				xDailyBucketCount={xDailyBucketCount}
				weeklyPackCount={weeklyPackCount}
			/>
		</>
	);
}

export const getStaticProps: GetStaticProps<Props> = async () => {
	return {
		props: {
			products: listProducts(),
			collectivePackCount: listCollectivePacks().length,
			xDailyBucketCount: listXDailyBuckets().length,
			weeklyPackCount: listWeeklyPacks().length,
		},
	};
};
