// Format canonique des fichiers de data/ : le même résultat quel que soit l'éditeur ou l'auteur.
//   JSON : indentation de 2 espaces, clés dans l'ordre du schéma, LF, retour à la ligne final.
//          Dictionnaires (types de liens et leurs libellés) triés par ordre alphabétique.
//          relations.json trié par « id » ; liens non orientés remis dans l'ordre alphabétique (from < to).
//   Markdown : LF, un seul retour à la ligne final.
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { loadSchemas } from './schemas.mjs';
import { SCHEMA_OF, classify, displayPath, isSymlink, scanFiles } from './dataset.mjs';

const SCHEMAS = loadSchemas();

/** Suit les « $ref » jusqu'au schéma réel : { schema, doc } (doc = nom du fichier de schéma courant). */
function deref(schema, doc) {
  let current = schema;
  let currentDoc = doc;
  while (current && current.$ref) {
    const [file, pointer = ''] = current.$ref.split('#');
    const docName = file ? file.replace(/\.schema\.json$/, '') : currentDoc;
    let target = SCHEMAS[docName];
    for (const part of pointer.split('/').filter(Boolean)) target = target?.[part];
    current = target;
    currentDoc = docName;
  }
  return { schema: current, doc: currentDoc };
}

/** Recopie `value` avec les clés dans l'ordre canonique (voir en-tête). */
function canonical(value, schema, doc) {
  const { schema: resolved, doc: currentDoc } = deref(schema, doc);
  if (Array.isArray(value)) return value.map((item) => canonical(item, resolved?.items, currentDoc));
  if (value === null || typeof value !== 'object') return value;

  const keys = Object.keys(value);
  const known = Object.keys(resolved?.properties ?? {});
  let ordered;
  if (!resolved) ordered = keys; // contenu sans schéma : on ne touche pas à l'ordre
  else if (known.length === 0) ordered = [...keys].sort(); // dictionnaire : ordre alphabétique
  else ordered = [...known.filter((key) => key in value), ...keys.filter((key) => !known.includes(key))]; // clés inconnues à la fin

  const out = {};
  for (const key of ordered) {
    const child = resolved?.properties?.[key] ?? (typeof resolved?.additionalProperties === 'object' ? resolved.additionalProperties : undefined);
    out[key] = canonical(value[key], child, currentDoc);
  }
  return out;
}

const byId = (a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

/** relations.json : liens non orientés remis dans l'ordre alphabétique, puis tri par « id ». */
function normalizeRelations(list, relationTypes) {
  const fixed = list.map((relation) => {
    const undirected = relationTypes?.[relation?.type]?.directed === false;
    if (undirected && typeof relation.from === 'string' && typeof relation.to === 'string' && relation.from > relation.to) {
      return { ...relation, from: relation.to, to: relation.from };
    }
    return relation;
  });
  return fixed.every((r) => r && typeof r.id === 'string') ? [...fixed].sort(byId) : fixed;
}

/** Version canonique d'un contenu JSON déjà lu. */
export function canonicalJson(kind, value, { relationTypes } = {}) {
  const data = kind === 'relations' && Array.isArray(value) ? normalizeRelations(value, relationTypes) : value;
  const schemaName = SCHEMA_OF[kind];
  return `${JSON.stringify(canonical(data, SCHEMAS[schemaName], schemaName), null, 2)}\n`;
}

/** Version canonique d'un texte Markdown : LF, sans BOM, un seul retour à la ligne final. */
export function canonicalMarkdown(text) {
  const body = text.replace(/^﻿/, '').replace(/\r\n?/g, '\n').replace(/\n+$/, '');
  return body.trim() === '' ? '' : `${body}\n`;
}

/** Lit du JSON en tolérant le BOM que certains éditeurs Windows ajoutent. */
export const parseJson = (raw) => JSON.parse(raw.replace(/^﻿/, ''));

/**
 * Version canonique du contenu brut d'un fichier de type `kind`, ou null si le JSON est illisible.
 * @param {{relationTypes?: object}} context  types de liens (pour ordonner les liens non orientés)
 */
export function canonicalText(kind, raw, context = {}) {
  if (kind === 'noteText') return canonicalMarkdown(raw);
  try {
    return canonicalJson(kind, parseJson(raw), context);
  } catch {
    return null;
  }
}

/**
 * Vérifie ou réécrit tous les fichiers reconnus de data/.
 * @param {string} dataDir
 * @param {{write: boolean}} options  write = true réécrit les fichiers à corriger
 * @returns {{checked: number, changed: string[], unreadable: {file: string, message: string}[]}}
 */
export function formatDataset(dataDir, { write }) {
  const read = (rel) => readFileSync(path.join(dataDir, ...rel.split('/')), 'utf8');
  let relationTypes;
  try {
    relationTypes = parseJson(read('_common/relation-types.json'));
  } catch {
    relationTypes = undefined; // fichier absent ou illisible : le contrôle (npm run check) le signalera
  }

  const changed = [];
  const unreadable = [];
  let checked = 0;
  for (const rel of scanFiles(dataDir)) {
    const found = classify(rel);
    if (!found || isSymlink(dataDir, rel)) continue; // fichier inattendu ou lien symbolique : c'est l'affaire de « npm run check »
    checked += 1;
    const raw = read(rel);
    const formatted = canonicalText(found.kind, raw, { relationTypes });
    if (formatted === null) {
      unreadable.push({ file: displayPath(rel), message: 'JSON invalide : impossible de le formater.' });
    } else if (formatted !== raw) {
      changed.push(displayPath(rel));
      if (write) writeFileSync(path.join(dataDir, ...rel.split('/')), formatted);
    }
  }
  return { checked, changed, unreadable };
}
