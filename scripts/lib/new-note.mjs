// « npm run new-note » : crée une note (fichier neutre + texte Markdown dans la langue source de l'édition).
import { randomInt } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { PLACEHOLDER, NOTE_MAX_LENGTH } from './constants.mjs';
import { canonicalJson, canonicalMarkdown, parseJson } from './format.mjs';
import { UserError, assertId, loadEdition, parseStart } from './cli.mjs';

// Sans les caractères qui se confondent (i, l, o, 0, 1).
const ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';

/** Identifiant aléatoire de note, du genre « n-7k2p9 ». */
export function randomNoteId(random = randomInt) {
  return `n-${Array.from({ length: 5 }, () => ALPHABET[random(ALPHABET.length)]).join('')}`;
}

function writeNew(file, content) {
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, content, { flag: 'wx' });
}

/** « character:kael » ou « relation:aria-kael-ally-1 » -> { type, id }. */
export function parseAbout(text) {
  const match = /^(character|relation):(.+)$/.exec(text ?? '');
  if (!match) throw new UserError(`--about doit avoir la forme character:<id> ou relation:<id>, par exemple « character:kael » (reçu : « ${text ?? ''} »).`);
  assertId(match[2], 'L\'identifiant du sujet');
  return { type: match[1], id: match[2] };
}

/**
 * @param {{random?: (max: number) => number}} [options.random]  (tests) générateur aléatoire
 * @returns {{id: string, files: string[], todo: string[]}}
 */
export function createNote({ dataDir, edition: ref, about, start, text, random }) {
  const subject = parseAbout(about);
  const { saga, edition, dir, data } = loadEdition(dataDir, ref);
  const language = data.language;

  // Le sujet doit exister : on ne crée pas de note dans le vide.
  if (subject.type === 'character') {
    if (!existsSync(path.join(dir, 'characters', `${subject.id}.json`))) {
      throw new UserError(`Le personnage « ${subject.id} » n'existe pas dans l'édition « ${saga}/${edition} ». Créez-le d'abord avec « npm run new-character ».`);
    }
  } else {
    let relations = [];
    try {
      relations = parseJson(readFileSync(path.join(dir, 'relations.json'), 'utf8'));
    } catch {
      throw new UserError(`Impossible de lire relations.json de l'édition « ${saga}/${edition} » : corrigez-le d'abord (« npm run check »).`);
    }
    if (!relations.some((r) => r.id === subject.id)) {
      throw new UserError(`Le lien « ${subject.id} » n'existe pas dans relations.json de l'édition « ${saga}/${edition} ».`);
    }
  }

  const todo = [];
  let position;
  if (start) {
    position = parseStart(start, data.books);
  } else {
    position = { book: data.books[0].id, chapter: 0 };
    todo.push('le chapitre où le lecteur APPREND ce que dit la note (« start.chapter » dans le fichier .json, actuellement 0)');
  }
  const body = text?.trim();
  if (body && [...body].length > NOTE_MAX_LENGTH) {
    throw new UserError(`Le texte de la note fait ${[...body].length} caractères : ${NOTE_MAX_LENGTH} au plus. Une note est un fait court, écrit avec vos propres mots.`);
  }
  if (!body) todo.push('le texte de la note (fichier .md) : quelques phrases avec vos propres mots, jamais un extrait du livre');

  // Identifiant aléatoire, jamais déjà pris dans cette édition.
  let id = randomNoteId(random);
  while (existsSync(path.join(dir, 'notes', `${id}.json`))) id = randomNoteId(random);

  const neutral = path.join(dir, 'notes', `${id}.json`);
  const markdown = path.join(dir, 'text', language, 'notes', `${id}.md`);
  writeNew(neutral, canonicalJson('note', { id, about: subject, start: position }));
  writeNew(markdown, canonicalMarkdown(body ?? `${PLACEHOLDER} : écrivez ici, avec vos propres mots, ce que le lecteur apprend à cette position (${NOTE_MAX_LENGTH} caractères au plus).`));
  return { id, files: [neutral, markdown].map((f) => path.relative(dataDir, f).split(path.sep).join('/')), todo };
}
