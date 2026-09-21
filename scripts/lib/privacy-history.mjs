// « npm run privacy:history » : cherche des données personnelles AVANT de publier le dépôt, partout où git les garde.
//
// Ce contrôle n'est PAS dans « npm test » : il juge les commits d'une personne, et un contributeur signe les siens
// avec son vrai e-mail (c'est normal chez lui). C'est le mainteneur qui le lance, avant le premier envoi.
//
// Ce qu'il examine :
//   1. l'auteur et le validateur (« committer ») de chaque commit ;
//   2. les messages de commit ;
//   3. TOUT ce qui a un jour été écrit dans un fichier, même supprimé depuis (l'historique publié contient tout) ;
//   4. les noms de branches et d'étiquettes ;
//   5. les fichiers actuels, y compris ceux qui ne sont pas encore ajoutés à git ;
//   6. l'identité que git utilisera pour les PROCHAINS commits.
import { spawnSync } from 'node:child_process';
import { readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { findPersonalData, isAllowedEmail, isBinaryFile } from './privacy.mjs';

const MAX_FILE_SIZE = 2_000_000;
const git = (repo, args) => spawnSync('git', args, { cwd: repo, encoding: 'utf8', maxBuffer: 512 * 1024 * 1024 });

/**
 * @param {string} repo  dossier du dépôt git
 * @returns {{ok: false, notARepo: true} | {ok: boolean, commitCount: number, identities: string[], problems: {where: string, kind: string, value: string}[]}}
 */
export function checkHistory(repo) {
  if (git(repo, ['rev-parse', '--git-dir']).status !== 0) return { ok: false, notARepo: true };

  const problems = [];
  const report = (where, found) => { for (const item of found) problems.push({ where, ...item }); };

  // 1 et 2. Commits : identités et messages.
  const separator = '\u001e';
  const field = '\u001f';
  const log = git(repo, ['log', '--all', `--format=%h${field}%s${field}%an${field}%ae${field}%cn${field}%ce${field}%B${separator}`]);
  const commits = log.status === 0 ? log.stdout.split(separator).map((c) => c.replace(/^\n/, '')).filter(Boolean) : [];
  const identities = new Set();
  for (const commit of commits) {
    const [hash, subject, authorName, authorEmail, committerName, committerEmail, message] = commit.split(field);
    const label = `commit ${hash} (« ${subject} »)`;
    identities.add(`${authorName} <${authorEmail}>`);
    identities.add(`${committerName} <${committerEmail}>`);
    if (!isAllowedEmail(authorEmail)) report(`${label}, auteur`, [{ kind: 'adresse e-mail', value: authorEmail }]);
    if (!isAllowedEmail(committerEmail)) report(`${label}, validateur (committer)`, [{ kind: 'adresse e-mail', value: committerEmail }]);
    report(`${label}, message`, findPersonalData(message ?? ''));
  }

  // 3. Le contenu de tous les fichiers, à chaque commit : seules les lignes AJOUTÉES comptent.
  const diff = git(repo, ['log', '--all', '-p', '-U0', '--text', '--no-color', '--no-ext-diff', '--format=@@commit %h %s']);
  let current = ''; let file = '';
  for (const line of diff.status === 0 ? diff.stdout.split('\n') : []) {
    if (line.startsWith('@@commit ')) { current = line.slice('@@commit '.length); file = ''; }
    else if (line.startsWith('+++ ')) file = line.slice(4).replace(/^b\//, '');
    else if (line.startsWith('+')) report(`commit ${current}, fichier ${file}`, findPersonalData(line.slice(1)));
  }

  // 4. Noms de branches et d'étiquettes.
  const refs = git(repo, ['for-each-ref', '--format=%(refname)']);
  for (const ref of refs.stdout.split('\n').filter(Boolean)) report(`nom de branche ou d'étiquette ${ref}`, findPersonalData(ref));

  // 5. Fichiers actuels (suivis, ou nouveaux et pas encore ajoutés ; pas ceux que .gitignore écarte).
  const listed = git(repo, ['ls-files', '-z', '--cached', '--others', '--exclude-standard']);
  for (const rel of listed.stdout.split('\0').filter(Boolean)) {
    if (isBinaryFile(rel)) continue;
    const abs = path.join(repo, rel);
    let text;
    try {
      if (statSync(abs).size > MAX_FILE_SIZE) continue;
      text = readFileSync(abs, 'utf8');
    } catch { continue; } // fichier supprimé mais encore listé, ou illisible
    report(`fichier actuel ${rel}`, findPersonalData(text));
  }

  // 6. L'identité des prochains commits.
  const email = git(repo, ['config', 'user.email']).stdout.trim();
  const name = git(repo, ['config', 'user.name']).stdout.trim();
  if (!email) problems.push({ where: 'identité git des prochains commits', kind: 'configuration', value: "aucune adresse e-mail n'est configurée (git config user.email)" });
  else if (!isAllowedEmail(email)) report('identité git des prochains commits (git config user.email)', [{ kind: 'adresse e-mail', value: email }]);
  if (name) report('identité git des prochains commits (git config user.name)', findPersonalData(name));

  // Chaque emplacement n'est signalé qu'une fois.
  const unique = [...new Map(problems.map((p) => [`${p.where}|${p.kind}|${p.value}`, p])).values()];
  return { ok: unique.length === 0, commitCount: commits.length, identities: [...identities].sort(), problems: unique };
}
