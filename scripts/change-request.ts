/**
 * Orchestrates a single change-request — a targeted edit applied to an
 * existing release pack on disk in response to a GitHub issue.
 *
 *   1. Resolve product repo at v<version> (NC_REPOS_DIR/<product>/ if set,
 *      else shallow clone into _repos/<product>/) — used by the agent for
 *      grounding any new claims.
 *   2. Verify the pack at content/<product>/<version>/ exists. (We're
 *      editing, not generating; an absent pack is a hard error.)
 *   3. Build the change-request prompt from prompts/change-request.md with
 *      the user's request + scope + current pack contents on disk.
 *   4. Spawn `nanocoder run "<prompt>" --mode yolo`.
 *   5. Run the validator at --phase full.
 *   6. On failure, retry up to --max-retries (default 3 = 1 initial + 2
 *      retries) with the auto-fix prompt embedding the structured error
 *      report.
 *   7. Write a sidecar `change-request.json` into the pack capturing what
 *      was requested and the run outcome — useful for audit on the PR diff.
 *
 *   pnpm change-request --job-spec '{"product":"nanocoder","version":"1.25.2",...}'
 *   pnpm change-request --job-spec "$(cat /tmp/spec.json)" --dry-run
 *
 * Exits 0 when the validator is clean, 1 when retries exhaust with failures
 * still present (the workflow opens the PR anyway with a `failed-change`
 * label so a human can finish it).
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

const ROOT = process.cwd();
const PROMPTS_DIR = join(ROOT, 'prompts');
const CONFIG_DIR = join(ROOT, 'config');

export type Product = {slug: string; repo: string};

export type Scope = 'whole-pack' | 'channels' | 'article' | 'file';

export type JobSpec = {
	product: string;
	version: string;
	scope: Scope;
	articleSlug: string | null;
	filePath: string | null;
	request: string;
	context: string | null;
	requester: string;
	issueNumber: number;
};

type Args = {
	jobSpec: string;
	dryRun: boolean;
	maxAttempts: number;
};

/* c8 ignore start */
function parse(): Args {
	const {values} = parseArgs({
		allowPositionals: true,
		options: {
			'job-spec': {type: 'string'},
			'dry-run': {type: 'boolean', default: false},
			'max-retries': {type: 'string', default: '3'},
		},
	});
	if (!values['job-spec']) {
		console.error('change-request: --job-spec is required');
		process.exit(2);
	}
	return {
		jobSpec: values['job-spec'] as string,
		dryRun: values['dry-run'] as boolean,
		maxAttempts: Number.parseInt(values['max-retries'] as string, 10),
	};
}

function loadProducts(): Product[] {
	return JSON.parse(
		readFileSync(join(CONFIG_DIR, 'products.json'), 'utf8'),
	) as Product[];
}

function readFile(path: string): string {
	return readFileSync(path, 'utf8');
}

/**
 * Resolves a working copy of the product repo at the given tag. Same shape
 * as generate-content.ts — the agent reads from this when the request adds
 * new substance that needs grounding.
 */
function resolveRepoPath(product: Product, version: string): string {
	const reposDir = process.env.NC_REPOS_DIR;
	if (reposDir) {
		const expanded = reposDir.replace(/^~/, homedir());
		const path = join(expanded, product.slug);
		if (existsSync(path)) {
			console.log(`change-request: using local checkout at ${path}`);
			return path;
		}
	}
	const target = join(ROOT, '_repos', product.slug);
	if (existsSync(target)) rmSync(target, {recursive: true, force: true});
	mkdirSync(join(ROOT, '_repos'), {recursive: true});
	const url = `https://github.com/${product.repo}.git`;
	const tag = `v${version}`;
	console.log(`change-request: cloning ${url} @ ${tag}`);
	try {
		execSync(`git clone --depth 1 --branch ${tag} ${url} ${target}`, {
			stdio: 'inherit',
		});
	} catch {
		console.log(`change-request: retrying clone without v-prefix (${version})`);
		execSync(`git clone --depth 1 --branch ${version} ${url} ${target}`, {
			stdio: 'inherit',
		});
	}
	return target;
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

export function scopeTarget(job: JobSpec): string {
	switch (job.scope) {
		case 'whole-pack':
			return 'any file under the pack root';
		case 'channels':
			return 'channels/*.md only — articles are off-limits';
		case 'article':
			return `articles/${job.articleSlug}/ only — headline channels and other articles are off-limits`;
		case 'file':
			return `the single file at ${job.filePath} — nothing else`;
	}
}

export function buildPrompt(args: {
	product: Product;
	job: JobSpec;
	packDir: string;
	repoPath: string;
	generatedAt: string;
	model: string;
}): string {
	const template = readFile(join(PROMPTS_DIR, 'change-request.md'));
	const channelsJson = readFile(join(CONFIG_DIR, 'channels.json'));
	return substitute(template, {
		PRODUCT_SLUG: args.product.slug,
		PRODUCT_REPO: args.product.repo,
		PRODUCT_REPO_URL: `https://github.com/${args.product.repo}`,
		VERSION: args.job.version,
		REPO_PATH: args.repoPath,
		PACK_DIR: args.packDir,
		PACK_ID: `${args.product.slug}/${args.job.version}`,
		VALIDATOR_ROOT: 'content',
		REQUESTER: args.job.requester,
		ISSUE_NUMBER: String(args.job.issueNumber),
		SCOPE: args.job.scope,
		SCOPE_TARGET: scopeTarget(args.job),
		ARTICLE_SLUG: args.job.articleSlug ?? '(none)',
		FILE_PATH: args.job.filePath ?? '(none)',
		REQUEST: args.job.request,
		CONTEXT: args.job.context ?? '(none)',
		CHANNELS_JSON: channelsJson.trim(),
		GENERATED_AT: args.generatedAt,
		MODEL: args.model,
	});
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
 * Spawn `nanocoder run`. Nanocoder auto-enables its Ink-free `--plain`
 * runtime when stdout isn't a TTY or CI is detected, so a single direct
 * spawn works both locally and on GitHub Actions runners.
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
				'change-request: `nanocoder` not on PATH. Install it (npm i -g @nanocollective/nanocoder).',
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
	failures: {file: string; rule: string; expected: string; actual: string}[];
	warnings: {file: string; rule: string; message: string}[];
};

function runValidator(packId: string): ValidationReport {
	const reportPath = join(tmpdir(), `cf-change-validate-${Date.now()}.json`);
	const result = spawnSync(
		'pnpm',
		[
			'validate',
			'--pack',
			packId,
			'--root',
			'content',
			'--report',
			reportPath,
			'--phase',
			'full',
			'--quiet',
		],
		{cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe']},
	);
	if (!existsSync(reportPath)) {
		console.error(
			`change-request: validator did not write a report.\n  exit=${result.status}\n  stdout=${result.stdout?.toString() ?? ''}\n  stderr=${result.stderr?.toString() ?? ''}`,
		);
		throw new Error('validator failed to produce a report');
	}
	return JSON.parse(readFileSync(reportPath, 'utf8')) as ValidationReport;
}

function writeSidecar(args: {
	packDir: string;
	job: JobSpec;
	generatedAt: string;
	model: string;
	attempts: number;
	finalStatus: 'passed' | 'failed-validation';
	failures: ValidationReport['failures'];
}) {
	const sidecar = {
		issue_number: args.job.issueNumber,
		requester: args.job.requester,
		scope: args.job.scope,
		article_slug: args.job.articleSlug,
		file_path: args.job.filePath,
		request: args.job.request,
		context: args.job.context,
		generated_at: args.generatedAt,
		model: args.model,
		attempts: args.attempts,
		final_status: args.finalStatus,
		failures: args.failures,
	};
	mkdirSync(args.packDir, {recursive: true});
	writeFileSync(
		join(args.packDir, 'change-request.json'),
		JSON.stringify(sidecar, null, 2),
	);
}

async function main() {
	const args = parse();
	const job = JSON.parse(args.jobSpec) as JobSpec;

	const products = loadProducts();
	const product = products.find(p => p.slug === job.product);
	if (!product) {
		console.error(`change-request: unknown product ${job.product}`);
		console.error(`        known: ${products.map(p => p.slug).join(', ')}`);
		process.exit(2);
	}

	const packDir = join(ROOT, 'content', product.slug, job.version);
	if (!existsSync(packDir)) {
		console.error(
			`change-request: pack does not exist at ${packDir}; nothing to edit`,
		);
		process.exit(2);
	}

	// For the `file` scope, also verify the file exists before asking the agent
	// to edit it. (Whole-pack / channels / article scopes can tolerate a
	// non-existent target — the agent will pick the right files itself.)
	if (job.scope === 'file' && job.filePath) {
		if (!existsSync(join(packDir, job.filePath))) {
			console.error(
				`change-request: scope=file but ${packDir}/${job.filePath} does not exist`,
			);
			process.exit(2);
		}
	}

	const generatedAt = new Date().toISOString();
	const model = 'minimax-m2.7';

	console.log(
		`change-request: ${product.slug} v${job.version} (scope=${job.scope}) — issue #${job.issueNumber} from @${job.requester} (max-attempts=${args.maxAttempts})`,
	);

	const repoPath = resolveRepoPath(product, job.version);
	const initialPrompt = buildPrompt({
		product,
		job,
		packDir,
		repoPath,
		generatedAt,
		model,
	});

	if (args.dryRun) {
		console.log(
			'\n--- DRY RUN: substituted prompt below, nanocoder NOT invoked ---\n',
		);
		console.log(initialPrompt);
		process.exit(0);
	}

	const packId = `${product.slug}/${job.version}`;
	let attempt = 0;
	let prompt = initialPrompt;
	let lastReport: ValidationReport | null = null;

	while (attempt < args.maxAttempts) {
		attempt += 1;
		console.log(`\nchange-request: attempt ${attempt}/${args.maxAttempts}`);
		const code = runNanocoder(prompt, model);
		if (code !== 0) {
			console.error(`change-request: nanocoder exited ${code}; aborting`);
			writeSidecar({
				packDir,
				job,
				generatedAt,
				model,
				attempts: attempt,
				finalStatus: 'failed-validation',
				failures: [],
			});
			process.exit(code);
		}

		lastReport = runValidator(packId);
		if (lastReport.failures.length === 0) {
			console.log(
				`change-request: ✓ validation passed${lastReport.warnings.length > 0 ? ` (${lastReport.warnings.length} warnings)` : ''}`,
			);
			writeSidecar({
				packDir,
				job,
				generatedAt,
				model,
				attempts: attempt,
				finalStatus: 'passed',
				failures: [],
			});
			process.exit(0);
		}

		console.log(
			`change-request: ✗ validation failed (${lastReport.failures.length} failures)`,
		);
		if (attempt >= args.maxAttempts) break;
		prompt = buildAutoFixPrompt({
			originalPrompt: initialPrompt,
			errorReport: JSON.stringify(lastReport.failures, null, 2),
			packDir,
			attemptNumber: attempt,
			maxAttempts: args.maxAttempts - 1,
		});
	}

	console.error(
		`\nchange-request: gave up after ${attempt} attempts; final report:\n${JSON.stringify(lastReport?.failures, null, 2)}`,
	);
	writeSidecar({
		packDir,
		job,
		generatedAt,
		model,
		attempts: attempt,
		finalStatus: 'failed-validation',
		failures: lastReport?.failures ?? [],
	});
	process.exit(1);
}

if (process.env.NODE_ENV !== 'test') {
	main().catch(e => {
		console.error(e);
		process.exit(1);
	});
}
/* c8 ignore stop */
