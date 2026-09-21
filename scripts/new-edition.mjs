// Commande « npm run new-edition -- --saga <saga> --from <édition> --id <nouvelle-édition> » (voir CONTRIBUTING.md).
import { createEdition, detectGithubUser } from './lib/new-edition.mjs';
import { checkDataset } from './lib/check.mjs';
import { formatIssues } from './lib/issues.mjs';
import { UserError, ask, canPrompt, loadEdition, parseCliArgs, resolveDataDir, runMain } from './lib/cli.mjs';

const USAGE = `Usage : npm run new-edition -- --saga <saga> --from <édition> --id <nouvelle-édition> [--github <pseudo>] [--language <fr>] [--publisher "…"] [--year <2015>]
Les valeurs absentes sont demandées dans le terminal.
Exemple : npm run new-edition -- --saga couronne-de-brume --from fr-original --id fr-collector-2020`;

await runMain(async () => {
  const values = parseCliArgs({
    saga: { type: 'string' }, from: { type: 'string' }, id: { type: 'string' },
    github: { type: 'string' }, language: { type: 'string' }, publisher: { type: 'string' }, year: { type: 'string' },
  }, USAGE);
  if (!values.saga || !values.from || !values.id) throw new UserError(`Il manque --saga, --from ou --id.\n\n${USAGE}`);
  const dataDir = resolveDataDir(values.data);
  const source = loadEdition(dataDir, `${values.saga}/${values.from}`);

  // Valeurs manquantes : détectées (gh), demandées (terminal interactif), sinon on liste ce qui manque.
  const missing = [];
  let github = values.github;
  if (!github) {
    github = detectGithubUser();
    if (github) console.log(`Pseudo GitHub détecté avec « gh » : ${github}`);
    else if (canPrompt()) github = await ask('Votre nom d\'utilisateur GitHub (pas votre e-mail)');
    else missing.push('--github <pseudo>');
  }
  let language = values.language;
  if (!language) {
    if (canPrompt()) language = await ask('Langue source de la nouvelle édition (fr, en…)', source.data.language);
    else missing.push('--language <fr>');
  }
  let publisher = values.publisher;
  if (!publisher) {
    if (canPrompt()) publisher = await ask('Éditeur de la nouvelle édition');
    else missing.push('--publisher "…"');
  }
  let year = values.year;
  if (!year) {
    if (canPrompt()) year = await ask('Année de publication');
    else missing.push('--year <2015>');
  }
  if (missing.length > 0) {
    throw new UserError(`Il manque : ${missing.join(', ')}.\nAjoutez ces options, ou lancez la commande dans un terminal interactif pour qu'elles vous soient demandées.\n\n${USAGE}`);
  }

  const created = createEdition({ dataDir, saga: values.saga, from: values.from, id: values.id, github, language, publisher, year: Number(year) });
  console.log(`✓ Édition « ${created.saga}/${created.id} » créée par copie de « ${created.from} » (based_on renseigné).`);

  console.log('\nValidation de data/ …');
  const { issues, fileCount } = checkDataset(dataDir);
  if (issues.length === 0) {
    console.log(`✓ ${fileCount} fichiers vérifiés, aucun problème.`);
  } else {
    console.error(formatIssues(issues));
    if (created.sourceLanguage !== language) {
      console.error(`\nLa langue source change (« ${created.sourceLanguage} » → « ${language} ») : chaque personnage et chaque note doit avoir son texte en « ${language} » (voir « npm run coverage -- --list »).`);
    }
  }

  const relative = `data/${created.saga}/editions/${created.id}`;
  console.log(`
Prochaines étapes :
  1. Ouvrez ${relative}/edition.json : adaptez « books » (titres, nombre de chapitres) à CETTE édition.
  2. Adaptez les positions (« start » / « end ») dans characters/, relations.json et notes/ :
     chaque position est le chapitre de CETTE édition où le lecteur l'apprend (« révélé ≠ vrai »).
  3. Les identifiants (aria, kael…) NE CHANGENT PAS : ne renommez rien.
  4. Lancez « npm run check », puis ouvrez une Pull Request.`);
  if (issues.length > 0) process.exit(1);
});
