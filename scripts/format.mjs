// Commande « npm run format » : met les fichiers de data/ au format canonique.
// « npm run format -- --check » ne modifie rien : elle liste ce qui devrait l'être (utilisé par la CI).
import { existsSync } from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { formatDataset } from './lib/format.mjs';
import { DATA_DIR } from './lib/paths.mjs';

const { values } = parseArgs({ options: { check: { type: 'boolean' }, data: { type: 'string' } } });
const dataDir = values.data ? path.resolve(values.data) : DATA_DIR;

if (!existsSync(dataDir)) {
  console.error(`Dossier introuvable : ${dataDir}\nLancez cette commande à la racine du dépôt (là où se trouve package.json).`);
  process.exit(2);
}

const { checked, changed, unreadable } = formatDataset(dataDir, { write: !values.check });

for (const problem of unreadable) console.error(`✗ ${problem.file} : ${problem.message}`);

if (values.check) {
  if (changed.length > 0) {
    console.error(`${changed.length} fichier${changed.length > 1 ? 's ne sont pas' : " n'est pas"} au format canonique :`);
    for (const file of changed) console.error(`  - ${file}`);
    console.error('\nLancez « npm run format » : il les corrige tout seul (indentation, ordre des clés, tri des liens…).');
  } else if (unreadable.length === 0) {
    console.log(`✓ ${checked} fichiers au format canonique.`);
  }
} else if (changed.length > 0) {
  console.log(`✓ ${changed.length} fichier${changed.length > 1 ? 's' : ''} reformaté${changed.length > 1 ? 's' : ''} :`);
  for (const file of changed) console.log(`  - ${file}`);
} else if (unreadable.length === 0) {
  console.log(`✓ ${checked} fichiers déjà au format canonique, rien à faire.`);
}

process.exit(unreadable.length > 0 || (values.check && changed.length > 0) ? 1 : 0);
