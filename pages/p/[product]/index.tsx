import { ArrowLeft, ArrowRight, GitBranch } from "lucide-react";
import type { GetStaticPaths, GetStaticProps } from "next";
import Head from "next/head";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { listProducts, listVersions } from "@/lib/content";

type Props = {
  product: string;
  versions: string[];
};

export default function ProductPage({ product, versions }: Props) {
  return (
    <>
      <Head>
        <title>{product} · ContentForest</title>
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
          <h1 className="text-3xl font-bold mb-2">{product}</h1>
          <p className="text-muted-foreground">
            {versions.length} version{versions.length === 1 ? "" : "s"} of
            generated content.
          </p>
        </header>

        {versions.length === 0 ? (
          <p className="text-muted-foreground">No versions yet.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {versions.map((version) => (
              <li key={version}>
                <Link
                  href={`/p/${product}/${version}`}
                  className="block group"
                >
                  <Card className="transition-colors group-hover:border-primary/50">
                    <CardHeader>
                      <CardTitle className="flex items-center justify-between text-base font-mono">
                        <span className="flex items-center gap-2">
                          <GitBranch className="h-4 w-4 text-primary" />v
                          {version}
                        </span>
                        <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1" />
                      </CardTitle>
                    </CardHeader>
                    <CardContent />
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

export const getStaticPaths: GetStaticPaths = async () => {
  return {
    paths: listProducts().map((p) => ({ params: { product: p.slug } })),
    fallback: false,
  };
};

export const getStaticProps: GetStaticProps<Props> = async ({ params }) => {
  const product = params?.product as string;
  return {
    props: {
      product,
      versions: listVersions(product),
    },
  };
};
