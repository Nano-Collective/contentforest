import {mkdtempSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import test from 'ava';
import {
	buildMemberBlock,
	listMemberSlugs,
	rewrite,
} from './sync-team-members.js';

function makeTeamFile(members: {slug: string; name?: string}[]): string {
	const root = mkdtempSync(join(tmpdir(), 'cf-sync-members-'));
	const teamPath = join(root, 'team.json');
	const team = members.map(m => ({
		slug: m.slug,
		name: m.name ?? 'Test',
		github: 'gh',
		role: 'role',
		voice: {tone: 't', do: ['a'], dont: ['b'], samples: []},
		channels: [{slug: 'linkedin', kind: 'social'}],
	}));
	writeFileSync(teamPath, JSON.stringify(team));
	return teamPath;
}

test('listMemberSlugs: returns sorted slugs', t => {
	const path = makeTeamFile([{slug: 'zach'}, {slug: 'alice'}, {slug: 'mu'}]);
	t.deepEqual(listMemberSlugs(path), ['alice', 'mu', 'zach']);
});

test('listMemberSlugs: returns [] when team.json missing', t => {
	t.deepEqual(listMemberSlugs('/nonexistent/team.json'), []);
});

test('buildMemberBlock: renders a dropdown when slugs exist', t => {
	const block = buildMemberBlock(['will', 'ben']);
	t.true(block.includes('  - type: dropdown'));
	t.true(block.includes('        - will'));
	t.true(block.includes('        - ben'));
	t.true(block.startsWith('  # BEGIN AUTO-MEMBERS'));
	t.true(block.endsWith('  # END AUTO-MEMBERS'));
});

test('buildMemberBlock: falls back to free-text input when team is empty', t => {
	const block = buildMemberBlock([]);
	t.true(block.includes('  - type: input'));
	t.true(block.includes('No team members configured'));
});

test('rewrite: swaps the bracketed block in place', t => {
	const before = [
		'name: example',
		'body:',
		'  - type: markdown',
		'    attributes:',
		'      value: header',
		'  # BEGIN AUTO-MEMBERS — old marker text',
		'  - type: input',
		'    id: member',
		'  # END AUTO-MEMBERS',
		'  - type: textarea',
		'    id: context',
		'',
	].join('\n');

	const after = rewrite(before, ['foo', 'bar']);
	t.true(after.includes('  - type: markdown'));
	t.true(after.includes('  - type: dropdown'));
	t.true(after.includes('        - bar'));
	t.true(after.includes('        - foo'));
	t.true(after.includes('  - type: textarea'));
});

test('rewrite: throws when markers are missing', t => {
	t.throws(() => rewrite('no markers here', ['will']), {
		message: /missing AUTO-MEMBERS markers/,
	});
});
