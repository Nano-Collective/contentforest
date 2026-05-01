/**
 * Orchestrates a single collective-content request — a create-or-edit pass
 * over a product-independent content pack at content/_collective/<slug>/,
 * triggered by a GitHub issue.
 *
 *   1. Determine create vs edit by checking whether the pack dir exists.
 *   2. Build the collective-request prompt from prompts/collective-request.md
 *      with the user's request, mode, scope, and (in edit mode) pack contents.
 *   3. Spawn `nanocoder run "<prompt>" --mode yolo`.
 *   4. Run the validator at --phase full on the `_collective/<slug>` pack id.
 *   5. On failure, retry up to --max-retries (default 3) with the auto-fix
 *      prompt embedding the structured error report.
 *   6. Write a sidecar `collective-request.json` capturing what was requested
 *      and the run outcome — useful for audit on the PR diff.
 *
 *   pnpm collective-request --job-spec '{"slug":"economics-charter",...}'
 *   pnpm collective-request --job-spec "$(cat /tmp/spec.json)" --dry-run
 *
 * Exits 0 when the validator is clean, 1 when retries exhaust with failures
 * still present (the workflow opens the PR anyway with a `failed-change`
 * label so a human can finish it). Sister script to change-request.ts;
 * structure is intentionally parallel for ease of comparison.
 */

import {spawnSync} from 'node:child_process';
import {
	existsSync,
	mkdirSync,
	readFileSync,
	unlinkSync,
	writeFileSync,
} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {parseArgs} from 'node:util';

const ROOT = process.cwd();
const PROMPTS_DIR = join(ROOT, 'prompts');
const CONFIG_DIR = join(ROOT, 'config');
const COLLECTIVE_URL = 'https://nanocollective.org';

export type Scope = 'whole-pack' | 'channels' | 'file';
export type Mode = 'create' | 'edit';

export type JobSpec = {
	slug: string;
	scope: Scope;
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
		console.error('collective-request: --job-spec is required');
		process.exit(2);
	}
	return {
		jobSpec: values['job-spec'] as string,
		dryRun: values['dry-run'] as boolean,
		maxAttempts: Number.parseInt(values['max-retries'] as string, 10),
	};
}

function readFile(path: string): string {
	return readFileSync(path, 'utf8');
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

export function scopeTarget(job: JobSpec, mode: Mode): string {
	switch (job.scope) {
		case 'whole-pack':
			return mode === 'create'
				? 'every channel file plus meta.json — generate the full pack'
				: 'any file under the pack root';
		case 'channels':
			return 'channels/*.md only';
		case 'file':
			return `the single file at ${job.filePath} — nothing else`;
	}
}

export function buildPrompt(args: {
	job: JobSpec;
	mode: Mode;
	packDir: string;
	generatedAt: string;
	model: string;
}): string {
	const template = readFile(join(PROMPTS_DIR, 'collective-request.md'));
	const channelsJson = readFile(join(CONFIG_DIR, 'channels.json'));
	return substitute(template, {
		SLUG: args.job.slug,
		PACK_DIR: args.packDir,
		PACK_ID: `_collective/${args.job.slug}`,
		VALIDATOR_ROOT: 'content',
		REQUESTER: args.job.requester,
		ISSUE_NUMBER: String(args.job.issueNumber),
		MODE: args.mode,
		SCOPE: args.job.scope,
		SCOPE_TARGET: scopeTarget(args.job, args.mode),
		FILE_PATH: args.job.filePath ?? '(none)',
		REQUEST: args.job.request,
		CONTEXT: args.job.context ?? '(none)',
		CHANNELS_JSON: channelsJson.trim(),
		COLLECTIVE_URL,
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
 * Spawn `nanocoder run`. Same TTY/pty handling as change-request.ts —
 * GitHub Actions runners have no TTY on stdin, Ink crashes there, so on
 * non-TTY parents we wrap in `script(1)`.
 */
/* c8 ignore start */
function runNanocoder(prompt: string, model: string): number {
	const isTTY = Boolean(process.stdout.isTTY);

	if (isTTY) {
		const result = spawnSync(
			'nanocoder',
			['run', prompt, '--mode', 'yolo', '--model', model, '--trust-directory'],
			{cwd: ROOT, stdio: 'inherit', env: process.env},
		);
		if (result.error) {
			if ((result.error as NodeJS.ErrnoException).code === 'ENOENT') {
				console.error(
					'collective-request: `nanocoder` not on PATH. Install it (npm i -g @nanocollective/nanocoder).',
				);
				return 127;
			}
			throw result.error;
		}
		return result.status ?? 1;
	}

	const promptFile = join(tmpdir(), `cf-collective-${Date.now()}.md`);
	writeFileSync(promptFile, prompt, 'utf8');
	try {
		const cmd = `nanocoder run "$(cat ${promptFile})" --mode yolo --model ${model} --trust-directory`;
		const result = spawnSync('script', ['-qfec', cmd, '/dev/null'], {
			cwd: ROOT,
			stdio: 'inherit',
			env: process.env,
		});
		if (result.error) {
			if ((result.error as NodeJS.ErrnoException).code === 'ENOENT') {
				console.error(
					'collective-request: `script(1)` not on PATH. Install util-linux.',
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
	failures: {file: string; rule: string; expected: string; actual: string}[];
	warnings: {file: string; rule: string; message: string}[];
};

function runValidator(packId: string): ValidationReport {
	const reportPath = join(
		tmpdir(),
		`cf-collective-validate-${Date.now()}.json`,
	);
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
			`collective-request: validator did not write a report.\n  exit=${result.status}\n  stdout=${result.stdout?.toString() ?? ''}\n  stderr=${result.stderr?.toString() ?? ''}`,
		);
		throw new Error('validator failed to produce a report');
	}
	return JSON.parse(readFileSync(reportPath, 'utf8')) as ValidationReport;
}

function writeSidecar(args: {
	packDir: string;
	job: JobSpec;
	mode: Mode;
	generatedAt: string;
	model: string;
	attempts: number;
	finalStatus: 'passed' | 'failed-validation';
	failures: ValidationReport['failures'];
}) {
	const sidecar = {
		issue_number: args.job.issueNumber,
		requester: args.job.requester,
		mode: args.mode,
		scope: args.job.scope,
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
		join(args.packDir, 'collective-request.json'),
		JSON.stringify(sidecar, null, 2),
	);
}

async function main() {
	const args = parse();
	const job = JSON.parse(args.jobSpec) as JobSpec;

	const packDir = join(ROOT, 'content', '_collective', job.slug);
	const mode: Mode = existsSync(packDir) ? 'edit' : 'create';

	// For the `file` scope we expect the file to exist — `file` scope is for
	// targeted edits, not for creating a single file in a brand-new pack.
	if (job.scope === 'file' && job.filePath) {
		if (mode === 'create') {
			console.error(
				`collective-request: scope=file requires an existing pack; ${packDir} does not yet exist`,
			);
			process.exit(2);
		}
		if (!existsSync(join(packDir, job.filePath))) {
			console.error(
				`collective-request: scope=file but ${packDir}/${job.filePath} does not exist`,
			);
			process.exit(2);
		}
	}

	const generatedAt = new Date().toISOString();
	const model = 'minimax-m2.7';

	console.log(
		`collective-request: ${job.slug} (mode=${mode}, scope=${job.scope}) — issue #${job.issueNumber} from @${job.requester} (max-attempts=${args.maxAttempts})`,
	);

	const initialPrompt = buildPrompt({
		job,
		mode,
		packDir,
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

	// In create mode, ensure the pack dir exists before the agent runs so it
	// can write into it without a separate mkdir step. The agent will populate
	// channels/*.md and meta.json itself.
	if (mode === 'create') {
		mkdirSync(packDir, {recursive: true});
	}

	const packId = `_collective/${job.slug}`;
	let attempt = 0;
	let prompt = initialPrompt;
	let lastReport: ValidationReport | null = null;

	while (attempt < args.maxAttempts) {
		attempt += 1;
		console.log(`\ncollective-request: attempt ${attempt}/${args.maxAttempts}`);
		const code = runNanocoder(prompt, model);
		if (code !== 0) {
			console.error(`collective-request: nanocoder exited ${code}; aborting`);
			writeSidecar({
				packDir,
				job,
				mode,
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
				`collective-request: ✓ validation passed${lastReport.warnings.length > 0 ? ` (${lastReport.warnings.length} warnings)` : ''}`,
			);
			writeSidecar({
				packDir,
				job,
				mode,
				generatedAt,
				model,
				attempts: attempt,
				finalStatus: 'passed',
				failures: [],
			});
			process.exit(0);
		}

		console.log(
			`collective-request: ✗ validation failed (${lastReport.failures.length} failures)`,
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
		`\ncollective-request: gave up after ${attempt} attempts; final report:\n${JSON.stringify(lastReport?.failures, null, 2)}`,
	);
	writeSidecar({
		packDir,
		job,
		mode,
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
