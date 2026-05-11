import test from 'ava';
import {
	expandChannels,
	findMember,
	parseTeam,
	partitionChannelGroups,
	type TeamChannel,
	TeamConfigError,
	type TeamMember,
} from './team.js';

const VALID_RAW = [
	{
		slug: 'will',
		name: 'Will Lamerton',
		github: 'willlamerton',
		role: 'Lead',
		voice: {tone: 't', do: ['a'], dont: ['b'], samples: []},
		channels: [
			{slug: 'linkedin', kind: 'social', min_words: 100, max_words: 500},
			{slug: 'x', kind: 'social', max_chars: 280},
		],
	},
];

test('parseTeam: accepts a well-formed config', t => {
	const team = parseTeam(VALID_RAW);
	t.is(team.length, 1);
	t.is(team[0].slug, 'will');
	t.is(team[0].channels.length, 2);
	t.is(team[0].channels[0].slug, 'linkedin');
	t.is(team[0].channels[1].max_chars, 280);
});

test('parseTeam: rejects non-array root', t => {
	t.throws(() => parseTeam({}), {instanceOf: TeamConfigError});
});

test('parseTeam: rejects non-kebab member slug', t => {
	const raw = JSON.parse(JSON.stringify(VALID_RAW));
	raw[0].slug = 'Will Lamerton';
	const err = t.throws(() => parseTeam(raw), {instanceOf: TeamConfigError});
	t.regex(err.message, /kebab-case/);
});

test('parseTeam: rejects duplicate member slugs', t => {
	const raw = JSON.parse(JSON.stringify([...VALID_RAW, ...VALID_RAW]));
	const err = t.throws(() => parseTeam(raw), {instanceOf: TeamConfigError});
	t.regex(err.message, /duplicate/);
});

test('parseTeam: rejects missing required member fields', t => {
	const raw = JSON.parse(JSON.stringify(VALID_RAW));
	delete raw[0].name;
	const err = t.throws(() => parseTeam(raw), {instanceOf: TeamConfigError});
	t.regex(err.message, /name/);
});

test('parseTeam: rejects unknown channel kind', t => {
	const raw = JSON.parse(JSON.stringify(VALID_RAW));
	raw[0].channels[0].kind = 'video';
	const err = t.throws(() => parseTeam(raw), {instanceOf: TeamConfigError});
	t.regex(err.message, /kind/);
});

test('parseTeam: rejects duplicate channel slugs within a member', t => {
	const raw = JSON.parse(JSON.stringify(VALID_RAW));
	raw[0].channels.push({slug: 'linkedin', kind: 'social'});
	const err = t.throws(() => parseTeam(raw), {instanceOf: TeamConfigError});
	t.regex(err.message, /duplicate/);
});

test('parseTeam: rejects negative numeric fields', t => {
	const raw = JSON.parse(JSON.stringify(VALID_RAW));
	raw[0].channels[0].min_words = -1;
	const err = t.throws(() => parseTeam(raw), {instanceOf: TeamConfigError});
	t.regex(err.message, /min_words/);
});

test('parseTeam: rejects non-string-array voice fields', t => {
	const raw = JSON.parse(JSON.stringify(VALID_RAW));
	raw[0].voice.do = [1, 2];
	t.throws(() => parseTeam(raw), {instanceOf: TeamConfigError});
});

test('findMember: returns the matching member', t => {
	const team = parseTeam(VALID_RAW);
	t.is(findMember(team, 'will')?.name, 'Will Lamerton');
	t.is(findMember(team, 'unknown'), undefined);
});

test('expandChannels: splits into mirrored and additional', t => {
	const team = parseTeam(VALID_RAW);
	const {mirrored, additional} = expandChannels(team[0], [
		'linkedin',
		'github-discussion',
	]);
	t.deepEqual(
		mirrored.map(c => c.slug),
		['linkedin'],
	);
	t.deepEqual(
		additional.map(c => c.slug),
		['x'],
	);
});

test('expandChannels: empty base pack means everything is additional', t => {
	const team = parseTeam(VALID_RAW);
	const {mirrored, additional} = expandChannels(team[0], []);
	t.is(mirrored.length, 0);
	t.is(additional.length, 2);
});

test('expandChannels: channels in pack but not in member are skipped', t => {
	const member: TeamMember = parseTeam(VALID_RAW)[0];
	const {mirrored, additional} = expandChannels(member, [
		'reddit',
		'github-discussion',
	]);
	t.is(mirrored.length, 0);
	t.is(additional.length, 2);
});

test('parseTeam: defaults agent_mode to "bundled" when omitted', t => {
	const team = parseTeam(VALID_RAW);
	t.is(team[0].agent_mode, 'bundled');
});

test('parseTeam: accepts agent_mode: "per-channel"', t => {
	const raw = JSON.parse(JSON.stringify(VALID_RAW));
	raw[0].agent_mode = 'per-channel';
	const team = parseTeam(raw);
	t.is(team[0].agent_mode, 'per-channel');
});

test('parseTeam: rejects unknown agent_mode', t => {
	const raw = JSON.parse(JSON.stringify(VALID_RAW));
	raw[0].agent_mode = 'sequential';
	const err = t.throws(() => parseTeam(raw), {instanceOf: TeamConfigError});
	t.regex(err.message, /agent_mode/);
});

test('parseTeam: accepts bundle_with referencing sibling channels', t => {
	const raw = JSON.parse(JSON.stringify(VALID_RAW));
	raw[0].channels[0].bundle_with = ['x'];
	const team = parseTeam(raw);
	t.deepEqual(team[0].channels[0].bundle_with, ['x']);
});

test('parseTeam: rejects bundle_with pointing at unknown channel', t => {
	const raw = JSON.parse(JSON.stringify(VALID_RAW));
	raw[0].channels[0].bundle_with = ['substack'];
	const err = t.throws(() => parseTeam(raw), {instanceOf: TeamConfigError});
	t.regex(err.message, /bundle_with/);
	t.regex(err.message, /substack/);
});

test('parseTeam: rejects bundle_with referencing self', t => {
	const raw = JSON.parse(JSON.stringify(VALID_RAW));
	raw[0].channels[0].bundle_with = ['linkedin'];
	const err = t.throws(() => parseTeam(raw), {instanceOf: TeamConfigError});
	t.regex(err.message, /self/);
});

test('partitionChannelGroups: no bundle_with → one group per channel', t => {
	const channels: TeamChannel[] = [
		{slug: 'a', kind: 'social'},
		{slug: 'b', kind: 'social'},
		{slug: 'c', kind: 'social'},
	];
	const groups = partitionChannelGroups(channels);
	t.is(groups.length, 3);
	t.deepEqual(
		groups.map(g => g.map(c => c.slug)),
		[['a'], ['b'], ['c']],
	);
});

test('partitionChannelGroups: bundle_with co-locates referenced channels', t => {
	const channels: TeamChannel[] = [
		{slug: 'linkedin-newsletter', kind: 'long-form', bundle_with: ['linkedin']},
		{slug: 'linkedin', kind: 'social'},
		{slug: 'x', kind: 'social'},
	];
	const groups = partitionChannelGroups(channels);
	t.is(groups.length, 2);
	const linkedinGroup = groups.find(g =>
		g.some(c => c.slug === 'linkedin-newsletter'),
	)!;
	t.deepEqual(linkedinGroup.map(c => c.slug).sort(), [
		'linkedin',
		'linkedin-newsletter',
	]);
	const xGroup = groups.find(g => g.some(c => c.slug === 'x'))!;
	t.deepEqual(
		xGroup.map(c => c.slug),
		['x'],
	);
});

test('parseTeam: defaults channel.articles to undefined (treated as true)', t => {
	const team = parseTeam(VALID_RAW);
	t.is(team[0].channels[0].articles, undefined);
});

test('parseTeam: accepts channel.articles: false', t => {
	const raw = JSON.parse(JSON.stringify(VALID_RAW));
	raw[0].channels[0].articles = false;
	const team = parseTeam(raw);
	t.is(team[0].channels[0].articles, false);
});

test('parseTeam: rejects non-boolean channel.articles', t => {
	const raw = JSON.parse(JSON.stringify(VALID_RAW));
	raw[0].channels[0].articles = 'no';
	const err = t.throws(() => parseTeam(raw), {instanceOf: TeamConfigError});
	t.regex(err.message, /articles/);
});

test('partitionChannelGroups: bundle_with is transitive (A→B, B→C ⇒ one group)', t => {
	const channels: TeamChannel[] = [
		{slug: 'a', kind: 'social', bundle_with: ['b']},
		{slug: 'b', kind: 'social', bundle_with: ['c']},
		{slug: 'c', kind: 'social'},
	];
	const groups = partitionChannelGroups(channels);
	t.is(groups.length, 1);
	t.deepEqual(groups[0].map(c => c.slug).sort(), ['a', 'b', 'c']);
});
