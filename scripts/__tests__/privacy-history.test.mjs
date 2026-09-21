// « npm run privacy:history » : le contrôle de l'historique git avant publication, sur de vrais dépôts temporaires.
// Les adresses et chemins d'exemple sont assemblés à l'exécution : ce fichier ne contient rien de réel.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { checkHistory } from '../lib/privacy-history.mjs';
import { ROOT_DIR } from '../lib/paths.mjs';
import { SCRIPTS_DIR } from './helpers.mjs';

// Ni la configuration git de la personne qui lance ces tests, ni celle du système, ne doivent influencer le résultat.
process.env.GIT_CONFIG_GLOBAL = '/dev/null';
process.env.GIT_CONFIG_SYSTEM = '/dev/null';

const hasGit = spawnSync('git', ['--version']).status === 0;
const skip = !hasGit ? 'git est absent' : process.platform === 'win32' ? 'ces tests utilisent /dev/null' : false;

const NOREPLY = `123456+demo${'@'}users.noreply.github.com`;
const REAL_EMAIL = ['alice.martin', 'perso.fr'].join('@'); // « adresse personnelle » d'exemple
const OTHER_EMAIL = ['bob.durand', 'travail.fr'].join('@');
const HOME_PATH = ['', 'home', 'alice', 'projet'].join('/'); // « chemin d'ordinateur » d'exemple
const HOME_FOLDER = ['', 'home', 'alice'].join('/'); // ce que le détecteur repère : le dossier personnel

const git = (repo, args, env = {}) => spawnSync('git', args, {
  cwd: repo, encoding: 'utf8',
  env: { ...process.env, GIT_AUTHOR_NAME: 'Demo', GIT_AUTHOR_EMAIL: NOREPLY, GIT_COMMITTER_NAME: 'Demo', GIT_COMMITTER_EMAIL: NOREPLY, ...env },
});

/** Un dépôt temporaire dont l'identité locale est l'adresse noreply. */
function makeRepo() {
  const repo = mkdtempSync(path.join(tmpdir(), 'book-tree-privacy-'));
  git(repo, ['init', '-q', '-b', 'main']);
  git(repo, ['config', '--local', 'user.email', NOREPLY]);
  git(repo, ['config', '--local', 'user.name', 'Demo']);
  const put = (rel, text) => { mkdirSync(path.dirname(path.join(repo, rel)), { recursive: true }); writeFileSync(path.join(repo, rel), text); };
  const commit = (message, { files = {}, remove = [], author = NOREPLY, committer = author } = {}) => {
    for (const [rel, text] of Object.entries(files)) put(rel, text);
    for (const rel of remove) rmSync(path.join(repo, rel));
    git(repo, ['add', '-A']);
    const result = git(repo, ['-c', 'commit.gpgsign=false', 'commit', '-q', '-m', message], { GIT_AUTHOR_EMAIL: author, GIT_COMMITTER_EMAIL: committer });
    assert.equal(result.status, 0, result.stderr);
    return git(repo, ['rev-parse', '--short', 'HEAD']).stdout.trim();
  };
  return { repo, put, commit, git: (...args) => git(repo, args), cleanup: () => rmSync(repo, { recursive: true, force: true }) };
}
/** Copie dans un dépôt de test la partie « fichiers » du contrôle de confidentialité et ce qu'elle relit. */
function copyPrivacyFiles(repo) {
  for (const rel of ['scripts/lib/paths.mjs', 'scripts/lib/privacy.mjs', 'scripts/lib/privacy-history.mjs', 'scripts/privacy-history.mjs',
    'scripts/__tests__/privacy.test.mjs', 'scripts/__tests__/privacy-history.test.mjs']) {
    mkdirSync(path.dirname(path.join(repo, rel)), { recursive: true });
    cpSync(path.join(ROOT_DIR, rel), path.join(repo, rel));
  }
}
const withRepo = (fn) => () => { const r = makeRepo(); try { return fn(r); } finally { r.cleanup(); } };
const found = (result) => result.problems.map((p) => p.value);

// ------------------------------------------------------------------ un dépôt propre
test('historique : un dépôt propre est accepté (noreply, mention Co-Authored-By noreply, adresse d\'exemple)', { skip }, withRepo(({ repo, commit }) => {
  commit('Premier commit', { files: { 'a.md': `Écrire à contact${'@'}example.org\n` } });
  commit(`Deuxième commit\n\nCo-Authored-By: Un assistant <noreply${'@'}fournisseur.io>`, { files: { 'b.md': 'ok\n' } });
  const result = checkHistory(repo);
  assert.deepEqual(result.problems, []);
  assert.equal(result.ok, true);
  assert.equal(result.commitCount, 2);
  assert.deepEqual(result.identities, [`Demo <${NOREPLY}>`]);
}));

test('historique : dossier qui n\'est pas un dépôt git', { skip }, () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'book-tree-nogit-'));
  try {
    assert.deepEqual(checkHistory(dir), { ok: false, notARepo: true });
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

// ------------------------------------------------------------------ 1 et 2 : identités et messages
test('historique : l\'e-mail de l\'AUTEUR d\'un commit est repéré', { skip }, withRepo(({ repo, commit }) => {
  const hash = commit('Ajoute un fichier', { files: { 'a.md': 'x\n' }, author: REAL_EMAIL, committer: NOREPLY });
  const result = checkHistory(repo);
  assert.equal(result.ok, false);
  assert.deepEqual(result.problems.map((p) => [p.where, p.value]), [[`commit ${hash} (« Ajoute un fichier »), auteur`, REAL_EMAIL]]);
  assert.ok(result.identities.some((i) => i.includes(REAL_EMAIL)), 'l\'identité apparaît dans la liste à vérifier');
}));

test('historique : l\'e-mail du VALIDATEUR (committer) est repéré, même si l\'auteur est anonyme', { skip }, withRepo(({ repo, commit }) => {
  commit('Fusion', { files: { 'a.md': 'x\n' }, author: NOREPLY, committer: OTHER_EMAIL });
  const result = checkHistory(repo);
  assert.deepEqual(found(result), [OTHER_EMAIL]);
  assert.match(result.problems[0].where, /validateur \(committer\)/);
}));

test('historique : un e-mail dans le MESSAGE d\'un commit est repéré', { skip }, withRepo(({ repo, commit }) => {
  commit(`Merci à quelqu'un\n\nSignalé par ${REAL_EMAIL}`, { files: { 'a.md': 'x\n' } });
  const result = checkHistory(repo);
  assert.deepEqual(found(result), [REAL_EMAIL]);
  assert.match(result.problems[0].where, /message$/);
}));

// ------------------------------------------------------------------ 3 : le contenu passé des fichiers
test('historique : une fuite dans un fichier SUPPRIMÉ depuis est repérée (l\'historique publié la contient toujours)', { skip }, withRepo(({ repo, commit }) => {
  const leaky = commit('Notes de travail', { files: { 'notes.txt': `mes notes dans ${HOME_PATH}\ncontact : ${REAL_EMAIL}\n` } });
  commit('Retire les notes', { remove: ['notes.txt'] });
  const result = checkHistory(repo);
  assert.deepEqual(found(result).sort(), [REAL_EMAIL, HOME_FOLDER].sort());
  for (const problem of result.problems) assert.match(problem.where, new RegExp(`^commit ${leaky} .*fichier notes\\.txt$`));
}));

test('historique : une fuite sur une AUTRE branche est repérée (toutes les branches sont examinées)', { skip }, withRepo(({ repo, commit, git: run }) => {
  commit('Base', { files: { 'a.md': 'x\n' } });
  run('checkout', '-q', '-b', 'essai');
  commit('Sur une branche', { files: { 'b.md': `voir ${HOME_PATH}\n` } });
  run('checkout', '-q', 'main');
  assert.deepEqual(found(checkHistory(repo)), [HOME_FOLDER]);
}));

test('historique : l\'auteur et le message d\'un commit sur une AUTRE branche sont aussi examinés', { skip }, withRepo(({ repo, commit, git: run }) => {
  commit('Base', { files: { 'a.md': 'x\n' } });
  run('checkout', '-q', '-b', 'essai');
  const hash = commit(`Sur une branche\n\nMerci à ${OTHER_EMAIL}`, { files: { 'b.md': 'propre\n' }, author: REAL_EMAIL, committer: NOREPLY });
  run('checkout', '-q', 'main'); // la branche « essai » n'est plus celle qu'on regarde : seul « --all » la voit
  const result = checkHistory(repo);
  assert.deepEqual(result.problems.map((p) => [p.where, p.value]).sort(), [
    [`commit ${hash} (« Sur une branche »), auteur`, REAL_EMAIL],
    [`commit ${hash} (« Sur une branche »), message`, OTHER_EMAIL],
  ].sort());
}));

test('historique : la même fuite n\'est signalée qu\'une fois par emplacement', { skip }, withRepo(({ repo, commit }) => {
  commit('Deux fois', { files: { 'a.md': `${REAL_EMAIL} et encore ${REAL_EMAIL}\n` } });
  const emails = checkHistory(repo).problems.filter((p) => p.value === REAL_EMAIL && p.where.includes('fichier a.md'));
  assert.equal(emails.length, 1);
}));

// ------------------------------------------------------------------ 4, 5 et 6
test('historique : un nom de branche ou d\'étiquette qui contient un e-mail est repéré', { skip }, withRepo(({ repo, commit, git: run }) => {
  commit('Base', { files: { 'a.md': 'x\n' } });
  run('branch', `correctif/${REAL_EMAIL}`);
  const result = checkHistory(repo);
  assert.deepEqual(found(result), [REAL_EMAIL]);
  assert.match(result.problems[0].where, /nom de branche ou d'étiquette/);
}));

test('historique : un fichier pas encore ajouté à git est examiné, mais pas un fichier ignoré par .gitignore', { skip }, withRepo(({ repo, put, commit }) => {
  commit('Base', { files: { '.gitignore': '.claude/\n', 'a.md': 'x\n' } });
  put('brouillon.md', `chemin : ${HOME_PATH}\n`); // neuf, pas ajouté : il serait publié au prochain commit
  put('.claude/settings.local.json', `{"path":"${HOME_PATH}"}\n`); // ignoré : ne sera jamais publié
  const result = checkHistory(repo);
  assert.deepEqual(result.problems.map((p) => p.where), ['fichier actuel brouillon.md']);
}));

test('historique : l\'identité des PROCHAINS commits est vérifiée (adresse personnelle, ou aucune adresse)', { skip }, withRepo(({ repo, commit, git: run }) => {
  commit('Base', { files: { 'a.md': 'x\n' } });
  run('config', '--local', 'user.email', REAL_EMAIL);
  const personal = checkHistory(repo);
  assert.deepEqual(found(personal), [REAL_EMAIL]);
  assert.match(personal.problems[0].where, /identité git des prochains commits/);

  run('config', '--local', '--unset', 'user.email');
  const none = checkHistory(repo);
  assert.equal(none.ok, false);
  assert.equal(none.problems[0].kind, 'configuration');
}));

// ------------------------------------------------------------------ la commande
const cli = (repo, args = []) => spawnSync(process.execPath, [path.join(SCRIPTS_DIR, 'privacy-history.mjs'), '--repo', repo, ...args], {
  encoding: 'utf8', env: { ...process.env, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_SYSTEM: '/dev/null' },
});

test('commande : sur un dépôt propre, affiche les identités à vérifier et réussit (code 0)', { skip }, withRepo(({ repo, commit }) => {
  commit('Premier', { files: { 'a.md': 'x\n' } });
  const result = cli(repo);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /1 commit examiné \(toutes les branches\)/);
  assert.ok(result.stdout.includes(`  - Demo <${NOREPLY}>`));
  assert.match(result.stdout, /Vérifiez aussi les NOMS/);
  assert.match(result.stdout, /✓ Aucune adresse e-mail personnelle ni aucun chemin de votre ordinateur/);
  assert.equal(result.stdout.includes(repo), false, 'le chemin du dépôt n\'est pas affiché');
}));

test('commande : en cas de fuite, liste chaque emplacement et sort en erreur (code 1)', { skip }, withRepo(({ repo, commit }) => {
  const hash = commit('Notes', { files: { 'notes.txt': `contact ${REAL_EMAIL}\n` }, author: OTHER_EMAIL });
  const result = cli(repo);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /✗ \d+ problèmes? : ces informations deviendraient PUBLIQUES au premier envoi/);
  assert.ok(result.stderr.includes(`commit ${hash} (« Notes »), auteur`));
  assert.ok(result.stderr.includes(`adresse e-mail : ${REAL_EMAIL}`));
  assert.match(result.stderr, /NE PUBLIEZ PAS/);
  assert.match(result.stderr, /git config --local user\.email/);
}));

test('commande : hors d\'un dépôt git, explique et sort avec le code 2', { skip }, () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'book-tree-nogit-'));
  try {
    const result = cli(dir);
    assert.equal(result.status, 2);
    assert.match(result.stderr, /n'est pas un dépôt git/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('le script est branché sur « npm run privacy:history »', async () => {
  const { readFileSync } = await import('node:fs');
  const pkg = JSON.parse(readFileSync(path.join(ROOT_DIR, 'package.json'), 'utf8'));
  assert.equal(pkg.scripts['privacy:history'], 'node scripts/privacy-history.mjs');
  assert.doesNotMatch(pkg.scripts.test, /privacy/, 'le contrôle de l\'historique n\'est pas dans « npm test »');
});

// ------------------------------------------------------------------ le point important : « npm test » n'échoue pas chez un contributeur
test('« npm test » (partie confidentialité) ne dépend pas de l\'historique : elle réussit même si les commits portent un e-mail personnel', { skip }, withRepo(({ repo, commit }) => {
  // Le dépôt d'un contributeur : la partie « fichiers » du contrôle, et des commits signés avec son vrai e-mail.
  copyPrivacyFiles(repo);
  writeFileSync(path.join(repo, '.gitignore'), '.claude/\nCLAUDE.local.md\n.env\nnode_modules/\n');
  commit('Contribution', { author: REAL_EMAIL, committer: OTHER_EMAIL });
  assert.equal(checkHistory(repo).ok, false, 'le contrôle d\'historique, lui, signale bien ces commits');

  const env = { ...process.env };
  delete env.NODE_TEST_CONTEXT; // sinon « node --test » lancé depuis un test ne cherche rien
  const result = spawnSync(process.execPath, ['--test', 'scripts/__tests__/privacy.test.mjs'], { cwd: repo, encoding: 'utf8', env });
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout, /(ℹ|#) pass \d+/);
  assert.match(result.stdout, /(ℹ|#) fail 0/);
}));

test('« npm test » (partie confidentialité) échoue quand même si un FICHIER suivi contient une donnée personnelle', { skip }, withRepo(({ repo, commit }) => {
  copyPrivacyFiles(repo);
  writeFileSync(path.join(repo, '.gitignore'), '.claude/\nCLAUDE.local.md\n.env\nnode_modules/\n');
  commit('Fuite dans un fichier', { files: { 'notes.md': `écrit dans ${HOME_PATH}\n` } });
  const env = { ...process.env };
  delete env.NODE_TEST_CONTEXT;
  const result = spawnSync(process.execPath, ['--test', 'scripts/__tests__/privacy.test.mjs'], { cwd: repo, encoding: 'utf8', env });
  assert.notEqual(result.status, 0);
}));
