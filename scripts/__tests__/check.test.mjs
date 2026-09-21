// Un test (au moins) par règle de validation : on abîme une copie du jeu valide d'UNE seule façon
// et on vérifie que le contrôle le repère, avec un message français utile.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { checkDataset } from '../lib/check.mjs';
import { formatIssues } from '../lib/issues.mjs';
import { DATA_DIR } from '../lib/paths.mjs';
import { ED, SAGA, SCRIPTS_DIR, VALID_DATA, assertIssue, issuesFor, makeDataset } from './helpers.mjs';

const CHARS = `${ED}/characters`;
const REL = `${ED}/relations.json`;
const at = (chapter, book = 1) => ({ book: `tome-${book}`, chapter });

// ------------------------------------------------------------------ jeux valides
test('un jeu de données valide ne produit aucun problème', () => {
  assert.deepEqual(checkDataset(VALID_DATA).issues, []);
});

test('la saga de démonstration du dépôt (data/) est valide', () => {
  const { issues } = checkDataset(DATA_DIR);
  assert.deepEqual(issues, [], formatIssues(issues));
});

test('les langues autres que la langue source peuvent être incomplètes', () => {
  // Le jeu valide contient déjà un texte anglais partiel (1 personnage sur 3, aucune note).
  const issues = issuesFor(() => {});
  assert.equal(issues.length, 0);
});

// ------------------------------------------------------------------ règle 9 : fichiers attendus
test('règle 9 : un fichier qui n\'est ni JSON ni Markdown est refusé', () => {
  const issues = issuesFor((d) => d.writeText(`${SAGA}/notes.txt`, 'à supprimer'));
  assertIssue(issues, 'files.unexpected', /ni du JSON ni du Markdown/, { file: 'notes.txt' });
});

test('règle 9 : un fichier système (.DS_Store) est refusé', () => {
  const issues = issuesFor((d) => d.writeText(`${SAGA}/.DS_Store`, ''));
  assertIssue(issues, 'files.unexpected', /ni du JSON ni du Markdown/);
});

test('règle 9 : un fichier JSON à un endroit imprévu est refusé', () => {
  const issues = issuesFor((d) => d.writeJson(`${SAGA}/divers.json`, {}));
  assertIssue(issues, 'files.unexpected', /pas à un endroit prévu/, { file: 'divers.json' });
});

test('règle 9 : un nom de fichier avec majuscule est refusé', () => {
  const issues = issuesFor((d) => d.writeJson(`${CHARS}/Dana.json`, { id: 'dana' }));
  assertIssue(issues, 'files.name', /« Dana\.json »/);
});

test('règle 9 : un nom de dossier avec underscore ou majuscule est refusé', () => {
  const issues = issuesFor((d) => d.copy(ED, `${SAGA}/editions/Fr_C`));
  assertIssue(issues, 'files.name', /« Fr_C »/);
});

// ------------------------------------------------------------------ règle 1 : schémas et id
test('règle 1 : un JSON cassé est signalé', () => {
  const issues = issuesFor((d) => d.writeText(`${CHARS}/ann.json`, '{ "id": "ann", '));
  assertIssue(issues, 'json.parse', /pas du JSON valide/, { file: 'ann.json' });
});

test('règle 1 : un champ obligatoire manquant est signalé (avec le rappel « révélé ≠ vrai » pour « start »)', () => {
  const issues = issuesFor((d) => d.edit(`${CHARS}/ann.json`, (c) => { delete c.start; }));
  const found = assertIssue(issues, 'schema.invalid', /Le champ « start » est obligatoire/);
  assert.equal(found.reminder, true);
});

test('règle 1 : un champ inconnu est signalé avec la liste des champs autorisés', () => {
  const issues = issuesFor((d) => d.edit(`${CHARS}/ann.json`, (c) => { c.age = 30; }));
  const found = assertIssue(issues, 'schema.invalid', /Le champ « age » n'existe pas/);
  assert.match(found.fix, /Champs autorisés : id, start, end/);
});

test('règle 1 : un mauvais type est signalé', () => {
  const issues = issuesFor((d) => d.edit(`${CHARS}/ann.json`, (c) => { c.start.chapter = '3'; }));
  assertIssue(issues, 'schema.invalid', /« start\.chapter » doit être un nombre entier/);
});

test('règle 1 : un motif invalide (identifiant de tome) est signalé avec une aide', () => {
  const issues = issuesFor((d) => d.edit(`${CHARS}/ann.json`, (c) => { c.start.book = 'Tome 1'; }));
  const found = assertIssue(issues, 'schema.invalid', /« start\.book » a un format invalide/);
  assert.match(found.fix, /minuscules sans accent/);
});

test('règle 1 : un nombre trop petit est signalé', () => {
  const issues = issuesFor((d) => d.edit(`${CHARS}/ann.json`, (c) => { c.start.chapter = 0; }));
  assertIssue(issues, 'schema.invalid', /doit valoir au moins 1/);
});

test('règle 1 : une description trop longue est signalée', () => {
  const issues = issuesFor((d) => d.edit(`${ED}/text/fr/characters/ann.json`, (c) => { c.description = 'x'.repeat(601); }));
  const found = assertIssue(issues, 'schema.invalid', /« description » est trop long \(601 caractères, 600 au plus\)/);
  assert.equal(found.reminder, true);
});

test('règle 1 : une valeur hors liste est signalée', () => {
  const issues = issuesFor((d) => d.edit(`${ED}/notes/n-aaaaa.json`, (n) => { n.about.type = 'lieu'; }));
  assertIssue(issues, 'schema.invalid', /doit être l'une de ces valeurs : « character », « relation »/);
});

test('règle 1 : une valeur constante fausse (schemaVersion) est signalée', () => {
  const issues = issuesFor((d) => d.edit(`${SAGA}/saga.json`, (s) => { s.schemaVersion = 2; }));
  assertIssue(issues, 'schema.invalid', /« schemaVersion » doit valoir 1/);
});

test('règle 1 : une liste vide qui doit contenir un élément est signalée (created_by)', () => {
  const issues = issuesFor((d) => d.edit(`${ED}/edition.json`, (e) => { e.created_by = []; }));
  assertIssue(issues, 'schema.invalid', /« created_by » doit contenir au moins 1 élément/);
});

test('règle 1 : une adresse e-mail à la place d\'un pseudo GitHub est refusée', () => {
  const issues = issuesFor((d) => d.edit(`${ED}/edition.json`, (e) => { e.created_by = ['jean@example.org']; }));
  const found = assertIssue(issues, 'schema.invalid', /format invalide/);
  assert.match(found.fix, /jamais une adresse e-mail/);
});

test('règle 1 : un doublon dans une liste est signalé (aliases)', () => {
  const issues = issuesFor((d) => d.edit(`${ED}/text/fr/characters/ann.json`, (c) => { c.aliases = ['x', 'x']; }));
  assertIssue(issues, 'schema.invalid', /deux fois la même valeur/);
});

test('règle 1 : un nom de type de lien invalide est signalé (clé d\'objet)', () => {
  const issues = issuesFor((d) => d.edit('_common/relation-types.json', (t) => { t['Bad Type'] = { category: 'social', directed: false }; }));
  assertIssue(issues, 'schema.invalid', /La clé « Bad Type » n'est pas un nom valide/);
});

test('règle 1 : une erreur dans relations.json nomme le lien concerné', () => {
  const issues = issuesFor((d) => d.edit(REL, (list) => { delete list[1].type; }));
  assertIssue(issues, 'schema.invalid', /Le lien « ann-cat-parent-1 » \(n° 2\) : Le champ « type » est obligatoire/);
});

test('règle 1 : l\'id d\'un personnage doit être le nom du fichier', () => {
  const issues = issuesFor((d) => d.edit(`${CHARS}/ann.json`, (c) => { c.id = 'zoe'; }));
  assertIssue(issues, 'schema.id-mismatch', /\(« zoe »\) ne correspond pas au nom du fichier \(« ann »\)/);
});

test('règle 1 : l\'id d\'une saga doit être le nom du dossier', () => {
  const issues = issuesFor((d) => d.edit(`${SAGA}/saga.json`, (s) => { s.id = 'autre-saga'; }));
  assertIssue(issues, 'schema.id-mismatch', /ne correspond pas au nom du dossier \(« mini-saga »\)/);
});

test('règle 1 : l\'id d\'une édition doit être le nom du dossier', () => {
  const issues = issuesFor((d) => d.edit(`${ED}/edition.json`, (e) => { e.id = 'fr-z'; }));
  assertIssue(issues, 'schema.id-mismatch', /ne correspond pas au nom du dossier \(« fr-a »\)/);
});

// ------------------------------------------------------------------ règle 2 : références
test('règle 2 : un auteur inconnu est signalé', () => {
  const issues = issuesFor((d) => d.edit(`${SAGA}/saga.json`, (s) => { s.authors = ['fantome']; }));
  assertIssue(issues, 'ref.author-unknown', /« fantome » n'existe pas/);
});

test('règle 2 : une édition par défaut inconnue est signalée', () => {
  const issues = issuesFor((d) => d.edit(`${SAGA}/saga.json`, (s) => { s.defaultEdition = 'fr-z'; }));
  assertIssue(issues, 'ref.default-edition-unknown', /« fr-z » n'existe pas/);
});

test('règle 2 : based_on doit désigner une édition de la même saga', () => {
  const issues = issuesFor((d) => d.edit(`${ED}/edition.json`, (e) => { e.based_on = 'fr-z'; }));
  assertIssue(issues, 'ref.based-on-unknown', /« fr-z », qui n'existe pas dans la saga « mini-saga »/);
});

test('règle 2 : based_on ne peut pas former de boucle (y compris vers soi-même)', () => {
  const loop = issuesFor((d) => d.edit(`${ED}/edition.json`, (e) => { e.based_on = 'fr-b'; }));
  assertIssue(loop, 'ref.based-on-cycle', /fr-a → fr-b → fr-a/);
  const self = issuesFor((d) => d.edit(`${ED}/edition.json`, (e) => { e.based_on = 'fr-a'; }));
  assertIssue(self, 'ref.based-on-cycle', /fr-a → fr-a/);
});

test('règle 2 : un lien vers un personnage inexistant est signalé', () => {
  const issues = issuesFor((d) => d.edit(REL, (list) => { list[0].to = 'zoe'; }));
  assertIssue(issues, 'ref.character-unknown', /« to » désigne « zoe »/);
});

test('règle 2 : un lien d\'un personnage vers lui-même est refusé', () => {
  const issues = issuesFor((d) => d.edit(REL, (list) => { list[0].to = 'ann'; }));
  assertIssue(issues, 'relations.self-link', /relie « ann » à lui-même/);
});

test('règle 2 : un type de lien inconnu est signalé avec la liste des types', () => {
  const issues = issuesFor((d) => d.edit(REL, (list) => { list[0].type = 'cousin_of'; }));
  const found = assertIssue(issues, 'ref.type-unknown', /type inconnu : « cousin_of »/);
  assert.match(found.fix, /Types connus : ally, master_of, parent_of, sibling_of/);
});

test('règle 2 : une note sur un personnage inexistant est signalée', () => {
  const issues = issuesFor((d) => d.edit(`${ED}/notes/n-aaaaa.json`, (n) => { n.about.id = 'zoe'; }));
  assertIssue(issues, 'ref.subject-unknown', /personnage « zoe », qui n'existe pas/);
});

test('règle 2 : une note sur un lien inexistant est signalée', () => {
  const issues = issuesFor((d) => d.edit(`${ED}/notes/n-bbbbb.json`, (n) => { n.about.id = 'ann-zoe-ally-1'; }));
  assertIssue(issues, 'ref.subject-unknown', /lien « ann-zoe-ally-1 », qui n'existe pas/);
});

// ------------------------------------------------------------------ règle 3 : positions
test('règle 3 : un tome inexistant est signalé, avec les tomes de l\'édition', () => {
  const issues = issuesFor((d) => d.edit(`${CHARS}/ann.json`, (c) => { c.start = at(1, 9); }));
  const found = assertIssue(issues, 'position.book-unknown', /tome « tome-9 », qui n'existe pas dans l'édition « fr-a »/);
  assert.match(found.fix, /« tome-1 » \(10 chapitres\)/);
});

test('règle 3 : un chapitre au-delà du dernier est signalé (tome à 5 chapitres)', () => {
  const issues = issuesFor((d) => d.edit(REL, (list) => { list[0].start = at(6, 2); }));
  assertIssue(issues, 'position.chapter-out-of-range', /chapitre 6 du tome « tome-2 », qui n'a que 5 chapitres/);
});

test('règle 3 : les limites de chapitres sont celles de l\'édition (fr-b n\'a que 8 chapitres au tome 1)', () => {
  const issues = issuesFor((d) => d.edit('mini-saga/editions/fr-b/notes/n-aaaaa.json', (n) => { n.start = at(9); }));
  assertIssue(issues, 'position.chapter-out-of-range', /n'a que 8 chapitres dans l'édition « fr-b »/);
});

test('règle 3 : le « end » d\'un personnage est aussi vérifié', () => {
  const issues = issuesFor((d) => d.edit(`${CHARS}/cat.json`, (c) => { c.end = at(40, 2); }));
  assertIssue(issues, 'position.chapter-out-of-range', /« end »/);
});

// ------------------------------------------------------------------ règle 4 : end après start
test('règle 4 : un « end » égal à « start » est refusé (avec le rappel « révélé ≠ vrai »)', () => {
  const issues = issuesFor((d) => d.edit(REL, (list) => { list[2].end = list[2].start; }));
  const found = assertIssue(issues, 'order.end-not-after-start', /n'est pas après « start »/);
  assert.equal(found.reminder, true);
});

test('règle 4 : un « end » avant « start » est refusé, même d\'un tome à l\'autre', () => {
  const issues = issuesFor((d) => d.edit(`${CHARS}/cat.json`, (c) => { c.end = at(1, 1); }));
  assertIssue(issues, 'order.end-not-after-start', /Le personnage « cat »/);
});

// ------------------------------------------------------------------ règle 5 : pas avant son sujet
test('règle 5 : un lien ne peut pas commencer avant l\'un de ses personnages', () => {
  const issues = issuesFor((d) => d.edit(REL, (list) => { list[0].start = at(1); })); // bob n'apparaît qu'au chapitre 2
  const found = assertIssue(issues, 'order.relation-before-character', /commence \(tome-1, chapitre 1\) avant que le lecteur ne découvre « bob »/);
  assert.equal(found.reminder, true);
});

test('règle 5 : une note ne peut pas commencer avant son personnage', () => {
  const issues = issuesFor((d) => d.edit(`${ED}/notes/n-aaaaa.json`, (n) => { n.about.id = 'cat'; n.start = at(1); }));
  assertIssue(issues, 'order.note-before-subject', /avant son sujet « cat »/);
});

test('règle 5 : une note ne peut pas commencer avant son lien', () => {
  const issues = issuesFor((d) => d.edit(`${ED}/notes/n-bbbbb.json`, (n) => { n.start = at(2); }));
  assertIssue(issues, 'order.note-before-subject', /avant son sujet « ann-bob-sibling-1 »/);
});

test('règle 5 : une note qui commence exactement au start de son sujet est acceptée', () => {
  const issues = issuesFor((d) => d.edit(`${ED}/notes/n-bbbbb.json`, (n) => { n.start = at(5); }));
  assert.deepEqual(issues, []);
});

// ------------------------------------------------------------------ règle 6 : doublons et cohérence
test('règle 6 : deux liens avec le même identifiant sont refusés', () => {
  const issues = issuesFor((d) => d.edit(REL, (list) => { list[2].id = list[1].id; }));
  assertIssue(issues, 'duplicate.id', /« ann-cat-parent-1 » est utilisé deux fois \(liens n° 2 et n° 3\)/);
});

test('règle 6 : deux tomes avec le même identifiant sont refusés', () => {
  const issues = issuesFor((d) => d.edit(`${ED}/edition.json`, (e) => { e.books[1].id = 'tome-1'; }));
  assertIssue(issues, 'duplicate.book', /Le tome « tome-1 » est déclaré deux fois/);
});

test('règle 6 : un doublon exact de lien est refusé', () => {
  const issues = issuesFor((d) => d.edit(REL, (list) => { list.push({ ...list[0], id: 'ann-bob-sibling-2' }); }));
  assertIssue(issues, 'duplicate.relation', /« ann-bob-sibling-1 » et « ann-bob-sibling-2 » sont identiques/);
});

test('règle 6 : deux liens du même type qui se chevauchent sont refusés', () => {
  const issues = issuesFor((d) => d.edit(REL, (list) => { list.push({ ...list[2], id: 'bob-cat-ally-2', start: at(6) }); }));
  assertIssue(issues, 'duplicate.relation', /se chevauchent/);
});

test('règle 6 : deux liens du même type qui se suivent (le second commence quand le premier finit) sont acceptés', () => {
  const issues = issuesFor((d) => d.edit(REL, (list) => {
    list.push({ ...list[2], id: 'bob-cat-ally-2', start: list[2].end, end: null });
  }));
  assert.deepEqual(issues, []);
});

test('règle 6 : un type non orienté doit avoir from avant to dans l\'ordre alphabétique', () => {
  const issues = issuesFor((d) => d.edit(REL, (list) => { [list[0].from, list[0].to] = [list[0].to, list[0].from]; }));
  const found = assertIssue(issues, 'order.undirected-canonical', /« from » \(« bob »\) doit précéder « to » \(« ann »\)/);
  assert.match(found.fix, /npm run format/);
});

test('règle 6 : un type orienté n\'est pas soumis à l\'ordre alphabétique', () => {
  const issues = issuesFor((d) => d.edit(REL, (list) => { list[1].from = 'cat'; list[1].to = 'ann'; }));
  assert.equal(issues.some((i) => i.rule === 'order.undirected-canonical'), false);
});

test('règle 6 : parent_of ne peut pas former de boucle directe', () => {
  const issues = issuesFor((d) => d.edit(REL, (list) => {
    list.push({ id: 'cat-ann-parent-1', from: 'cat', to: 'ann', type: 'parent_of', start: at(3), end: null });
  }));
  assertIssue(issues, 'family.parent-cycle', /ann → cat → ann/);
});

test('règle 6 : parent_of ne peut pas former de boucle indirecte (3 personnages)', () => {
  const issues = issuesFor((d) => d.edit(REL, (list) => {
    list.push({ id: 'bob-ann-parent-1', from: 'bob', to: 'ann', type: 'parent_of', start: at(3), end: null });
    list.push({ id: 'cat-bob-parent-1', from: 'cat', to: 'bob', type: 'parent_of', start: at(3), end: null });
  }));
  assertIssue(issues, 'family.parent-cycle', /boucle : (ann → cat → bob → ann|bob → ann → cat → bob|cat → bob → ann → cat)/);
});

// ------------------------------------------------------------------ règle 7 : langue source complète
test('règle 7 : un personnage sans texte dans la langue source est signalé', () => {
  const issues = issuesFor((d) => d.remove(`${ED}/text/fr/characters/bob.json`));
  const found = assertIssue(issues, 'texts.missing', /Le personnage « bob » n'a pas de texte en « fr »/, { file: 'text/fr/characters/bob.json' });
  assert.equal(found.reminder, true);
});

test('règle 7 : une note sans texte dans la langue source est signalée', () => {
  const issues = issuesFor((d) => d.remove(`${ED}/text/fr/notes/n-aaaaa.md`));
  assertIssue(issues, 'texts.missing', /La note « n-aaaaa » n'a pas de texte en « fr »/);
});

test('règle 7 : la langue source d\'une édition peut être une autre langue (ici en)', () => {
  const issues = issuesFor((d) => d.edit('mini-saga/editions/fr-b/edition.json', (e) => { e.language = 'en'; }));
  assertIssue(issues, 'texts.missing', /n'a pas de texte en « en »/);
});

test('règle 7 : les libellés de types doivent exister dans chaque langue source', () => {
  const issues = issuesFor((d) => d.remove('_common/text/fr/relation-types.json'));
  assertIssue(issues, 'texts.relation-types-missing', /libellés des types de liens en « fr »/);
});

test('règle 7 : un type sans libellé dans la langue source est signalé', () => {
  const issues = issuesFor((d) => d.edit('_common/text/fr/relation-types.json', (t) => { delete t.ally; }));
  assertIssue(issues, 'texts.label-missing', /libellé du type « ally » en « fr »/);
});

test('règle 7 : un type orienté sans libellé inverse dans la langue source est signalé', () => {
  const issues = issuesFor((d) => d.edit('_common/text/fr/relation-types.json', (t) => { delete t.parent_of.reverse_label; }));
  const found = assertIssue(issues, 'texts.reverse-label-missing', /« parent_of » n'a pas de « reverse_label » en « fr »/);
  assert.match(found.fix, /a pour parent/);
});

test('règle 7 : dans une langue non source, le libellé inverse peut manquer (en est partiel)', () => {
  // Le jeu valide a déjà « en » avec parent_of sans reverse_label : aucun problème attendu.
  assert.deepEqual(issuesFor(() => {}), []);
});

test('règle 7 : un libellé inverse est interdit sur un type non orienté', () => {
  const issues = issuesFor((d) => d.edit('_common/text/fr/relation-types.json', (t) => { t.ally.reverse_label = 'est allié de'; }));
  assertIssue(issues, 'texts.reverse-label-undirected', /« ally » n'est pas orienté/);
});

test('règle 7 : une saga sans aucun texte est signalée', () => {
  const issues = issuesFor((d) => d.remove(`${SAGA}/text`));
  assertIssue(issues, 'texts.no-language', /saga « mini-saga » n'a aucun texte/);
});

test('règle 7 : un auteur sans aucun texte est signalé', () => {
  const issues = issuesFor((d) => d.remove('authors/text'));
  assertIssue(issues, 'texts.no-language', /auteur « writer » n'a aucun texte/);
});

// ------------------------------------------------------------------ règle 8 : textes orphelins
test('règle 8 : un texte de personnage sans personnage est orphelin (même dans une autre langue)', () => {
  const fr = issuesFor((d) => d.writeJson(`${ED}/text/fr/characters/zoe.json`, { name: 'Zoé', description: 'Orpheline.' }));
  assertIssue(fr, 'orphan.text', /ne correspond à aucun personnage.*characters\/zoe\.json/);
  const en = issuesFor((d) => d.writeJson(`${ED}/text/en/characters/zoe.json`, { name: 'Zoe', description: 'Orphan.' }));
  assertIssue(en, 'orphan.text', /« en »/);
});

test('règle 8 : un texte de note sans note est orphelin', () => {
  const issues = issuesFor((d) => d.writeText(`${ED}/text/fr/notes/n-zzzzz.md`, 'Texte sans note.\n'));
  assertIssue(issues, 'orphan.text', /ne correspond à aucune note.*n-zzzzz/);
});

test('règle 8 : un texte d\'auteur sans auteur est orphelin', () => {
  const issues = issuesFor((d) => d.writeJson('authors/text/fr/fantome.json', { name: 'Fantôme', bio: 'Inconnu.' }));
  assertIssue(issues, 'orphan.text', /ne correspond à aucun auteur/);
});

test('règle 8 : un libellé pour un type inexistant est orphelin', () => {
  const issues = issuesFor((d) => d.edit('_common/text/en/relation-types.json', (t) => { t.cousin_of = { label: 'is a cousin of' }; }));
  assertIssue(issues, 'orphan.text', /type « cousin_of », qui n'existe pas/);
});

// ------------------------------------------------------------------ notes
test('notes : une note vide est refusée', () => {
  const issues = issuesFor((d) => d.writeText(`${ED}/text/fr/notes/n-aaaaa.md`, '  \n'));
  assertIssue(issues, 'notes.text-empty', /Cette note est vide/);
});

test('notes : au-delà de 600 caractères la note est refusée, à 600 elle passe', () => {
  const tooLong = issuesFor((d) => d.writeText(`${ED}/text/fr/notes/n-aaaaa.md`, `${'a'.repeat(601)}\n`));
  assertIssue(tooLong, 'notes.text-too-long', /601 caractères, 600 au plus/);
  const limit = issuesFor((d) => d.writeText(`${ED}/text/fr/notes/n-aaaaa.md`, `${'a'.repeat(600)}\n`));
  assert.deepEqual(limit, []);
});

test('notes : les caractères spéciaux comptent pour un seul caractère (accents, emoji)', () => {
  const issues = issuesFor((d) => d.writeText(`${ED}/text/fr/notes/n-aaaaa.md`, `${'é'.repeat(300)}${'😀'.repeat(300)}\n`));
  assert.deepEqual(issues, []);
});

// ------------------------------------------------------------------ structure et marqueurs
test('structure : un relations.json manquant est signalé', () => {
  const issues = issuesFor((d) => d.remove(REL));
  assertIssue(issues, 'structure.missing-file', /« relations\.json » de l'édition « fr-a »/);
});

test('structure : un edition.json manquant est signalé', () => {
  const issues = issuesFor((d) => d.remove(`${ED}/edition.json`));
  assertIssue(issues, 'structure.missing-file', /« edition\.json » de l'édition « fr-a »/);
});

test('structure : un saga.json manquant est signalé', () => {
  const issues = issuesFor((d) => d.remove(`${SAGA}/saga.json`));
  assertIssue(issues, 'structure.missing-file', /« saga\.json » de la saga « mini-saga »/);
});

test('marqueur : un « À COMPLÉTER » oublié dans un texte est refusé', () => {
  const issues = issuesFor((d) => d.edit(`${ED}/text/fr/characters/ann.json`, (c) => { c.description = 'À COMPLÉTER'; }));
  assertIssue(issues, 'todo.placeholder', /valeur « À COMPLÉTER »/);
});

test('marqueur : un « À COMPLÉTER » oublié dans une note est refusé', () => {
  const issues = issuesFor((d) => d.writeText(`${ED}/text/fr/notes/n-aaaaa.md`, 'À COMPLÉTER\n'));
  assertIssue(issues, 'todo.placeholder', /valeur « À COMPLÉTER »/);
});

// ------------------------------------------------------------------ affichage
test('l\'affichage regroupe par fichier, explique la correction et rappelle « révélé ≠ vrai »', () => {
  const issues = issuesFor((d) => d.edit(REL, (list) => { list[2].end = list[2].start; }));
  const text = formatIssues(issues);
  assert.match(text, /^data\/mini-saga\/editions\/fr-a\/relations\.json/m);
  assert.match(text, /✗ .*n'est pas après « start »/);
  assert.match(text, /→ Comment corriger :/);
  assert.match(text, /ℹ Rappel : « start » \(et « end »\) est le moment où le lecteur l'APPREND/);
  assert.match(text, /1 problème dans 1 fichier\./);
});

test('la commande « check » sort en erreur (code 1) et affiche les explications', () => {
  const dataset = makeDataset((d) => d.edit(REL, (list) => { list[0].to = 'zoe'; }));
  try {
    const result = spawnSync(process.execPath, [path.join(SCRIPTS_DIR, 'check.mjs'), '--data', dataset.dataDir], { encoding: 'utf8' });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /« to » désigne « zoe »/);
    assert.match(result.stderr, /Comment corriger/);
  } finally {
    dataset.cleanup();
  }
});

test('la commande « check » sort en succès (code 0) sur un jeu valide', () => {
  const result = spawnSync(process.execPath, [path.join(SCRIPTS_DIR, 'check.mjs'), '--data', VALID_DATA], { encoding: 'utf8' });
  assert.equal(result.status, 0);
  assert.match(result.stdout, /✓ \d+ fichiers vérifiés, aucun problème\./);
});
