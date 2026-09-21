// « npm run new-character » : crée un personnage (fichier neutre + texte dans la langue source de l'édition).
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { PLACEHOLDER } from './constants.mjs';
import { canonicalJson } from './format.mjs';
import { UserError, assertId, loadEdition, parseStart } from './cli.mjs';

function writeNew(file, content) {
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, content, { flag: 'wx' }); // « wx » : jamais d'écrasement
}

/**
 * @returns {{files: string[], todo: string[]}}  fichiers créés (relatifs à dataDir) et ce qu'il reste à compléter
 */
export function createCharacter({ dataDir, edition: ref, id, start, name, description }) {
  assertId(id, 'L\'identifiant du personnage');
  const { saga, edition, dir, data } = loadEdition(dataDir, ref);
  const language = data.language;

  const neutral = path.join(dir, 'characters', `${id}.json`);
  const text = path.join(dir, 'text', language, 'characters', `${id}.json`);
  for (const file of [neutral, text]) {
    if (existsSync(file)) throw new UserError(`Le personnage « ${id} » existe déjà dans l'édition « ${saga}/${edition} » (${path.relative(dataDir, file)}) : je refuse de l'écraser.`);
  }

  const todo = [];
  let position;
  if (start) {
    position = parseStart(start, data.books);
  } else {
    // Volontairement invalide (chapitre 0) : « npm run check » refuse tant que le vrai chapitre n'est pas renseigné.
    // Un chapitre par défaut risquerait de créer un spoiler sans que personne ne s'en aperçoive.
    position = { book: data.books[0].id, chapter: 0 };
    todo.push(`le chapitre où le lecteur DÉCOUVRE ce personnage (« start.chapter » dans characters/${id}.json, actuellement 0)`);
  }
  if (!name) todo.push(`le nom (« name » dans text/${language}/characters/${id}.json)`);
  if (!description) todo.push(`la description, limitée à ce que le lecteur sait à ce moment-là (« description » dans text/${language}/characters/${id}.json)`);

  writeNew(neutral, canonicalJson('character', { id, start: position, end: null }));
  writeNew(text, canonicalJson('characterText', { name: name ?? PLACEHOLDER, description: description ?? PLACEHOLDER }));
  return { files: [neutral, text].map((f) => path.relative(dataDir, f).split(path.sep).join('/')), todo };
}
