import type {GetStaticProps} from 'next';
import Head from 'next/head';
import {Hero} from '@/components/home/Hero';
import {ProductGrid} from '@/components/home/ProductGrid';
import {
	listCollectivePacks,
	listProducts,
	type ProductSummary,
} from '@/lib/content';

type Props = {
	products: ProductSummary[];
	collectivePackCount: number;
};

export default function Home({products, collectivePackCount}: Props) {
	return (
		<>
			<Head>
				<title>ContentForest · Nano Collective</title>
			</Head>
			<Hero />
			<ProductGrid
				products={products}
				collectivePackCount={collectivePackCount}
			/>
		</>
	);
}

export const getStaticProps: GetStaticProps<Props> = async () => {
	return {
		props: {
			products: listProducts(),
			collectivePackCount: listCollectivePacks().length,
		},
	};
};
