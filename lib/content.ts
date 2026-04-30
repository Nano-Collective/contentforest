import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import matter from "gray-matter";

const CONTENT_DIR = join(process.cwd(), "content");

export type ContentFile = {
  path: string;
  channel: string;
  raw: string;
  body: string;
  frontmatter: Record<string, unknown>;
};

export type VersionPack = {
  product: string;
  version: string;
  meta: Record<string, unknown> | null;
  files: ContentFile[];
};

export type ProductSummary = {
  slug: string;
  latestVersion: string | null;
  versions: string[];
};

function listDirs(path: string): string[] {
  try {
    return readdirSync(path).filter((entry) => {
      const full = join(path, entry);
      return statSync(full).isDirectory() && !entry.startsWith("_");
    });
  } catch {
    return [];
  }
}

function compareVersionsDesc(a: string, b: string): number {
  const pa = a.split(".").map((n) => Number.parseInt(n, 10) || 0);
  const pb = b.split(".").map((n) => Number.parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const diff = (pb[i] ?? 0) - (pa[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

export function listProducts(): ProductSummary[] {
  const slugs = listDirs(CONTENT_DIR);
  return slugs.map((slug) => {
    const versions = listDirs(join(CONTENT_DIR, slug)).sort(
      compareVersionsDesc,
    );
    return {
      slug,
      latestVersion: versions[0] ?? null,
      versions,
    };
  });
}

export function listVersions(product: string): string[] {
  return listDirs(join(CONTENT_DIR, product)).sort(compareVersionsDesc);
}

function readMarkdown(filePath: string, channel: string): ContentFile {
  const raw = readFileSync(filePath, "utf8");
  const parsed = matter(raw);
  // gray-matter parses ISO date strings into JS Date objects via js-yaml, but
  // Next's getStaticProps requires JSON-serializable props. Round-trip through
  // JSON so dates become ISO strings.
  const frontmatter = JSON.parse(JSON.stringify(parsed.data));
  return {
    path: filePath,
    channel,
    raw,
    body: parsed.content,
    frontmatter,
  };
}

export function readVersionPack(product: string, version: string): VersionPack {
  const root = join(CONTENT_DIR, product, version);
  const files: ContentFile[] = [];

  // channels/*.md (flat)
  const channelsPath = join(root, "channels");
  try {
    const entries = readdirSync(channelsPath).filter((e) => e.endsWith(".md"));
    for (const entry of entries) {
      const channel = entry.replace(/\.md$/, "");
      files.push(readMarkdown(join(channelsPath, entry), channel));
    }
  } catch {
    // channels/ may not exist
  }

  // personal/<member>/<channel>.md (nested) — also handles the flat fallback
  // personal/<member>-<channel>.md form that the validator accepts.
  const personalPath = join(root, "personal");
  try {
    for (const memberEntry of readdirSync(personalPath)) {
      const memberPath = join(personalPath, memberEntry);
      const stat = statSync(memberPath);
      if (stat.isDirectory()) {
        for (const channelFile of readdirSync(memberPath)) {
          if (!channelFile.endsWith(".md")) continue;
          const channelSlug = channelFile.replace(/\.md$/, "");
          files.push(
            readMarkdown(
              join(memberPath, channelFile),
              `personal:${memberEntry}:${channelSlug}`,
            ),
          );
        }
      } else if (memberEntry.endsWith(".md")) {
        // flat fallback: personal/will-linkedin.md or personal/will.md
        const stem = memberEntry.replace(/\.md$/, "");
        const dash = stem.indexOf("-");
        const channel =
          dash > 0
            ? `personal:${stem.slice(0, dash)}:${stem.slice(dash + 1)}`
            : `personal:${stem}`;
        files.push(readMarkdown(memberPath, channel));
      }
    }
  } catch {
    // personal/ may not exist
  }

  let meta: Record<string, unknown> | null = null;
  try {
    meta = JSON.parse(readFileSync(join(root, "meta.json"), "utf8"));
  } catch {
    // meta is optional in early scaffold
  }

  return { product, version, meta, files };
}
