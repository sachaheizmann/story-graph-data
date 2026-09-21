// Briques communes aux commandes « new-* » et « coverage » : arguments, édition cible, saisie interactive.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import readline from 'node:readline/promises';
import { DATA_DIR } from './paths.mjs';
import { parseJson } from './format.mjs';

/** Erreur « normale » (mauvais argument, fichier déjà là…) : on affiche le message, sans trace technique. */
export class UserError extends Error {}

export const ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Lit les options de la ligne de commande ; une option inconnue devient une UserError avec le mode d'emploi. */
export function parseCliArgs(options, usage, argv = process.argv.slice(2)) {
  try {
    return parseArgs({ args: argv, options: { ...options, data: { type: 'string' } }, strict: true }).values;
  } catch (error) {
    throw new UserError(`Options non comprises (${error.message}).\n\n${usage}`);
  }
}

export const resolveDataDir = (value) => (value ? path.resolve(value) : DATA_DIR);

/** Exécute une commande : les UserError sont affichées proprement (code 1), les autres erreurs remontent. */
export async function runMain(main) {
  try {
    await main();
  } catch (error) {
    if (error instanceof UserError) {
      console.error(`✗ ${error.message}`);
      process.exit(1);
    }
    throw error;
  }
}

export function assertId(value, label) {
  if (typeof value !== 'string' || !ID_PATTERN.test(value)) {
    throw new UserError(`${label} « ${value ?? ''} » n'est pas valide : utilisez des minuscules sans accent, des chiffres et des tirets (exemple : « aria », « val-sombre »).`);
  }
}

/** « couronne-de-brume/fr-original » -> { saga, edition }. */
export function parseEditionRef(ref) {
  const parts = typeof ref === 'string' ? ref.split('/') : [];
  if (parts.length !== 2 || !parts.every((part) => ID_PATTERN.test(part))) {
    throw new UserError(`--edition doit avoir la forme <saga>/<édition>, par exemple « couronne-de-brume/fr-original » (reçu : « ${ref ?? ''} »).`);
  }
  return { saga: parts[0], edition: parts[1] };
}

const subdirs = (dir) => (existsSync(dir) ? readdirSync(dir, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name).sort() : []);

/** Trouve une édition et lit son edition.json : { saga, edition, dir, data }. */
export function loadEdition(dataDir, ref) {
  const { saga, edition } = parseEditionRef(ref);
  const dir = path.join(dataDir, saga, 'editions', edition);
  const file = path.join(dir, 'edition.json');
  if (!existsSync(file)) {
    const known = subdirs(dataDir).filter((s) => s !== '_common' && s !== 'authors')
      .flatMap((s) => subdirs(path.join(dataDir, s, 'editions')).map((e) => `${s}/${e}`));
    throw new UserError(`L'édition « ${saga}/${edition} » n'existe pas. Éditions disponibles : ${known.join(', ') || '(aucune)'}.`);
  }
  let data;
  try {
    data = parseJson(readFileSync(file, 'utf8'));
  } catch {
    throw new UserError(`Le fichier ${path.relative(process.cwd(), file)} n'est pas du JSON valide : corrigez-le d'abord (« npm run check »).`);
  }
  if (!Array.isArray(data.books) || data.books.length === 0 || typeof data.language !== 'string') {
    throw new UserError(`Le fichier ${path.relative(process.cwd(), file)} est incomplet (« language » ou « books » manquant) : corrigez-le d'abord (« npm run check »).`);
  }
  return { saga, edition, dir, data };
}

/** « tome-1:20 » -> { book: 'tome-1', chapter: 20 }, en vérifiant que le tome et le chapitre existent dans l'édition. */
export function parseStart(text, books) {
  const match = /^([a-z0-9]+(?:-[a-z0-9]+)*):(\d+)$/.exec(text ?? '');
  if (!match) throw new UserError(`--start doit avoir la forme <tome>:<chapitre>, par exemple « ${books[0].id}:20 » (reçu : « ${text ?? ''} »).`);
  const [, bookId, chapterText] = match;
  const chapter = Number(chapterText);
  const book = books.find((b) => b.id === bookId);
  if (!book) throw new UserError(`Le tome « ${bookId} » n'existe pas dans cette édition. Tomes : ${books.map((b) => `${b.id} (${b.chapters} chapitres)`).join(', ')}.`);
  if (chapter < 1 || chapter > book.chapters) throw new UserError(`Le tome « ${bookId} » a ${book.chapters} chapitres dans cette édition : le chapitre ${chapter} n'existe pas.`);
  return { book: bookId, chapter };
}

/** Vrai quand on peut poser des questions à la personne (terminal interactif). */
export const canPrompt = () => Boolean(process.stdin.isTTY && process.stdout.isTTY);

/** Pose une question ; Entrée valide la valeur par défaut. */
export async function ask(question, defaultValue) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = (await rl.question(defaultValue ? `${question} [${defaultValue}] : ` : `${question} : `)).trim();
    return answer || defaultValue || '';
  } finally {
    rl.close();
  }
}
