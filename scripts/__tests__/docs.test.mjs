// La documentation dit vrai : exemples JSON conformes, liens valides, commandes qui existent, messages exacts,
// et les commandes citées dans CONTRIBUTING.md fonctionnent pour de bon.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createAjv, getValidator } from '../lib/schemas.mjs';
import { checkDataset } from '../lib/check.mjs';
import { ROOT_DIR, DATA_DIR } from '../lib/paths.mjs';
import { formatDataset } from '../lib/format.mjs';
import { SCRIPTS_DIR } from './helpers.mjs';

const read = (...parts) => readFileSync(path.join(ROOT_DIR, ...parts), 'utf8');
const DOCS = { 'README.md': read('README.md'), 'CONTRIBUTING.md': read('CONTRIBUTING.md'), 'docs/MAINTAINER.md': read('docs', 'MAINTAINER.md') };
const readme = DOCS['README.md'];
const contributing = DOCS['CONTRIBUTING.md'];
const pkg = JSON.parse(read('package.json'));
const normalize = (text) => text.replace(/\s+/g, ' ').trim();

const RULE = '**Chaque `start` est le moment où le lecteur l\'apprend, jamais le moment où c\'est vrai dans l\'histoire.**';
const DEATH_RULE = '**La mort d\'un personnage passe par le `end` du personnage, jamais par le `end` d\'un lien familial.**';

// ------------------------------------------------------------------ la règle et le contenu attendu
test('README : la règle « révélé ≠ vrai » est en gras, avec l\'exemple de Vador', () => {
  assert.ok(readme.includes(RULE));
  assert.match(readme, /^## La règle qui gouverne tout : « révélé ≠ vrai »$/m);
  assert.match(readme, /Vador est le père de Luke depuis la naissance de Luke, mais le spectateur ne l'apprend que dans le film 5/);
  assert.match(readme, /\*\*Conséquence : la description d'un personnage ne contient que ce qui est connu à son `start`\.\*\*/);
});

test('README : un emplacement balisé pour l\'adresse du site, qui n\'existe pas encore', () => {
  const markers = readme.match(/^<!-- TODO: URL du site -->$/gm) ?? [];
  assert.equal(markers.length, 1, 'le repère « <!-- TODO: URL du site --> » est présent une fois, sur sa propre ligne');
  assert.match(readme, /^## Le site$/m);
});

test('README : présente les deux dépôts, l\'arborescence, la démo, et les deux licences', () => {
  for (const heading of ['Comment les données sont organisées', 'Où se trouve quoi', 'Les deux dépôts', 'Le modèle de données en bref', 'Pour commencer', 'La saga de démonstration', 'Contribuer', 'Licences']) {
    assert.match(readme, new RegExp(`^## ${heading}$`, 'm'), heading);
  }
  assert.match(readme, /CC BY-SA 4\.0/);
  assert.match(readme, /\[MIT\]\(LICENSE-SCRIPTS\)/);
  assert.match(readme, /dépôt \*\*privé\*\*/);
  assert.match(readme, /Neutre|neutre/);
  assert.match(readme, /Une édition = une copie complète et indépendante/);
  assert.match(readme, /Un traducteur ne touche jamais aux `start`/);
});

test('README : l\'arborescence décrite existe vraiment', () => {
  const tree = readme.match(/```\ndata\/\n[\s\S]*?```/)[0];
  for (const entry of ['_common', 'relation-types.json', 'authors', 'saga.json', 'editions', 'edition.json', 'relations.json', 'characters', 'notes', 'schema', 'scripts', 'docs/MAINTAINER.md', '.github', 'CONTRIBUTING.md']) {
    assert.ok(tree.includes(entry), entry);
  }
  for (const rel of ['schema', 'scripts', 'docs/MAINTAINER.md', '.github', 'CONTRIBUTING.md', 'data/_common/relation-types.json', 'data/authors', 'data/couronne-de-brume/saga.json']) {
    assert.ok(existsSync(path.join(ROOT_DIR, rel)), rel);
  }
});

test('CONTRIBUTING : la règle d\'or est en gras et les 8 rubriques demandées sont là, dans l\'ordre', () => {
  assert.ok(contributing.includes(RULE));
  const titles = [...contributing.matchAll(/^## (\d+)\. (.+)$/gm)].map((m) => [Number(m[1]), m[2]]);
  assert.deepEqual(titles.map(([n]) => n), [1, 2, 3, 4, 5, 6, 7, 8, 9]);
  assert.deepEqual(titles.slice(0, 8).map(([, t]) => t.split(/[ ,:(]/)[0]), ['Le', 'Ajouter', 'Traduire', 'Créer', 'La', 'Droit', 'Relire', 'Règles']);
  assert.match(titles[0][1], /parcours d'une contribution/);
  assert.match(titles[2][1], /^Traduire$/);
  assert.match(titles[5][1], /Droit d'auteur/);
  assert.match(titles[6][1], /Relire la Pull Request d'un autre/);
  assert.match(titles[7][1], /courtoisie/);
});

test('CONTRIBUTING : le workflow, les commandes et la limite à data/ sont expliqués', () => {
  for (const text of ['Faites un fork', 'git checkout -b', 'npm run format', 'npm run check', 'Ouvrez la Pull Request', 'data/', 'jusqu\'où vous avez lu']) {
    assert.ok(contributing.includes(text), text);
  }
  assert.match(contributing, /Ne modifiez \*\*que\*\* `data\/`/);
  for (const command of ['npm run new-character', 'npm run new-note', 'npm run new-edition', 'npm run coverage']) assert.ok(contributing.includes(command), command);
  assert.match(contributing, /text\/<langue>\//);
  assert.match(contributing, /Node\.js\]\(https:\/\/nodejs\.org\) \*\*22 ou plus récent\*\*/);
  assert.match(readme, /\*\*22 ou plus récent\*\*/);
  assert.equal(pkg.engines.node, '>=22');
});

test('CONTRIBUTING : la mort d\'un personnage passe par le end du personnage (exemple d\'Edrin et Maelis)', () => {
  assert.ok(contributing.includes(DEATH_RULE));
  assert.match(contributing, /Prenons Edrin, le roi de Brume/);
  assert.match(contributing, /Son mariage avec Maelis \*\*reste\*\*/);
  assert.match(contributing, /Ce qu'il ne faut \*\*pas\*\* faire/);
  assert.match(contributing, /Ilan reste son fils/);
});

test('CONTRIBUTING : explique l\'avertissement family.end-at-death et pourquoi il ne bloque pas', () => {
  assert.match(contributing, /^### L'avertissement `family\.end-at-death`$/m);
  assert.match(contributing, /\*\*Il ne bloque pas la validation, et c'est voulu\.\*\*/);
  assert.match(contributing, /un divorce, un reniement, une annulation de mariage/);
  assert.match(contributing, /annotation jaune/);
  assert.match(contributing, /dites-le dans la description de votre Pull Request/);
});

test('CONTRIBUTING : droit d\'auteur (faits, propres mots, 600 caractères) et relecture (« lu jusqu\'au chapitre N »)', () => {
  assert.match(contributing, /\*\*On enregistre des faits\*\*/);
  assert.match(contributing, /\*\*On écrit avec ses propres mots\.\*\*/);
  assert.match(contributing, /600 caractères au plus/);
  assert.match(contributing, /Si vous n'avez lu le livre que jusqu'au chapitre N, vous ne pouvez relire que jusque-là/);
  assert.match(contributing, /Soyez bienveillant/);
  assert.match(contributing, /Soyez bref/);
});

// ------------------------------------------------------------------ commandes citées
test('toutes les commandes « npm run <nom> » citées dans la documentation existent dans package.json', () => {
  for (const [file, text] of Object.entries(DOCS)) {
    for (const [, name] of text.matchAll(/npm run ([a-z][a-z:-]*)/g)) assert.ok(name in pkg.scripts, `${file} cite « npm run ${name} », qui n'existe pas`);
  }
  for (const name of ['check', 'format', 'coverage', 'new-character', 'new-note', 'new-edition', 'test', 'privacy:history']) assert.ok(name in pkg.scripts, name);
});

// ------------------------------------------------------------------ liens et ancres
const slug = (title) => title.toLowerCase().replace(/[^\p{L}\p{N}_\s-]/gu, '').replace(/ /g, '-');
const anchorsOf = (text) => new Set([...text.matchAll(/^#{1,6} (.+)$/gm)].map((m) => slug(m[1])));

test('les liens relatifs et les ancres de README.md et CONTRIBUTING.md mènent quelque part', () => {
  for (const file of ['README.md', 'CONTRIBUTING.md']) {
    const text = DOCS[file];
    const baseDir = path.dirname(path.join(ROOT_DIR, file));
    for (const [, target, anchor] of text.matchAll(/\]\((?!https?:)([^)#\s]*)(?:#([^)\s]+))?\)/g)) {
      const destination = target === '' ? path.join(ROOT_DIR, file) : path.join(baseDir, target);
      assert.ok(existsSync(destination), `${file} : lien cassé vers « ${target} »`);
      if (anchor && destination.endsWith('.md')) {
        assert.ok(anchorsOf(readFileSync(destination, 'utf8')).has(anchor), `${file} : l'ancre « #${anchor} » n'existe pas dans ${path.relative(ROOT_DIR, destination)}`);
      }
    }
  }
});

test('les adresses GitHub de la documentation utilisent le vrai dépôt', () => {
  for (const [file, text] of Object.entries(DOCS)) {
    for (const [url] of text.matchAll(/https:\/\/github\.com\/[^\s)]+/g)) {
      assert.match(url, /^https:\/\/github\.com\/(sachaheizmann\/story-graph-data|<votre-pseudo>\/story-graph-data)/, `${file} : ${url}`);
    }
  }
});

// ------------------------------------------------------------------ exemples JSON
/** Tous les blocs ```json de la documentation, avec le repère qui les précède. */
function jsonBlocks(file) {
  const blocks = [];
  const lines = DOCS[file].split('\n');
  for (let i = 0; i < lines.length; i += 1) {
    if (!/^\s*```json\s*$/.test(lines[i])) continue;
    const marker = lines.slice(Math.max(0, i - 2), i).reverse().find((l) => l.trim().startsWith('<!--')) ?? '';
    const indent = lines[i].match(/^ */)[0].length;
    const body = [];
    let j = i + 1;
    while (!/^\s*```\s*$/.test(lines[j])) { body.push(lines[j].slice(indent)); j += 1; }
    blocks.push({ file, marker: marker.trim(), text: body.join('\n'), line: i + 1 });
  }
  return blocks;
}
const ALL_BLOCKS = ['README.md', 'CONTRIBUTING.md'].flatMap(jsonBlocks);

test('chaque exemple JSON est repéré par un commentaire, qui dit d\'où il vient ou quel schéma il respecte', () => {
  assert.ok(ALL_BLOCKS.length >= 10);
  for (const block of ALL_BLOCKS) {
    assert.match(block.marker, /^<!-- (exemple tiré de : \S+|schéma : [a-z-]+) -->$/, `${block.file} ligne ${block.line} : exemple sans repère`);
  }
});

test('les exemples « tirés de » un fichier de la démo sont identiques à ce fichier', () => {
  const sourced = ALL_BLOCKS.filter((b) => b.marker.includes('exemple tiré de'));
  assert.ok(sourced.length >= 8);
  for (const block of sourced) {
    const [, source] = block.marker.match(/exemple tiré de : (\S+)/);
    const [file, ids] = source.split('#');
    const actual = JSON.parse(readFileSync(path.join(ROOT_DIR, file), 'utf8'));
    const expected = ids ? ids.split(',').map((id) => actual.find((item) => item.id === id)) : actual;
    assert.ok(!Array.isArray(expected) || expected.every(Boolean), `${block.file} : un identifiant de ${file} n'existe pas`);
    const shown = JSON.parse(block.text);
    // Un seul identifiant demandé : l'exemple est l'objet, pas une liste d'un élément.
    assert.deepEqual(shown, ids && !ids.includes(',') ? expected[0] : expected, `${block.file} ligne ${block.line} : l'exemple ne correspond plus à ${source}`);
  }
});

test('les exemples « schéma » sont valides selon le schéma indiqué', () => {
  const ajv = createAjv();
  const shown = ALL_BLOCKS.filter((b) => b.marker.includes('schéma'));
  assert.ok(shown.length >= 3);
  for (const block of shown) {
    const [, name] = block.marker.match(/schéma : ([a-z-]+)/);
    const validate = getValidator(ajv, name);
    assert.equal(validate(JSON.parse(block.text)), true, `${block.file} ligne ${block.line} : ${JSON.stringify(validate.errors)}`);
  }
});

test('les phrases de la démo citées dans CONTRIBUTING.md sont exactement celles des fichiers', () => {
  const ed = 'data/couronne-de-brume/editions/fr-original';
  const kael = JSON.parse(readFileSync(path.join(ROOT_DIR, ed, 'text/fr/characters/kael.json'), 'utf8'));
  assert.ok(contributing.includes(`« ${kael.description} »`), 'la description de Kael citée dans le tableau a changé');
  const note = readFileSync(path.join(ROOT_DIR, ed, 'text/fr/notes/n-4gevr.md'), 'utf8').trim();
  assert.ok(contributing.includes(`> ${note}`), 'la note du chapitre 9 citée a changé');
  // La note du chapitre 9 suggère sans dévoiler : elle ne contient aucun mot de parenté (la fratrie est révélée au chapitre 20).
  assert.doesNotMatch(note, /frère|sœur|père|fils|fille|parent|famille/i);
});

// ------------------------------------------------------------------ le tableau des types de liens
test('README : le tableau des types de liens correspond exactement à data/_common', () => {
  const types = JSON.parse(read('data', '_common', 'relation-types.json'));
  const labels = JSON.parse(read('data', '_common', 'text', 'fr', 'relation-types.json'));
  const section = readme.split('### Les types de liens')[1].split(/^## /m)[0]; // jusqu'au titre suivant : pas le tableau des commandes
  const table = section.split('\n').filter((l) => /^\| `/.test(l));
  assert.equal(table.length, Object.keys(types).length, 'un type manque ou est en trop');
  for (const row of table) {
    const [, type, category, directed, label, reverse] = row.split('|').map((c) => c.trim().replace(/^`|`$/g, ''));
    assert.ok(type in types, `type inconnu : ${type}`);
    assert.equal(category, types[type].category === 'family' ? 'famille' : 'social', type);
    assert.equal(directed.startsWith('oui'), types[type].directed, type);
    assert.equal(label, labels[type].label, type);
    assert.equal(reverse, labels[type].reverse_label ?? '', type);
  }
});

// ------------------------------------------------------------------ messages exacts
test('le tableau des messages de « npm run check » ne cite que des extraits de vrais messages', () => {
  const source = readdirSync(path.join(SCRIPTS_DIR, 'lib'), { recursive: true, withFileTypes: true })
    .filter((e) => e.isFile() && e.name.endsWith('.mjs'))
    .map((e) => readFileSync(path.join(e.parentPath ?? e.path, e.name), 'utf8')).join('\n');
  const section = contributing.split('## 9. Comprendre')[1];
  const fragments = [...section.matchAll(/^\| `([^`]+)` \|/gm)].map((m) => m[1]);
  assert.ok(fragments.length >= 10);
  for (const fragment of fragments) assert.ok(source.includes(fragment), `« ${fragment} » n'apparaît dans aucun message des scripts`);
});

test('l\'avertissement montré dans CONTRIBUTING est celui que produit vraiment le mariage terminé à la mort d\'Edrin', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'book-tree-doc-'));
  try {
    const dataDir = path.join(root, 'data');
    cpSync(DATA_DIR, dataDir, { recursive: true });
    const file = path.join(dataDir, 'couronne-de-brume/editions/fr-original/relations.json');
    const relations = JSON.parse(readFileSync(file, 'utf8'));
    relations.find((r) => r.id === 'edrin-maelis-spouse-1').end = { book: 'tome-1', chapter: 12 }; // l'exemple « à ne pas faire »
    writeFileSync(file, `${JSON.stringify(relations, null, 2)}\n`);
    const { errors, warnings } = checkDataset(dataDir);
    assert.equal(errors.length, 0, 'ce n\'est pas une erreur : l\'avertissement ne bloque pas');
    assert.equal(warnings.length, 1);
    assert.equal(warnings[0].rule, 'family.end-at-death');
    assert.ok(normalize(contributing).includes(normalize(`Avertissement : ${warnings[0].message}`)), `le message affiché dans CONTRIBUTING.md a changé :\n${warnings[0].message}`);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

// ------------------------------------------------------------------ les commandes de CONTRIBUTING fonctionnent
/** « --a b --c "d e" » -> ['--a', 'b', '--c', 'd e'] */
const tokenize = (text) => [...text.matchAll(/"([^"]*)"|(\S+)/g)].map((m) => m[1] ?? m[2]);
const documented = (script) => {
  const line = contributing.split('\n').find((l) => l.startsWith(`npm run ${script} -- `));
  assert.ok(line, `CONTRIBUTING.md ne contient pas de commande « npm run ${script} -- … »`);
  return tokenize(line.slice(`npm run ${script} -- `.length));
};
const skipShell = process.platform === 'win32';
const emptyPath = mkdtempSync(path.join(tmpdir(), 'book-tree-nogh-'));
const runScript = (script, args, dataDir) => spawnSync(process.execPath, [path.join(SCRIPTS_DIR, `${script}.mjs`), ...args, '--data', dataDir], {
  encoding: 'utf8', env: { ...process.env, PATH: emptyPath },
});

test('les commandes new-character, new-note et new-edition de CONTRIBUTING.md s\'exécutent, et le lien d\'exemple est valide', { skip: skipShell }, () => {
  const root = mkdtempSync(path.join(tmpdir(), 'book-tree-doc-'));
  try {
    const dataDir = path.join(root, 'data');
    cpSync(DATA_DIR, dataDir, { recursive: true });

    // 1. le personnage (on ajoute le nom et la description que la doc dit de compléter)
    const character = runScript('new-character', [...documented('new-character'), '--name', 'Mira', '--description', 'Une voyageuse.'], dataDir);
    assert.equal(character.status, 0, character.stderr);
    assert.ok(existsSync(path.join(dataDir, 'couronne-de-brume/editions/fr-original/characters/mira.json')));

    // 2. le lien d'exemple de la doc, ajouté à relations.json
    const example = ALL_BLOCKS.find((b) => b.file === 'CONTRIBUTING.md' && b.text.includes('mira-aria-friend-1'));
    assert.ok(example, 'le lien d\'exemple existe dans CONTRIBUTING.md');
    const file = path.join(dataDir, 'couronne-de-brume/editions/fr-original/relations.json');
    writeFileSync(file, JSON.stringify([...JSON.parse(readFileSync(file, 'utf8')), JSON.parse(example.text)]));
    formatDataset(dataDir, { write: true });

    // 3. la note
    const note = runScript('new-note', documented('new-note'), dataDir);
    assert.equal(note.status, 0, note.stderr);
    assert.match(note.stdout, /Note « n-[a-z0-9]{5} » créée/);

    // 4. l'édition (la doc laisse le reste à demander dans le terminal : on le donne ici)
    const edition = runScript('new-edition', [...documented('new-edition'), '--github', 'demo-user', '--language', 'fr', '--publisher', 'Éditions Collector', '--year', '2020'], dataDir);
    assert.equal(edition.status, 0, edition.stderr);

    const { errors, warnings } = checkDataset(dataDir);
    assert.deepEqual(errors, [], errors.map((e) => `${e.file}: ${e.message}`).join('\n'));
    assert.deepEqual(warnings, []);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('la commande de traduction citée dans CONTRIBUTING.md (coverage --edition … --list) s\'exécute', { skip: skipShell }, () => {
  const line = contributing.split('\n').find((l) => l.trim().startsWith('npm run coverage -- --edition'));
  assert.ok(line);
  const result = runScript('coverage', tokenize(line.trim().slice('npm run coverage -- '.length)), DATA_DIR);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /à traduire, personnages/);
});
