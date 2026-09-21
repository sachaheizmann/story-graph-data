// Avertissements non bloquants, annotations GitHub, sorties « sûres » et liens symboliques.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { checkDataset } from '../lib/check.mjs';
import { formatDataset } from '../lib/format.mjs';
import { formatIssues, githubAnnotation, makeIssue, oneLine } from '../lib/issues.mjs';
import { DATA_DIR } from '../lib/paths.mjs';
import { ED, SAGA, SCRIPTS_DIR, assertIssue, issuesFor, makeDataset } from './helpers.mjs';

const REL = `${ED}/relations.json`;
const at = (chapter, book = 1) => ({ book: `tome-${book}`, chapter });
const runCheck = (dataDir, env = {}) => spawnSync(process.execPath, [path.join(SCRIPTS_DIR, 'check.mjs'), '--data', dataDir], {
  encoding: 'utf8',
  env: { ...process.env, GITHUB_ACTIONS: '', ...env },
});

// « cat » disparaît au tome 2, chapitre 2 ; le lien parent ann→cat commence au tome 1, chapitre 3.
const endParentLinkWhereCatEnds = (d) => d.edit(REL, (list) => { list[1].end = at(2, 2); });

// ------------------------------------------------------------------ la règle
test('avertissement : un lien familial qui se termine à la mort d\'un personnage est signalé, sans bloquer', () => {
  const dataset = makeDataset(endParentLinkWhereCatEnds);
  try {
    const { errors, warnings } = checkDataset(dataset.dataDir);
    assert.equal(errors.length, 0, 'ce n\'est pas une erreur');
    assert.equal(warnings.length, 1);
    const [warning] = warnings;
    assert.equal(warning.rule, 'family.end-at-death');
    assert.equal(warning.severity, 'warning');
    assert.match(warning.message, /« ann-cat-parent-1 » \(parent_of\) se termine \(tome-2, chapitre 2\).*mort ou le départ de « cat »/);
    assert.match(warning.fix, /« end » du PERSONNAGE.*characters\/cat\.json/);
    assert.match(warning.fix, /Edrin meurt.*mariage avec Maelis reste/);
    assert.match(warning.fix, /divorce/, 'on explique quand ignorer l\'avertissement');
    assert.equal(warning.reminder, true);
  } finally { dataset.cleanup(); }
});

test('avertissement : vaut aussi pour le personnage « from » du lien', () => {
  const issues = issuesFor((d) => {
    d.edit(`${ED}/characters/ann.json`, (c) => { c.end = at(3, 2); });
    d.edit(REL, (list) => { list[0].end = at(3, 2); }); // ann-bob-sibling-1
  });
  assertIssue(issues, 'family.end-at-death', /« ann-bob-sibling-1 » \(sibling_of\).*« ann »/);
});

test('avertissement : pas d\'avertissement si le lien familial n\'a pas de « end » (le cas correct)', () => {
  const issues = issuesFor(() => {});
  assert.equal(issues.filter((i) => i.severity === 'warning').length, 0);
});

test('avertissement : pas d\'avertissement si le « end » du lien tombe à un autre endroit', () => {
  const issues = issuesFor((d) => d.edit(REL, (list) => { list[1].end = at(1, 2); }));
  assert.equal(issues.filter((i) => i.rule === 'family.end-at-death').length, 0);
});

test('avertissement : pas d\'avertissement pour un lien qui n\'est pas familial (une alliance peut finir avec une mort)', () => {
  const issues = issuesFor((d) => d.edit(REL, (list) => { list[2].end = at(2, 2); })); // bob-cat-ally-1, social
  assert.equal(issues.length, 0);
});

test('la saga de démonstration n\'a aucun avertissement (le mariage d\'Edrin et Maelis n\'a pas de « end »)', () => {
  const { warnings } = checkDataset(DATA_DIR);
  assert.deepEqual(warnings, []);
});

// ------------------------------------------------------------------ la commande
test('check : un avertissement seul n\'empêche pas la réussite (code 0) mais s\'affiche', () => {
  const dataset = makeDataset(endParentLinkWhereCatEnds);
  try {
    const result = runCheck(dataset.dataDir);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stderr, /⚠ Avertissement : Le lien familial « ann-cat-parent-1 »/);
    assert.match(result.stderr, /1 avertissement \(ne bloque pas la validation\)/);
    assert.match(result.stdout, /✓ \d+ fichiers vérifiés, aucun problème \(1 avertissement, voir ci-dessus\)/);
  } finally { dataset.cleanup(); }
});

test('check : un avertissement accompagné d\'une erreur sort en erreur (code 1) et affiche les deux', () => {
  const dataset = makeDataset((d) => {
    endParentLinkWhereCatEnds(d);
    d.edit(REL, (list) => { list[0].to = 'zoe'; });
  });
  try {
    const result = runCheck(dataset.dataDir);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /✗ .*« to » désigne « zoe »/);
    assert.match(result.stderr, /⚠ Avertissement/);
    assert.match(result.stderr, /1 problème dans 1 fichier\. 1 avertissement/);
  } finally { dataset.cleanup(); }
});

// ------------------------------------------------------------------ annotations GitHub
test('annotations : dans GitHub Actions, un avertissement devient « ::warning file=…,title=…:: »', () => {
  const dataset = makeDataset(endParentLinkWhereCatEnds);
  try {
    const result = runCheck(dataset.dataDir, { GITHUB_ACTIONS: 'true' });
    assert.equal(result.status, 0);
    const lines = result.stdout.split('\n').filter((l) => l.startsWith('::'));
    assert.equal(lines.length, 1);
    assert.match(lines[0], /^::warning file=data\/mini-saga\/editions\/fr-a\/relations\.json,title=family\.end-at-death::Le lien familial « ann-cat-parent-1 »/);
  } finally { dataset.cleanup(); }
});

test('annotations : une erreur devient « ::error … » dans GitHub Actions', () => {
  const dataset = makeDataset((d) => d.edit(REL, (list) => { list[0].to = 'zoe'; }));
  try {
    const result = runCheck(dataset.dataDir, { GITHUB_ACTIONS: 'true' });
    assert.equal(result.status, 1);
    assert.match(result.stdout, /^::error file=data\/mini-saga\/editions\/fr-a\/relations\.json,title=ref\.character-unknown::/m);
  } finally { dataset.cleanup(); }
});

test('annotations : hors de GitHub Actions, aucune ligne « :: » n\'est affichée', () => {
  const dataset = makeDataset(endParentLinkWhereCatEnds);
  try {
    const result = runCheck(dataset.dataDir);
    assert.equal(/^::/m.test(result.stdout + result.stderr), false);
  } finally { dataset.cleanup(); }
});

test('annotations : les caractères spéciaux sont protégés (%, retours à la ligne, « : » et « , » dans le chemin)', () => {
  const line = githubAnnotation(makeIssue('data/a,b:c.json', 'x.y', '100 % faux\nligne 2', { severity: 'warning', fix: 'Corrigez.' }));
  assert.equal(line, '::warning file=data/a%2Cb%3Ac.json,title=x.y::100 %25 faux ligne 2 → Corrigez.');
  assert.equal(line.includes('\n'), false);
});

// ------------------------------------------------------------------ sorties sûres
test('sécurité : « oneLine » supprime les retours à la ligne et caractères de contrôle', () => {
  assert.equal(oneLine('a\nb\r\n::error::x\u0007y'), 'a b ::error::x y');
});

test('sécurité : un nom de fichier piégé ne peut pas injecter une commande « :: » dans les logs', () => {
  const dataset = makeDataset((d) => d.writeText(`${SAGA}/a\n::error::boom.json`, '{}'));
  try {
    const result = runCheck(dataset.dataDir, { GITHUB_ACTIONS: 'true' });
    assert.equal(result.status, 1);
    const all = `${result.stdout}\n${result.stderr}`.split('\n');
    const commands = all.filter((line) => line.startsWith('::'));
    assert.ok(commands.length > 0, 'l\'annotation légitime existe');
    for (const line of commands) assert.match(line, /^::error file=[^\n]*,title=files\.name::/, `ligne suspecte : ${line}`);
    assert.equal(all.some((line) => line.startsWith('::error::boom')), false);
  } finally { dataset.cleanup(); }
});

test('sécurité : le texte affiché tient sur une seule ligne par message', () => {
  const text = formatIssues([makeIssue('data/x.json', 'r', 'ligne 1\n::error::boom', { fix: 'a\nb' })]);
  assert.equal(text.split('\n').some((line) => line.startsWith('::')), false);
});

// ------------------------------------------------------------------ liens symboliques
test('sécurité : un lien symbolique dans data/ est refusé', { skip: process.platform === 'win32' }, () => {
  const dataset = makeDataset((d) => symlinkSync(d.at(`${ED}/edition.json`), d.at(`${SAGA}/raccourci.json`)));
  try {
    const { issues } = checkDataset(dataset.dataDir);
    assertIssue(issues, 'files.symlink', /lien symbolique/, { file: 'raccourci.json' });
  } finally { dataset.cleanup(); }
});

test('sécurité : « npm run format » ne réécrit jamais un fichier situé derrière un lien symbolique', { skip: process.platform === 'win32' }, () => {
  const outside = mkdtempSync(path.join(tmpdir(), 'book-tree-outside-'));
  const target = path.join(outside, 'secret.json');
  writeFileSync(target, '{"a":1}');
  const dataset = makeDataset((d) => symlinkSync(target, d.at(`${ED}/characters/piege.json`)));
  try {
    formatDataset(dataset.dataDir, { write: true });
    assert.equal(readFileSync(target, 'utf8'), '{"a":1}', 'le fichier extérieur est intact');
  } finally { dataset.cleanup(); rmSync(outside, { recursive: true, force: true }); }
});
