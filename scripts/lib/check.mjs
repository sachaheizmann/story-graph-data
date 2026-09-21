// Le contrôle complet de data/ : fichiers, schémas, puis règles entre fichiers.
import { createAjv } from './schemas.mjs';
import { loadDataset } from './dataset.mjs';
import { makeIssue } from './issues.mjs';
import { PLACEHOLDER } from './constants.mjs';
import { checkStructure } from './rules/structure.mjs';
import { checkReferences } from './rules/references.mjs';
import { checkPositions } from './rules/positions.mjs';
import { checkUniqueness } from './rules/uniqueness.mjs';
import { checkTexts } from './rules/texts.mjs';

/**
 * Vérifie un dossier data/.
 * @returns {{issues: object[], fileCount: number, dataset: object}}
 */
export function checkDataset(dataDir) {
  const dataset = loadDataset(dataDir, createAjv());
  const add = (file, rule, message, options) => dataset.issues.push(makeIssue(file, rule, message, options));

  checkStructure(dataset, add);
  checkReferences(dataset, add);
  checkPositions(dataset, add);
  checkUniqueness(dataset, add);
  checkTexts(dataset, add);

  // Les outils « new-* » laissent un marqueur : on refuse qu'il reste dans un fichier.
  for (const entry of dataset.entries) {
    if (entry.raw.includes(PLACEHOLDER)) {
      add(entry.file, 'todo.placeholder',
        `Il reste une valeur « ${PLACEHOLDER} » dans ce fichier.`,
        { fix: 'Remplacez-la par le vrai contenu (ou supprimez le fichier si vous n\'en avez plus besoin).' });
    }
  }

  const issues = dataset.issues.slice().sort((a, b) => a.file.localeCompare(b.file) || a.rule.localeCompare(b.rule) || a.message.localeCompare(b.message));
  return { issues, fileCount: dataset.entries.length, dataset };
}
