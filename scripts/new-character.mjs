// Commande « npm run new-character -- --edition <saga>/<édition> --id <id> » (voir CONTRIBUTING.md).
import { createCharacter } from './lib/new-character.mjs';
import { parseCliArgs, resolveDataDir, runMain, UserError } from './lib/cli.mjs';

const USAGE = `Usage : npm run new-character -- --edition <saga>/<édition> --id <id> [--start <tome>:<chapitre>] [--name "…"] [--description "…"]
Exemple : npm run new-character -- --edition couronne-de-brume/fr-original --id mira --start tome-1:12`;

await runMain(async () => {
  const values = parseCliArgs({
    edition: { type: 'string' }, id: { type: 'string' }, start: { type: 'string' },
    name: { type: 'string' }, description: { type: 'string' },
  }, USAGE);
  if (!values.edition || !values.id) throw new UserError(`Il manque --edition ou --id.\n\n${USAGE}`);
  const { files, todo } = createCharacter({ dataDir: resolveDataDir(values.data), ...values });

  console.log(`✓ Personnage « ${values.id} » créé :`);
  for (const file of files) console.log(`  - data/${file}`);
  if (todo.length > 0) {
    console.log('\nIl reste à compléter :');
    for (const item of todo) console.log(`  • ${item}`);
    console.log('\n« npm run check » refusera ces fichiers tant que ce n\'est pas fait.');
  }
  console.log('\nRappel : « start » = le moment où le lecteur DÉCOUVRE le personnage, pas celui où il commence à exister dans l\'histoire.');
  console.log('La description ne dit que ce qui est connu à ce moment-là : le reste va dans des notes (npm run new-note).');
  if (todo.length === 0) console.log('Terminé ? Lancez « npm run check ».');
});
