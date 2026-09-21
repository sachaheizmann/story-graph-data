// Un « problème » trouvé par le contrôle, et sa mise en forme pour le terminal.
import { REVEALED_REMINDER } from './constants.mjs';

/**
 * @param {string} file     chemin affiché, relatif à la racine du dépôt (ex. « data/ma-saga/saga.json »)
 * @param {string} rule     code stable de la règle (utilisé par les tests), ex. « order.end-not-after-start »
 * @param {string} message  ce qui ne va pas, en français
 * @param {{fix?: string, reminder?: boolean}} [options]
 *        fix : comment corriger ; reminder : ajoute le rappel « révélé ≠ vrai »
 */
export function makeIssue(file, rule, message, { fix, reminder } = {}) {
  return { file, rule, message, fix, reminder: Boolean(reminder) };
}

/** Texte lisible d'une liste de problèmes, regroupés par fichier. */
export function formatIssues(issues) {
  const byFile = new Map();
  for (const found of issues) {
    if (!byFile.has(found.file)) byFile.set(found.file, []);
    byFile.get(found.file).push(found);
  }
  const lines = [];
  for (const [file, list] of byFile) {
    lines.push(file);
    for (const found of list) {
      lines.push(`  ✗ ${found.message}`);
      if (found.fix) lines.push(`    → Comment corriger : ${found.fix}`);
      if (found.reminder) lines.push(`    ℹ Rappel : ${REVEALED_REMINDER}`);
    }
    lines.push('');
  }
  const count = issues.length;
  lines.push(`${count} problème${count > 1 ? 's' : ''} dans ${byFile.size} fichier${byFile.size > 1 ? 's' : ''}.`);
  return lines.join('\n');
}
