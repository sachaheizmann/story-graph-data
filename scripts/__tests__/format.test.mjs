// Règle 10 et « npm run format » : format canonique des fichiers de data/.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { canonicalJson, canonicalMarkdown, canonicalText, formatDataset } from '../lib/format.mjs';
import { checkDataset } from '../lib/check.mjs';
import { DATA_DIR } from '../lib/paths.mjs';
import { ED, SAGA, SCRIPTS_DIR, VALID_DATA, assertIssue, issuesFor, makeDataset } from './helpers.mjs';

const REL = `${ED}/relations.json`;
const TYPES = { ally: { category: 'social', directed: false }, parent_of: { category: 'family', directed: true } };

// ------------------------------------------------------------------ fonctions de mise en forme
test('les clés d\'un personnage suivent l\'ordre du schéma (id, start, end), positions comprises', () => {
  const messy = { end: null, start: { chapter: 3, book: 'tome-1' }, id: 'aria' };
  assert.equal(canonicalJson('character', messy),
    '{\n  "id": "aria",\n  "start": {\n    "book": "tome-1",\n    "chapter": 3\n  },\n  "end": null\n}\n');
});

test('l\'indentation est de 2 espaces et le fichier finit par un retour à la ligne', () => {
  const text = canonicalJson('author', { born: 1975, id: 'alex-morel' });
  assert.equal(text, '{\n  "id": "alex-morel",\n  "born": 1975\n}\n');
});

test('les clés inconnues sont gardées, à la fin, dans leur ordre d\'origine', () => {
  const text = canonicalJson('character', { zzz: 1, id: 'a', aaa: 2, start: { book: 'tome-1', chapter: 1 } });
  assert.deepEqual(Object.keys(JSON.parse(text)), ['id', 'start', 'zzz', 'aaa']);
});

test('les dictionnaires (types de liens) sont triés par ordre alphabétique, entrées comprises', () => {
  const text = canonicalJson('relationTypes', {
    spouse_of: { directed: false, category: 'family' },
    ally: { directed: false, category: 'social' },
  });
  const parsed = JSON.parse(text);
  assert.deepEqual(Object.keys(parsed), ['ally', 'spouse_of']);
  assert.deepEqual(Object.keys(parsed.ally), ['category', 'directed']);
});

test('les listes gardent leur ordre (aliases, created_by, books) mais relations.json est trié par id', () => {
  const edition = canonicalJson('edition', {
    books: [{ chapters: 3, id: 'tome-2', title: 'B' }, { chapters: 3, id: 'tome-1', title: 'A' }],
    created_by: ['zed', 'amy'], based_on: null, year: 2000, publisher: 'P', language: 'fr', id: 'x',
  });
  assert.deepEqual(JSON.parse(edition).books.map((b) => b.id), ['tome-2', 'tome-1']);
  assert.deepEqual(JSON.parse(edition).created_by, ['zed', 'amy']);

  const start = { book: 'tome-1', chapter: 1 };
  const relations = canonicalJson('relations', [
    { id: 'b-c-ally-1', from: 'b', to: 'c', type: 'ally', start },
    { id: 'a-b-ally-1', from: 'a', to: 'b', type: 'ally', start },
  ], { relationTypes: TYPES });
  assert.deepEqual(JSON.parse(relations).map((r) => r.id), ['a-b-ally-1', 'b-c-ally-1']);
});

test('un lien non orienté est remis dans l\'ordre alphabétique, un lien orienté n\'est pas touché', () => {
  const start = { book: 'tome-1', chapter: 1 };
  const result = JSON.parse(canonicalJson('relations', [
    { id: 'kael-aria-ally-1', from: 'kael', to: 'aria', type: 'ally', start },
    { id: 'zed-amy-parent-1', from: 'zed', to: 'amy', type: 'parent_of', start },
  ], { relationTypes: TYPES }));
  assert.deepEqual([result[0].from, result[0].to], ['aria', 'kael']);
  assert.deepEqual([result[1].from, result[1].to], ['zed', 'amy']);
});

test('le formatage est idempotent : formater deux fois donne le même résultat', () => {
  const once = canonicalJson('relations', [{ id: 'b', from: 'z', to: 'a', type: 'ally', start: { chapter: 1, book: 't' } }], { relationTypes: TYPES });
  assert.equal(canonicalText('relations', once, { relationTypes: TYPES }), once);
});

test('Markdown : LF, sans BOM, un seul retour à la ligne final', () => {
  assert.equal(canonicalMarkdown('Une ligne.\r\nUne autre.\r\n\r\n\r\n'), 'Une ligne.\nUne autre.\n');
  assert.equal(canonicalMarkdown('﻿Sans retour final'), 'Sans retour final\n');
  assert.equal(canonicalMarkdown('Deux espaces = saut de ligne Markdown  \nsuite\n'), 'Deux espaces = saut de ligne Markdown  \nsuite\n');
});

test('un JSON illisible renvoie null (le contrôle le signale ailleurs)', () => {
  assert.equal(canonicalText('character', '{ pas du json'), null);
});

// ------------------------------------------------------------------ règle 10 dans « npm run check »
test('règle 10 : une indentation de 4 espaces est refusée, avec la commande qui corrige', () => {
  const issues = issuesFor((d) => d.writeText(`${ED}/characters/bob.json`, JSON.stringify(d.readJson(`${ED}/characters/bob.json`), null, 4)));
  const found = assertIssue(issues, 'format.not-canonical', /n'est pas au format canonique/, { file: 'characters/bob.json' });
  assert.match(found.fix, /npm run format/);
});

test('règle 10 : des clés dans le désordre sont refusées', () => {
  const issues = issuesFor((d) => d.writeText(`${ED}/characters/bob.json`, `${JSON.stringify({ end: null, start: { chapter: 2, book: 'tome-1' }, id: 'bob' }, null, 2)}\n`));
  assertIssue(issues, 'format.not-canonical', /clés dans l'ordre du schéma/);
});

test('règle 10 : des fins de ligne Windows (CRLF) sont refusées', () => {
  const issues = issuesFor((d) => d.writeText(`${ED}/characters/bob.json`, readFileSync(d.at(`${ED}/characters/bob.json`), 'utf8').replace(/\n/g, '\r\n')));
  assertIssue(issues, 'format.not-canonical', /fin de ligne LF/);
});

test('règle 10 : l\'absence de retour à la ligne final est refusée', () => {
  const issues = issuesFor((d) => d.writeText(`${ED}/characters/bob.json`, readFileSync(d.at(`${ED}/characters/bob.json`), 'utf8').trimEnd()));
  assertIssue(issues, 'format.not-canonical', /retour à la ligne final/);
});

test('règle 10 : un BOM en tête d\'un JSON est refusé (et non pris pour du JSON cassé)', () => {
  const issues = issuesFor((d) => d.writeText(`${ED}/characters/bob.json`, `﻿${readFileSync(d.at(`${ED}/characters/bob.json`), 'utf8')}`));
  assertIssue(issues, 'format.not-canonical', /n'est pas au format canonique/);
  assert.equal(issues.some((i) => i.rule === 'json.parse'), false);
});

test('règle 10 : relations.json non trié par id est refusé', () => {
  const issues = issuesFor((d) => d.edit(REL, (list) => list.reverse()));
  assertIssue(issues, 'format.not-canonical', /liens triés par id/, { file: 'relations.json' });
});

test('règle 10 : une note Markdown sans retour à la ligne final ou en CRLF est refusée', () => {
  const noFinal = issuesFor((d) => d.writeText(`${ED}/text/fr/notes/n-aaaaa.md`, 'Une note.'));
  assertIssue(noFinal, 'format.not-canonical', /un seul retour à la ligne final/);
  const crlf = issuesFor((d) => d.writeText(`${ED}/text/fr/notes/n-aaaaa.md`, 'Une note.\r\n'));
  assertIssue(crlf, 'format.not-canonical', /fin de ligne LF/);
});

test('règle 10 : un fichier déjà invalide n\'ajoute pas une erreur de format en plus', () => {
  const issues = issuesFor((d) => d.writeText(`${ED}/characters/bob.json`, JSON.stringify({ id: 'bob', age: 3 }, null, 4)));
  assert.equal(issues.some((i) => i.rule === 'format.not-canonical' && i.file.endsWith('bob.json')), false);
});

// ------------------------------------------------------------------ « npm run format »
function messUp(d) {
  d.writeText(`${ED}/characters/bob.json`, JSON.stringify(d.readJson(`${ED}/characters/bob.json`), null, 4)); // 4 espaces
  d.edit(REL, (list) => { [list[0].from, list[0].to] = [list[0].to, list[0].from]; return list.reverse(); }); // lien inversé + désordre
  d.writeText(`${ED}/text/fr/notes/n-aaaaa.md`, 'Une note de test sur Ann.\r\n'); // CRLF
}

test('formatDataset en mode vérification liste les fichiers à corriger sans les modifier', () => {
  const d = makeDataset(messUp);
  try {
    const before = readFileSync(d.at(REL), 'utf8');
    const { changed } = formatDataset(d.dataDir, { write: false });
    assert.deepEqual(changed.sort(), [
      `data/${ED}/characters/bob.json`,
      `data/${ED}/relations.json`,
      `data/${ED}/text/fr/notes/n-aaaaa.md`,
    ]);
    assert.equal(readFileSync(d.at(REL), 'utf8'), before, 'le mode --check ne doit rien écrire');
  } finally { d.cleanup(); }
});

test('formatDataset répare tout, puis « npm run check » est content (y compris l\'ordre des liens non orientés)', () => {
  const d = makeDataset(messUp);
  try {
    assert.ok(checkDataset(d.dataDir).issues.length > 0);
    formatDataset(d.dataDir, { write: true });
    assert.deepEqual(checkDataset(d.dataDir).issues, []);
    assert.deepEqual(formatDataset(d.dataDir, { write: false }).changed, [], 'un second passage ne change plus rien');
    const relations = d.readJson(REL);
    assert.deepEqual([relations[0].id, relations[0].from, relations[0].to], ['ann-bob-sibling-1', 'ann', 'bob']);
  } finally { d.cleanup(); }
});

test('formatDataset signale un JSON illisible au lieu de planter', () => {
  const d = makeDataset((x) => x.writeText(`${ED}/characters/bob.json`, '{ oups'));
  try {
    const { unreadable } = formatDataset(d.dataDir, { write: true });
    assert.equal(unreadable.length, 1);
    assert.match(unreadable[0].file, /bob\.json/);
  } finally { d.cleanup(); }
});

test('formatDataset ne touche pas aux fichiers inattendus', () => {
  const d = makeDataset((x) => x.writeText(`${SAGA}/notes.txt`, 'à laisser tranquille\r\n'));
  try {
    formatDataset(d.dataDir, { write: true });
    assert.equal(readFileSync(d.at(`${SAGA}/notes.txt`), 'utf8'), 'à laisser tranquille\r\n');
  } finally { d.cleanup(); }
});

test('la saga de démonstration est déjà au format canonique', () => {
  const { changed, unreadable } = formatDataset(DATA_DIR, { write: false });
  assert.deepEqual({ changed, unreadable }, { changed: [], unreadable: [] });
});

const runFormat = (args) => spawnSync(process.execPath, [path.join(SCRIPTS_DIR, 'format.mjs'), ...args], { encoding: 'utf8' });

test('la commande « format --check » sort en erreur (1) et explique comment corriger, sans rien écrire', () => {
  const d = makeDataset(messUp);
  try {
    const result = runFormat(['--check', '--data', d.dataDir]);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /3 fichiers ne sont pas au format canonique/);
    assert.match(result.stderr, /npm run format/);
    assert.equal(runFormat(['--check', '--data', d.dataDir]).status, 1, 'toujours en erreur : rien n\'a été écrit');
  } finally { d.cleanup(); }
});

test('la commande « format » corrige puis « format --check » réussit', () => {
  const d = makeDataset(messUp);
  try {
    const fixed = runFormat(['--data', d.dataDir]);
    assert.equal(fixed.status, 0);
    assert.match(fixed.stdout, /3 fichiers reformatés/);
    const after = runFormat(['--check', '--data', d.dataDir]);
    assert.equal(after.status, 0);
    assert.match(after.stdout, /✓ \d+ fichiers au format canonique/);
  } finally { d.cleanup(); }
});

test('« format --check » réussit sur le jeu valide', () => {
  assert.equal(runFormat(['--check', '--data', VALID_DATA]).status, 0);
});
