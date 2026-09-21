// Commande « npm run privacy:history » : à lancer soi-même avant le premier envoi vers GitHub (voir docs/MAINTAINER.md).
import path from 'node:path';
import { parseArgs } from 'node:util';
import { checkHistory } from './lib/privacy-history.mjs';
import { ROOT_DIR } from './lib/paths.mjs';

const { values } = parseArgs({ options: { repo: { type: 'string' } } });
const repo = values.repo ? path.resolve(values.repo) : ROOT_DIR;
const result = checkHistory(repo);

if (result.notARepo) {
  console.error("✗ Ce dossier n'est pas un dépôt git : lancez la commande à la racine du projet (là où se trouve package.json).");
  process.exit(2);
}

console.log(`Vérification de la vie privée avant publication : ${result.commitCount} commit${result.commitCount > 1 ? 's' : ''} examiné${result.commitCount > 1 ? 's' : ''} (toutes les branches).`);
console.log('\nIdentités trouvées dans l\'historique (auteurs et validateurs) :');
for (const identity of result.identities) console.log(`  - ${identity}`);
console.log('  (Vérifiez aussi les NOMS : ils seront publics.)');

if (result.ok) {
  console.log('\n✓ Aucune adresse e-mail personnelle ni aucun chemin de votre ordinateur dans : les commits, leurs messages, tout ce qui a été écrit dans les fichiers (même supprimé), les noms de branches, les fichiers actuels et l\'identité des prochains commits.');
  console.log('  Seules les adresses « noreply » (GitHub, mentions Co-Authored-By) et les adresses d\'exemple sont admises.');
} else {
  console.error(`\n✗ ${result.problems.length} problème${result.problems.length > 1 ? 's' : ''} : ces informations deviendraient PUBLIQUES au premier envoi.\n`);
  for (const problem of result.problems) console.error(`  - ${problem.where}\n      ${problem.kind} : ${problem.value}`);
  console.error(`
Comment corriger :
  - Identité des prochains commits : git config --local user.email "<numéro>+<pseudo>@users.noreply.github.com"
  - Un commit ou un fichier de l'historique est en cause : NE PUBLIEZ PAS. L'historique se réécrit tant que rien n'est
    envoyé (par exemple avec « git filter-branch ») : demandez de l'aide, puis relancez cette commande.`);
  process.exit(1);
}
