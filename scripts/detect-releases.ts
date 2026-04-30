/**
 * Diffs the latest GitHub release of each product in config/products.json
 * against the highest version recorded in content/<product>/index.json.
 * Emits a JSON array of new release jobs to stdout, one per product with a
 * newer release than what's been processed.
 *
 *   pnpm detect-releases               # writes to stdout
 *   pnpm detect-releases > jobs.json
 *
 * Output shape:
 *   [
 *     {
 *       "product": "nanocoder",
 *       "version": "1.25.3",
 *       "releaseBody": "...",
 *       "releaseTagUrl": "https://github.com/Nano-Collective/nanocoder/releases/tag/v1.25.3"
 *     },
 *     ...
 *   ]
 *
 * Exit codes:
 *   0 — successful detection (any number of jobs, including zero)
 *   1 — unexpected error (network, gh missing, malformed configs)
 */
import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();

type Product = { slug: string; repo: string };
type ProductIndex = {
  slug: string;
  repo: string;
  latestVersion?: string | null;
  versions?: string[];
};

type Job = {
  product: string;
  version: string;
  releaseBody: string;
  releaseTagUrl: string;
};

function loadProducts(): Product[] {
  return JSON.parse(
    readFileSync(join(ROOT, "config/products.json"), "utf8"),
  ) as Product[];
}

function loadProcessedVersion(product: string): string | null {
  const path = join(ROOT, "content", product, "index.json");
  if (!existsSync(path)) return null;
  try {
    const idx = JSON.parse(readFileSync(path, "utf8")) as ProductIndex;
    return idx.latestVersion ?? null;
  } catch {
    return null;
  }
}

function fetchLatestRelease(repo: string): {
  tag: string;
  version: string;
  body: string;
  url: string;
} | null {
  try {
    const json = execSync(`gh api repos/${repo}/releases/latest`, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    const release = JSON.parse(json) as {
      tag_name: string;
      body?: string;
      html_url?: string;
    };
    const tag = release.tag_name;
    const version = tag.replace(/^v/, "");
    return {
      tag,
      version,
      body: release.body ?? "",
      url: release.html_url ?? `https://github.com/${repo}/releases/tag/${tag}`,
    };
  } catch (e) {
    process.stderr.write(
      `detect-releases: ${repo} → no latest release: ${(e as Error).message}\n`,
    );
    return null;
  }
}

function compareVersions(a: string, b: string): number {
  const pa = a.split(".").map((n) => Number.parseInt(n, 10) || 0);
  const pb = b.split(".").map((n) => Number.parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

function main() {
  const products = loadProducts();
  const jobs: Job[] = [];

  for (const product of products) {
    const release = fetchLatestRelease(product.repo);
    if (!release) {
      process.stderr.write(
        `detect-releases: ${product.slug} skipped (no GH release)\n`,
      );
      continue;
    }

    const processed = loadProcessedVersion(product.slug);
    if (processed && compareVersions(release.version, processed) <= 0) {
      process.stderr.write(
        `detect-releases: ${product.slug}@${release.version} ≤ processed ${processed}, skip\n`,
      );
      continue;
    }

    process.stderr.write(
      `detect-releases: ${product.slug}@${release.version} ${processed ? `> ${processed}` : "(first)"} — NEW\n`,
    );
    jobs.push({
      product: product.slug,
      version: release.version,
      releaseBody: release.body,
      releaseTagUrl: release.url,
    });
  }

  process.stdout.write(JSON.stringify(jobs, null, 2));
  process.stdout.write("\n");
}

main();
