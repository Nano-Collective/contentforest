/**
 * Orchestrates a single personal-pack request — generates {{member}}'s
 * personal-voice channel posts grounded in an existing base pack on disk.
 *
 * Personal packs are pack-level only: one set of channel posts per request,
 * mirroring the base pack's channels. They do NOT generate per-article drip
 * content (article-level personal posts were removed on 2026-05-12 — the
 * personal voice doesn't fit interim/drip pieces).
 *
 *   1. Resolve the base pack root from job.basePackKind + job.basePackId.
 *      Fail fast if the directory doesn't exist on disk — the requester is
 *      expected to point at a real, already-merged pack.
 *   2. Load the team member from config/team.json. Fail fast if missing.
 *   3. Compute the channel split:
 *        mirrored = base-pack channels ∩ member.channels
 *        additional = member.channels ∖ base-pack channels
 *      The validator's source of truth for personal files is team.json, so a
 *      channel in the base pack that the member doesn't list is silently
 *      skipped (no file written).
 *   4. Spawn the personal-channels agent (or one per group, when
 *      `agent_mode: "per-channel"`). Validate `--phase personal`. Auto-fix
 *      retry up to --max-retries on validation failure.
 *   5. Write a sidecar `personal-request.json` next to the generated files
 *      (under `<base-pack>/personal/<member>/`) capturing what was requested
 *      and the run outcome.
 *
 *   pnpm personal-request --job-spec-file /tmp/spec.json
 *   pnpm personal-request --job-spec '{"memberSlug":"will",...}' --dry-run
 *
 * --job-spec-file is preferred for orchestrators that already have the spec
 * on disk: it avoids shoving a multi-KB JSON blob through shell argv, where
 * it would have to round-trip through `sh -c` quoting and pnpm's command-
 * string escaping (the latter has tripped on backslash-heavy payloads).
 *
 * Exits 0 when the channels agent validates clean, 1 if it gives up with
 * failures still present (the workflow opens the PR anyway with a
 * `failed-change` label so a human can finish it). Sister script to
 * collective-request.ts; structure is intentionally parallel.
 */

import {spawnSync} from 'node:child_process';
import {
	existsSync,
	mkdirSync,
	readdirSync,
	readFileSync,
	writeFileSync,
} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {parseArgs} from 'node:util';
import {
	expandChannels,
	findMember,
	loadTeam,
	partitionChannelGroups,
	type TeamChannel,
	type TeamMember,
} from '../lib/team.js';

const ROOT = process.cwd();
const PROMPTS_DIR = join(ROOT, 'prompts');
const CONFIG_DIR = join(ROOT, 'config');
const CONTENT_DIR = join(ROOT, 'content');

export type BasePackKind = 'product' | 'collective';

export type JobSpec = {
	memberSlug: string;
	basePackKind: BasePackKind;
	basePackId: string;
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
			'job-spec-file': {type: 'string'},
			'dry-run': {type: 'boolean', default: false},
			'max-retries': {type: 'string', default: '3'},
		},
	});
	const inline = values['job-spec'] as string | undefined;
	const file = values['job-spec-file'] as string | undefined;
	if (!inline && !file) {
		console.error(
			'personal-request: pass either --job-spec or --job-spec-file',
		);
		process.exit(2);
	}
	const jobSpec = file ? readFileSync(file, 'utf8') : (inline as string);
	return {
		jobSpec,
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

/**
 * Resolves the absolute path of a base pack from (kind, id). Doesn't validate
 * existence — the caller does that and produces a useful error.
 */
export function basePackDir(
	job: Pick<JobSpec, 'basePackKind' | 'basePackId'>,
): string {
	if (job.basePackKind === 'collective') {
		return join(CONTENT_DIR, '_collective', job.basePackId);
	}
	const [product, version] = job.basePackId.split('/');
	return join(CONTENT_DIR, product, version);
}

export function basePackId(
	job: Pick<JobSpec, 'basePackKind' | 'basePackId'>,
): string {
	return job.basePackKind === 'collective'
		? `_collective/${job.basePackId}`
		: job.basePackId;
}

/**
 * Lists channel slugs present at <packDir>/channels/. Used to compute the
 * mirrored / additional split against the member's channels[].
 */
export function listBasePackChannels(packDir: string): string[] {
	const channelsDir = join(packDir, 'channels');
	if (!existsSync(channelsDir)) return [];
	return readdirSync(channelsDir)
		.filter(f => f.endsWith('.md'))
		.map(f => f.replace(/\.md$/, ''))
		.sort();
}

function bullets(items: string[]): string {
	if (items.length === 0) return '- (none)';
	return items.map(i => `- ${i}`).join('\n');
}

function commaList(items: string[]): string {
	return items.length === 0 ? '(none)' : items.join(', ');
}

export type ChannelSpawn = {
	/** Channels covered by this spawn (group). */
	channels: TeamChannel[];
	/** Mirrored subset (intersect with the base pack). */
	mirrored: TeamChannel[];
	/** Additional subset (member-only, not in the base pack). */
	additional: TeamChannel[];
	/** Stable label used for logging and the sidecar (hyphenated slug list). */
	label: string;
};

/**
 * Plans the channel-phase agent spawns for a member. Returns one spawn for
 * `agent_mode: "bundled"` (today's default), or one per `bundle_with`-group
 * for `agent_mode: "per-channel"`. Groups containing zero in-scope channels
 * (mirrored ∪ additional is empty) are dropped — those channels would be a
 * no-op for this run.
 */
export function planChannelSpawns(args: {
	member: TeamMember;
	mirrored: TeamChannel[];
	additional: TeamChannel[];
}): ChannelSpawn[] {
	const mirroredSet = new Set(args.mirrored.map(c => c.slug));
	const additionalSet = new Set(args.additional.map(c => c.slug));
	const isInScope = (slug: string) =>
		mirroredSet.has(slug) || additionalSet.has(slug);

	if (args.member.agent_mode !== 'per-channel') {
		return [
			{
				channels: args.member.channels,
				mirrored: args.mirrored,
				additional: args.additional,
				label: 'all',
			},
		];
	}

	const groups = partitionChannelGroups(args.member.channels);
	const spawns: ChannelSpawn[] = [];
	for (const group of groups) {
		const groupSlugs = group.map(c => c.slug);
		if (!groupSlugs.some(isInScope)) continue;
		spawns.push({
			channels: group,
			mirrored: args.mirrored.filter(c => groupSlugs.includes(c.slug)),
			additional: args.additional.filter(c => groupSlugs.includes(c.slug)),
			label: groupSlugs.join('-'),
		});
	}
	return spawns;
}

export function buildChannelsPrompt(args: {
	job: JobSpec;
	member: TeamMember;
	packDir: string;
	packId: string;
	mirrored: TeamChannel[];
	additional: TeamChannel[];
	generatedAt: string;
	model: string;
	/**
	 * Subset of member.channels in scope for this spawn. Defaults to all of
	 * them (bundled mode). In per-channel mode the orchestrator passes a
	 * partitioned group so the agent only sees the rules and validator scope
	 * for the channels it's writing.
	 */
	inScopeChannels?: TeamChannel[];
}): string {
	const template = readFile(join(PROMPTS_DIR, 'agents/personal-channels.md'));
	const inScope = args.inScopeChannels ?? args.member.channels;

	const baseFmHints =
		args.job.basePackKind === 'product'
			? `product: ${args.job.basePackId.split('/')[0]}\nversion: "${args.job.basePackId.split('/')[1]}"`
			: `slug: ${args.job.basePackId}`;

	const productSlug =
		args.job.basePackKind === 'product'
			? args.job.basePackId.split('/')[0]
			: '(n/a)';
	const version =
		args.job.basePackKind === 'product'
			? args.job.basePackId.split('/')[1]
			: '(n/a)';
	const collectiveSlug =
		args.job.basePackKind === 'collective' ? args.job.basePackId : '(n/a)';

	return substitute(template, {
		MEMBER_SLUG: args.member.slug,
		MEMBER_NAME: args.member.name,
		MEMBER_ROLE: args.member.role,
		MEMBER_VOICE_TONE: args.member.voice.tone,
		MEMBER_VOICE_DO: bullets(args.member.voice.do),
		MEMBER_VOICE_DONT: bullets(args.member.voice.dont),
		MEMBER_VOICE_SAMPLES:
			args.member.voice.samples.length > 0
				? args.member.voice.samples.map(s => `> ${s}`).join('\n\n')
				: '(none)',
		MEMBER_CHANNELS_JSON: JSON.stringify(inScope, null, 2),
		MIRRORED_CHANNEL_SLUGS: commaList(args.mirrored.map(c => c.slug)),
		ADDITIONAL_CHANNEL_SLUGS: commaList(args.additional.map(c => c.slug)),
		IN_SCOPE_CHANNEL_SLUGS: commaList(inScope.map(c => c.slug)),
		BASE_KIND: args.job.basePackKind === 'product' ? 'release' : 'collective',
		BASE_PACK_DIR: args.packDir,
		BASE_PACK_ID: args.packId,
		TARGET_DIR: `${join(args.packDir, 'personal', args.member.slug)}/`,
		VALIDATOR_ROOT: 'content',
		PRODUCT_SLUG: productSlug,
		VERSION: version,
		COLLECTIVE_SLUG: collectiveSlug,
		REQUESTER: args.job.requester,
		ISSUE_NUMBER: String(args.job.issueNumber),
		CONTEXT: args.job.context ?? '(none)',
		BASE_FRONTMATTER_HINTS: baseFmHints,
		GENERATED_AT: args.generatedAt,
		MODEL: args.model,
	});
}

/**
 * Edit-mode prompt for the channels phase. Used when the orchestrator was
 * called with a non-empty `context` field (typically a /change PR comment).
 * Drops the create-mode "produce personal-voice posts" framing entirely;
 * leads with the change request as a non-negotiable directive. The agent
 * reads existing files at TARGET_DIR, applies the change with the smallest
 * possible diff, and stops.
 */
export function buildChannelsEditPrompt(args: {
	job: JobSpec;
	member: TeamMember;
	packDir: string;
	packId: string;
	generatedAt: string;
	model: string;
}): string {
	const template = readFile(
		join(PROMPTS_DIR, 'agents/personal-channels-edit.md'),
	);
	return substitute(template, {
		MEMBER_SLUG: args.member.slug,
		MEMBER_NAME: args.member.name,
		MEMBER_VOICE_TONE: args.member.voice.tone,
		MEMBER_VOICE_DO: bullets(args.member.voice.do),
		MEMBER_VOICE_DONT: bullets(args.member.voice.dont),
		TARGET_DIR: `${join(args.packDir, 'personal', args.member.slug)}/`,
		BASE_PACK_DIR: args.packDir,
		BASE_PACK_ID: args.packId,
		VALIDATOR_ROOT: 'content',
		REQUESTER: args.job.requester,
		CONTEXT: args.job.context ?? '',
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
				'personal-request: `nanocoder` not on PATH. Install it (npm i -g @nanocollective/nanocoder).',
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

function runValidator(
	packId: string,
	channelFilter?: string[],
): ValidationReport {
	const reportPath = join(tmpdir(), `cf-personal-validate-${Date.now()}.json`);
	const argv = [
		'validate',
		'--pack',
		packId,
		'--root',
		'content',
		'--report',
		reportPath,
		'--phase',
		'personal',
		'--quiet',
	];
	if (channelFilter && channelFilter.length > 0) {
		argv.push('--personal-channels', channelFilter.join(','));
	}
	const result = spawnSync('pnpm', argv, {
		cwd: ROOT,
		encoding: 'utf8',
		stdio: ['ignore', 'pipe', 'pipe'],
	});
	if (!existsSync(reportPath)) {
		console.error(
			`personal-request: validator did not write a report.\n  exit=${result.status}\n  stdout=${result.stdout?.toString() ?? ''}\n  stderr=${result.stderr?.toString() ?? ''}`,
		);
		throw new Error('validator failed to produce a report');
	}
	return JSON.parse(readFileSync(reportPath, 'utf8')) as ValidationReport;
}

type AgentPhase = 'channels';

type Sidecar = {
	issue_number: number;
	requester: string;
	member: string;
	base_pack_kind: BasePackKind;
	base_pack_id: string;
	context: string | null;
	mirrored_channels: string[];
	additional_channels: string[];
	agent_mode: 'bundled' | 'per-channel';
	generated_at: string;
	model: string;
	phases: {
		phase: AgentPhase;
		/**
		 * Channel slugs handled by this spawn. Omitted for bundled-mode
		 * spawns; present (one phase entry per group) when
		 * agent_mode === "per-channel".
		 */
		channel_group?: string[];
		attempts: number;
		final_status: 'passed' | 'failed-validation';
		failures: ValidationReport['failures'];
	}[];
};

function writeSidecar(args: {memberDir: string; sidecar: Sidecar}) {
	mkdirSync(args.memberDir, {recursive: true});
	writeFileSync(
		join(args.memberDir, 'personal-request.json'),
		JSON.stringify(args.sidecar, null, 2),
	);
}

/**
 * Runs a single agent phase (channels or articles) with the auto-fix retry
 * loop. Returns `{status, attempts, failures}` — never throws on agent or
 * validator failure (those are recorded in the sidecar).
 */
function runAgentPhase(args: {
	phase: AgentPhase;
	label?: string;
	initialPrompt: string;
	packId: string;
	packDir: string;
	model: string;
	maxAttempts: number;
	channelFilter?: string[];
}): {
	status: 'passed' | 'failed-validation';
	attempts: number;
	failures: ValidationReport['failures'];
} {
	let attempt = 0;
	let prompt = args.initialPrompt;
	let lastReport: ValidationReport | null = null;
	const tag = args.label ? `${args.phase}:${args.label}` : args.phase;

	while (attempt < args.maxAttempts) {
		attempt += 1;
		console.log(
			`\npersonal-request[${tag}]: attempt ${attempt}/${args.maxAttempts}`,
		);
		const code = runNanocoder(prompt, args.model);
		if (code !== 0) {
			console.error(
				`personal-request[${tag}]: nanocoder exited ${code}; aborting phase`,
			);
			return {status: 'failed-validation', attempts: attempt, failures: []};
		}

		lastReport = runValidator(args.packId, args.channelFilter);
		if (lastReport.failures.length === 0) {
			console.log(
				`personal-request[${tag}]: ✓ validation passed${lastReport.warnings.length > 0 ? ` (${lastReport.warnings.length} warnings)` : ''}`,
			);
			return {status: 'passed', attempts: attempt, failures: []};
		}

		console.log(
			`personal-request[${tag}]: ✗ validation failed (${lastReport.failures.length} failures)`,
		);
		if (attempt >= args.maxAttempts) break;
		prompt = buildAutoFixPrompt({
			originalPrompt: args.initialPrompt,
			errorReport: JSON.stringify(lastReport.failures, null, 2),
			packDir: args.packDir,
			attemptNumber: attempt,
			maxAttempts: args.maxAttempts - 1,
		});
	}

	return {
		status: 'failed-validation',
		attempts: attempt,
		failures: lastReport?.failures ?? [],
	};
}

async function main() {
	const args = parse();
	const job = JSON.parse(args.jobSpec) as JobSpec;

	const team = loadTeam(join(CONFIG_DIR, 'team.json'));
	const member = findMember(team, job.memberSlug);
	if (!member) {
		console.error(
			`personal-request: member "${job.memberSlug}" not found in config/team.json`,
		);
		process.exit(2);
	}

	const packDir = basePackDir(job);
	const packId = basePackId(job);
	if (!existsSync(packDir)) {
		console.error(
			`personal-request: base pack ${packId} does not exist on disk at ${packDir}`,
		);
		process.exit(2);
	}

	const baseChannelSlugs = listBasePackChannels(packDir);
	const {mirrored, additional} = expandChannels(member, baseChannelSlugs);

	const generatedAt = new Date().toISOString();
	const model = 'minimax-m2.7';

	console.log(
		`personal-request: ${packId} for @${member.slug} (kind=${job.basePackKind}) — issue #${job.issueNumber} from @${job.requester} (max-attempts=${args.maxAttempts})`,
	);
	console.log(
		`  mirrored channels: ${mirrored.map(c => c.slug).join(', ') || '(none)'}`,
	);
	console.log(
		`  additional channels: ${additional.map(c => c.slug).join(', ') || '(none)'}`,
	);

	if (mirrored.length === 0 && additional.length === 0) {
		console.log(
			`personal-request: nothing to write — member "${member.slug}" doesn't publish on any base-pack channel and has no additional channels`,
		);
		process.exit(0);
	}

	// Edit mode fires when context is non-empty (typically a /change PR
	// comment routed via pr-change.yaml). The edit-mode prompt is much
	// tighter and leads with the change request as a non-negotiable
	// directive — necessary because the create-mode prompt's "produce
	// personal-voice posts" framing dilutes targeted edits. Edit mode stays
	// bundled even when agent_mode === "per-channel" — the change is usually
	// targeted at one file already and partitioning loses cross-file context.
	const isEdit =
		typeof job.context === 'string' && job.context.trim().length > 0;

	const spawns: ChannelSpawn[] = isEdit
		? [
				{
					channels: member.channels,
					mirrored,
					additional,
					label: 'all',
				},
			]
		: planChannelSpawns({member, mirrored, additional});

	console.log(
		`  agent mode: ${member.agent_mode}${isEdit ? ' (edit mode — bundled regardless)' : ''} → ${spawns.length} channel spawn(s)`,
	);
	for (const s of spawns) {
		console.log(
			`    spawn "${s.label}": ${s.channels.map(c => c.slug).join(', ')}`,
		);
	}

	const buildSpawnPrompt = (spawn: ChannelSpawn): string =>
		isEdit
			? buildChannelsEditPrompt({
					job,
					member,
					packDir,
					packId,
					generatedAt,
					model,
				})
			: buildChannelsPrompt({
					job,
					member,
					packDir,
					packId,
					mirrored: spawn.mirrored,
					additional: spawn.additional,
					inScopeChannels: spawn.channels,
					generatedAt,
					model,
				});

	if (args.dryRun) {
		console.log(
			'\n--- DRY RUN: substituted prompts below, nanocoder NOT invoked ---\n',
		);
		for (const spawn of spawns) {
			console.log(
				`### personal-channels prompt (mode: ${isEdit ? 'edit' : 'create'}, spawn: ${spawn.label}):\n`,
			);
			console.log(buildSpawnPrompt(spawn));
		}
		process.exit(0);
	}

	const memberDir = join(packDir, 'personal', member.slug);
	mkdirSync(memberDir, {recursive: true});

	const phases: Sidecar['phases'] = [];

	const isPerChannel = !isEdit && member.agent_mode === 'per-channel';
	for (const spawn of spawns) {
		const channelFilter = isPerChannel
			? spawn.channels.map(c => c.slug)
			: undefined;
		const channelsResult = runAgentPhase({
			phase: 'channels',
			label: isPerChannel ? spawn.label : undefined,
			initialPrompt: buildSpawnPrompt(spawn),
			packId,
			packDir,
			model,
			maxAttempts: args.maxAttempts,
			channelFilter,
		});
		phases.push({
			phase: 'channels',
			...(isPerChannel && {channel_group: spawn.channels.map(c => c.slug)}),
			attempts: channelsResult.attempts,
			final_status: channelsResult.status,
			failures: channelsResult.failures,
		});
	}

	const sidecar: Sidecar = {
		issue_number: job.issueNumber,
		requester: job.requester,
		member: member.slug,
		base_pack_kind: job.basePackKind,
		base_pack_id: job.basePackId,
		context: job.context,
		mirrored_channels: mirrored.map(c => c.slug),
		additional_channels: additional.map(c => c.slug),
		agent_mode: isPerChannel ? 'per-channel' : 'bundled',
		generated_at: generatedAt,
		model,
		phases,
	};
	writeSidecar({memberDir, sidecar});

	const anyFailed = phases.some(p => p.final_status === 'failed-validation');
	process.exit(anyFailed ? 1 : 0);
}

if (process.env.NODE_ENV !== 'test') {
	main().catch(e => {
		console.error(e);
		process.exit(1);
	});
}
/* c8 ignore stop */
