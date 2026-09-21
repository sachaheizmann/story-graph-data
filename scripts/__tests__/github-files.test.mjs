// CODEOWNERS, modèles d'issue et de Pull Request, guide du mainteneur : ce qu'ils doivent contenir.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { ROOT_DIR } from '../lib/paths.mjs';

const read = (...parts) => readFileSync(path.join(ROOT_DIR, ...parts), 'utf8');
const OWNER = '@sachaheizmann';

// ------------------------------------------------------------------ CODEOWNERS
/** Lignes actives de CODEOWNERS : [{ pattern, owners }] (les commentaires sont ignorés). */
const codeowners = read('.github', 'CODEOWNERS').split('\n')
  .filter((line) => line.trim() !== '' && !line.trim().startsWith('#'))
  .map((line) => { const [pattern, ...owners] = line.trim().split(/\s+/); return { pattern, owners }; });
const ownersOf = (pattern) => codeowners.find((entry) => entry.pattern === pattern)?.owners;

test('CODEOWNERS : schema/, scripts/, .github/, docs/ et les fichiers de la racine appartiennent au mainteneur', () => {
  for (const pattern of ['/schema/', '/scripts/', '/.github/', '/docs/', '/*']) {
    assert.deepEqual(ownersOf(pattern), [OWNER], pattern);
  }
});

test('CODEOWNERS : data/ n\'a pas de propriétaire, sauf le fichier des types de liens (décision du mainteneur)', () => {
  assert.deepEqual(ownersOf('/data/'), [], 'la ligne « /data/ » sans propriétaire est présente');
  assert.deepEqual(ownersOf('/data/_common/relation-types.json'), [OWNER]);
  const indexOf = (pattern) => codeowners.findIndex((entry) => entry.pattern === pattern);
  assert.ok(indexOf('/*') < indexOf('/data/'), '« /* » vient avant : la dernière règle qui correspond gagne');
  assert.ok(indexOf('/data/') < indexOf('/data/_common/relation-types.json'));
});

test('CODEOWNERS : le seul propriétaire déclaré est le mainteneur, et un exemple de relecteur de langue est commenté', () => {
  const everyone = new Set(codeowners.flatMap((entry) => entry.owners));
  assert.deepEqual([...everyone], [OWNER]);
  assert.match(read('.github', 'CODEOWNERS'), /^# \/data\/\*\/editions\/\*\/text\/en\/\s+@pseudo-du-relecteur @sachaheizmann$/m);
});

// ------------------------------------------------------------------ modèle de Pull Request
test('modèle de PR : contient les quatre cases obligatoires', () => {
  const template = read('.github', 'PULL_REQUEST_TEMPLATE.md');
  const boxes = [...template.matchAll(/^- \[ \] (.+)$/gm)].map((m) => m[1]);
  assert.ok(boxes.some((b) => /respecté la règle \*\*« révélé ≠ vrai »\*\*/.test(b)));
  assert.ok(boxes.some((b) => /aucun spoiler au-delà de leur `start`/.test(b)));
  assert.ok(boxes.some((b) => /aucun passage du livre/.test(b)));
  assert.ok(boxes.some((b) => /`npm run check` passe/.test(b)));
  assert.ok(boxes.some((b) => /`end` \*\*du personnage\*\*.*jamais avec le `end` d'un lien familial/.test(b)), 'la règle de la mort d\'un personnage');
  assert.match(template, /Tome `…`, chapitre `…`/, 'la position de lecture du relecteur');
});

// ------------------------------------------------------------------ modèles d'issue
const issueForm = (name) => read('.github', 'ISSUE_TEMPLATE', name);

test('modèles d\'issue : « Signaler un spoiler », « Bug » et « Suggestion » existent, en français, sans tabulation', () => {
  for (const [file, title, label] of [['spoiler.yml', 'Signaler un spoiler', 'spoiler'], ['bug.yml', 'Signaler un bug', 'bug'], ['suggestion.yml', 'Faire une suggestion', 'enhancement']]) {
    const text = issueForm(file);
    assert.match(text, new RegExp(`^name: ${title}$`, 'm'), file);
    assert.match(text, new RegExp(`^labels: \\["${label}"\\]$`, 'm'), file);
    assert.match(text, /^body:$/m, file);
    assert.equal(text.includes('\t'), false, `${file} : le YAML n'accepte pas les tabulations`);
  }
});

test('modèle « spoiler » : demande l\'élément, la position de lecture et ce qui est révélé, et rappelle « révélé ≠ vrai »', () => {
  const text = issueForm('spoiler.yml');
  for (const id of ['edition', 'element', 'element-id', 'reading-position', 'revealed']) {
    assert.match(text, new RegExp(`id: ${id}\\n(?:.*\\n)*?.*\\n?`), id);
    assert.match(text, new RegExp(`^ {4}id: ${id}$`, 'm'), `champ « ${id} »`);
  }
  assert.match(text, /Position de lecture/);
  assert.match(text, /chaque `start` est le moment où le lecteur l'apprend, jamais le moment où c'est vrai dans l'histoire/);
  assert.match(text, /<details>/, 'le détail du spoiler est caché par défaut');
  assert.match(text, /Cette issue est publique/);
});

// ------------------------------------------------------------------ guide du mainteneur
const guide = read('docs', 'MAINTAINER.md');

test('MAINTAINER.md : « Require review from Code Owners » est le premier réglage et il est marqué OBLIGATOIRE', () => {
  const sections = [...guide.matchAll(/^## (\d+)\. (.+)$/gm)].map((m) => ({ number: Number(m[1]), title: m[2] }));
  assert.equal(sections[0].number, 1, 'la première section numérotée est la n° 1');
  assert.match(sections[0].title, /OBLIGATOIRE.*Require review from Code Owners/);

  // La liste de mise en route commence par ce réglage.
  const checklist = [...guide.matchAll(/^\d+\. \[ \] (.+)$/gm)].map((m) => m[1]);
  assert.match(checklist[0], /Require review from Code Owners.*OBLIGATOIRE/);

  // Aucun autre réglage n'est détaillé avant la section 1.
  const beforeSection1 = guide.slice(0, guide.indexOf('## 1.'));
  assert.doesNotMatch(beforeSection1, /Add branch protection rule|New repository secret/);
});

test('MAINTAINER.md : dit que la vraie protection est Code Owners et que le contrôle de périmètre n\'est qu\'une aide', () => {
  assert.match(guide, /\*\*La vraie protection du dépôt, c'est le réglage « Require review from Code Owners »/);
  assert.match(guide, /Le contrôle de périmètre automatique n'est qu'une \*\*aide\*\*/);
});

test('MAINTAINER.md : décrit « Require approval for all outside collaborators » et le secret DEPLOY_HOOK_URL', () => {
  assert.match(guide, /\*\*Require approval for all outside collaborators\*\*/);
  assert.match(guide, /Name\*\* : `DEPLOY_HOOK_URL`/);
  assert.match(guide, /jamais affichée dans les journaux/);
});

test('MAINTAINER.md : signale le piège du mainteneur seul (on ne peut pas approuver sa propre PR)', () => {
  assert.match(guide, /interdit d'approuver sa propre Pull Request/);
  assert.match(guide, /\*\*décochée\*\* la case \*\*Do not allow bypassing the above settings\*\*/);
});

test('MAINTAINER.md : explique comment relire une PR et ajouter un type de lien (avec reverse_label)', () => {
  assert.match(guide, /^## Relire une Pull Request$/m);
  assert.match(guide, /^## Ajouter un type de lien$/m);
  assert.match(guide, /`reverse_label` \*\*obligatoire pour un type orienté\*\*/);
  assert.match(guide, /jamais\*\* se terminer à cause d'un décès|\*\*jamais\*\* se terminer à cause d'un décès/);
});

test('MAINTAINER.md : les liens relatifs pointent vers des fichiers qui existent, et les ancres vers des titres qui existent', () => {
  for (const [, target] of guide.matchAll(/\]\((\.\.?\/[^)#]+)\)/g)) {
    assert.ok(existsSync(path.join(ROOT_DIR, 'docs', target)), `lien cassé : ${target}`);
  }
  // Même algorithme que GitHub : minuscules, ponctuation retirée, chaque espace devient un tiret (sans les regrouper).
  const slug = (title) => title.toLowerCase().replace(/[^\p{L}\p{N}_\s-]/gu, '').replace(/ /g, '-');
  const anchors = new Set([...guide.matchAll(/^#{1,3} (.+)$/gm)].map((m) => slug(m[1])));
  for (const [, anchor] of guide.matchAll(/\]\(#([^)]+)\)/g)) assert.ok(anchors.has(anchor), `ancre inconnue : #${anchor}`);
});

test('MAINTAINER.md : les adresses GitHub utilisent le vrai dépôt', () => {
  const urls = [...guide.matchAll(/https:\/\/github\.com\/[^\s)]+/g)].map((m) => m[0]);
  assert.ok(urls.length > 5);
  for (const url of urls) assert.match(url, /^https:\/\/github\.com\/sachaheizmann\/story-graph-data(\/|$)/, url);
});
