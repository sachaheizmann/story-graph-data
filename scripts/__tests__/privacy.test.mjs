// Le dépôt est PUBLIC : rien de personnel ne doit y entrer (chemin de votre ordinateur, adresse e-mail, réglages ou
// mémoire de l'assistant de code). Ce test relit tous les fichiers qui seraient publiés (suivis ou pas encore ajoutés).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { ROOT_DIR } from '../lib/paths.mjs';

// Fichiers suivis ET fichiers neufs pas encore ajoutés (mais pas ceux que .gitignore écarte) : on juge avant le commit.
const listed = spawnSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], { cwd: ROOT_DIR, encoding: 'utf8' });
const skip = listed.status !== 0 ? 'pas dans un dépôt git' : false;
const files = skip ? [] : listed.stdout.split('\0').filter(Boolean);

// Les motifs sont construits par morceaux pour que ce fichier ne contienne pas lui-même ce qu'il cherche.
const HOME = new RegExp(`(?:/${'home'}/[a-z]|/${'Users'}/[A-Za-z]|[A-Z]:\\\\${'Users'}\\\\|${'Desktop'}/)`);
const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+/g;
const ALLOWED_EMAIL_DOMAINS = ['example.org']; // domaine réservé aux exemples, utilisé dans les tests

const isText = (file) => !/\.(png|jpe?g|gif|ico|pdf|woff2?)$/i.test(file);
const read = (file) => readFileSync(path.join(ROOT_DIR, file), 'utf8');

test('confidentialité : aucun fichier suivi ne contient un chemin de l\'ordinateur de quelqu\'un', { skip }, () => {
  const offenders = files.filter((file) => isText(file) && file !== 'package-lock.json' && HOME.test(read(file)));
  assert.deepEqual(offenders, []);
});

test('confidentialité : aucune adresse e-mail réelle dans les fichiers suivis (seulement des exemples @example.org)', { skip }, () => {
  const found = [];
  for (const file of files.filter(isText)) {
    for (const email of read(file).match(EMAIL) ?? []) {
      if (!ALLOWED_EMAIL_DOMAINS.some((domain) => email.endsWith(`@${domain}`))) found.push(`${file}: ${email}`);
    }
  }
  // Les URL d'installation dans le fichier de verrouillage ne sont pas des e-mails ; on les ignore explicitement.
  assert.deepEqual(found.filter((line) => !line.startsWith('package-lock.json:')), []);
});

test('confidentialité : ni réglages ni mémoire de l\'assistant de code ne sont suivis par git', { skip }, () => {
  const forbidden = files.filter((file) => /(^|\/)(\.claude|memory)(\/|$)|(^|\/)(CLAUDE\.local\.md|MEMORY\.md)$/.test(file));
  assert.deepEqual(forbidden, []);
});

test('confidentialité : .gitignore écarte les réglages personnels de l\'assistant de code', () => {
  const ignore = read('.gitignore').split('\n').map((line) => line.trim());
  for (const entry of ['.claude/', 'CLAUDE.local.md', '.env', 'node_modules/']) assert.ok(ignore.includes(entry), entry);
});

test('confidentialité : les commits n\'utilisent que l\'adresse « noreply » de GitHub', { skip }, () => {
  const log = spawnSync('git', ['log', '--all', '--format=%ae%n%ce'], { cwd: ROOT_DIR, encoding: 'utf8' });
  const emails = new Set(log.stdout.split('\n').filter(Boolean));
  for (const email of emails) assert.match(email, /@users\.noreply\.github\.com$/, email);
});
