// « npm run new-edition » : copie une édition existante en une nouvelle, à adapter ensuite.
// Les identifiants (personnages, liens, notes) restent identiques dans la copie.
import { cpSync, existsSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { canonicalJson } from './format.mjs';
import { UserError, assertId, loadEdition } from './cli.mjs';

/** Même règle que le schéma : un pseudo GitHub, jamais une adresse e-mail. */
export const GITHUB_USER = /^[A-Za-z0-9](?:[A-Za-z0-9]|-(?=[A-Za-z0-9])){0,38}$/;

/** Pseudo GitHub de la personne connectée à « gh », ou undefined si gh est absent ou déconnecté. */
export function detectGithubUser(run = spawnSync) {
  try {
    const result = run('gh', ['api', 'user', '--jq', '.login'], { encoding: 'utf8', timeout: 5000 });
    const login = result.status === 0 ? String(result.stdout).trim() : '';
    return GITHUB_USER.test(login) ? login : undefined;
  } catch {
    return undefined;
  }
}

/** Vérifie et nettoie le pseudo GitHub saisi (accepte « @pseudo »). */
export function cleanGithubUser(value) {
  const login = String(value ?? '').trim().replace(/^@/, '');
  if (login.includes('@')) {
    throw new UserError(`« ${value} » ressemble à une adresse e-mail : indiquez votre NOM D'UTILISATEUR GitHub (jamais d'e-mail, le dépôt est public).`);
  }
  if (!GITHUB_USER.test(login)) {
    throw new UserError(`« ${value} » n'est pas un nom d'utilisateur GitHub valide (lettres, chiffres et tirets).`);
  }
  return login;
}

/**
 * @param {object} options
 * @param {string} options.dataDir
 * @param {string} options.saga      identifiant de la saga
 * @param {string} options.from      identifiant de l'édition à copier
 * @param {string} options.id        identifiant de la nouvelle édition
 * @param {string} options.github    pseudo GitHub du créateur
 * @param {string} options.language  langue SOURCE de la nouvelle édition (« fr », « en »…)
 * @param {string} options.publisher
 * @param {number} options.year
 */
export function createEdition({ dataDir, saga, from, id, github, language, publisher, year }) {
  assertId(saga, 'La saga');
  assertId(from, 'L\'édition à copier');
  assertId(id, 'L\'identifiant de la nouvelle édition');
  if (id === from) throw new UserError('La nouvelle édition doit avoir un identifiant différent de celle que vous copiez.');

  const source = loadEdition(dataDir, `${saga}/${from}`);
  const targetDir = path.join(dataDir, saga, 'editions', id);
  if (existsSync(targetDir)) {
    throw new UserError(`L'édition « ${saga}/${id} » existe déjà : je refuse de l'écraser. Choisissez un autre identifiant.`);
  }

  const login = cleanGithubUser(github);
  if (!/^[a-z]{2,3}$/.test(language ?? '')) throw new UserError(`La langue « ${language ?? ''} » n'est pas valide : utilisez un code court en minuscules (« fr », « en »…).`);
  if (!publisher || !String(publisher).trim()) throw new UserError('L\'éditeur (--publisher) ne peut pas être vide.');
  if (!Number.isInteger(year) || year < 1400 || year > 2100) throw new UserError(`L'année « ${year} » n'est pas valide (un nombre entre 1400 et 2100).`);

  cpSync(source.dir, targetDir, { recursive: true, errorOnExist: true, force: false });

  // Les traducteurs de l'édition copiée ne sont pas ceux de la nouvelle : on repart de zéro.
  const { translators, ...rest } = source.data;
  const edition = { ...rest, id, language, publisher: String(publisher).trim(), year, based_on: from, created_by: [login] };
  writeFileSync(path.join(targetDir, 'edition.json'), canonicalJson('edition', edition));

  return { saga, id, from, dir: targetDir, sourceLanguage: source.data.language };
}
