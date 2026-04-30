import { ArrowRight, Package } from "lucide-react";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { ProductSummary } from "@/lib/content";

type Props = {
  products: ProductSummary[];
};

export function ProductGrid({ products }: Props) {
  return (
    <section id="products" className="max-w-6xl mx-auto px-4 py-16">
      <header className="mb-8">
        <h2 className="text-2xl font-bold mb-2">Products</h2>
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
                <Card className="h-full transition-colors group-hover:border-primary/50 card-hover-glow">
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
    </section>
  );
}
