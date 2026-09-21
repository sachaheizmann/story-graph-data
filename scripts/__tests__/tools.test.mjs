// Tests des commandes new-character, new-note, new-edition et coverage.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { checkDataset } from '../lib/check.mjs';
import { formatDataset } from '../lib/format.mjs';
import { formatIssues } from '../lib/issues.mjs';
import { UserError } from '../lib/cli.mjs';
import { createCharacter } from '../lib/new-character.mjs';
import { createNote, randomNoteId } from '../lib/new-note.mjs';
import { cleanGithubUser, createEdition, detectGithubUser } from '../lib/new-edition.mjs';
import { computeCoverage, formatCoverage } from '../lib/coverage.mjs';
import { DATA_DIR } from '../lib/paths.mjs';
import { ED, SCRIPTS_DIR, makeDataset } from './helpers.mjs';

const EDITION = 'mini-saga/fr-a';
const ruleCodes = (dataDir) => checkDataset(dataDir).issues.map((i) => i.rule);
const assertUserError = (fn, pattern) => assert.throws(fn, (error) => error instanceof UserError && pattern.test(error.message));
const withDataset = (fn) => { const d = makeDataset(); try { return fn(d); } finally { d.cleanup(); } };

// ================================================================== new-character
test('new-character : crée le fichier neutre et le texte, et le résultat passe « check » et le format', () => withDataset((d) => {
  const { files, todo } = createCharacter({ dataDir: d.dataDir, edition: EDITION, id: 'dana', start: 'tome-1:7', name: 'Dana', description: 'Une voyageuse.' });
  assert.deepEqual(files, [`${ED}/characters/dana.json`, `${ED}/text/fr/characters/dana.json`]);
  assert.deepEqual(todo, []);
  assert.deepEqual(d.readJson(`${ED}/characters/dana.json`), { id: 'dana', start: { book: 'tome-1', chapter: 7 }, end: null });
  assert.deepEqual(d.readJson(`${ED}/text/fr/characters/dana.json`), { name: 'Dana', description: 'Une voyageuse.' });
  assert.deepEqual(checkDataset(d.dataDir).issues, []);
  assert.deepEqual(formatDataset(d.dataDir, { write: false }).changed, []);
}));

test('new-character : sans --start, le chapitre est 0 et « check » refuse tant que ce n\'est pas complété', () => withDataset((d) => {
  const { todo } = createCharacter({ dataDir: d.dataDir, edition: EDITION, id: 'dana' });
  assert.equal(todo.length, 3, 'chapitre, nom et description sont à compléter');
  assert.equal(d.readJson(`${ED}/characters/dana.json`).start.chapter, 0);
  const codes = ruleCodes(d.dataDir);
  assert.ok(codes.includes('schema.invalid'), 'le chapitre 0 est refusé par le schéma');
  assert.ok(codes.includes('todo.placeholder'), 'le marqueur « À COMPLÉTER » est refusé');
}));

test('new-character : le texte est créé dans la langue source de l\'édition', () => withDataset((d) => {
  d.edit(`${ED}/edition.json`, (e) => { e.language = 'en'; });
  createCharacter({ dataDir: d.dataDir, edition: EDITION, id: 'dana', start: 'tome-1:7', name: 'Dana', description: 'A traveller.' });
  assert.ok(existsSync(d.at(`${ED}/text/en/characters/dana.json`)));
  assert.equal(existsSync(d.at(`${ED}/text/fr/characters/dana.json`)), false);
}));

test('new-character : refuse d\'écraser un personnage existant', () => withDataset((d) => {
  const before = readFileSync(d.at(`${ED}/characters/ann.json`), 'utf8');
  assertUserError(() => createCharacter({ dataDir: d.dataDir, edition: EDITION, id: 'ann', start: 'tome-1:1' }), /« ann » existe déjà.*je refuse de l'écraser/);
  assert.equal(readFileSync(d.at(`${ED}/characters/ann.json`), 'utf8'), before);
}));

test('new-character : refuse si seul le texte existe déjà (pas d\'écrasement partiel)', () => withDataset((d) => {
  d.writeJson(`${ED}/text/fr/characters/dana.json`, { name: 'Dana', description: 'Texte existant.' });
  assertUserError(() => createCharacter({ dataDir: d.dataDir, edition: EDITION, id: 'dana', start: 'tome-1:1' }), /existe déjà/);
  assert.equal(existsSync(d.at(`${ED}/characters/dana.json`)), false, 'rien n\'a été créé');
}));

test('new-character : refuse un identifiant invalide, une édition inconnue, un début invalide', () => withDataset((d) => {
  assertUserError(() => createCharacter({ dataDir: d.dataDir, edition: EDITION, id: 'Dana Ö' }), /n'est pas valide.*minuscules/);
  assertUserError(() => createCharacter({ dataDir: d.dataDir, edition: 'mini-saga/fr-z', id: 'dana' }), /n'existe pas.*mini-saga\/fr-a, mini-saga\/fr-b/);
  assertUserError(() => createCharacter({ dataDir: d.dataDir, edition: 'mauvais', id: 'dana' }), /forme <saga>\/<édition>/);
  assertUserError(() => createCharacter({ dataDir: d.dataDir, edition: EDITION, id: 'dana', start: 'tome-1' }), /forme <tome>:<chapitre>/);
  assertUserError(() => createCharacter({ dataDir: d.dataDir, edition: EDITION, id: 'dana', start: 'tome-9:1' }), /tome « tome-9 » n'existe pas/);
  assertUserError(() => createCharacter({ dataDir: d.dataDir, edition: EDITION, id: 'dana', start: 'tome-2:6' }), /5 chapitres/);
  assert.equal(existsSync(d.at(`${ED}/characters/dana.json`)), false);
}));

// ================================================================== new-note
test('new-note : crée une note sur un personnage (id aléatoire n-xxxxx), valide et bien formatée', () => withDataset((d) => {
  const { id, files, todo } = createNote({ dataDir: d.dataDir, edition: EDITION, about: 'character:bob', start: 'tome-1:6', text: 'Bob cache un secret.' });
  assert.match(id, /^n-[a-z0-9]{5}$/);
  assert.deepEqual(files, [`${ED}/notes/${id}.json`, `${ED}/text/fr/notes/${id}.md`]);
  assert.deepEqual(todo, []);
  assert.deepEqual(d.readJson(`${ED}/notes/${id}.json`), { id, about: { type: 'character', id: 'bob' }, start: { book: 'tome-1', chapter: 6 } });
  assert.equal(readFileSync(d.at(`${ED}/text/fr/notes/${id}.md`), 'utf8'), 'Bob cache un secret.\n');
  assert.deepEqual(checkDataset(d.dataDir).issues, []);
  assert.deepEqual(formatDataset(d.dataDir, { write: false }).changed, []);
}));

test('new-note : crée une note sur un lien', () => withDataset((d) => {
  const { id } = createNote({ dataDir: d.dataDir, edition: EDITION, about: 'relation:ann-bob-sibling-1', start: 'tome-1:8', text: 'Ils se ressemblent.' });
  assert.deepEqual(d.readJson(`${ED}/notes/${id}.json`).about, { type: 'relation', id: 'ann-bob-sibling-1' });
  assert.deepEqual(checkDataset(d.dataDir).issues, []);
}));

test('new-note : sans --start ni --text, le chapitre est 0 et « check » refuse tant que ce n\'est pas complété', () => withDataset((d) => {
  const { id, todo } = createNote({ dataDir: d.dataDir, edition: EDITION, about: 'character:bob' });
  assert.equal(todo.length, 2);
  assert.match(readFileSync(d.at(`${ED}/text/fr/notes/${id}.md`), 'utf8'), /^À COMPLÉTER/);
  const codes = ruleCodes(d.dataDir);
  assert.ok(codes.includes('schema.invalid'));
  assert.ok(codes.includes('todo.placeholder'));
}));

test('new-note : refuse un sujet inexistant ou mal écrit', () => withDataset((d) => {
  assertUserError(() => createNote({ dataDir: d.dataDir, edition: EDITION, about: 'character:zoe' }), /personnage « zoe » n'existe pas.*new-character/);
  assertUserError(() => createNote({ dataDir: d.dataDir, edition: EDITION, about: 'relation:ann-zoe-ally-1' }), /lien « ann-zoe-ally-1 » n'existe pas/);
  assertUserError(() => createNote({ dataDir: d.dataDir, edition: EDITION, about: 'lieu:bob' }), /character:<id> ou relation:<id>/);
  assertUserError(() => createNote({ dataDir: d.dataDir, edition: EDITION }), /character:<id> ou relation:<id>/);
  assert.equal(readdirSync(d.at(`${ED}/notes`)).length, 2, 'aucune note n\'a été créée');
}));

test('new-note : refuse un texte de plus de 600 caractères', () => withDataset((d) => {
  assertUserError(() => createNote({ dataDir: d.dataDir, edition: EDITION, about: 'character:bob', start: 'tome-1:6', text: 'x'.repeat(601) }), /601 caractères : 600 au plus/);
}));

test('new-note : si l\'identifiant tiré existe déjà, un autre est tiré', () => withDataset((d) => {
  const draws = [];
  // Les 5 premiers tirages redonnent « n-aaaaa » (déjà pris dans le jeu valide), les suivants « n-bcdef ».
  const random = () => { draws.push(1); return draws.length <= 5 ? 0 : draws.length - 5; };
  const { id } = createNote({ dataDir: d.dataDir, edition: EDITION, about: 'character:bob', start: 'tome-1:6', text: 'Texte.', random });
  assert.equal(id, 'n-bcdef');
}));

test('new-note : l\'identifiant utilise 5 caractères sans ambiguïté (pas de i, l, o, 0, 1)', () => {
  for (let i = 0; i < 200; i += 1) assert.match(randomNoteId(), /^n-[a-hj-km-np-z2-9]{5}$/);
});

// ================================================================== new-edition
const NEW_EDITION = { saga: 'mini-saga', from: 'fr-a', id: 'fr-c', github: 'demo-user2', language: 'fr', publisher: 'Éditeur C', year: 2020 };

test('new-edition : copie l\'édition, met à jour edition.json et garde les identifiants', () => withDataset((d) => {
  d.edit(`${ED}/edition.json`, ({ books, ...rest }) => ({ ...rest, translators: ['Marie Dupont'], books })); // ordre canonique : translators avant books
  createEdition({ dataDir: d.dataDir, ...NEW_EDITION });

  const copy = d.readJson('mini-saga/editions/fr-c/edition.json');
  assert.equal(copy.id, 'fr-c');
  assert.equal(copy.based_on, 'fr-a');
  assert.deepEqual(copy.created_by, ['demo-user2']);
  assert.equal(copy.publisher, 'Éditeur C');
  assert.equal(copy.year, 2020);
  assert.equal('translators' in copy, false, 'les traducteurs de l\'édition copiée ne suivent pas');
  assert.deepEqual(copy.books, d.readJson(`${ED}/edition.json`).books, 'les tomes sont copiés (à adapter ensuite)');

  const ids = (edition) => readdirSync(d.at(`mini-saga/editions/${edition}/characters`)).sort();
  assert.deepEqual(ids('fr-c'), ids('fr-a'), 'les identifiants de personnages ne changent pas');
  assert.deepEqual(readdirSync(d.at('mini-saga/editions/fr-c/notes')).sort(), readdirSync(d.at(`${ED}/notes`)).sort());

  assert.deepEqual(checkDataset(d.dataDir).issues, [], formatIssues(checkDataset(d.dataDir).issues));
  assert.deepEqual(formatDataset(d.dataDir, { write: false }).changed, []);
  assert.equal(d.readJson(`${ED}/edition.json`).translators[0], 'Marie Dupont', 'l\'édition source n\'est pas modifiée');
}));

test('new-edition : copie l\'édition de démonstration du dépôt et la valide', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'book-tree-demo-'));
  try {
    const dataDir = path.join(root, 'data');
    cpSync(DATA_DIR, dataDir, { recursive: true });
    createEdition({ dataDir, saga: 'couronne-de-brume', from: 'fr-original', id: 'fr-collector-2020', github: 'demo-contributor', language: 'fr', publisher: 'Éditions Collector', year: 2020 });
    const { issues } = checkDataset(dataDir);
    assert.deepEqual(issues, [], formatIssues(issues));
    const copy = JSON.parse(readFileSync(path.join(dataDir, 'couronne-de-brume/editions/fr-collector-2020/edition.json'), 'utf8'));
    assert.equal(copy.based_on, 'fr-original');
    assert.equal(copy.books[0].chapters, 30);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('new-edition : refuse d\'écraser une édition existante, sans rien modifier', () => withDataset((d) => {
  const before = readFileSync(d.at('mini-saga/editions/fr-b/edition.json'), 'utf8');
  assertUserError(() => createEdition({ dataDir: d.dataDir, ...NEW_EDITION, id: 'fr-b' }), /« mini-saga\/fr-b » existe déjà : je refuse de l'écraser/);
  assert.equal(readFileSync(d.at('mini-saga/editions/fr-b/edition.json'), 'utf8'), before);

  createEdition({ dataDir: d.dataDir, ...NEW_EDITION });
  assertUserError(() => createEdition({ dataDir: d.dataDir, ...NEW_EDITION }), /existe déjà/);
}));

test('new-edition : refuse une copie de soi-même, une saga ou édition inconnue', () => withDataset((d) => {
  assertUserError(() => createEdition({ dataDir: d.dataDir, ...NEW_EDITION, id: 'fr-a' }), /identifiant différent/);
  assertUserError(() => createEdition({ dataDir: d.dataDir, ...NEW_EDITION, from: 'fr-z' }), /« mini-saga\/fr-z » n'existe pas/);
  assertUserError(() => createEdition({ dataDir: d.dataDir, ...NEW_EDITION, saga: 'autre' }), /« autre\/fr-a » n'existe pas/);
  assert.equal(existsSync(d.at('mini-saga/editions/fr-c')), false);
}));

test('new-edition : refuse une adresse e-mail à la place du pseudo GitHub, et les valeurs invalides', () => withDataset((d) => {
  assertUserError(() => createEdition({ dataDir: d.dataDir, ...NEW_EDITION, github: 'jean@example.org' }), /ressemble à une adresse e-mail/);
  assertUserError(() => createEdition({ dataDir: d.dataDir, ...NEW_EDITION, github: 'pseudo invalide' }), /pas un nom d'utilisateur GitHub valide/);
  assertUserError(() => createEdition({ dataDir: d.dataDir, ...NEW_EDITION, language: 'Français' }), /langue.*n'est pas valide/);
  assertUserError(() => createEdition({ dataDir: d.dataDir, ...NEW_EDITION, publisher: '  ' }), /éditeur.*ne peut pas être vide/);
  assertUserError(() => createEdition({ dataDir: d.dataDir, ...NEW_EDITION, year: 20 }), /année/);
  assert.equal(existsSync(d.at('mini-saga/editions/fr-c')), false, 'rien n\'est créé quand une valeur est invalide');
}));

test('new-edition : accepte « @pseudo »', () => {
  assert.equal(cleanGithubUser('@demo-user'), 'demo-user');
});

test('new-edition : une langue source différente rend la validation exigeante (textes à traduire)', () => withDataset((d) => {
  createEdition({ dataDir: d.dataDir, ...NEW_EDITION, language: 'en' });
  const codes = ruleCodes(d.dataDir);
  assert.ok(codes.includes('texts.missing'), 'les textes en « en » manquent pour la nouvelle langue source');
  assert.ok(codes.includes('texts.label-missing'), 'les libellés de types en « en » sont exigés aussi');
}));

test('new-edition : détecte le pseudo GitHub via « gh » quand il est disponible', () => {
  assert.equal(detectGithubUser(() => ({ status: 0, stdout: 'sachaheizmann\n' })), 'sachaheizmann');
  assert.equal(detectGithubUser(() => ({ status: 1, stdout: '' })), undefined, 'gh non connecté');
  assert.equal(detectGithubUser(() => { throw new Error('ENOENT'); }), undefined, 'gh non installé');
  assert.equal(detectGithubUser(() => ({ status: 0, stdout: 'jean@example.org' })), undefined, 'jamais une adresse e-mail');
});

// ================================================================== lignes de commande
const emptyPath = mkdtempSync(path.join(tmpdir(), 'book-tree-nogh-')); // PATH sans « gh » : test indépendant de la machine
const run = (script, args) => spawnSync(process.execPath, [path.join(SCRIPTS_DIR, script), ...args], { encoding: 'utf8', env: { ...process.env, PATH: emptyPath } });

test('CLI new-edition : crée, valide et affiche les prochaines étapes', () => withDataset((d) => {
  const r = run('new-edition.mjs', ['--data', d.dataDir, '--saga', 'mini-saga', '--from', 'fr-a', '--id', 'fr-c', '--github', 'demo-user2', '--language', 'fr', '--publisher', 'Éditeur C', '--year', '2020']);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /Édition « mini-saga\/fr-c » créée par copie de « fr-a »/);
  assert.match(r.stdout, /✓ \d+ fichiers vérifiés, aucun problème/);
  assert.match(r.stdout, /Les identifiants \(aria, kael…\) NE CHANGENT PAS/);
  assert.ok(existsSync(d.at('mini-saga/editions/fr-c/edition.json')));
}));

test('CLI new-edition : refuse d\'écraser (code 1, message clair)', () => withDataset((d) => {
  const r = run('new-edition.mjs', ['--data', d.dataDir, '--saga', 'mini-saga', '--from', 'fr-a', '--id', 'fr-b', '--github', 'demo-user2', '--language', 'fr', '--publisher', 'X', '--year', '2020']);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /✗ L'édition « mini-saga\/fr-b » existe déjà : je refuse de l'écraser/);
}));

test('CLI new-edition : sans terminal interactif, liste les valeurs manquantes au lieu d\'attendre', () => withDataset((d) => {
  const r = run('new-edition.mjs', ['--data', d.dataDir, '--saga', 'mini-saga', '--from', 'fr-a', '--id', 'fr-c']);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /Il manque : --github <pseudo>, --language <fr>, --publisher "…", --year <2015>/);
  assert.equal(existsSync(d.at('mini-saga/editions/fr-c')), false);
}));

test('CLI new-edition : sur une saga qui ne valide pas, signale le problème et sort en erreur', () => withDataset((d) => {
  const r = run('new-edition.mjs', ['--data', d.dataDir, '--saga', 'mini-saga', '--from', 'fr-a', '--id', 'fr-c', '--github', 'demo-user2', '--language', 'en', '--publisher', 'X', '--year', '2020']);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /texts\/en|n'a pas de texte en « en »/);
  assert.match(r.stderr, /La langue source change/);
}));

test('CLI new-character : crée les fichiers et rappelle la règle « révélé ≠ vrai »', () => withDataset((d) => {
  const r = run('new-character.mjs', ['--data', d.dataDir, '--edition', EDITION, '--id', 'dana']);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /Personnage « dana » créé/);
  assert.match(r.stdout, /Il reste à compléter/);
  assert.match(r.stdout, /« start » = le moment où le lecteur DÉCOUVRE le personnage/);
  assert.ok(existsSync(d.at(`${ED}/characters/dana.json`)));
}));

test('CLI new-character : refuse d\'écraser et sans --id affiche le mode d\'emploi', () => withDataset((d) => {
  const again = run('new-character.mjs', ['--data', d.dataDir, '--edition', EDITION, '--id', 'ann']);
  assert.equal(again.status, 1);
  assert.match(again.stderr, /existe déjà/);
  const usage = run('new-character.mjs', ['--data', d.dataDir, '--edition', EDITION]);
  assert.equal(usage.status, 1);
  assert.match(usage.stderr, /Il manque --edition ou --id/);
  assert.match(usage.stderr, /Usage : npm run new-character/);
}));

test('CLI new-note : crée la note, rappelle « révélé ≠ vrai », refuse une option inconnue', () => withDataset((d) => {
  const ok = run('new-note.mjs', ['--data', d.dataDir, '--edition', EDITION, '--about', 'character:bob', '--start', 'tome-1:6', '--text', 'Une note.']);
  assert.equal(ok.status, 0, ok.stderr);
  assert.match(ok.stdout, /Note « n-[a-z0-9]{5} » créée/);
  assert.match(ok.stdout, /jamais le moment où c'est vrai dans l'histoire/);
  const bad = run('new-note.mjs', ['--data', d.dataDir, '--edition', EDITION, '--about', 'character:bob', '--bidule']);
  assert.equal(bad.status, 1);
  assert.match(bad.stderr, /Options non comprises/);
}));

// ================================================================== coverage
test('coverage : pourcentage par édition et par langue (source en premier)', () => withDataset((d) => {
  const { editions } = computeCoverage(d.dataDir);
  const a = editions.find((e) => e.edition === 'fr-a');
  assert.deepEqual(a.languages.map((l) => l.language), ['fr', 'en']);
  assert.equal(a.languages[0].percent, 100);
  assert.equal(a.languages[0].source, true);
  // en : 1 personnage traduit sur 3, 0 note sur 2 -> 1/5 = 20 %
  assert.equal(a.languages[1].percent, 20);
  assert.deepEqual(a.languages[1].characters, { done: 1, total: 3 });
  assert.deepEqual(a.languages[1].notes, { done: 0, total: 2 });
  assert.deepEqual(a.languages[1].missing, { characters: ['bob', 'cat'], notes: ['n-aaaaa', 'n-bbbbb'] });
}));

test('coverage : les libellés de types de liens comptent aussi (label + reverse_label des types orientés)', () => withDataset((d) => {
  const { relationTypes } = computeCoverage(d.dataDir);
  const fr = relationTypes.find((l) => l.language === 'fr');
  const en = relationTypes.find((l) => l.language === 'en');
  assert.equal(fr.total, 6); // 4 types + 2 libellés inverses (master_of, parent_of)
  assert.equal(fr.percent, 100);
  assert.equal(en.done, 2); // ally.label et parent_of.label
  assert.equal(en.percent, 33);
  assert.ok(en.missing.includes('parent_of.reverse_label'));
}));

test('coverage : la saga de démonstration a 44 % de traduction anglaise', () => {
  const { editions } = computeCoverage(DATA_DIR);
  const original = editions.find((e) => e.edition === 'fr-original');
  const en = original.languages.find((l) => l.language === 'en');
  assert.deepEqual([en.done, en.total, en.percent], [7, 16, 44]);
  assert.equal(editions.find((e) => e.edition === 'fr-poche-2015').languages.length, 1);
});

test('coverage : l\'affichage montre la barre, le pourcentage et, avec --list, ce qui reste à traduire', () => withDataset((d) => {
  const result = computeCoverage(d.dataDir);
  const short = formatCoverage(result);
  assert.match(short, /mini-saga \/ fr-a : 3 personnages, 2 notes/);
  assert.match(short, /en  ██░░░░░░░░  20 %  \(1\/5\)/);
  assert.match(short, /--list/);
  const long = formatCoverage(result, { list: true });
  assert.match(long, /à traduire, personnages : bob, cat/);
  assert.match(long, /à traduire, notes : n-aaaaa, n-bbbbb/);
}));

test('coverage : la commande affiche le tableau (code 0) et refuse une édition inconnue', () => withDataset((d) => {
  const ok = run('coverage.mjs', ['--data', d.dataDir, '--list']);
  assert.equal(ok.status, 0, ok.stderr);
  assert.match(ok.stdout, /Couverture des traductions/);
  assert.match(ok.stdout, /Types de liens/);
  const bad = run('coverage.mjs', ['--data', d.dataDir, '--edition', 'mini-saga/fr-z']);
  assert.equal(bad.status, 1);
  assert.match(bad.stderr, /n'existe pas/);
}));
