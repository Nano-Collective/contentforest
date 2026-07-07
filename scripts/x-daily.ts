/**
 * Generates a WEEK's batch of standalone X (Twitter) posts for the Nano
 * Collective account in one run, committed to content/_x-daily/<monday>/. This
 * is the evergreen X pool the calendar planner draws from to fill six X slots a
 * day (see scripts/plan-calendar.ts); the planner decides which post lands on
 * which day, not this script.
 *
 * The quota is deterministic and owned by THIS script, not the model:
 * --posts slots (default 30 = 6/day × 5 weekdays; the planner skips weekends)
 * are round-robined across the products in config/products.json plus the
 * collective, so every product — including the newest — gets at least one turn
 * a week. Each slot's angle is chosen by the
 * planning agent (steered off recently-used angles by the ledger); the writer
 * agent writes one post per slot. Owning the slot structure here guarantees the
 * quota and filenames no matter what the model does.
 *
 *   1. Build the slots (round-robin products + collective, --posts of them).
 *   2. Plan agent (prompts/agents/x-daily-plan.md): writes a JSON file with
 *      one {file, angle, archetype, focus} per slot. Retried until it parses +
 *      covers every slot, up to --max-retries.
 *   3. Write meta.json (the plan) so the validator knows the expected files.
 *   4. Writer agent (prompts/agents/x-daily-write.md) once per slot, each
 *      producing posts/<file>.md and self-checking only its own file.
 *   5. Validate the whole bucket. For any file still failing, re-spawn its
 *      writer with the error report as fix context, up to --max-retries.
 *   6. On a clean pass, append the week's angles to content/_x-daily/ledger.json
 *      (commit mode only) so next week's planner avoids them.
 *
 *   pnpm x-daily                         # this week, writes to content/_local/
 *   pnpm x-daily --date 2026-07-06 --test
 *   pnpm x-daily --commit                # writes to content/ (the CI path)
 *   pnpm x-daily --posts 42 --dry-run    # print the plan prompt, run nothing
 *
 * `--date` should be the week's Monday; the CI cron passes it. Exits 0 when the
 * validator is clean, 1 when retries exhaust with failures still present (the
 * workflow opens the PR anyway with a failed-validation label so a human can
 * finish it).
 */

import {spawnSync} from 'node:child_process';
import {existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {parseArgs} from 'node:util';

const ROOT = process.cwd();
const PROMPTS_DIR = join(ROOT, 'prompts');
const CONFIG_DIR = join(ROOT, 'config');
const COLLECTIVE_SOURCE = 'collective';
const X_DAILY_DIR = '_x-daily';
// How many recent angles per source to show the planner. Enough to steer it
// off repetition without flooding the prompt.
const LEDGER_CONTEXT_PER_SOURCE = 8;

export type Product = {slug: string; repo: string};

export type RunMode = 'commit' | 'local' | 'test';

export type Slot = {
	file: string;
	source: string;
	sourceKind: 'product' | 'collective';
};

export type PlanEntry = {
	file: string;
	angle: string;
	focus: string;
	archetype: string;
};

export type LedgerEntry = {
	date: string;
	source: string;
	angle: string;
	archetype?: string;
	preview: string;
};

/**
 * Post archetypes — the *shape* of a post, independent of its topic. The
 * planner assigns one per slot and rotates them (steered by the ledger, which
 * records the archetype it used) so the daily feed varies in structure, not
 * just subject. The writer is handed the chosen archetype's guidance. Keep the
 * ids stable: they are written to the ledger and matched on read.
 */
export type Archetype = {id: string; label: string; guidance: string};

export const ARCHETYPES: Archetype[] = [
	{
		id: 'problem-relief',
		label: 'Problem, then relief',
		guidance:
			'Open with a specific, real annoyance a developer feels - concrete enough that they nod. The next sentence is the fix. Never open with the product or feature name.',
	},
	{
		id: 'sharp-take',
		label: 'Sharp take',
		guidance:
			'One opinionated line about how things should be done, then a sentence of why the product backs it up. Have a stance. Keep it short - this archetype should not fill the character budget.',
	},
	{
		id: 'til',
		label: 'Non-obvious detail',
		guidance:
			'Lead with a surprising or easy-to-miss behaviour or fact - something a casual user would not expect. Then say why it matters. No "did you know" phrasing.',
	},
	{
		id: 'origin',
		label: 'Why it exists',
		guidance:
			'Explain the motivation - the problem or principle the thing was built around - not a feature list. Closer to a design note than a spec.',
	},
	{
		id: 'one-tip',
		label: 'One concrete tip',
		guidance:
			'A single actionable thing the reader can do today, stated plainly. One tip, not three. End on what they get for it.',
	},
	{
		id: 'by-the-numbers',
		label: 'Lead with a number',
		guidance:
			'Open with a concrete number, limit, or measurement that reframes the thing (a size, a count, a default, a threshold). Let the number carry the hook.',
	},
	{
		id: 'contrarian',
		label: 'Against the default',
		guidance:
			'Name a common default or habit, then show how the product deliberately does the opposite and why that is better. Do not name or attack specific competitors.',
	},
];

const ARCHETYPE_IDS = new Set(ARCHETYPES.map(a => a.id));

export function archetypeById(id: string): Archetype | undefined {
	return ARCHETYPES.find(a => a.id === id);
}

/** Markdown bullet list of the archetype menu, for the planner prompt. */
export function archetypesCatalogue(): string {
	return ARCHETYPES.map(a => `- \`${a.id}\` (${a.label}): ${a.guidance}`).join(
		'\n',
	);
}

type Args = {
	date: string;
	mode: RunMode;
	posts: number;
	dryRun: boolean;
	maxAttempts: number;
};

// Default weekly quota: six X posts a day across the five weekdays (weekends
// are skipped by the calendar planner, so there's no point generating for them).
const DEFAULT_POSTS_PER_WEEK = 30;

/* c8 ignore start */
function parse(): Args {
	const {values} = parseArgs({
		allowPositionals: true,
		options: {
			date: {type: 'string'},
			commit: {type: 'boolean', default: false},
			test: {type: 'boolean', default: false},
			posts: {type: 'string', default: String(DEFAULT_POSTS_PER_WEEK)},
			'dry-run': {type: 'boolean', default: false},
			'max-retries': {type: 'string', default: '3'},
		},
	});
	const mode: RunMode = values.commit
		? 'commit'
		: values.test
			? 'test'
			: 'local';
	return {
		date: (values.date as string | undefined) ?? mondayIso(),
		mode,
		posts: Number.parseInt(values.posts as string, 10),
		dryRun: values['dry-run'] as boolean,
		maxAttempts: Number.parseInt(values['max-retries'] as string, 10),
	};
}

/** This week's Monday (UTC) — the default bucket key for the weekly batch. */
function mondayIso(): string {
	const d = new Date();
	const back = (d.getUTCDay() + 6) % 7;
	d.setUTCDate(d.getUTCDate() - back);
	return d.toISOString().slice(0, 10);
}

function readFile(path: string): string {
	return readFileSync(path, 'utf8');
}

function loadProducts(): Product[] {
	return JSON.parse(readFile(join(CONFIG_DIR, 'products.json'))) as Product[];
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

export function contentRootFor(mode: RunMode): string {
	switch (mode) {
		case 'commit':
			return 'content';
		case 'test':
			return 'content/_test';
		case 'local':
			return 'content/_local';
	}
}

/**
 * The week's post slots: `count` of them, round-robined across every product
 * plus the collective so each source gets a fair, stable share and every
 * product appears at least once. Files are numbered per source
 * (`nanocoder-1.md`, `nanocoder-2.md`, `collective-1.md`, ...). The planner
 * places these across the week's days; order here is just deterministic.
 */
export function buildSlots(products: Product[], count: number): Slot[] {
	const sources: {source: string; kind: 'product' | 'collective'}[] = [
		...products.map(p => ({source: p.slug, kind: 'product' as const})),
		{source: COLLECTIVE_SOURCE, kind: 'collective' as const},
	];
	const perSource = new Map<string, number>();
	const slots: Slot[] = [];
	for (let i = 0; i < count; i++) {
		const {source, kind} = sources[i % sources.length];
		const n = (perSource.get(source) ?? 0) + 1;
		perSource.set(source, n);
		slots.push({file: `${source}-${n}.md`, source, sourceKind: kind});
	}
	return slots;
}

/**
 * Parse the planner's JSON. Must be an array of {file, angle, focus} whose
 * `file` set exactly equals the slot set — no missing, extra, or duplicate
 * slots. Returns the plan re-ordered to match `slots` on success.
 */
export function parseXDailyPlan(
	raw: string,
	slots: Slot[],
): {ok: true; plan: PlanEntry[]} | {ok: false; problems: string[]} {
	let parsed: unknown;
	try {
		parsed = JSON.parse(raw);
	} catch (e) {
		return {
			ok: false,
			problems: [`plan file is not valid JSON: ${(e as Error).message}`],
		};
	}
	if (!Array.isArray(parsed)) {
		return {ok: false, problems: ['plan must be a JSON array']};
	}

	const problems: string[] = [];
	const byFile = new Map<string, PlanEntry>();
	for (const [i, entry] of parsed.entries()) {
		if (!entry || typeof entry !== 'object') {
			problems.push(`entry ${i} is not an object`);
			continue;
		}
		const obj = entry as Record<string, unknown>;
		const {file, angle, focus} = obj;
		// archetype is steering, not structure: a missing or unknown value is
		// coerced to a deterministic fallback below rather than failing the plan
		// (a whole nanocoder run is too expensive to discard over it).
		const archetype = typeof obj.archetype === 'string' ? obj.archetype : '';
		if (typeof file !== 'string' || file.length === 0) {
			problems.push(`entry ${i}: "file" must be a non-empty string`);
			continue;
		}
		if (typeof angle !== 'string' || angle.length === 0) {
			problems.push(`entry ${i} (${file}): "angle" must be a non-empty string`);
		}
		if (typeof focus !== 'string' || focus.length === 0) {
			problems.push(`entry ${i} (${file}): "focus" must be a non-empty string`);
		}
		if (byFile.has(file)) {
			problems.push(`entry ${i}: file "${file}" is duplicated in the plan`);
			continue;
		}
		if (typeof angle === 'string' && typeof focus === 'string') {
			byFile.set(file, {file, angle, focus, archetype});
		}
	}

	const slotFiles = new Set(slots.map(s => s.file));
	for (const file of byFile.keys()) {
		if (!slotFiles.has(file)) {
			problems.push(`plan has unexpected slot "${file}"`);
		}
	}
	for (const slot of slots) {
		if (!byFile.has(slot.file)) {
			problems.push(`plan is missing slot "${slot.file}"`);
		}
	}

	if (problems.length > 0) return {ok: false, problems};
	// Re-order to slot order so downstream is deterministic, and coerce any
	// missing/unknown archetype to a deterministic per-slot fallback so the
	// daily set still spans different shapes even if the planner omits them.
	return {
		ok: true,
		plan: slots.map((s, i) => {
			const entry = byFile.get(s.file) as PlanEntry;
			const archetype = ARCHETYPE_IDS.has(entry.archetype)
				? entry.archetype
				: ARCHETYPES[i % ARCHETYPES.length].id;
			return {...entry, archetype};
		}),
	};
}

/**
 * Render recent ledger angles, grouped by source, newest first, for the
 * planning prompt. Only sources present in `slots` are shown.
 */
export function summarizeRecentAngles(
	ledger: LedgerEntry[],
	slots: Slot[],
	perSource: number = LEDGER_CONTEXT_PER_SOURCE,
): string {
	const sources = [...new Set(slots.map(s => s.source))];
	const lines: string[] = [];
	for (const source of sources) {
		const recent = ledger
			.filter(e => e.source === source)
			.slice(-perSource)
			.reverse();
		if (recent.length === 0) {
			lines.push(`${source}: (no recent posts)`);
			continue;
		}
		lines.push(`${source}:`);
		for (const e of recent) {
			const shape = e.archetype ? ` (${e.archetype})` : '';
			lines.push(`  - [${e.date}]${shape} ${e.angle}`);
		}
	}
	return lines.join('\n');
}

export function ledgerPath(): string {
	// Rotation history is always read from / written to the canonical
	// committed location, regardless of run mode — that's the memory the cron
	// builds up over time.
	return join(ROOT, 'content', X_DAILY_DIR, 'ledger.json');
}

export function readLedger(path: string): LedgerEntry[] {
	if (!existsSync(path)) return [];
	try {
		const parsed = JSON.parse(readFileSync(path, 'utf8'));
		return Array.isArray(parsed) ? (parsed as LedgerEntry[]) : [];
	} catch {
		return [];
	}
}

export function buildPlanPrompt(args: {
	date: string;
	slots: Slot[];
	productsJson: string;
	channelsJson: string;
	recentAngles: string;
	planOutputPath: string;
}): string {
	const template = readFile(join(PROMPTS_DIR, 'agents', 'x-daily-plan.md'));
	const slotsForAgent = args.slots.map(s => ({file: s.file, source: s.source}));
	return substitute(template, {
		DATE: args.date,
		SLOTS_JSON: JSON.stringify(slotsForAgent, null, 2),
		PRODUCTS_JSON: args.productsJson.trim(),
		CHANNELS_JSON: args.channelsJson.trim(),
		RECENT_ANGLES: args.recentAngles,
		ARCHETYPES_CATALOGUE: archetypesCatalogue(),
		PLAN_OUTPUT_PATH: args.planOutputPath,
	});
}

export function buildWritePrompt(args: {
	slot: Slot;
	plan: PlanEntry;
	date: string;
	packDir: string;
	packId: string;
	validatorRoot: string;
	products: Product[];
	maxChars: number;
	generatedAt: string;
	model: string;
	fixContext: string;
}): string {
	const template = readFile(join(PROMPTS_DIR, 'agents', 'x-daily-write.md'));
	const isCollective = args.slot.sourceKind === 'collective';
	const docsGlob = isCollective
		? '_refs/collective/**'
		: `_refs/${args.slot.source}/docs/**`;
	const sourceLabel = isCollective ? 'the Nano Collective' : args.slot.source;
	const archetype = archetypeById(args.plan.archetype);
	return substitute(template, {
		DATE: args.date,
		FILE: args.slot.file,
		SOURCE: args.slot.source,
		SOURCE_KIND: args.slot.sourceKind,
		SOURCE_LABEL: sourceLabel,
		ANGLE: args.plan.angle,
		FOCUS: args.plan.focus,
		ARCHETYPE: archetype ? archetype.label : args.plan.archetype,
		ARCHETYPE_GUIDANCE: archetype ? archetype.guidance : '',
		POST_PATH: join(args.packDir, 'posts', args.slot.file),
		PACK_ID: args.packId,
		VALIDATOR_ROOT: args.validatorRoot,
		DOCS_GLOB: docsGlob,
		MAX_CHARS: String(args.maxChars),
		GENERATED_AT: args.generatedAt,
		MODEL: args.model,
		FIX_CONTEXT: args.fixContext,
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
				'x-daily: `nanocoder` not on PATH. Install it (npm i -g @nanocollective/nanocoder).',
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

function runValidator(packId: string, root: string): ValidationReport {
	const reportPath = join(tmpdir(), `cf-x-daily-validate-${Date.now()}.json`);
	const result = spawnSync(
		'pnpm',
		[
			'validate',
			'--pack',
			packId,
			'--root',
			root,
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
			`x-daily: validator did not write a report.\n  exit=${result.status}\n  stdout=${result.stdout?.toString() ?? ''}\n  stderr=${result.stderr?.toString() ?? ''}`,
		);
		throw new Error('validator failed to produce a report');
	}
	return JSON.parse(readFileSync(reportPath, 'utf8')) as ValidationReport;
}

function writeMeta(args: {
	packDir: string;
	date: string;
	slots: Slot[];
	plan: PlanEntry[];
	generatedAt: string;
	model: string;
	attempts: number;
	finalStatus: 'passed' | 'failed-validation' | 'pending';
	failures: ValidationFailure[];
}) {
	const sourceByFile = new Map(args.slots.map(s => [s.file, s.source]));
	const posts = args.plan.map(p => ({
		file: p.file,
		source: sourceByFile.get(p.file) ?? COLLECTIVE_SOURCE,
		angle: p.angle,
		archetype: p.archetype,
	}));
	const meta = {
		kind: 'x-daily',
		date: args.date,
		generated_at: args.generatedAt,
		model: args.model,
		posts,
		attempts: args.attempts,
		final_status: args.finalStatus,
		failures: args.failures,
	};
	mkdirSync(args.packDir, {recursive: true});
	writeFileSync(join(args.packDir, 'meta.json'), JSON.stringify(meta, null, 2));
}

function previewOf(packDir: string, file: string): string {
	try {
		const raw = readFileSync(join(packDir, 'posts', file), 'utf8');
		// Strip frontmatter, take the first non-empty line, cap length.
		const body = raw.replace(/^---[\s\S]*?---\n?/, '').trim();
		const firstLine = body.split('\n').find(l => l.trim().length > 0) ?? '';
		return firstLine.slice(0, 100);
	} catch {
		return '';
	}
}

function appendLedger(args: {
	date: string;
	slots: Slot[];
	plan: PlanEntry[];
	packDir: string;
}) {
	const path = ledgerPath();
	const existing = readLedger(path);
	const sourceByFile = new Map(args.slots.map(s => [s.file, s.source]));
	const additions: LedgerEntry[] = args.plan.map(p => ({
		date: args.date,
		source: sourceByFile.get(p.file) ?? COLLECTIVE_SOURCE,
		angle: p.angle,
		archetype: p.archetype,
		preview: previewOf(args.packDir, p.file),
	}));
	mkdirSync(join(ROOT, 'content', X_DAILY_DIR), {recursive: true});
	writeFileSync(path, JSON.stringify([...existing, ...additions], null, 2));
}

async function main() {
	const args = parse();
	const products = loadProducts();
	const slots = buildSlots(products, args.posts);
	const contentRoot = contentRootFor(args.mode);
	const packDir = join(ROOT, contentRoot, X_DAILY_DIR, args.date);
	const packId = `${X_DAILY_DIR}/${args.date}`;
	const generatedAt = new Date().toISOString();
	const model = 'minimax-m3';

	const channelsJson = readFile(join(CONFIG_DIR, 'channels.json'));
	const channels = JSON.parse(channelsJson) as {
		slug: string;
		max_chars?: number;
	}[];
	const maxChars = channels.find(c => c.slug === 'x')?.max_chars ?? 280;
	const productsJson = readFile(join(CONFIG_DIR, 'products.json'));

	const ledger = readLedger(ledgerPath());
	const recentAngles = summarizeRecentAngles(ledger, slots);

	console.log(
		`x-daily: week of ${args.date} (mode=${args.mode}) — ${slots.length} posts round-robined across ${products.length} product(s) + collective, max-attempts=${args.maxAttempts}`,
	);

	const planPath = join(tmpdir(), `cf-x-daily-plan-${Date.now()}.json`);
	const planPrompt = buildPlanPrompt({
		date: args.date,
		slots,
		productsJson,
		channelsJson,
		recentAngles,
		planOutputPath: planPath,
	});

	if (args.dryRun) {
		console.log(
			'\n--- DRY RUN: plan prompt below, nanocoder NOT invoked ---\n',
		);
		console.log(planPrompt);
		process.exit(0);
	}

	mkdirSync(join(packDir, 'posts'), {recursive: true});

	// ── Phase 1: plan ────────────────────────────────────────────────────────
	let plan: PlanEntry[] | null = null;
	for (let attempt = 1; attempt <= args.maxAttempts; attempt++) {
		console.log(`\nx-daily: plan attempt ${attempt}/${args.maxAttempts}`);
		const code = runNanocoder(planPrompt, model);
		if (code !== 0) {
			console.error(`x-daily: planner exited ${code}; aborting`);
			process.exit(code);
		}
		if (!existsSync(planPath)) {
			console.error('x-daily: planner wrote no plan file; retrying');
			continue;
		}
		const result = parseXDailyPlan(readFileSync(planPath, 'utf8'), slots);
		if (result.ok) {
			plan = result.plan;
			break;
		}
		console.error(
			`x-daily: plan invalid:\n  - ${result.problems.join('\n  - ')}`,
		);
	}
	if (!plan) {
		console.error('x-daily: could not get a valid plan; aborting');
		process.exit(1);
	}

	// Write meta.json up front so each writer's self-check sees the expected
	// file-set. final_status flips to passed/failed-validation at the end.
	writeMeta({
		packDir,
		date: args.date,
		slots,
		plan,
		generatedAt,
		model,
		attempts: 0,
		finalStatus: 'pending',
		failures: [],
	});

	// ── Phase 2: write one post per slot ─────────────────────────────────────
	const planByFile = new Map(plan.map(p => [p.file, p]));
	for (const slot of slots) {
		console.log(`\nx-daily: writing ${slot.file} (source=${slot.source})`);
		const prompt = buildWritePrompt({
			slot,
			plan: planByFile.get(slot.file) as PlanEntry,
			date: args.date,
			packDir,
			packId,
			validatorRoot: contentRoot,
			products,
			maxChars,
			generatedAt,
			model,
			fixContext: '(none)',
		});
		const code = runNanocoder(prompt, model);
		if (code !== 0) {
			console.error(`x-daily: writer for ${slot.file} exited ${code}`);
		}
	}

	// ── Phase 3: validate + per-file fix loop ────────────────────────────────
	let attempt = 1;
	let report = runValidator(packId, contentRoot);
	while (report.failures.length > 0 && attempt < args.maxAttempts) {
		attempt += 1;
		const failingSlots = slots.filter(s =>
			report.failures.some(f => f.file.endsWith(`posts/${s.file}`)),
		);
		// Pack-level failures (e.g. meta) with no slot match: nothing to re-spawn.
		if (failingSlots.length === 0) break;
		console.log(
			`\nx-daily: validation attempt ${attempt}/${args.maxAttempts} — re-spawning ${failingSlots.length} writer(s)`,
		);
		for (const slot of failingSlots) {
			const fileFailures = report.failures.filter(f =>
				f.file.endsWith(`posts/${slot.file}`),
			);
			const prompt = buildWritePrompt({
				slot,
				plan: planByFile.get(slot.file) as PlanEntry,
				date: args.date,
				packDir,
				packId,
				validatorRoot: contentRoot,
				products,
				maxChars,
				generatedAt,
				model,
				fixContext: JSON.stringify(fileFailures, null, 2),
			});
			runNanocoder(prompt, model);
		}
		report = runValidator(packId, contentRoot);
	}

	const finalStatus =
		report.failures.length === 0 ? 'passed' : 'failed-validation';
	writeMeta({
		packDir,
		date: args.date,
		slots,
		plan,
		generatedAt,
		model,
		attempts: attempt,
		finalStatus,
		failures: report.failures,
	});

	if (finalStatus === 'passed') {
		console.log(
			`\nx-daily: ✓ validation passed${report.warnings.length > 0 ? ` (${report.warnings.length} warnings)` : ''}`,
		);
		// Only the canonical commit run feeds the rotation memory.
		if (args.mode === 'commit') {
			appendLedger({date: args.date, slots, plan, packDir});
			console.log('x-daily: appended angles to the ledger');
		}
		process.exit(0);
	}

	console.error(
		`\nx-daily: ✗ gave up after ${attempt} attempts; ${report.failures.length} failure(s):\n${JSON.stringify(report.failures, null, 2)}`,
	);
	process.exit(1);
}

/* c8 ignore stop */

if (process.env.NODE_ENV !== 'test') {
	main().catch(e => {
		console.error(e);
		process.exit(1);
	});
}
