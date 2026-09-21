// Commande « npm run coverage » : pourcentage de textes traduits par édition et par langue (utile aux traducteurs).
import { existsSync } from 'node:fs';
import { computeCoverage, formatCoverage } from './lib/coverage.mjs';
import { parseCliArgs, resolveDataDir, runMain, UserError } from './lib/cli.mjs';

const USAGE = 'Usage : npm run coverage [-- --list] [-- --edition <saga>/<édition>]';

await runMain(async () => {
  const values = parseCliArgs({ list: { type: 'boolean' }, edition: { type: 'string' } }, USAGE);
  const dataDir = resolveDataDir(values.data);
  if (!existsSync(dataDir)) throw new UserError(`Dossier introuvable : ${dataDir}. Lancez cette commande à la racine du dépôt.`);

  const result = computeCoverage(dataDir);
  if (values.edition) {
    result.editions = result.editions.filter((e) => `${e.saga}/${e.edition}` === values.edition);
    if (result.editions.length === 0) throw new UserError(`L'édition « ${values.edition} » n'existe pas.`);
  }
  console.log(formatCoverage(result, { list: values.list }));
});
