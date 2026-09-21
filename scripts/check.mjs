// Commande « npm run check » : vérifie tout le dossier data/ et explique les erreurs en français.
import { existsSync } from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { checkDataset } from './lib/check.mjs';
import { formatIssues } from './lib/issues.mjs';
import { DATA_DIR } from './lib/paths.mjs';

const { values } = parseArgs({ options: { data: { type: 'string' } } });
const dataDir = values.data ? path.resolve(values.data) : DATA_DIR;

if (!existsSync(dataDir)) {
  console.error(`Dossier introuvable : ${dataDir}\nLancez cette commande à la racine du dépôt (là où se trouve package.json).`);
  process.exit(2);
}

const { issues, fileCount } = checkDataset(dataDir);
if (issues.length === 0) {
  console.log(`✓ ${fileCount} fichiers vérifiés, aucun problème.`);
} else {
  console.error(formatIssues(issues));
  console.error('\nCorrigez ces problèmes puis relancez « npm run check ».');
  process.exit(1);
}
