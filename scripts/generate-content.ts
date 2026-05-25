/**
 * Orchestrates a single release-pack generation via the v3 multi-stage
 * pipeline. The article phase is split into a planner + per-article writers
 * so one bad article (or one model misbehaviour mid-write) can't take down
 * the whole pack the way the v2 monolithic article-channels agent did.
 *
 *   1. Resolve product repo (NC_REPOS_DIR/<product>/ if set, else shallow
 *      clone v<version> into _repos/<product>/).
 *   2. Read the GitHub release body via `gh api`.
 *   3. release-channels agent: write the announcement (channels/*.md + the
 *      top-level meta.json). Auto-fix retry loop on validation failure.
 *   4. article-plan agent: writes a JSON array of {slug,title,focus} (0-3
 *      entries) to a tmp file. Orchestrator parses + sanity-checks it.
 *   5. For each planned article, run an article-write spawn that produces
 *      exactly that article's files. Validate scoped to --articles <slug>.
 *      Auto-fix retry loop per article. A failing article doesn't abort
 *      the others — every planned article gets its own attempt budget.
 *   6. Write the final meta.json with cumulative attempt counters, an
 *      `articles: [...]` array carrying per-article status, and an overall
 *      `final_status` (passed iff every stage and every article passed).
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
 *
 * TODO(distribute): a regen overwrites whatever the agents produce, including
 * any `distributed_at` or `wont_use_at` field a member previously stamped on
 * a file via the distribute Worker. If we ever expect to regen a pack that
 * has already been distributed, snapshot those fields per-file before the
 * agents run and re-apply them to the produced files (use lib/frontmatter.ts).
 */

import {execSync, spawnSync} from 'node:child_process';
import {
	existsSync,
	mkdirSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from 'node:fs';
import {homedir, tmpdir} from 'node:os';
import {join} from 'node:path';
import {parseArgs} from 'node:util';

const KEBAB_CASE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const MAX_ARTICLES_PER_PACK = 3;

const ROOT = process.cwd();
const PROMPTS_DIR = join(ROOT, 'prompts');
const CONFIG_DIR = join(ROOT, 'config');

export type Product = {slug: string; repo: string};

export type JobSpec = {
	product: string;
	version: string;
	releaseBody?: string;
	releaseTagUrl?: string;
};

export type RunMode = 'commit' | 'local' | 'test';

export type Phase = 'channels' | 'articles';

export type AgentSpec = {
	slug: string;
	phase: Phase;
	promptFile: string;
};

export const AGENTS: AgentSpec[] = [
	{
		slug: 'release-channels',
		phase: 'channels',
		promptFile: 'agents/release-channels.md',
	},
	{
		slug: 'article-plan',
		phase: 'articles',
		promptFile: 'agents/article-plan.md',
	},
	{
		slug: 'article-write',
		phase: 'articles',
		promptFile: 'agents/article-write.md',
	},
];

/** Single entry in the planner's output JSON array. */
export type PlannedArticle = {
	slug: string;
	title: string;
	focus: string;
};

type Args = {
	product?: string;
	version?: string;
	jobSpec?: string;
	mode: RunMode;
	dryRun: boolean;
	maxAttemptsPerAgent: number;
};

/* c8 ignore start */
function parse(): Args {
	const {values} = parseArgs({
		allowPositionals: true,
		options: {
			product: {type: 'string'},
			version: {type: 'string'},
			'job-spec': {type: 'string'},
			commit: {type: 'boolean', default: false},
			test: {type: 'boolean', default: false},
			'dry-run': {type: 'boolean', default: false},
			'max-retries': {type: 'string', default: '6'},
		},
	});
	const mode: RunMode = values.commit
		? 'commit'
		: values.test
			? 'test'
			: 'local';
	return {
		product: values.product as string | undefined,
		version: values.version as string | undefined,
		jobSpec: values['job-spec'] as string | undefined,
		mode,
		dryRun: values['dry-run'] as boolean,
		// --max-retries is the *total attempts* per agent (1 initial + retries).
		// Default 6 = 1 initial + up to 5 retries; cost ceiling = 2 agents × 6 = 12 spawns.
		maxAttemptsPerAgent: Number.parseInt(values['max-retries'] as string, 10),
	};
}
/* c8 ignore stop */

export function packDirFor(
	mode: RunMode,
	product: string,
	version: string,
): string {
	if (mode === 'commit') return join(ROOT, 'content', product, version);
	if (mode === 'test') return join(ROOT, 'content', '_test', product, version);
	return join(ROOT, 'content', '_local', product, version);
}

export function validatorRootFor(mode: RunMode): string {
	if (mode === 'commit') return 'content';
	if (mode === 'test') return 'content/_test';
	return 'content/_local';
}

/* c8 ignore start */
function loadProducts(): Product[] {
	return JSON.parse(
		readFileSync(join(CONFIG_DIR, 'products.json'), 'utf8'),
	) as Product[];
}

function readFile(path: string): string {
	return readFileSync(path, 'utf8');
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

	const target = join(ROOT, '_repos', product.slug);
	if (existsSync(target)) {
		rmSync(target, {recursive: true, force: true});
	}
	mkdirSync(join(ROOT, '_repos'), {recursive: true});
	const url = `https://github.com/${product.repo}.git`;
	const tag = `v${version}`;
	console.log(`generate: cloning ${url} @ ${tag}`);
	try {
		execSync(`git clone --depth 1 --branch ${tag} ${url} ${target}`, {
			stdio: 'inherit',
		});
	} catch {
		// tag without v-prefix is also common
		console.log(`generate: retrying clone without v-prefix (${version})`);
		execSync(`git clone --depth 1 --branch ${version} ${url} ${target}`, {
			stdio: 'inherit',
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
			encoding: 'utf8',
			stdio: ['ignore', 'pipe', 'pipe'],
		});
		const release = JSON.parse(json) as {body?: string; html_url?: string};
		return {
			body: release.body ?? '',
			url:
				release.html_url ??
				`https://github.com/${product.repo}/releases/tag/${tag}`,
		};
	} catch {
		console.warn(
			`generate: no GH release found for ${product.repo}@${tag}, using empty body`,
		);
		return {
			body: '',
			url: `https://github.com/${product.repo}/releases/tag/${tag}`,
		};
	}
}
/* c8 ignore stop */

export function substitute(
	template: string,
	vars: Record<string, string>,
): string {
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
export function buildPromptVars(args: {
	product: Product;
	version: string;
	job: JobSpec;
	packDir: string;
	repoPath: string;
	generatedAt: string;
	model: string;
	validatorRoot: string;
}): Record<string, string> {
	const channelsJson = readFile(join(CONFIG_DIR, 'channels.json'));
	return {
		PRODUCT_SLUG: args.product.slug,
		PRODUCT_REPO: args.product.repo,
		PRODUCT_REPO_URL: `https://github.com/${args.product.repo}`,
		VERSION: args.version,
		REPO_PATH: args.repoPath,
		RELEASE_TAG_URL: args.job.releaseTagUrl ?? '',
		RELEASE_BODY: args.job.releaseBody ?? '',
		GENERATED_AT: args.generatedAt,
		MODEL: args.model,
		CHANNELS_JSON: channelsJson.trim(),
		PACK_DIR: args.packDir,
		PACK_ID: `${args.product.slug}/${args.version}`,
		VALIDATOR_ROOT: args.validatorRoot,
	};
}

export function buildAgentPrompt(
	agent: AgentSpec,
	vars: Record<string, string>,
): string {
	const template = readFile(join(PROMPTS_DIR, agent.promptFile));
	return substitute(template, vars);
}

export function buildAutoFixPrompt(args: {
	originalPrompt: string;
	errorReport: string;
	packDir: string;
	attemptNumber: number;
	maxAttempts: number;
}): string {
	const template = readFile(join(PROMPTS_DIR, 'auto-fix.md'));
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
 * Nanocoder auto-enables its Ink-free `--plain` runtime when stdout isn't a
 * TTY or CI is detected, so the same direct spawn works locally (full Ink
 * UI) and in GitHub Actions (plain log output) without a pty wrapper.
 */
/* c8 ignore start */
function runNanocoder(prompt: string, model: string): number {
	const result = spawnSync(
		'nanocoder',
		['run', prompt, '--mode', 'yolo', '--model', model, '--trust-directory'],
		{cwd: ROOT, stdio: 'inherit', env: process.env},
	);
	if (result.error) {
		if ((result.error as NodeJS.ErrnoException).code === 'ENOENT') {
			console.error(
				'generate: `nanocoder` not on PATH. Install it (npm i -g @nanocollective/nanocoder).',
			);
			return 127;
		}
		throw result.error;
	}
	return result.status ?? 1;
}

type ValidationFailure = {
	file: string;
	rule: string;
	expected: string;
	actual: string;
};

type ValidationReport = {
	scannedPacks: string[];
	skippedPacks: string[];
	failures: ValidationFailure[];
	warnings: {file: string; rule: string; message: string}[];
};

function runValidator(args: {
	packId: string;
	root: string;
	phase: Phase;
	/** When set, restrict the articles iteration to these slugs. */
	articleSlugs?: string[];
}): ValidationReport {
	const reportPath = join(tmpdir(), `cf-validation-${Date.now()}.json`);
	const argv = [
		'validate',
		'--pack',
		args.packId,
		'--root',
		args.root,
		'--report',
		reportPath,
		'--phase',
		args.phase,
		'--quiet',
	];
	if (args.articleSlugs && args.articleSlugs.length > 0) {
		argv.push('--articles', args.articleSlugs.join(','));
	}
	const result = spawnSync('pnpm', argv, {
		cwd: ROOT,
		encoding: 'utf8',
		stdio: ['ignore', 'pipe', 'pipe'],
	});
	if (!existsSync(reportPath)) {
		console.error(
			`generate: validator did not write a report.\n  exit=${result.status}\n  stdout=${result.stdout?.toString() ?? ''}\n  stderr=${result.stderr?.toString() ?? ''}`,
		);
		throw new Error('validator failed to produce a report');
	}
	return JSON.parse(readFileSync(reportPath, 'utf8')) as ValidationReport;
}

/**
 * Parses + sanity-checks the planner's JSON output. The planner is asked to
 * emit a JSON array of `PlannedArticle`; anything else fails fast so the
 * orchestrator can retry the planner spawn with a structured error.
 *
 * Returns the list on success, or a list of human-readable problems
 * (suitable for feeding back to the model via the auto-fix prompt) on
 * failure. Never throws.
 */
export function parsePlan(raw: string): {
	ok: true;
	plan: PlannedArticle[];
} | {ok: false; problems: string[]} {
	const problems: string[] = [];
	let parsed: unknown;
	try {
		parsed = JSON.parse(raw);
	} catch (e) {
		return {ok: false, problems: [`plan file is not valid JSON: ${(e as Error).message}`]};
	}
	if (!Array.isArray(parsed)) {
		return {ok: false, problems: ['plan must be a JSON array (use [] for zero articles)']};
	}
	if (parsed.length > MAX_ARTICLES_PER_PACK) {
		problems.push(
			`plan has ${parsed.length} entries; cap is ${MAX_ARTICLES_PER_PACK}`,
		);
	}
	const seenSlugs = new Set<string>();
	const plan: PlannedArticle[] = [];
	for (const [i, entry] of parsed.entries()) {
		if (!entry || typeof entry !== 'object') {
			problems.push(`entry ${i} is not an object`);
			continue;
		}
		const obj = entry as Record<string, unknown>;
		const slug = obj.slug;
		const title = obj.title;
		const focus = obj.focus;
		if (typeof slug !== 'string' || slug.length === 0) {
			problems.push(`entry ${i}: "slug" must be a non-empty string`);
		} else if (!KEBAB_CASE.test(slug)) {
			problems.push(
				`entry ${i}: slug "${slug}" must be kebab-case (lowercase letters, digits, single hyphens)`,
			);
		} else if (seenSlugs.has(slug)) {
			problems.push(`entry ${i}: slug "${slug}" is duplicated in the plan`);
		} else {
			seenSlugs.add(slug);
		}
		if (typeof title !== 'string' || title.length === 0) {
			problems.push(`entry ${i}: "title" must be a non-empty string`);
		}
		if (typeof focus !== 'string' || focus.length === 0) {
			problems.push(`entry ${i}: "focus" must be a non-empty string`);
		}
		if (
			typeof slug === 'string' &&
			typeof title === 'string' &&
			typeof focus === 'string'
		) {
			plan.push({slug, title, focus});
		}
	}
	if (problems.length > 0) return {ok: false, problems};
	return {ok: true, plan};
}

/**
 * Substitutes the per-article variables into the article-write template.
 * Built on top of `substitute` because each article writer needs three
 * extra vars (slug, title, focus) on top of the shared promptVars.
 */
export function buildArticleWritePrompt(args: {
	template: string;
	promptVars: Record<string, string>;
	article: PlannedArticle;
}): string {
	return substitute(args.template, {
		...args.promptVars,
		ARTICLE_SLUG: args.article.slug,
		ARTICLE_TITLE: args.article.title,
		ARTICLE_FOCUS: args.article.focus,
	});
}

type ArticleOutcome = {
	slug: string;
	title: string;
	focus: string;
	final_status: 'passed' | 'failed-validation';
	attempts: number;
	failures: ValidationFailure[];
};

function writeMeta(args: {
	packDir: string;
	product: string;
	version: string;
	productUrl: string;
	generatedAt: string;
	model: string;
	generationAttempts: number;
	autoFixAttempts: number;
	finalStatus: 'passed' | 'failed-validation' | 'pending';
	failedAgent?: string;
	articles?: ArticleOutcome[];
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
	if (args.articles) meta.articles = args.articles;
	mkdirSync(args.packDir, {recursive: true});
	writeFileSync(join(args.packDir, 'meta.json'), JSON.stringify(meta, null, 2));
}

type PhaseTotals = {
	generationAttempts: number;
	autoFixAttempts: number;
};

type PhaseOutcome =
	| {status: 'passed'; attempts: number}
	| {status: 'failed-validation'; attempts: number; failures: ValidationFailure[]};

/**
 * Runs a single agent spawn with the auto-fix retry loop. Returns
 * `{status, failures}` per attempt budget. Increments the shared
 * totals counter so the orchestrator can write cumulative numbers
 * to meta.json regardless of how many phases ran.
 *
 * `validate` is called from the orchestrator (not inline) so the caller
 * can scope the validator however it needs — pack-wide for the release
 * agent, --articles <slug> for a single article writer.
 */
function runRetryLoop(args: {
	agentSlug: string;
	initialPrompt: string;
	packDir: string;
	model: string;
	maxAttempts: number;
	totals: PhaseTotals;
	validate: () => ValidationReport;
	/** Called when nanocoder exits non-zero (system failure, not a content rule
	 * miss). Returns the failures synthesised for the next auto-fix prompt. */
	onCrash: (exitCode: number) => ValidationFailure[];
}): PhaseOutcome {
	let prompt = args.initialPrompt;
	let attempt = 0;
	let lastFailures: ValidationFailure[] = [];

	while (attempt < args.maxAttempts) {
		attempt += 1;
		args.totals.generationAttempts += 1;
		console.log(
			`generate: ${args.agentSlug} attempt ${attempt}/${args.maxAttempts}`,
		);
		const code = runNanocoder(prompt, args.model);
		if (code !== 0) {
			console.error(
				`generate: nanocoder exited ${code} on agent ${args.agentSlug}`,
			);
			lastFailures = args.onCrash(code);
		} else {
			const report = args.validate();
			if (report.failures.length === 0) {
				console.log(
					`generate: ✓ ${args.agentSlug} passed` +
						(report.warnings.length > 0
							? ` (${report.warnings.length} warnings)`
							: ''),
				);
				return {status: 'passed', attempts: attempt};
			}
			console.log(
				`generate: ✗ ${args.agentSlug} failed validation (${report.failures.length} failures)`,
			);
			lastFailures = report.failures;
		}

		if (attempt >= args.maxAttempts) break;
		args.totals.autoFixAttempts += 1;
		prompt = buildAutoFixPrompt({
			originalPrompt: args.initialPrompt,
			errorReport: JSON.stringify(lastFailures, null, 2),
			packDir: args.packDir,
			attemptNumber: attempt,
			maxAttempts: args.maxAttempts - 1,
		});
	}

	console.error(
		`\ngenerate: gave up on ${args.agentSlug} after ${attempt} attempts; final failures:\n${JSON.stringify(lastFailures, null, 2)}`,
	);
	return {status: 'failed-validation', attempts: attempt, failures: lastFailures};
}

type PipelineResult = {
	finalStatus: 'passed' | 'failed-validation';
	failedAgent?: string;
	generationAttempts: number;
	autoFixAttempts: number;
	articles: ArticleOutcome[];
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
	const totals: PhaseTotals = {generationAttempts: 0, autoFixAttempts: 0};

	// ── Phase 1: release-channels ────────────────────────────────────────────
	const releaseAgent = AGENTS.find(a => a.slug === 'release-channels')!;
	console.log(`\ngenerate: ━━━ agent: ${releaseAgent.slug} (phase=channels) ━━━`);
	const releaseOutcome = runRetryLoop({
		agentSlug: releaseAgent.slug,
		initialPrompt: buildAgentPrompt(releaseAgent, promptVars),
		packDir: args.packDir,
		model: args.model,
		maxAttempts: args.maxAttemptsPerAgent,
		totals,
		validate: () =>
			runValidator({packId, root: args.validatorRoot, phase: 'channels'}),
		onCrash: code => [
			{
				file: '(nanocoder)',
				rule: 'nanocoder-exit',
				expected: 'exit 0',
				actual: `exit ${code}`,
			},
		],
	});
	if (releaseOutcome.status === 'failed-validation') {
		return {
			finalStatus: 'failed-validation',
			failedAgent: releaseAgent.slug,
			generationAttempts: totals.generationAttempts,
			autoFixAttempts: totals.autoFixAttempts,
			articles: [],
		};
	}

	// ── Phase 2: article-plan ────────────────────────────────────────────────
	const plannerAgent = AGENTS.find(a => a.slug === 'article-plan')!;
	console.log(`\ngenerate: ━━━ agent: ${plannerAgent.slug} (phase=articles) ━━━`);
	const planPath = join(tmpdir(), `cf-plan-${Date.now()}.json`);
	const plannerVars = {...promptVars, PLAN_OUTPUT_PATH: planPath};
	const plannerPrompt = buildAgentPrompt(plannerAgent, plannerVars);
	let plan: PlannedArticle[] | null = null;
	const planOutcome = runRetryLoop({
		agentSlug: plannerAgent.slug,
		initialPrompt: plannerPrompt,
		packDir: args.packDir,
		model: args.model,
		maxAttempts: args.maxAttemptsPerAgent,
		totals,
		validate: () => {
			if (!existsSync(planPath)) {
				return {
					scannedPacks: [],
					skippedPacks: [],
					warnings: [],
					failures: [
						{
							file: planPath,
							rule: 'plan-exists',
							expected: 'plan JSON file written by the planner',
							actual: 'missing',
						},
					],
				};
			}
			const raw = readFileSync(planPath, 'utf8');
			const parsed = parsePlan(raw);
			if (parsed.ok) {
				plan = parsed.plan;
				return {
					scannedPacks: [],
					skippedPacks: [],
					warnings: [],
					failures: [],
				};
			}
			return {
				scannedPacks: [],
				skippedPacks: [],
				warnings: [],
				failures: parsed.problems.map(p => ({
					file: planPath,
					rule: 'plan-shape',
					expected:
						'JSON array of {slug,title,focus}, ≤ 3 entries, kebab-case unique slugs',
					actual: p,
				})),
			};
		},
		onCrash: code => [
			{
				file: '(nanocoder)',
				rule: 'nanocoder-exit',
				expected: 'exit 0',
				actual: `exit ${code}`,
			},
		],
	});

	// Clean up the plan file regardless of outcome — it's an orchestrator
	// scratchpad, not pack output.
	if (existsSync(planPath)) {
		try {
			rmSync(planPath, {force: true});
		} catch {
			/* best effort */
		}
	}

	if (planOutcome.status === 'failed-validation') {
		return {
			finalStatus: 'failed-validation',
			failedAgent: plannerAgent.slug,
			generationAttempts: totals.generationAttempts,
			autoFixAttempts: totals.autoFixAttempts,
			articles: [],
		};
	}

	const planned: PlannedArticle[] = plan ?? [];
	console.log(
		`generate: planner picked ${planned.length} article(s): ${planned.map(a => a.slug).join(', ') || '(none)'}`,
	);

	// ── Phase 3: per-article writers ─────────────────────────────────────────
	const writerAgent = AGENTS.find(a => a.slug === 'article-write')!;
	const writerTemplate = readFile(join(PROMPTS_DIR, writerAgent.promptFile));
	const outcomes: ArticleOutcome[] = [];
	for (const article of planned) {
		console.log(
			`\ngenerate: ━━━ agent: ${writerAgent.slug} [${article.slug}] (phase=articles) ━━━`,
		);
		const initialPrompt = buildArticleWritePrompt({
			template: writerTemplate,
			promptVars,
			article,
		});
		const result = runRetryLoop({
			agentSlug: `${writerAgent.slug}:${article.slug}`,
			initialPrompt,
			packDir: args.packDir,
			model: args.model,
			maxAttempts: args.maxAttemptsPerAgent,
			totals,
			validate: () =>
				runValidator({
					packId,
					root: args.validatorRoot,
					phase: 'articles',
					articleSlugs: [article.slug],
				}),
			onCrash: code => [
				{
					file: '(nanocoder)',
					rule: 'nanocoder-exit',
					expected: 'exit 0',
					actual: `exit ${code}`,
				},
			],
		});
		outcomes.push({
			slug: article.slug,
			title: article.title,
			focus: article.focus,
			final_status: result.status,
			attempts: result.attempts,
			failures: result.status === 'failed-validation' ? result.failures : [],
		});
	}

	const anyArticleFailed = outcomes.some(
		o => o.final_status === 'failed-validation',
	);
	return {
		finalStatus: anyArticleFailed ? 'failed-validation' : 'passed',
		failedAgent: anyArticleFailed ? writerAgent.slug : undefined,
		generationAttempts: totals.generationAttempts,
		autoFixAttempts: totals.autoFixAttempts,
		articles: outcomes,
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
				'generate: --product and --version are required (or pass --job-spec)',
			);
			process.exit(2);
		}
		job = {product: args.product, version: args.version};
	}

	const products = loadProducts();
	const product = products.find(p => p.slug === job.product);
	if (!product) {
		console.error(`generate: unknown product ${job.product}`);
		console.error(`        known: ${products.map(p => p.slug).join(', ')}`);
		process.exit(2);
	}

	const packDir = packDirFor(args.mode, product.slug, job.version);
	const validatorRoot = validatorRootFor(args.mode);
	const generatedAt = new Date().toISOString();
	const model = 'minimax-m2.7';
	const productUrl = `https://github.com/${product.repo}`;

	console.log(
		`generate: ${product.slug} v${job.version} → ${packDir.replace(ROOT, '.')} (mode=${args.mode}, max-attempts/agent=${args.maxAttemptsPerAgent})`,
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
			'\n--- DRY RUN: substituted agent prompts below, nanocoder NOT invoked ---\n',
		);
		for (const agent of AGENTS) {
			console.log(
				`\n━━━━━━━━━━ ${agent.slug} (phase=${agent.phase}) ━━━━━━━━━━\n`,
			);
			// The planner needs a plan-output path; the writer needs per-article
			// vars chosen at runtime. Show representative placeholders in the
			// dry-run output so the prompt is readable.
			const vars =
				agent.slug === 'article-plan'
					? {...promptVars, PLAN_OUTPUT_PATH: '/tmp/cf-plan-<runtime>.json'}
					: agent.slug === 'article-write'
						? {
								...promptVars,
								ARTICLE_SLUG: '<planned-slug>',
								ARTICLE_TITLE: '<planner-chosen title>',
								ARTICLE_FOCUS: '<planner-chosen focus line>',
							}
						: promptVars;
			console.log(buildAgentPrompt(agent, vars));
		}
		process.exit(0);
	}

	// Pre-create pack dir so nanocoder can write into it cleanly
	mkdirSync(packDir, {recursive: true});

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
		articles: result.articles.length > 0 ? result.articles : undefined,
	});

	if (result.finalStatus === 'passed') {
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

if (process.env.NODE_ENV !== 'test') {
	main().catch(e => {
		console.error(e);
		process.exit(1);
	});
}
/* c8 ignore stop */
