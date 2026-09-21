// Détection de données personnelles dans du texte : chemins d'ordinateur et adresses e-mail.
//
// Le dépôt est PUBLIC. Ces motifs sont volontairement GÉNÉRIQUES : ils ne contiennent ni un nom, ni un e-mail,
// ni un chemin en particulier, et repèrent celui de n'importe qui. Ils sont construits par morceaux pour que ce
// fichier ne contienne pas lui-même ce qu'il cherche.
//
// Utilisé par :
//   - scripts/__tests__/privacy.test.mjs  (npm test)        : les fichiers suivis par git ;
//   - scripts/privacy-history.mjs         (npm run privacy:history) : l'historique complet, à lancer soi-même.

/** Dossiers personnels : /home/<quelqu'un>/, /Users/<quelqu'un>/ (macOS), C:\Users\<quelqu'un>\ (Windows). */
const HOME_PATHS = new RegExp([
  `/${'home'}/[A-Za-z0-9._-]+`,
  `/${'Users'}/[A-Za-z0-9._-]+`,
  `[A-Za-z]:[\\\\/]${'Users'}[\\\\/][A-Za-z0-9._ -]+`,
].join('|'), 'g');

/** Noms de dossiers personnels qui ne désignent personne : l'utilisateur standard des machines de GitHub Actions. */
const NEUTRAL_HOME_NAMES = ['runner'];

/**
 * Une adresse e-mail. Le dernier morceau doit être un nom de domaine en lettres (« .fr », « .com ») : cela écarte
 * les numéros de version collés à un nom (« paquet@8.20.0 »).
 */
const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/g;

/** Domaines réservés aux exemples (RFC 2606) : utilisés dans les tests et la documentation. */
const EXAMPLE_DOMAINS = ['example.org', 'example.com', 'example.net'];

/**
 * Une adresse est admise si elle ne révèle personne :
 *   - l'adresse « noreply » de GitHub (<numéro>+<pseudo>@users.noreply.github.com) ;
 *   - toute adresse « noreply » (par exemple celle d'une mention « Co-Authored-By ») ;
 *   - un domaine d'exemple.
 */
export function isAllowedEmail(email) {
  const at = email.lastIndexOf('@');
  const local = email.slice(0, at).toLowerCase();
  const domain = email.slice(at + 1).toLowerCase();
  return domain === 'users.noreply.github.com'
    || local === 'noreply' || local === 'no-reply'
    || EXAMPLE_DOMAINS.includes(domain);
}

/**
 * Cherche des données personnelles dans un texte.
 * @returns {{kind: 'chemin d\'ordinateur' | 'adresse e-mail', value: string}[]}
 */
export function findPersonalData(text) {
  const found = [];
  for (const match of text.matchAll(HOME_PATHS)) {
    const name = match[0].split(/[\\/]/).filter(Boolean).pop();
    if (!NEUTRAL_HOME_NAMES.includes(name)) found.push({ kind: "chemin d'ordinateur", value: match[0] });
  }
  for (const [email] of text.matchAll(EMAIL)) {
    if (!isAllowedEmail(email)) found.push({ kind: 'adresse e-mail', value: email });
  }
  return found;
}

/** Fichiers qu'on ne lit pas comme du texte. */
export const isBinaryFile = (file) => /\.(png|jpe?g|gif|ico|webp|pdf|woff2?|zip|gz)$/i.test(file);

/** Réglages et mémoire d'un assistant de code : ils contiennent des chemins d'ordinateur et ne se publient jamais. */
export const isAssistantFile = (file) => /(^|\/)(\.claude|memory)(\/|$)|(^|\/)(CLAUDE\.local\.md|MEMORY\.md)$/.test(file);
