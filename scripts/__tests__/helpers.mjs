// Outils partagés par les tests : copier le jeu de données valide dans un dossier temporaire, l'abîmer, le vérifier.
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { checkDataset } from '../lib/check.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
export const VALID_DATA = path.join(here, 'fixtures', 'valid', 'data');
export const SCRIPTS_DIR = path.join(here, '..');

/** Copie le jeu valide dans un dossier temporaire et renvoie de quoi le modifier. */
export function makeDataset(mutate) {
  const root = mkdtempSync(path.join(tmpdir(), 'book-tree-test-'));
  const dataDir = path.join(root, 'data');
  cpSync(VALID_DATA, dataDir, { recursive: true });
  const at = (rel) => path.join(dataDir, ...rel.split('/'));
  const api = {
    root,
    dataDir,
    at,
    readJson: (rel) => JSON.parse(readFileSync(at(rel), 'utf8')),
    writeText(rel, text) {
      mkdirSync(path.dirname(at(rel)), { recursive: true });
      writeFileSync(at(rel), text);
    },
    writeJson(rel, value) {
      api.writeText(rel, `${JSON.stringify(value, null, 2)}\n`);
    },
    /** Lit un fichier JSON, applique fn (qui modifie l'objet, ou en renvoie un autre) et le réécrit. */
    edit(rel, fn) {
      const value = api.readJson(rel);
      const result = fn(value);
      api.writeJson(rel, result === undefined ? value : result);
    },
    remove: (rel) => rmSync(at(rel), { recursive: true, force: true }),
    copy: (from, to) => cpSync(at(from), at(to), { recursive: true }),
    cleanup: () => rmSync(root, { recursive: true, force: true }),
  };
  if (mutate) mutate(api);
  return api;
}

/** Abîme une copie du jeu valide puis renvoie les problèmes trouvés. */
export function issuesFor(mutate) {
  const dataset = makeDataset(mutate);
  try {
    return checkDataset(dataset.dataDir).issues;
  } finally {
    dataset.cleanup();
  }
}

/** Vérifie qu'un problème de cette règle existe, avec un message français qui contient `message`. */
export function assertIssue(issues, rule, message, { file } = {}) {
  const ofRule = issues.filter((i) => i.rule === rule);
  assert.ok(ofRule.length > 0,
    `Aucun problème « ${rule} » trouvé. Problèmes reçus :\n${issues.map((i) => `  [${i.rule}] ${i.message}`).join('\n') || '  (aucun)'}`);
  const matching = ofRule.filter((i) => (message === undefined || i.message.match(message)) && (file === undefined || i.file.includes(file)));
  assert.ok(matching.length > 0,
    `Le problème « ${rule} » existe mais pas avec ce message/fichier (${message} / ${file}). Reçus :\n${ofRule.map((i) => `  ${i.file}: ${i.message}`).join('\n')}`);
  return matching[0];
}

export const ED = 'mini-saga/editions/fr-a';
export const SAGA = 'mini-saga';
