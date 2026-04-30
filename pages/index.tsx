import { ArrowRight, Package } from "lucide-react";
import type { GetStaticProps } from "next";
import Head from "next/head";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
      <main className="max-w-6xl mx-auto px-4 py-10">
        <header className="mb-10">
          <h1 className="text-3xl font-bold mb-2">Products</h1>
          <p className="text-muted-foreground">
            Browse generated release packs and evergreen content for every Nano
            Collective product.
          </p>
        </header>

        {products.length === 0 ? (
          <p className="text-muted-foreground">
            No products yet. Add one to <code>config/products.json</code>.
          </p>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {products.map((product) => (
              <li key={product.slug}>
                <Link href={`/p/${product.slug}`} className="block group">
                  <Card className="h-full transition-colors group-hover:border-primary/50">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Package className="h-5 w-5 text-primary" />
                        {product.slug}
                      </CardTitle>
                      <CardDescription>
                        {product.latestVersion
                          ? `Latest: v${product.latestVersion}`
                          : "No content yet"}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center justify-between text-sm text-muted-foreground">
                        <span>
                          {product.versions.length} version
                          {product.versions.length === 1 ? "" : "s"}
                        </span>
                        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </>
  );
}

export const getStaticProps: GetStaticProps<Props> = async () => {
  return { props: { products: listProducts() } };
};
