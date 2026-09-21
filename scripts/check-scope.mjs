// Contrôle de périmètre d'une Pull Request : une AIDE, pas la protection.
//
// Règle : si l'auteur de la PR n'est pas OWNER, MEMBER ou COLLABORATOR du dépôt, la PR ne peut modifier
// que le dossier data/. Les dossiers schema/, scripts/, .github/, docs/ et les fichiers de la racine
// définissent les règles et l'automatisation : ils ne sont modifiés que par le mainteneur.
//
// La vraie protection est le réglage GitHub « Require review from Code Owners » (voir docs/MAINTAINER.md) :
// ce script peut être contourné par une PR qui modifierait le workflow lui-même.
//
// Le workflow exécute la copie de CE fichier qui se trouve sur la branche main (jamais celle de la PR) :
//   git diff --name-only --no-renames -z HEAD^1 HEAD | node check-scope.mjs
// La liste des fichiers arrive sur l'entrée standard, séparée par des caractères NUL (les noms de fichiers
// peuvent contenir des espaces ou des retours à la ligne). Le statut de l'auteur vient de la variable
// d'environnement AUTHOR_ASSOCIATION (ou de l'option --association).
//
// Ce fichier n'importe rien d'autre que Node : c'est voulu, pour qu'il reste simple à relire et à isoler.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

/** Statuts GitHub (« author_association ») qui peuvent modifier n'importe quel fichier. */
export const TRUSTED_ASSOCIATIONS = ['OWNER', 'MEMBER', 'COLLABORATOR'];

/** Les seuls chemins que les autres personnes peuvent modifier. */
export const ALLOWED_PREFIX = 'data/';

/** Nombre maximum de fichiers listés dans le message. */
const LIST_LIMIT = 20;

/** Liste de fichiers séparés par NUL -> tableau (les entrées vides sont ignorées). */
export const parseFileList = (input) => String(input).split('\0').filter((name) => name !== '');

/** Un chemin est dans le périmètre s'il est dans data/ sans détour (« ./ », « .. », « // »). */
export function isInScope(file) {
  return file.startsWith(ALLOWED_PREFIX) && path.posix.normalize(file) === file;
}

/**
 * @param {{files: string[], association?: string}} input  fichiers modifiés (anciens ET nouveaux chemins) et statut de l'auteur
 * @returns {{ok: boolean, trusted: boolean, outOfScope: string[]}}
 */
export function checkScope({ files, association }) {
  const trusted = TRUSTED_ASSOCIATIONS.includes(association); // comparaison exacte : tout ce qui est inconnu est « non fiable »
  const outOfScope = trusted ? [] : files.filter((file) => !isInScope(file));
  return { ok: outOfScope.length === 0, trusted, outOfScope };
}

/** Un texte sur une seule ligne : un nom de fichier ne doit pas pouvoir injecter une commande « :: » dans les logs. */
const oneLine = (text) => String(text).replace(/[\p{Cc}\p{Zl}\p{Zp}]+/gu, ' ');

function main() {
  let values;
  try {
    ({ values } = parseArgs({ options: { association: { type: 'string' } }, strict: true }));
  } catch (error) {
    console.error(`Options non comprises (${error.message}).\nUsage : git diff --name-only --no-renames -z HEAD^1 HEAD | node check-scope.mjs [--association OWNER]`);
    return 2;
  }
  if (process.stdin.isTTY) {
    console.error('Cette commande lit la liste des fichiers modifiés sur son entrée, séparés par des caractères NUL.\nUsage : git diff --name-only --no-renames -z HEAD^1 HEAD | node check-scope.mjs');
    return 2;
  }

  const association = values.association ?? process.env.AUTHOR_ASSOCIATION;
  const files = parseFileList(readFileSync(0, 'utf8'));
  const result = checkScope({ files, association });

  if (result.trusted) {
    console.log(`✓ Auteur de confiance (${association}) : pas de restriction de périmètre (${files.length} fichier${files.length > 1 ? 's' : ''} modifié${files.length > 1 ? 's' : ''}).`);
    return 0;
  }
  if (result.ok) {
    console.log(`✓ Contrôle de périmètre : les ${files.length} fichier${files.length > 1 ? 's' : ''} modifié${files.length > 1 ? 's' : ''} sont tous dans data/.`);
    return 0;
  }

  const shown = result.outOfScope.slice(0, LIST_LIMIT).map((file) => `  - ${oneLine(file)}`);
  if (result.outOfScope.length > LIST_LIMIT) shown.push(`  … et ${result.outOfScope.length - LIST_LIMIT} autre(s)`);
  const status = association ? `« ${oneLine(association)} »` : 'inconnu';
  console.error(`✗ Cette Pull Request modifie des fichiers en dehors de data/ :
${shown.join('\n')}

Pourquoi ce refus ? Votre statut sur ce dépôt est ${status}. Les personnes extérieures peuvent proposer
des personnages, des liens, des notes et des traductions (dossier data/), mais pas modifier les règles et
l'automatisation : schema/, scripts/, .github/, docs/ et les fichiers de la racine sont réservés au
mainteneur. Cela protège le contrôle qui vérifie les contributions de tout le monde.

Que faire ?
  - Retirez ces fichiers de votre Pull Request : ne gardez que ce qui est dans data/.
  - Une idée d'amélioration des règles, des outils ou de la documentation ? Ouvrez plutôt une issue
    « Suggestion » : le mainteneur s'en occupera.

(Ce contrôle est une aide : la vraie protection est la relecture obligatoire par le mainteneur.)`);
  console.error(`::error title=Contrôle de périmètre::${result.outOfScope.length} fichier(s) modifié(s) en dehors de data/`);
  return 1;
}

// Ne lance la commande que si ce fichier est exécuté directement (et non importé par les tests).
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = main();
}
