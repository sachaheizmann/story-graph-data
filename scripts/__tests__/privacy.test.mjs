// Le dépôt est PUBLIC : rien de personnel ne doit y entrer (chemin d'ordinateur, adresse e-mail, réglages ou mémoire
// d'un assistant de code). Ce test relit les fichiers SUIVIS par git.
//
// Il ne regarde volontairement PAS l'historique des commits : un contributeur signe les siens avec son vrai e-mail, et
// une Pull Request est fusionnée sous le nom de son auteur. L'historique se vérifie à part, par le mainteneur, avec
// « npm run privacy:history » (voir scripts/privacy-history.mjs).
//
// Aucun nom, e-mail ni chemin réel n'est écrit ici : les motifs sont génériques (scripts/lib/privacy.mjs) et les
// exemples sont assemblés à l'exécution.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { ROOT_DIR } from '../lib/paths.mjs';
import { findPersonalData, isAllowedEmail, isAssistantFile, isBinaryFile } from '../lib/privacy.mjs';

const listed = spawnSync('git', ['ls-files', '-z'], { cwd: ROOT_DIR, encoding: 'utf8' });
const skip = listed.status !== 0 ? 'pas dans un dépôt git' : false;
const files = skip ? [] : listed.stdout.split('\0').filter(Boolean);
const read = (file) => readFileSync(path.join(ROOT_DIR, file), 'utf8');

// ------------------------------------------------------------------ les fichiers du dépôt
test('confidentialité : aucun fichier suivi ne contient de chemin d\'ordinateur ni d\'adresse e-mail personnelle', { skip }, () => {
  const found = [];
  for (const file of files.filter((f) => !isBinaryFile(f))) {
    for (const { kind, value } of findPersonalData(read(file))) found.push(`${file} : ${kind} « ${value} »`);
  }
  assert.deepEqual(found, []);
});

test('confidentialité : les fichiers de ces contrôles eux-mêmes n\'en contiennent pas non plus (même avant d\'être ajoutés à git)', () => {
  for (const file of ['scripts/lib/privacy.mjs', 'scripts/lib/privacy-history.mjs', 'scripts/privacy-history.mjs',
    'scripts/__tests__/privacy.test.mjs', 'scripts/__tests__/privacy-history.test.mjs']) {
    assert.deepEqual(findPersonalData(read(file)), [], file);
  }
});

test('confidentialité : ni réglages ni mémoire d\'un assistant de code ne sont suivis par git', { skip }, () => {
  assert.deepEqual(files.filter(isAssistantFile), []);
});

test('confidentialité : .gitignore écarte les réglages personnels de l\'assistant de code', () => {
  const ignore = read('.gitignore').split('\n').map((line) => line.trim());
  for (const entry of ['.claude/', 'CLAUDE.local.md', '.env', 'node_modules/']) assert.ok(ignore.includes(entry), entry);
});

test('confidentialité : ce test ne regarde pas l\'historique (il ne peut donc pas échouer à cause du e-mail d\'un contributeur)', () => {
  const source = read('scripts/__tests__/privacy.test.mjs');
  // Les mots recherchés sont assemblés ici pour que ce test ne se reconnaisse pas lui-même.
  const historyCommands = new RegExp(`git['", ]+(${['lo', 'g'].join('')}|${['sh', 'ow'].join('')}|rev-${['li', 'st'].join('')}|ref${['lo', 'g'].join('')})`);
  const extraFiles = new RegExp(`--${'oth'}ers|--${'cac'}hed`);
  const code = source.split('\n').filter((line) => !line.trim().startsWith('//')).join('\n');
  assert.doesNotMatch(code, historyCommands);
  assert.doesNotMatch(code, extraFiles, 'il ne liste que les fichiers suivis par git');
  assert.match(code, /'ls-files', '-z'\]/);
});

// ------------------------------------------------------------------ les motifs (exemples assemblés à l'exécution)
const at = '@';
const slash = '/';

test('motifs : un dossier personnel est repéré sous Linux, macOS et Windows', () => {
  const samples = [
    `${slash}${'home'}${slash}alice${slash}projet`,
    `${slash}${'Users'}${slash}bob${slash}Documents`,
    `C:\\${'Users'}\\Carol\\Bureau`,
    `D:${slash}${'Users'}${slash}dave${slash}x`,
  ];
  for (const sample of samples) {
    const found = findPersonalData(`fichier lu dans ${sample} hier`);
    assert.equal(found.length, 1, sample);
    assert.equal(found[0].kind, "chemin d'ordinateur");
  }
});

test('motifs : ne sont pas repérés : les modèles génériques et l\'utilisateur des machines de GitHub Actions', () => {
  for (const ok of [`${slash}${'home'}${slash}<votre-pseudo>${slash}projet`, `${slash}${'home'}${slash}runner${slash}work`, 'un dossier home', `${slash}${'home'}`]) {
    assert.deepEqual(findPersonalData(ok), [], ok);
  }
});

test('motifs : une adresse e-mail ordinaire est repérée', () => {
  const found = findPersonalData(`contact : alice.martin${at}perso.fr, ou bob+lecture${at}mail.example.fr`);
  assert.deepEqual(found.map((f) => f.value), [`alice.martin${at}perso.fr`, `bob+lecture${at}mail.example.fr`]);
  assert.ok(found.every((f) => f.kind === 'adresse e-mail'));
});

test('motifs : sont admises : l\'adresse noreply de GitHub, toute adresse noreply, et les domaines d\'exemple', () => {
  for (const email of [`123456+demo${at}users.noreply.github.com`, `demo${at}users.noreply.github.com`, `noreply${at}exemple-de-service.io`,
    `no-reply${at}autre.io`, `t${at}example.org`, `x${at}example.com`, `y${at}example.net`]) {
    assert.equal(isAllowedEmail(email), true, email);
    assert.deepEqual(findPersonalData(`écrit par ${email}.`), [], email);
  }
});

test('motifs : une adresse presque « noreply » ne passe pas', () => {
  for (const email of [`noreply2${at}perso.fr`, `alice${at}noreply.fr`, `alice${at}users.noreply.github.com.perso.fr`, `alice${at}example.org.fr`]) {
    assert.equal(isAllowedEmail(email), false, email);
  }
});

test('motifs : un numéro de version collé à un nom n\'est pas une adresse e-mail', () => {
  assert.deepEqual(findPersonalData(`npm install paquet${at}8.20.0 et outil${at}1.2.3-beta`), []);
});

test('réglages d\'assistant et fichiers binaires : reconnus par leur chemin', () => {
  for (const file of ['.claude/settings.local.json', 'a/.claude/x', 'memory/notes.md', 'CLAUDE.local.md', 'docs/MEMORY.md']) assert.equal(isAssistantFile(file), true, file);
  for (const file of ['README.md', 'CLAUDE.md', 'data/memory-of-the-world/saga.json']) assert.equal(isAssistantFile(file), false, file);
  assert.equal(isBinaryFile('logo.PNG'), true);
  assert.equal(isBinaryFile('README.md'), false);
});
