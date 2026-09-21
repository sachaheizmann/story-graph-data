// Découverte, classement, lecture et validation par schéma de tous les fichiers de data/.
// Les règles « entre fichiers » (scripts/lib/rules/) travaillent ensuite sur le modèle construit ici.
import { readdirSync, readFileSync, lstatSync } from 'node:fs';
import path from 'node:path';
import { getValidator } from './schemas.mjs';
import { describeAjvErrors } from './ajv-messages.mjs';
import { makeIssue } from './issues.mjs';

const ID = '[a-z0-9]+(?:-[a-z0-9]+)*';
const LANG = '[a-z]{2,3}';
const EDITION_DIR = `(?<saga>${ID})/editions/(?<edition>${ID})`;

/** Où peut se trouver un fichier de data/, et de quel type il est. L'ordre compte. */
const PATTERNS = [
  ['relationTypes', /^_common\/relation-types\.json$/],
  ['relationTypesText', new RegExp(`^_common/text/(?<lang>${LANG})/relation-types\\.json$`)],
  ['author', new RegExp(`^authors/(?<id>${ID})\\.json$`)],
  ['authorText', new RegExp(`^authors/text/(?<lang>${LANG})/(?<id>${ID})\\.json$`)],
  ['saga', new RegExp(`^(?<saga>${ID})/saga\\.json$`)],
  ['sagaText', new RegExp(`^(?<saga>${ID})/text/(?<lang>${LANG})/saga\\.json$`)],
  ['edition', new RegExp(`^${EDITION_DIR}/edition\\.json$`)],
  ['relations', new RegExp(`^${EDITION_DIR}/relations\\.json$`)],
  ['character', new RegExp(`^${EDITION_DIR}/characters/(?<id>${ID})\\.json$`)],
  ['note', new RegExp(`^${EDITION_DIR}/notes/(?<id>${ID})\\.json$`)],
  ['characterText', new RegExp(`^${EDITION_DIR}/text/(?<lang>${LANG})/characters/(?<id>${ID})\\.json$`)],
  ['noteText', new RegExp(`^${EDITION_DIR}/text/(?<lang>${LANG})/notes/(?<id>${ID})\\.md$`)],
];

/** Type de fichier -> nom du schéma qui le valide (les fichiers .md n'ont pas de schéma). */
export const SCHEMA_OF = {
  relationTypes: 'relation-types',
  relationTypesText: 'relation-types-text',
  author: 'author',
  authorText: 'author-text',
  saga: 'saga',
  sagaText: 'saga-text',
  edition: 'edition',
  relations: 'relations',
  character: 'character',
  note: 'note',
  characterText: 'character-text',
};

/** Chemin affiché dans les messages : relatif à la racine du dépôt. */
export const displayPath = (rel) => `data/${rel}`;

/** Le contenu d'une entrée si le fichier est lisible ET conforme à son schéma, sinon undefined. */
export const dataOf = (entry) => (entry && entry.valid ? entry.data : undefined);

/** Reconnaît un fichier d'après son chemin (relatif à data/, avec des « / »). Renvoie null s'il n'est pas attendu là. */
export function classify(rel) {
  for (const [kind, pattern] of PATTERNS) {
    const match = pattern.exec(rel);
    if (match) return { kind, ...match.groups };
  }
  return null;
}

/** Liste tous les fichiers sous dataDir (chemins relatifs, séparateur « / », ordre alphabétique). */
export function scanFiles(dataDir) {
  const found = [];
  const walk = (dir, prefix) => {
    for (const name of readdirSync(dir).sort()) {
      const abs = path.join(dir, name);
      const rel = prefix ? `${prefix}/${name}` : name;
      if (lstatSync(abs).isDirectory()) walk(abs, rel);
      else found.push(rel);
    }
  };
  walk(dataDir, '');
  return found;
}

/** Problèmes de nom : extension refusée, ou dossier / fichier qui n'est pas en minuscules, chiffres et tirets. */
export function nameProblems(rel) {
  const parts = rel.split('/');
  const problems = [];
  parts.forEach((part, index) => {
    const isFile = index === parts.length - 1;
    const extension = isFile ? path.posix.extname(part) : '';
    const stem = extension ? part.slice(0, -extension.length) : part;
    const allowed = new RegExp(`^${ID}$`).test(stem) || (index === 0 && stem === '_common');
    if (!allowed) problems.push(part);
  });
  return problems;
}

const hasAllowedExtension = (rel) => ['.json', '.md'].includes(path.posix.extname(rel));

/**
 * Charge tout data/ et le range dans un modèle :
 *   sagas -> editions -> personnages / notes / textes, plus auteurs et types de liens.
 * Les problèmes de fichier (nom, JSON, schéma, id) sont ajoutés à `issues`.
 * Chaque entrée : { rel, file, kind, ctx, raw, data, valid }.
 */
export function loadDataset(dataDir, ajv) {
  const issues = [];
  const add = (file, rule, message, options) => issues.push(makeIssue(file, rule, message, options));

  const dataset = {
    dataDir,
    issues,
    entries: [],
    relationTypes: null,
    relationTypesText: new Map(), // langue -> entrée
    authors: new Map(), // id -> entrée
    authorTexts: new Map(), // id -> Map(langue -> entrée)
    sagas: new Map(), // id -> { id, saga, texts: Map(langue -> entrée), editions: Map }
  };

  const getSaga = (id) => {
    if (!dataset.sagas.has(id)) dataset.sagas.set(id, { id, saga: null, texts: new Map(), editions: new Map() });
    return dataset.sagas.get(id);
  };
  const getEdition = (sagaId, id) => {
    const saga = getSaga(sagaId);
    if (!saga.editions.has(id)) {
      saga.editions.set(id, {
        id,
        sagaId,
        edition: null,
        relations: null,
        characters: new Map(), // id -> entrée
        notes: new Map(), // id -> entrée
        characterTexts: new Map(), // langue -> Map(id -> entrée)
        noteTexts: new Map(), // langue -> Map(id -> entrée)
      });
    }
    return saga.editions.get(id);
  };
  const nested = (map, key) => {
    if (!map.has(key)) map.set(key, new Map());
    return map.get(key);
  };

  for (const rel of scanFiles(dataDir)) {
    const file = displayPath(rel);

    // Règle 9 : rien d'autre que du JSON / Markdown, noms en minuscules-chiffres-tirets.
    if (!hasAllowedExtension(rel)) {
      add(file, 'files.unexpected',
        "Ce fichier n'est ni du JSON ni du Markdown : le dossier data/ ne contient que des fichiers .json et .md.",
        { fix: "Supprimez-le (si c'est un fichier créé par votre système, ajoutez-le à .gitignore)." });
      continue;
    }
    const badNames = nameProblems(rel);
    if (badNames.length > 0) {
      add(file, 'files.name',
        `Nom invalide : ${badNames.map((n) => `« ${n} »`).join(', ')}. Les noms de dossiers et de fichiers s'écrivent en minuscules sans accent, avec des chiffres et des tirets.`,
        { fix: 'Renommez-le, par exemple « val-sombre » au lieu de « Val_Sombre ». Les identifiants ne contiennent jamais d\'espace, de majuscule ni d\'underscore.' });
      continue;
    }
    const found = classify(rel);
    if (!found) {
      add(file, 'files.unexpected',
        "Ce fichier n'est pas à un endroit prévu dans data/.",
        { fix: 'Voir le schéma de l\'arborescence dans le README : data/<saga>/editions/<édition>/{edition.json, relations.json, characters/, notes/, text/<langue>/}.' });
      continue;
    }

    const { kind, ...ctx } = found;
    const raw = readFileSync(path.join(dataDir, ...rel.split('/')), 'utf8');
    const entry = { rel, file, kind, ctx, raw, data: undefined, valid: false };
    dataset.entries.push(entry);

    if (kind === 'noteText') {
      entry.data = raw;
      entry.valid = true;
    } else {
      try {
        entry.data = JSON.parse(raw.replace(/^\uFEFF/, '')); // tolère le BOM (la règle de format le signalera)
      } catch (error) {
        add(file, 'json.parse', `Ce fichier n'est pas du JSON valide (${error.message}).`,
          { fix: 'Cherchez une virgule oubliée ou en trop, un guillemet ou une accolade manquants. Un éditeur comme VS Code souligne l\'erreur.' });
        register(dataset, entry, { getSaga, getEdition, nested });
        continue;
      }
      const validate = getValidator(ajv, SCHEMA_OF[kind]);
      if (validate(entry.data)) {
        entry.valid = true;
        checkIdMatchesName(entry, add);
      } else {
        for (const described of describeAjvErrors(validate.errors, entry.data)) {
          add(file, 'schema.invalid', described.message, { fix: described.fix, reminder: described.reminder });
        }
      }
    }
    register(dataset, entry, { getSaga, getEdition, nested });
  }
  return dataset;
}

/** Règle 1 : l'« id » d'un fichier est le nom du fichier (ou du dossier pour une saga et une édition). */
function checkIdMatchesName(entry, add) {
  const { kind, ctx, data, file } = entry;
  const expected = { character: ctx.id, note: ctx.id, author: ctx.id, saga: ctx.saga, edition: ctx.edition }[kind];
  if (expected === undefined || data.id === expected) return;
  const target = kind === 'saga' || kind === 'edition' ? 'du dossier' : 'du fichier';
  add(file, 'schema.id-mismatch',
    `L'« id » (« ${data.id} ») ne correspond pas au nom ${target} (« ${expected} »).`,
    { fix: `Mettez « "id": "${expected}" » : l'identifiant est stable et ne change jamais.` });
}

/** Range une entrée dans le modèle, selon son type. */
function register(dataset, entry, { getSaga, getEdition, nested }) {
  const { kind, ctx } = entry;
  switch (kind) {
    case 'relationTypes': dataset.relationTypes = entry; break;
    case 'relationTypesText': dataset.relationTypesText.set(ctx.lang, entry); break;
    case 'author': dataset.authors.set(ctx.id, entry); break;
    case 'authorText': nested(dataset.authorTexts, ctx.id).set(ctx.lang, entry); break;
    case 'saga': getSaga(ctx.saga).saga = entry; break;
    case 'sagaText': getSaga(ctx.saga).texts.set(ctx.lang, entry); break;
    case 'edition': getEdition(ctx.saga, ctx.edition).edition = entry; break;
    case 'relations': getEdition(ctx.saga, ctx.edition).relations = entry; break;
    case 'character': getEdition(ctx.saga, ctx.edition).characters.set(ctx.id, entry); break;
    case 'note': getEdition(ctx.saga, ctx.edition).notes.set(ctx.id, entry); break;
    case 'characterText': nested(getEdition(ctx.saga, ctx.edition).characterTexts, ctx.lang).set(ctx.id, entry); break;
    case 'noteText': nested(getEdition(ctx.saga, ctx.edition).noteTexts, ctx.lang).set(ctx.id, entry); break;
    default: throw new Error(`Type de fichier inconnu : ${kind}`);
  }
}

/** Toutes les éditions du jeu de données, avec leur saga : [{ sagaId, ed }]. */
export function allEditions(dataset) {
  const list = [];
  for (const [sagaId, saga] of dataset.sagas) for (const ed of saga.editions.values()) list.push({ sagaId, saga, ed });
  return list;
}
