// Commande « npm run new-note -- --edition <saga>/<édition> --about character:<id> » (voir CONTRIBUTING.md).
import { createNote } from './lib/new-note.mjs';
import { parseCliArgs, resolveDataDir, runMain, UserError } from './lib/cli.mjs';

const USAGE = `Usage : npm run new-note -- --edition <saga>/<édition> --about <character|relation>:<id> [--start <tome>:<chapitre>] [--text "…"]
Exemples : npm run new-note -- --edition couronne-de-brume/fr-original --about character:kael --start tome-1:20
           npm run new-note -- --edition couronne-de-brume/fr-original --about relation:aria-kael-ally-1`;

await runMain(async () => {
  const values = parseCliArgs({
    edition: { type: 'string' }, about: { type: 'string' }, start: { type: 'string' }, text: { type: 'string' },
  }, USAGE);
  if (!values.edition || !values.about) throw new UserError(`Il manque --edition ou --about.\n\n${USAGE}`);
  const { id, files, todo } = createNote({ dataDir: resolveDataDir(values.data), ...values });

  console.log(`✓ Note « ${id} » créée :`);
  for (const file of files) console.log(`  - data/${file}`);
  if (todo.length > 0) {
    console.log('\nIl reste à compléter :');
    for (const item of todo) console.log(`  • ${item}`);
    console.log('\n« npm run check » refusera ces fichiers tant que ce n\'est pas fait.');
  }
  console.log('\nRappel : « start » = le moment où le lecteur APPREND ce que dit la note, jamais le moment où c\'est vrai dans l\'histoire.');
  if (todo.length === 0) console.log('Terminé ? Lancez « npm run check ».');
});
