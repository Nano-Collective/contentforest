import type {GetStaticProps} from 'next';
import Head from 'next/head';
import {Hero} from '@/components/home/Hero';
import {ProductGrid} from '@/components/home/ProductGrid';
import {listCalendarWeeks} from '@/lib/calendar';
import {
	listCollectivePacks,
	listProducts,
	listXDailyBuckets,
	type ProductSummary,
} from '@/lib/content';

type Props = {
	products: ProductSummary[];
	collectivePackCount: number;
	xDailyBucketCount: number;
	calendarWeekCount: number;
};

export default function Home({
	products,
	collectivePackCount,
	xDailyBucketCount,
	calendarWeekCount,
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
				calendarWeekCount={calendarWeekCount}
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
			calendarWeekCount: listCalendarWeeks().length,
		},
	};
};
