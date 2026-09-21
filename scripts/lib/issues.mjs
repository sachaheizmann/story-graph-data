// Un « problème » trouvé par le contrôle, et sa mise en forme pour le terminal et pour GitHub.
import { REVEALED_REMINDER } from './constants.mjs';

/**
 * @param {string} file     chemin affiché, relatif à la racine du dépôt (ex. « data/ma-saga/saga.json »)
 * @param {string} rule     code stable de la règle (utilisé par les tests), ex. « order.end-not-after-start »
 * @param {string} message  ce qui ne va pas, en français
 * @param {{fix?: string, reminder?: boolean, severity?: 'error'|'warning'}} [options]
 *        fix : comment corriger ; reminder : ajoute le rappel « révélé ≠ vrai » ;
 *        severity : « error » (bloque, par défaut) ou « warning » (avertissement, ne bloque pas)
 */
export function makeIssue(file, rule, message, { fix, reminder, severity = 'error' } = {}) {
  return { file, rule, message, fix, reminder: Boolean(reminder), severity };
}

export const isError = (issue) => issue.severity === 'error';
export const isWarning = (issue) => issue.severity === 'warning';

/**
 * Met un texte sur UNE seule ligne. Les messages contiennent parfois du texte venu des fichiers d'une
 * Pull Request : sans cela, un retour à la ligne suivi de « ::… » pourrait se faire passer pour une
 * commande GitHub Actions dans les logs.
 */
export const oneLine = (text) => String(text).replace(/[\p{Cc}\p{Zl}\p{Zp}]+/gu, ' ');

/** Texte lisible d'une liste de problèmes et d'avertissements, regroupés par fichier. */
export function formatIssues(issues) {
  const byFile = new Map();
  for (const found of issues) {
    if (!byFile.has(found.file)) byFile.set(found.file, []);
    byFile.get(found.file).push(found);
  }
  const lines = [];
  for (const [file, list] of byFile) {
    lines.push(oneLine(file));
    for (const found of list) {
      lines.push(`  ${isWarning(found) ? '⚠ Avertissement :' : '✗'} ${oneLine(found.message)}`);
      if (found.fix) lines.push(`    → Comment corriger : ${oneLine(found.fix)}`);
      if (found.reminder) lines.push(`    ℹ Rappel : ${REVEALED_REMINDER}`);
    }
    lines.push('');
  }
  const errors = issues.filter(isError);
  const warnings = issues.filter(isWarning);
  const summary = [];
  if (errors.length > 0) {
    const files = new Set(errors.map((i) => i.file)).size;
    summary.push(`${errors.length} problème${errors.length > 1 ? 's' : ''} dans ${files} fichier${files > 1 ? 's' : ''}.`);
  }
  if (warnings.length > 0) {
    summary.push(`${warnings.length} avertissement${warnings.length > 1 ? 's' : ''} (ne bloque${warnings.length > 1 ? 'nt' : ''} pas la validation).`);
  }
  lines.push(summary.join(' '));
  return lines.join('\n');
}

// Format des annotations GitHub Actions : https://docs.github.com/actions/reference/workflow-commands-for-github-actions
const escapeData = (text) => String(text).replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A');
const escapeProperty = (text) => escapeData(text).replace(/:/g, '%3A').replace(/,/g, '%2C');

/** Ligne « ::warning file=…,title=…::message » : GitHub l'affiche directement dans la Pull Request. */
export function githubAnnotation(issue) {
  const level = isWarning(issue) ? 'warning' : 'error';
  const body = oneLine(issue.fix ? `${issue.message} → ${issue.fix}` : issue.message);
  return `::${level} file=${escapeProperty(oneLine(issue.file))},title=${escapeProperty(issue.rule)}::${escapeData(body)}`;
}
