// Commande « npm run check » : vérifie tout le dossier data/ et explique les erreurs en français.
import { existsSync } from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { checkDataset } from './lib/check.mjs';
import { formatIssues, githubAnnotation } from './lib/issues.mjs';
import { DATA_DIR } from './lib/paths.mjs';

const { values } = parseArgs({ options: { data: { type: 'string' } } });
const dataDir = values.data ? path.resolve(values.data) : DATA_DIR;

if (!existsSync(dataDir)) {
  console.error(`Dossier introuvable : ${dataDir}\nLancez cette commande à la racine du dépôt (là où se trouve package.json).`);
  process.exit(2);
}

const { issues, errors, warnings, fileCount } = checkDataset(dataDir);

// Dans GitHub Actions, chaque problème devient une annotation visible directement dans la Pull Request.
if (process.env.GITHUB_ACTIONS === 'true') {
  for (const found of issues) console.log(githubAnnotation(found));
}

if (errors.length === 0) {
  if (warnings.length > 0) console.error(`${formatIssues(warnings)}\n`);
  console.log(`✓ ${fileCount} fichiers vérifiés, aucun problème${warnings.length > 0 ? ` (${warnings.length} avertissement${warnings.length > 1 ? 's' : ''}, voir ci-dessus)` : ''}.`);
} else {
  console.error(formatIssues(issues));
  console.error('\nCorrigez ces problèmes puis relancez « npm run check ».');
  process.exit(1);
}
