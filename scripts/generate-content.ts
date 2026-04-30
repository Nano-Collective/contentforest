/**
 * Orchestrates a single release-pack generation:
 *
 *   1. Resolve product repo (NC_REPOS_DIR/<product>/ if set, else shallow
 *      clone v<version> into _repos/<product>/).
 *   2. Read the GitHub release body via `gh api`.
 *   3. Load prompts/release-pack.md, substitute {{VAR}} placeholders.
 *   4. Spawn `nanocoder run "<prompt>" --mode yolo` from the repo root.
 *   5. Run scripts/validate-content.ts on the produced pack.
 *   6. On validation failure, build the auto-fix prompt with the structured
 *      error report and retry up to --max-retries (default 3). Layer 1 of
 *      the auto-fix loop in planning §6.7.
 *   7. Update meta.json with attempt counters and final_status.
 *
 *   pnpm generate -- --product nanocoder --version 1.25.3
 *   pnpm generate -- --product nanocoder --version 1.25.3 --commit
 *   pnpm generate -- --product nanocoder --version 1.25.3 --dry-run
 *   pnpm generate -- --job-spec '{"product":"nanocoder","version":"1.25.3"}'
 *
 * Output location:
 *   --commit absent (default)  → content/_local/<product>/<version>/
 *   --commit present           → content/<product>/<version>/
 *   --test                     → content/_test/<product>/<version>/
 */

import { execSync, spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { parseArgs } from "node:util";

const ROOT = process.cwd();
const PROMPTS_DIR = join(ROOT, "prompts");
const CONFIG_DIR = join(ROOT, "config");

type Product = { slug: string; repo: string };

type JobSpec = {
  product: string;
  version: string;
  releaseBody?: string;
  releaseTagUrl?: string;
};

type RunMode = "commit" | "local" | "test";

type Args = {
  product?: string;
  version?: string;
  jobSpec?: string;
  mode: RunMode;
  dryRun: boolean;
  maxRetries: number;
};

function parse(): Args {
  const { values } = parseArgs({
    allowPositionals: true,
    options: {
      product: { type: "string" },
      version: { type: "string" },
      "job-spec": { type: "string" },
      commit: { type: "boolean", default: false },
      test: { type: "boolean", default: false },
      "dry-run": { type: "boolean", default: false },
      "max-retries": { type: "string", default: "3" },
    },
  });
  const mode: RunMode = values.commit
    ? "commit"
    : values.test
      ? "test"
      : "local";
  return {
    product: values.product as string | undefined,
    version: values.version as string | undefined,
    jobSpec: values["job-spec"] as string | undefined,
    mode,
    dryRun: values["dry-run"] as boolean,
    maxRetries: Number.parseInt(values["max-retries"] as string, 10),
  };
}

function packDirFor(mode: RunMode, product: string, version: string): string {
  if (mode === "commit") return join(ROOT, "content", product, version);
  if (mode === "test") return join(ROOT, "content", "_test", product, version);
  return join(ROOT, "content", "_local", product, version);
}

function loadProducts(): Product[] {
  return JSON.parse(
    readFileSync(join(CONFIG_DIR, "products.json"), "utf8"),
  ) as Product[];
}

function readFile(path: string): string {
  return readFileSync(path, "utf8");
}

/**
 * Resolves the path to a working copy of the product repo at the given tag.
 * Uses NC_REPOS_DIR/<product>/ if present (caller is responsible for
 * checkouts when reusing local checkouts) — otherwise shallow-clones into
 * _repos/<product>/. The clone is gitignored.
 */
function resolveRepoPath(product: Product, version: string): string {
  const reposDir = process.env.NC_REPOS_DIR;
  if (reposDir) {
    const expanded = reposDir.replace(/^~/, homedir());
    const path = join(expanded, product.slug);
    if (existsSync(path)) {
      console.log(`generate: using local checkout at ${path}`);
      return path;
    }
    console.log(
      `generate: NC_REPOS_DIR set but ${path} missing — falling back to clone`,
    );
  }

  const target = join(ROOT, "_repos", product.slug);
  if (existsSync(target)) {
    rmSync(target, { recursive: true, force: true });
  }
  mkdirSync(join(ROOT, "_repos"), { recursive: true });
  const url = `https://github.com/${product.repo}.git`;
  const tag = `v${version}`;
  console.log(`generate: cloning ${url} @ ${tag}`);
  try {
    execSync(`git clone --depth 1 --branch ${tag} ${url} ${target}`, {
      stdio: "inherit",
    });
  } catch {
    // tag without v-prefix is also common
    console.log(`generate: retrying clone without v-prefix (${version})`);
    execSync(`git clone --depth 1 --branch ${version} ${url} ${target}`, {
      stdio: "inherit",
    });
  }
  return target;
}

/**
 * Fetches the GitHub release body via the gh CLI. Returns empty string on
 * 404 (release may be a plain git tag with no GH release page).
 */
function fetchReleaseBody(
  product: Product,
  version: string,
): {
  body: string;
  url: string;
} {
  const tag = `v${version}`;
  const apiPath = `repos/${product.repo}/releases/tags/${tag}`;
  try {
    const json = execSync(`gh api ${apiPath}`, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    const release = JSON.parse(json) as { body?: string; html_url?: string };
    return {
      body: release.body ?? "",
      url:
        release.html_url ??
        `https://github.com/${product.repo}/releases/tag/${tag}`,
    };
  } catch {
    console.warn(
      `generate: no GH release found for ${product.repo}@${tag}, using empty body`,
    );
    return {
      body: "",
      url: `https://github.com/${product.repo}/releases/tag/${tag}`,
    };
  }
}

function substitute(template: string, vars: Record<string, string>): string {
  let out = template;
  for (const [key, value] of Object.entries(vars)) {
    out = out.replaceAll(`{{${key}}}`, value);
  }
  return out;
}

function buildPrompt(args: {
  product: Product;
  version: string;
  job: JobSpec;
  packDir: string;
  repoPath: string;
  generatedAt: string;
  model: string;
}): string {
  const template = readFile(join(PROMPTS_DIR, "release-pack.md"));
  const teamJson = readFile(join(CONFIG_DIR, "team.json"));
  const channelsJson = readFile(join(CONFIG_DIR, "channels.json"));
  return substitute(template, {
    PRODUCT_SLUG: args.product.slug,
    PRODUCT_REPO: args.product.repo,
    PRODUCT_REPO_URL: `https://github.com/${args.product.repo}`,
    VERSION: args.version,
    REPO_PATH: args.repoPath,
    RELEASE_TAG_URL: args.job.releaseTagUrl ?? "",
    RELEASE_BODY: args.job.releaseBody ?? "",
    GENERATED_AT: args.generatedAt,
    MODEL: args.model,
    TEAM_JSON: teamJson.trim(),
    CHANNELS_JSON: channelsJson.trim(),
    PACK_DIR: args.packDir,
  });
}

function buildAutoFixPrompt(args: {
  originalPrompt: string;
  errorReport: string;
  packDir: string;
  attemptNumber: number;
  maxAttempts: number;
}): string {
  const template = readFile(join(PROMPTS_DIR, "auto-fix.md"));
  return substitute(template, {
    PACK_DIR: args.packDir,
    ATTEMPT_NUMBER: String(args.attemptNumber),
    MAX_ATTEMPTS: String(args.maxAttempts),
    ERROR_REPORT: args.errorReport,
    ORIGINAL_PROMPT: args.originalPrompt,
  });
}

/**
 * Spawns `nanocoder run` with the given prompt. Inherits stdio so the user
 * sees progress in real time. Returns the exit code.
 *
 * `--mode yolo` runs every tool without prompting — required in CI where
 * there's no human to approve. `auto-accept` (Nanocoder's default for
 * non-interactive runs) still prompts for bash and destructive git, which
 * would hang the workflow indefinitely. Our prompt explicitly tells the
 * agent not to run bash, so yolo's blast radius is bounded by the prompt
 * contract plus the gitignored / scoped working directory.
 */
function runNanocoder(prompt: string, model: string): number {
  const result = spawnSync(
    "nanocoder",
    ["run", prompt, "--mode", "yolo", "--model", model],
    {
      cwd: ROOT,
      stdio: "inherit",
      env: process.env,
    },
  );
  if (result.error) {
    if ((result.error as NodeJS.ErrnoException).code === "ENOENT") {
      console.error(
        "generate: `nanocoder` not on PATH. Install it (npm i -g @nanocollective/nanocoder) or set up via brew/nix.",
      );
      return 127;
    }
    throw result.error;
  }
  return result.status ?? 1;
}

type ValidationReport = {
  scannedPacks: string[];
  skippedPacks: string[];
  failures: { file: string; rule: string; expected: string; actual: string }[];
  warnings: { file: string; rule: string; message: string }[];
};

function runValidator(args: {
  packId: string;
  root: string;
}): ValidationReport {
  const reportPath = join(tmpdir(), `cf-validation-${Date.now()}.json`);
  const result = spawnSync(
    "pnpm",
    [
      "validate",
      "--pack",
      args.packId,
      "--root",
      args.root,
      "--report",
      reportPath,
      "--quiet",
    ],
    {
      cwd: ROOT,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  if (!existsSync(reportPath)) {
    console.error(
      `generate: validator did not write a report.\n  exit=${result.status}\n  stdout=${result.stdout?.toString() ?? ""}\n  stderr=${result.stderr?.toString() ?? ""}`,
    );
    throw new Error("validator failed to produce a report");
  }
  return JSON.parse(readFileSync(reportPath, "utf8")) as ValidationReport;
}

function writeMeta(args: {
  packDir: string;
  product: string;
  version: string;
  productUrl: string;
  generatedAt: string;
  model: string;
  generationAttempts: number;
  autoFixAttempts: number;
  finalStatus: "passed" | "failed-validation" | "pending";
}) {
  const meta = {
    product: args.product,
    version: args.version,
    product_url: args.productUrl,
    generated_at: args.generatedAt,
    model: args.model,
    generation_attempts: args.generationAttempts,
    auto_fix_attempts: args.autoFixAttempts,
    final_status: args.finalStatus,
  };
  mkdirSync(args.packDir, { recursive: true });
  writeFileSync(join(args.packDir, "meta.json"), JSON.stringify(meta, null, 2));
}

async function main() {
  const args = parse();

  let job: JobSpec;
  if (args.jobSpec) {
    job = JSON.parse(args.jobSpec) as JobSpec;
  } else {
    if (!args.product || !args.version) {
      console.error(
        "generate: --product and --version are required (or pass --job-spec)",
      );
      process.exit(2);
    }
    job = { product: args.product, version: args.version };
  }

  const products = loadProducts();
  const product = products.find((p) => p.slug === job.product);
  if (!product) {
    console.error(`generate: unknown product ${job.product}`);
    console.error(`        known: ${products.map((p) => p.slug).join(", ")}`);
    process.exit(2);
  }

  const packDir = packDirFor(args.mode, product.slug, job.version);
  const generatedAt = new Date().toISOString();
  const model = "minimax-m2.7";

  console.log(
    `generate: ${product.slug} v${job.version} → ${packDir.replace(ROOT, ".")} (mode=${args.mode})`,
  );

  // Inputs the prompt needs
  const repoPath = resolveRepoPath(product, job.version);
  if (!job.releaseBody || !job.releaseTagUrl) {
    const fetched = fetchReleaseBody(product, job.version);
    job.releaseBody = job.releaseBody ?? fetched.body;
    job.releaseTagUrl = job.releaseTagUrl ?? fetched.url;
  }

  const initialPrompt = buildPrompt({
    product,
    version: job.version,
    job,
    packDir,
    repoPath,
    generatedAt,
    model,
  });

  if (args.dryRun) {
    console.log(
      "\n--- DRY RUN: substituted prompt below, nanocoder NOT invoked ---\n",
    );
    console.log(initialPrompt);
    process.exit(0);
  }

  // Pre-create pack dir so nanocoder can write into it cleanly
  mkdirSync(packDir, { recursive: true });

  let attempt = 0;
  let autoFixAttempts = 0;
  let prompt = initialPrompt;
  let finalReport: ValidationReport | null = null;

  while (attempt < args.maxRetries) {
    attempt += 1;
    console.log(`\ngenerate: attempt ${attempt}/${args.maxRetries}`);
    const code = runNanocoder(prompt, model);
    if (code !== 0) {
      console.error(`generate: nanocoder exited ${code}; aborting`);
      writeMeta({
        packDir,
        product: product.slug,
        version: job.version,
        productUrl: `https://github.com/${product.repo}`,
        generatedAt,
        model,
        generationAttempts: attempt,
        autoFixAttempts,
        finalStatus: "failed-validation",
      });
      process.exit(code);
    }

    const packId = `${product.slug}/${job.version}`;
    const validatorRoot =
      args.mode === "commit"
        ? "content"
        : args.mode === "test"
          ? "content/_test"
          : "content/_local";
    finalReport = runValidator({ packId, root: validatorRoot });

    if (finalReport.failures.length === 0) {
      console.log(
        `generate: ✓ validation passed${finalReport.warnings.length > 0 ? ` (${finalReport.warnings.length} warnings)` : ""}`,
      );
      writeMeta({
        packDir,
        product: product.slug,
        version: job.version,
        productUrl: `https://github.com/${product.repo}`,
        generatedAt,
        model,
        generationAttempts: attempt,
        autoFixAttempts,
        finalStatus: "passed",
      });
      process.exit(0);
    }

    console.log(
      `generate: ✗ validation failed (${finalReport.failures.length} failures)`,
    );
    if (attempt >= args.maxRetries) break;

    autoFixAttempts += 1;
    prompt = buildAutoFixPrompt({
      originalPrompt: initialPrompt,
      errorReport: JSON.stringify(finalReport.failures, null, 2),
      packDir,
      attemptNumber: autoFixAttempts,
      maxAttempts: args.maxRetries - 1,
    });
  }

  console.error(
    `\ngenerate: gave up after ${attempt} attempts; final report:\n${JSON.stringify(finalReport?.failures, null, 2)}`,
  );
  writeMeta({
    packDir,
    product: product.slug,
    version: job.version,
    productUrl: `https://github.com/${product.repo}`,
    generatedAt,
    model,
    generationAttempts: attempt,
    autoFixAttempts,
    finalStatus: "failed-validation",
  });
  process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
