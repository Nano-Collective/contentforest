import type { GetStaticProps } from "next";
import Head from "next/head";
import { Hero } from "@/components/home/Hero";
import { ProductGrid } from "@/components/home/ProductGrid";
import { listProducts, type ProductSummary } from "@/lib/content";

type Props = {
  products: ProductSummary[];
};

export default function Home({ products }: Props) {
  return (
    <>
      <Head>
        <title>ContentForest · Nano Collective</title>
      </Head>
      <Hero />
      <ProductGrid products={products} />
    </>
  );
}

export const getStaticProps: GetStaticProps<Props> = async () => {
  return { props: { products: listProducts() } };
};
