/**
 * Orchestrates a single release-pack generation via the v2 two-agent
 * pipeline (planning §6.4.3).
 *
 *   1. Resolve product repo (NC_REPOS_DIR/<product>/ if set, else shallow
 *      clone v<version> into _repos/<product>/).
 *   2. Read the GitHub release body via `gh api`.
 *   3. For each agent in the pipeline (release-channels, article-channels):
 *        - Load prompts/agents/<slug>.md, substitute {{VAR}} placeholders.
 *        - Spawn `nanocoder run "<prompt>" --mode yolo`.
 *        - Run the validator at that agent's phase.
 *        - On failure, build the auto-fix prompt with the structured error
 *          report and retry up to --max-retries (default 6 = 1 initial + 5
 *          retries) for that agent.
 *        - If the agent exhausts retries, write meta.json with
 *          final_status: "failed-validation" + failed_agent: <slug>, leave
 *          whatever was produced on disk for inspection, and abort the run.
 *   4. After all four agents pass, write final meta.json with cumulative
 *      attempt counters and final_status: "passed".
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
  unlinkSync,
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

type Phase = "channels" | "articles";

type AgentSpec = {
  slug: string;
  phase: Phase;
  promptFile: string;
};

const AGENTS: AgentSpec[] = [
  {
    slug: "release-channels",
    phase: "channels",
    promptFile: "agents/release-channels.md",
  },
  {
    slug: "article-channels",
    phase: "articles",
    promptFile: "agents/article-channels.md",
  },
];

type Args = {
  product?: string;
  version?: string;
  jobSpec?: string;
  mode: RunMode;
  dryRun: boolean;
  maxAttemptsPerAgent: number;
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
      "max-retries": { type: "string", default: "6" },
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
    // --max-retries is the *total attempts* per agent (1 initial + retries).
    // Default 6 = 1 initial + up to 5 retries; cost ceiling = 2 agents × 6 = 12 spawns.
    maxAttemptsPerAgent: Number.parseInt(values["max-retries"] as string, 10),
  };
}

function packDirFor(mode: RunMode, product: string, version: string): string {
  if (mode === "commit") return join(ROOT, "content", product, version);
  if (mode === "test") return join(ROOT, "content", "_test", product, version);
  return join(ROOT, "content", "_local", product, version);
}

function validatorRootFor(mode: RunMode): string {
  if (mode === "commit") return "content";
  if (mode === "test") return "content/_test";
  return "content/_local";
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

/**
 * Common variable bag for every agent prompt. Individual agent prompts
 * use whichever subset they need; unused keys are silently ignored.
 *
 * PACK_ID and VALIDATOR_ROOT are surfaced so each agent can run
 * `pnpm validate` against itself in-process before exiting (planning
 * §6.4.3 — the in-spawn self-check optimisation). The orchestrator
 * still validates after the spawn returns; the self-check just lets
 * the model converge in one spawn instead of needing a fresh one.
 */
function buildPromptVars(args: {
  product: Product;
  version: string;
  job: JobSpec;
  packDir: string;
  repoPath: string;
  generatedAt: string;
  model: string;
  validatorRoot: string;
}): Record<string, string> {
  const channelsJson = readFile(join(CONFIG_DIR, "channels.json"));
  return {
    PRODUCT_SLUG: args.product.slug,
    PRODUCT_REPO: args.product.repo,
    PRODUCT_REPO_URL: `https://github.com/${args.product.repo}`,
    VERSION: args.version,
    REPO_PATH: args.repoPath,
    RELEASE_TAG_URL: args.job.releaseTagUrl ?? "",
    RELEASE_BODY: args.job.releaseBody ?? "",
    GENERATED_AT: args.generatedAt,
    MODEL: args.model,
    CHANNELS_JSON: channelsJson.trim(),
    PACK_DIR: args.packDir,
    PACK_ID: `${args.product.slug}/${args.version}`,
    VALIDATOR_ROOT: args.validatorRoot,
  };
}

function buildAgentPrompt(
  agent: AgentSpec,
  vars: Record<string, string>,
): string {
  const template = readFile(join(PROMPTS_DIR, agent.promptFile));
  return substitute(template, vars);
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
 * would hang the workflow indefinitely. Our prompts explicitly tell each
 * agent not to run bash, so yolo's blast radius is bounded by the prompt
 * contract plus the gitignored / scoped working directory.
 *
 * **TTY:** Nanocoder is built on Ink, which requires raw-mode TTY input even
 * in `run` (non-interactive) mode (see `nano-coder/source/cli.tsx` — render()
 * is unconditional). GitHub Actions runners have no TTY on stdin, so Ink
 * crashes with "Raw mode is not supported" before any tool calls execute.
 * On non-TTY parents we wrap the spawn in `script(1)` (util-linux) which
 * allocates a pty. On a real TTY we spawn nanocoder directly for the
 * cleanest UX. The prompt is passed via a temp file to avoid shell
 * escaping the agent's markdown.
 */
function runNanocoder(prompt: string, model: string): number {
  const isTTY = Boolean(process.stdout.isTTY);

  if (isTTY) {
    const result = spawnSync(
      "nanocoder",
      ["run", prompt, "--mode", "yolo", "--model", model, "--trust-directory"],
      { cwd: ROOT, stdio: "inherit", env: process.env },
    );
    if (result.error) {
      if ((result.error as NodeJS.ErrnoException).code === "ENOENT") {
        console.error(
          "generate: `nanocoder` not on PATH. Install it (npm i -g @nanocollective/nanocoder).",
        );
        return 127;
      }
      throw result.error;
    }
    return result.status ?? 1;
  }

  // Non-TTY parent (CI): allocate a pty via `script` so Ink can set raw mode.
  // We write the prompt to a temp file and substitute it via $(cat ...) so
  // we don't have to shell-escape the markdown body.
  // -f flushes output after every write — without it CI logs are silent for
  // minutes at a time while a generation is actually progressing.
  const promptFile = join(tmpdir(), `cf-prompt-${Date.now()}.md`);
  writeFileSync(promptFile, prompt, "utf8");
  try {
    const cmd = `nanocoder run "$(cat ${promptFile})" --mode yolo --model ${model} --trust-directory`;
    const result = spawnSync("script", ["-qfec", cmd, "/dev/null"], {
      cwd: ROOT,
      stdio: "inherit",
      env: process.env,
    });
    if (result.error) {
      if ((result.error as NodeJS.ErrnoException).code === "ENOENT") {
        console.error(
          "generate: `script(1)` not on PATH. Install util-linux (apt-get install bsdmainutils on Debian/Ubuntu).",
        );
        return 127;
      }
      throw result.error;
    }
    return result.status ?? 1;
  } finally {
    try {
      unlinkSync(promptFile);
    } catch {
      // best-effort cleanup
    }
  }
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
  phase: Phase;
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
      "--phase",
      args.phase,
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
  failedAgent?: string;
}) {
  const meta: Record<string, unknown> = {
    product: args.product,
    version: args.version,
    product_url: args.productUrl,
    generated_at: args.generatedAt,
    model: args.model,
    generation_attempts: args.generationAttempts,
    auto_fix_attempts: args.autoFixAttempts,
    final_status: args.finalStatus,
  };
  if (args.failedAgent) meta.failed_agent = args.failedAgent;
  mkdirSync(args.packDir, { recursive: true });
  writeFileSync(join(args.packDir, "meta.json"), JSON.stringify(meta, null, 2));
}

type PipelineResult = {
  finalStatus: "passed" | "failed-validation";
  failedAgent?: string;
  generationAttempts: number;
  autoFixAttempts: number;
};

function runAgentPipeline(args: {
  product: Product;
  version: string;
  job: JobSpec;
  packDir: string;
  repoPath: string;
  generatedAt: string;
  model: string;
  validatorRoot: string;
  maxAttemptsPerAgent: number;
}): PipelineResult {
  const promptVars = buildPromptVars({
    product: args.product,
    version: args.version,
    job: args.job,
    packDir: args.packDir,
    repoPath: args.repoPath,
    generatedAt: args.generatedAt,
    model: args.model,
    validatorRoot: args.validatorRoot,
  });
  const packId = `${args.product.slug}/${args.version}`;

  let totalGenerationAttempts = 0;
  let totalAutoFixAttempts = 0;

  for (const agent of AGENTS) {
    console.log(
      `\ngenerate: ━━━ agent: ${agent.slug} (phase=${agent.phase}) ━━━`,
    );
    const initialPrompt = buildAgentPrompt(agent, promptVars);
    let prompt = initialPrompt;
    let attempt = 0;
    let lastReport: ValidationReport | null = null;

    while (attempt < args.maxAttemptsPerAgent) {
      attempt += 1;
      totalGenerationAttempts += 1;
      console.log(
        `generate: ${agent.slug} attempt ${attempt}/${args.maxAttemptsPerAgent}`,
      );
      const code = runNanocoder(prompt, args.model);
      if (code !== 0) {
        console.error(
          `generate: nanocoder exited ${code} on agent ${agent.slug}; aborting pipeline`,
        );
        return {
          finalStatus: "failed-validation",
          failedAgent: agent.slug,
          generationAttempts: totalGenerationAttempts,
          autoFixAttempts: totalAutoFixAttempts,
        };
      }

      lastReport = runValidator({
        packId,
        root: args.validatorRoot,
        phase: agent.phase,
      });

      if (lastReport.failures.length === 0) {
        console.log(
          `generate: ✓ ${agent.slug} passed phase ${agent.phase}` +
            (lastReport.warnings.length > 0
              ? ` (${lastReport.warnings.length} warnings)`
              : ""),
        );
        break;
      }

      console.log(
        `generate: ✗ ${agent.slug} failed validation (${lastReport.failures.length} failures)`,
      );
      if (attempt >= args.maxAttemptsPerAgent) break;

      totalAutoFixAttempts += 1;
      prompt = buildAutoFixPrompt({
        originalPrompt: initialPrompt,
        errorReport: JSON.stringify(lastReport.failures, null, 2),
        packDir: args.packDir,
        attemptNumber: attempt,
        maxAttempts: args.maxAttemptsPerAgent - 1,
      });
    }

    if (lastReport && lastReport.failures.length > 0) {
      console.error(
        `\ngenerate: gave up on ${agent.slug} after ${attempt} attempts; final report:\n${JSON.stringify(lastReport.failures, null, 2)}`,
      );
      return {
        finalStatus: "failed-validation",
        failedAgent: agent.slug,
        generationAttempts: totalGenerationAttempts,
        autoFixAttempts: totalAutoFixAttempts,
      };
    }
  }

  return {
    finalStatus: "passed",
    generationAttempts: totalGenerationAttempts,
    autoFixAttempts: totalAutoFixAttempts,
  };
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
  const validatorRoot = validatorRootFor(args.mode);
  const generatedAt = new Date().toISOString();
  const model = "minimax-m2.7";
  const productUrl = `https://github.com/${product.repo}`;

  console.log(
    `generate: ${product.slug} v${job.version} → ${packDir.replace(ROOT, ".")} (mode=${args.mode}, max-attempts/agent=${args.maxAttemptsPerAgent})`,
  );

  // Inputs the prompts need
  const repoPath = resolveRepoPath(product, job.version);
  if (!job.releaseBody || !job.releaseTagUrl) {
    const fetched = fetchReleaseBody(product, job.version);
    job.releaseBody = job.releaseBody ?? fetched.body;
    job.releaseTagUrl = job.releaseTagUrl ?? fetched.url;
  }

  if (args.dryRun) {
    const promptVars = buildPromptVars({
      product,
      version: job.version,
      job,
      packDir,
      repoPath,
      generatedAt,
      model,
      validatorRoot,
    });
    console.log(
      "\n--- DRY RUN: substituted agent prompts below, nanocoder NOT invoked ---\n",
    );
    for (const agent of AGENTS) {
      console.log(
        `\n━━━━━━━━━━ ${agent.slug} (phase=${agent.phase}) ━━━━━━━━━━\n`,
      );
      console.log(buildAgentPrompt(agent, promptVars));
    }
    process.exit(0);
  }

  // Pre-create pack dir so nanocoder can write into it cleanly
  mkdirSync(packDir, { recursive: true });

  const result = runAgentPipeline({
    product,
    version: job.version,
    job,
    packDir,
    repoPath,
    generatedAt,
    model,
    validatorRoot,
    maxAttemptsPerAgent: args.maxAttemptsPerAgent,
  });

  writeMeta({
    packDir,
    product: product.slug,
    version: job.version,
    productUrl,
    generatedAt,
    model,
    generationAttempts: result.generationAttempts,
    autoFixAttempts: result.autoFixAttempts,
    finalStatus: result.finalStatus,
    failedAgent: result.failedAgent,
  });

  if (result.finalStatus === "passed") {
    console.log(
      `\ngenerate: ✓ pipeline complete (${result.generationAttempts} agent spawns, ${result.autoFixAttempts} auto-fix retries)`,
    );
    process.exit(0);
  }

  console.error(
    `\ngenerate: ✗ pipeline failed at agent ${result.failedAgent} (${result.generationAttempts} agent spawns, ${result.autoFixAttempts} auto-fix retries)`,
  );
  process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
