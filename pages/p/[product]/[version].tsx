"use client";

import { ArrowLeft } from "lucide-react";
import type { GetStaticPaths, GetStaticProps } from "next";
import Head from "next/head";
import Link from "next/link";
import { useState } from "react";
import FileTree, { type FileTreeItem } from "@/components/FileTree";
import MarkdownPane from "@/components/MarkdownPane";
import {
  listProducts,
  listVersions,
  readVersionPack,
  type VersionPack,
} from "@/lib/content";

type Props = {
  pack: VersionPack;
};

function buildItems(pack: VersionPack): FileTreeItem[] {
  return pack.files.map((f) => {
    if (f.channel.startsWith("personal:")) {
      // "personal:will:linkedin" → "will / linkedin.md"
      // "personal:will"          → "will.md"
      const rest = f.channel.slice("personal:".length);
      const parts = rest.split(":");
      const label =
        parts.length === 2 ? `${parts[0]} / ${parts[1]}.md` : `${rest}.md`;
      return { channel: f.channel, label, group: "personal" };
    }
    return { channel: f.channel, label: `${f.channel}.md`, group: "channels" };
  });
}

export default function VersionPage({ pack }: Props) {
  const items = buildItems(pack);
  const [selected, setSelected] = useState(items[0]?.channel ?? "");

  const file = pack.files.find((f) => f.channel === selected);

  const filename = (() => {
    if (!selected.startsWith("personal:")) return `${selected}.md`;
    const parts = selected.slice("personal:".length).split(":");
    return parts.length === 2 ? `${parts[1]}.md` : `${parts[0]}.md`;
  })();

  return (
    <>
      <Head>
        <title>
          {pack.product} v{pack.version} · ContentForest
        </title>
      </Head>
      <main className="max-w-6xl mx-auto px-4 py-10">
        <Link
          href={`/p/${pack.product}`}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
        >
          <ArrowLeft className="h-4 w-4" />
          {pack.product}
        </Link>

        <header className="mb-8">
          <h1 className="text-3xl font-bold mb-1">
            {pack.product}{" "}
            <span className="font-mono text-2xl text-muted-foreground">
              v{pack.version}
            </span>
          </h1>
          {(() => {
            const generatedAt =
              typeof pack.meta?.generated_at === "string"
                ? pack.meta.generated_at
                : null;
            const model =
              typeof pack.meta?.model === "string" ? pack.meta.model : null;
            if (!generatedAt) return null;
            return (
              <p className="text-sm text-muted-foreground">
                Generated {new Date(generatedAt).toLocaleString()}
                {model ? ` · ${model}` : null}
              </p>
            );
          })()}
        </header>

        <div className="grid gap-6 md:grid-cols-[220px_1fr]">
          <aside className="md:sticky md:top-20 md:self-start">
            <FileTree
              items={items}
              selected={selected}
              onSelect={setSelected}
            />
          </aside>
          <section className="min-w-0">
            {file ? (
              <MarkdownPane
                filename={filename}
                raw={file.raw}
                body={file.body}
              />
            ) : (
              <p className="text-muted-foreground">No file selected.</p>
            )}
          </section>
        </div>
      </main>
    </>
  );
}

export const getStaticPaths: GetStaticPaths = async () => {
  const paths: { params: { product: string; version: string } }[] = [];
  for (const product of listProducts()) {
    for (const version of listVersions(product.slug)) {
      paths.push({ params: { product: product.slug, version } });
    }
  }
  return { paths, fallback: false };
};

export const getStaticProps: GetStaticProps<Props> = async ({ params }) => {
  const product = params?.product as string;
  const version = params?.version as string;
  return { props: { pack: readVersionPack(product, version) } };
};
