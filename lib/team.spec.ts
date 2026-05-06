import test from 'ava';
import {
	expandChannels,
	findMember,
	parseTeam,
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
