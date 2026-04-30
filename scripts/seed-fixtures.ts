/**
 * Pulls the latest released version of every product into content/_test/
 * by invoking generate-content.ts with --test for each. Useful for prompt-
 * tuning sessions where you want a stable corpus to iterate against.
 *
 *   pnpm seed-fixtures
 *   pnpm seed-fixtures -- --product nanocoder        # one product only
 *
 * Skips products that already have a content/_test/<product>/<version>/
 * directory unless --force is passed.
 */
import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";

const ROOT = process.cwd();

type Product = { slug: string; repo: string };

function main() {
  const { values } = parseArgs({
    allowPositionals: true,
    options: {
      product: { type: "string" },
      force: { type: "boolean", default: false },
    },
  });

  const products = JSON.parse(
    readFileSync(join(ROOT, "config/products.json"), "utf8"),
  ) as Product[];

  const targets = values.product
    ? products.filter((p) => p.slug === (values.product as string))
    : products;

  if (targets.length === 0) {
    console.error(
      `seed-fixtures: no matching products (got --product=${values.product})`,
    );
    process.exit(2);
  }

  for (const product of targets) {
    let version: string;
    try {
      const json = execSync(`gh api repos/${product.repo}/releases/latest`, {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      });
      version = (JSON.parse(json) as { tag_name: string }).tag_name.replace(
        /^v/,
        "",
      );
    } catch {
      console.warn(
        `seed-fixtures: skipping ${product.slug} (no latest release)`,
      );
      continue;
    }

    const packDir = join(ROOT, "content", "_test", product.slug, version);
    if (existsSync(packDir) && !values.force) {
      console.log(
        `seed-fixtures: ${product.slug}@${version} already in _test/, skip (use --force to regenerate)`,
      );
      continue;
    }

    console.log(`\nseed-fixtures: ${product.slug}@${version}\n`);
    execSync(
      `pnpm generate -- --product ${product.slug} --version ${version} --test`,
      { cwd: ROOT, stdio: "inherit" },
    );
  }
}

main();
