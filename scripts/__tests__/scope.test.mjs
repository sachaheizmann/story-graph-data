// Contrôle de périmètre des Pull Requests (scripts/check-scope.mjs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { ALLOWED_PREFIX, EXEMPT_LOGINS, TRUSTED_ASSOCIATIONS, checkScope, isInScope, parseFileList } from '../check-scope.mjs';
import { SCRIPTS_DIR } from './helpers.mjs';

const SCRIPT = path.join(SCRIPTS_DIR, 'check-scope.mjs');
const run = (files, association, { env = {}, login } = {}) => spawnSync(process.execPath, [SCRIPT, ...(association ? ['--association', association] : []), ...(login ? ['--login', login] : [])], {
  input: files.join('\0'),
  encoding: 'utf8',
  env: { ...process.env, AUTHOR_ASSOCIATION: '', AUTHOR_LOGIN: '', ...env },
});

// ------------------------------------------------------------------ la règle
test('les auteurs de confiance (OWNER, MEMBER, COLLABORATOR) peuvent modifier n\'importe quoi', () => {
  assert.deepEqual(TRUSTED_ASSOCIATIONS, ['OWNER', 'MEMBER', 'COLLABORATOR']);
  for (const association of TRUSTED_ASSOCIATIONS) {
    const result = checkScope({ files: ['scripts/check.mjs', '.github/CODEOWNERS', 'README.md'], association });
    assert.deepEqual(result, { ok: true, trusted: true, exempt: false, outOfScope: [] });
  }
});

test('les autres auteurs peuvent modifier data/ et seulement data/', () => {
  const outsiders = ['CONTRIBUTOR', 'FIRST_TIME_CONTRIBUTOR', 'FIRST_TIMER', 'NONE', 'MANNEQUIN'];
  for (const association of outsiders) {
    assert.equal(checkScope({ files: ['data/ma-saga/saga.json', 'data/_common/relation-types.json'], association }).ok, true, association);
    const refused = checkScope({ files: ['data/x.json', 'scripts/check.mjs'], association });
    assert.equal(refused.ok, false, association);
    assert.deepEqual(refused.outOfScope, ['scripts/check.mjs'], 'seul le fichier hors périmètre est listé');
  }
});

test('en cas de doute (statut inconnu, absent, en minuscules), on applique la règle stricte', () => {
  for (const association of [undefined, '', 'owner', 'ADMIN', 'OWNER ', null]) {
    assert.equal(checkScope({ files: ['scripts/x.mjs'], association }).ok, false, String(association));
  }
});

test('chaque zone protégée est refusée à une personne extérieure', () => {
  const protectedFiles = [
    'schema/character.schema.json', 'scripts/lib/check.mjs', 'scripts/__tests__/check.test.mjs',
    '.github/workflows/validate.yml', '.github/CODEOWNERS', '.github/PULL_REQUEST_TEMPLATE.md',
    'docs/MAINTAINER.md', 'README.md', 'CONTRIBUTING.md', 'package.json', 'package-lock.json',
    'LICENSE-DATA', 'LICENSE-SCRIPTS', '.gitignore', '.gitattributes', '.editorconfig',
  ];
  const result = checkScope({ files: protectedFiles, association: 'NONE' });
  assert.deepEqual(result.outOfScope, protectedFiles);
});

test('les détours ne passent pas : data/../scripts, ./data, data seul, Data/, datafoo/, data-extra/', () => {
  for (const file of ['data/../scripts/check.mjs', './data/x.json', 'data', 'Data/x.json', 'datafoo/x.json', 'data-extra/x.json', '/data/x.json', 'data//x.json']) {
    assert.equal(isInScope(file), false, file);
  }
  assert.equal(ALLOWED_PREFIX, 'data/');
  assert.equal(isInScope('data/couronne-de-brume/editions/fr-original/relations.json'), true);
});

test('un fichier déplacé DEPUIS scripts/ vers data/ est refusé (l\'ancien chemin compte aussi)', () => {
  // « git diff --no-renames » liste l'ancien chemin (supprimé) ET le nouveau (ajouté).
  assert.deepEqual(checkScope({ files: ['scripts/check.mjs', 'data/check.json'], association: 'NONE' }).outOfScope, ['scripts/check.mjs']);
});

test('une PR sans fichier modifié passe', () => {
  assert.equal(checkScope({ files: [], association: 'NONE' }).ok, true);
});

test('la liste est lue avec des NUL : espaces et retours à la ligne dans les noms sont conservés', () => {
  assert.deepEqual(parseFileList('data/a b.json\0scripts/x\ny.mjs\0'), ['data/a b.json', 'scripts/x\ny.mjs']);
  assert.deepEqual(parseFileList(''), []);
});

// ------------------------------------------------------------------ Dependabot
const DEPENDABOT_FILES = ['.github/workflows/validate.yml', 'package.json', 'package-lock.json'];

test('Dependabot : l\'auteur « dependabot[bot] » est exempté, même sans statut de confiance', () => {
  assert.deepEqual(EXEMPT_LOGINS, ['dependabot[bot]']);
  for (const association of ['NONE', 'CONTRIBUTOR', undefined]) {
    const result = checkScope({ files: DEPENDABOT_FILES, association, login: 'dependabot[bot]' });
    assert.deepEqual(result, { ok: true, trusted: false, exempt: true, outOfScope: [] }, String(association));
  }
});

test('Dependabot : personne ne peut se faire passer pour lui (comparaison exacte du nom)', () => {
  const lookalikes = ['dependabot', 'Dependabot[bot]', 'DEPENDABOT[BOT]', 'dependabot[bot] ', ' dependabot[bot]', 'dependabot[bot]-fake',
    'not-dependabot[bot]', 'dependabot-bot', 'github-actions[bot]', 'renovate[bot]', 'dependabot[bot]\n', '', undefined, null];
  for (const login of lookalikes) {
    const result = checkScope({ files: DEPENDABOT_FILES, association: 'NONE', login });
    assert.equal(result.ok, false, JSON.stringify(login));
    assert.equal(result.exempt, false, JSON.stringify(login));
  }
});

test('Dependabot : l\'exemption ne dépend pas du statut : un auteur de confiance reste « de confiance », pas « exempté »', () => {
  assert.deepEqual(checkScope({ files: ['scripts/x'], association: 'OWNER', login: 'dependabot[bot]' }),
    { ok: true, trusted: true, exempt: false, outOfScope: [] });
});

// ------------------------------------------------------------------ la commande
test('commande : une personne extérieure qui modifie scripts/ échoue, avec une explication française', () => {
  const result = run(['data/ma-saga/saga.json', 'scripts/lib/check.mjs'], 'FIRST_TIME_CONTRIBUTOR');
  assert.equal(result.status, 1);
  assert.match(result.stderr, /✗ Cette Pull Request modifie des fichiers en dehors de data\//);
  assert.match(result.stderr, /^ {2}- scripts\/lib\/check\.mjs$/m);
  assert.equal(result.stderr.includes('- data/ma-saga/saga.json'), false, 'le fichier autorisé n\'est pas listé');
  assert.match(result.stderr, /Pourquoi ce refus \? Votre statut sur ce dépôt est « FIRST_TIME_CONTRIBUTOR »/);
  assert.match(result.stderr, /Que faire \?/);
  assert.match(result.stderr, /issue\s+« Suggestion »/);
  assert.match(result.stderr, /la vraie protection est la relecture obligatoire par le mainteneur/);
  assert.match(result.stderr, /^::error title=Contrôle de périmètre::1 fichier\(s\)/m);
});

test('commande : une personne extérieure qui ne modifie que data/ réussit', () => {
  const result = run(['data/ma-saga/saga.json', 'data/ma-saga/editions/fr/relations.json'], 'NONE');
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /✓ Contrôle de périmètre : les 2 fichiers modifiés sont tous dans data\//);
});

test('commande : le mainteneur (OWNER) peut modifier scripts/', () => {
  const result = run(['scripts/lib/check.mjs', '.github/CODEOWNERS'], 'OWNER');
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Auteur de confiance \(OWNER\)/);
});

test('commande : le statut peut venir de la variable AUTHOR_ASSOCIATION (comme dans le workflow)', () => {
  assert.equal(run(['scripts/x.mjs'], undefined, { env: { AUTHOR_ASSOCIATION: 'COLLABORATOR' } }).status, 0);
  const missing = run(['scripts/x.mjs'], undefined);
  assert.equal(missing.status, 1, 'sans statut connu : règle stricte');
  assert.match(missing.stderr, /votre statut sur ce dépôt est inconnu/i);
});

test('commande : Dependabot est exempté (option --login ou variable AUTHOR_LOGIN) et le message rappelle la revue de propriétaire', () => {
  for (const result of [run(DEPENDABOT_FILES, 'NONE', { login: 'dependabot[bot]' }), run(DEPENDABOT_FILES, undefined, { env: { AUTHOR_ASSOCIATION: 'NONE', AUTHOR_LOGIN: 'dependabot[bot]' } })]) {
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Auteur exempté du contrôle de périmètre \(dependabot\[bot\]\)/);
    assert.match(result.stdout, /reste soumise à la revue de propriétaire \(Code Owners\)/);
  }
});

test('commande : un faux Dependabot est refusé comme n\'importe quelle personne extérieure', () => {
  const result = run(DEPENDABOT_FILES, 'CONTRIBUTOR', { login: 'dependabot-bot' });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /- \.github\/workflows\/validate\.yml/);
});

test('commande : beaucoup de fichiers hors périmètre sont résumés', () => {
  const result = run(Array.from({ length: 25 }, (_, i) => `scripts/f${i}.mjs`), 'NONE');
  assert.equal(result.status, 1);
  assert.match(result.stderr, /… et 5 autre\(s\)/);
});

test('sécurité : un nom de fichier piégé ne peut pas injecter de commande « :: » dans les logs', () => {
  const result = run(['scripts/a\n::error::boom.mjs', 'scripts/b\r::set-output name=x::y'], 'NONE');
  assert.equal(result.status, 1);
  const commands = result.stderr.split('\n').filter((line) => line.startsWith('::'));
  assert.equal(commands.length, 1, 'seule l\'annotation légitime du script est une commande');
  assert.match(commands[0], /^::error title=Contrôle de périmètre::2 fichier\(s\) modifié\(s\) en dehors de data\/$/);
});

test('commande : sans liste sur l\'entrée ou avec une option inconnue, elle explique l\'usage (code 2)', () => {
  const unknown = spawnSync(process.execPath, [SCRIPT, '--bidule'], { input: '', encoding: 'utf8' });
  assert.equal(unknown.status, 2);
  assert.match(unknown.stderr, /Options non comprises/);
});

// ------------------------------------------------------------------ le vrai chemin : git, comme dans le workflow
const git = (cwd, ...args) => spawnSync('git', ['-c', 'commit.gpgsign=false', '-c', 'core.hooksPath=/dev/null', ...args], {
  cwd, encoding: 'utf8',
  env: { ...process.env, GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@example.org', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@example.org', GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_SYSTEM: '/dev/null' },
});
const hasGit = spawnSync('git', ['--version']).status === 0;

/** Construit un dépôt « main », une branche de PR qui applique `change`, puis la fusion (comme refs/pull/N/merge). */
function makePullRequest(change) {
  const repo = mkdtempSync(path.join(tmpdir(), 'book-tree-pr-'));
  const put = (rel, text = 'x\n') => { mkdirSync(path.dirname(path.join(repo, rel)), { recursive: true }); writeFileSync(path.join(repo, rel), text); };
  git(repo, 'init', '-q', '-b', 'main');
  put('data/a.json', '{"a":1}\n');
  put('scripts/check.mjs', 'export {};\n');
  put('README.md', 'lisez-moi\n');
  git(repo, 'add', '-A'); git(repo, 'commit', '-q', '-m', 'main');
  git(repo, 'checkout', '-q', '-b', 'pr');
  change({ repo, put, rename: (a, b) => { mkdirSync(path.dirname(path.join(repo, b)), { recursive: true }); renameSync(path.join(repo, a), path.join(repo, b)); } });
  git(repo, 'add', '-A'); git(repo, 'commit', '-q', '-m', 'pr');
  git(repo, 'checkout', '-q', 'main');
  // La branche main avance pendant que la PR est ouverte : elle ne doit PAS apparaître comme modifiée par la PR.
  put('docs/nouveau.md', 'ajout du mainteneur\n');
  git(repo, 'add', '-A'); git(repo, 'commit', '-q', '-m', 'main avance');
  git(repo, 'merge', '-q', '--no-ff', '-m', 'merge de la PR', 'pr');
  return repo;
}
// La commande exacte du workflow.
const scopeOfMerge = (repo, association) => spawnSync('bash', ['-c', `set -o pipefail; git diff --name-only --no-renames -z HEAD^1 HEAD | node "${SCRIPT}"`], {
  cwd: repo, encoding: 'utf8', env: { ...process.env, AUTHOR_ASSOCIATION: association, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_SYSTEM: '/dev/null' },
});

test('git : une PR qui ne touche que data/ passe, même si main a avancé depuis (docs/nouveau.md n\'est pas compté)', { skip: !hasGit }, () => {
  const repo = makePullRequest(({ put }) => put('data/b.json', '{"b":2}\n'));
  try {
    const result = scopeOfMerge(repo, 'NONE');
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /les 1 fichier modifié sont tous dans data\//);
  } finally { rmSync(repo, { recursive: true, force: true }); }
});

test('git : une PR qui modifie scripts/ est refusée pour une personne extérieure', { skip: !hasGit }, () => {
  const repo = makePullRequest(({ put }) => { put('data/b.json'); put('scripts/check.mjs', 'export const truc = 1;\n'); });
  try {
    const result = scopeOfMerge(repo, 'CONTRIBUTOR');
    assert.equal(result.status, 1);
    assert.match(result.stderr, /^ {2}- scripts\/check\.mjs$/m);
    assert.equal(scopeOfMerge(repo, 'OWNER').status, 0, 'le mainteneur peut');
  } finally { rmSync(repo, { recursive: true, force: true }); }
});

test('git : une PR de Dependabot (.github/ et package.json) passe, la même PR d\'un inconnu est refusée', { skip: !hasGit }, () => {
  const repo = makePullRequest(({ put }) => { put('.github/workflows/validate.yml', 'name: validate\n'); put('package.json', '{}\n'); });
  try {
    const bot = spawnSync('bash', ['-c', `set -o pipefail; git diff --name-only --no-renames -z HEAD^1 HEAD | node "${SCRIPT}"`], {
      cwd: repo, encoding: 'utf8', env: { ...process.env, AUTHOR_ASSOCIATION: 'NONE', AUTHOR_LOGIN: 'dependabot[bot]', GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_SYSTEM: '/dev/null' },
    });
    assert.equal(bot.status, 0, bot.stderr);
    assert.equal(scopeOfMerge(repo, 'NONE').status, 1, 'sans le nom de Dependabot, la PR est refusée');
  } finally { rmSync(repo, { recursive: true, force: true }); }
});

test('git : déplacer scripts/check.mjs vers data/ ne contourne pas le contrôle (renommage)', { skip: !hasGit }, () => {
  const repo = makePullRequest(({ rename }) => rename('scripts/check.mjs', 'data/check.json'));
  try {
    const result = scopeOfMerge(repo, 'NONE');
    assert.equal(result.status, 1, 'le fichier a quitté scripts/ : c\'est une modification de scripts/');
    assert.match(result.stderr, /^ {2}- scripts\/check\.mjs$/m);
  } finally { rmSync(repo, { recursive: true, force: true }); }
});

test('git : supprimer un fichier de scripts/ ou modifier README.md est refusé', { skip: !hasGit }, () => {
  const repo = makePullRequest(({ repo: root, put }) => { rmSync(path.join(root, 'scripts/check.mjs')); put('README.md', 'modifié\n'); });
  try {
    const result = scopeOfMerge(repo, 'NONE');
    assert.equal(result.status, 1);
    assert.match(result.stderr, /- scripts\/check\.mjs/);
    assert.match(result.stderr, /- README\.md/);
  } finally { rmSync(repo, { recursive: true, force: true }); }
});

test('git : un nom de fichier avec espaces et retour à la ligne est traité sans injection', { skip: !hasGit || process.platform === 'win32' }, () => {
  const repo = makePullRequest(({ put }) => { put('data/un fichier.json'); put('scripts/piege\n::error::boom.mjs'); });
  try {
    const result = scopeOfMerge(repo, 'NONE');
    assert.equal(result.status, 1);
    assert.equal(result.stderr.split('\n').some((line) => line.startsWith('::error::boom')), false);
    assert.equal(result.stderr.includes('data/un fichier.json'), false, 'le fichier de data/ avec espace est accepté');
  } finally { rmSync(repo, { recursive: true, force: true }); }
});
