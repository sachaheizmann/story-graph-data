// Traduit les erreurs d'ajv (anglais, techniques) en messages français avec une piste de correction.
// Les pistes viennent du mot-clé maison « x-message » des schémas.

const TYPES_FR = {
  string: 'du texte',
  integer: 'un nombre entier',
  number: 'un nombre',
  boolean: 'vrai ou faux (true / false)',
  array: 'une liste [ … ]',
  object: 'un objet { … }',
  null: 'null',
};

const decode = (segment) => segment.replace(/~1/g, '/').replace(/~0/g, '~');

/** « /3/start/chapter » -> { where: « le lien n° 4 (« id ») », field: « start.chapter » }. */
function locate(instancePath, data) {
  const segments = instancePath.split('/').slice(1).map(decode);
  let where = '';
  if (Array.isArray(data) && segments.length > 0 && /^\d+$/.test(segments[0])) {
    const index = Number(segments.shift());
    const id = data[index]?.id;
    where = id ? `Le lien « ${id} » (n° ${index + 1})` : `L'élément n° ${index + 1}`;
  }
  const field = segments.map((s) => (/^\d+$/.test(s) ? `[${s}]` : `.${s}`)).join('').replace(/^\./, '');
  return { where, field };
}

const short = (value) => {
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  return text.length > 40 ? `${text.slice(0, 37)}…` : text;
};

/**
 * @param {import('ajv').ErrorObject[]} errors
 * @param {unknown} data  le contenu du fichier (pour retrouver l'id d'un lien)
 * @returns {{message: string, fix?: string, reminder: boolean}[]}
 */
export function describeAjvErrors(errors, data) {
  const seen = new Set();
  const out = [];
  for (const error of errors) {
    const key = `${error.instancePath}|${error.keyword}|${JSON.stringify(error.params)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const described = describeOne(error, data);
    if (described) out.push(described);
  }
  return out;
}

function describeOne(error, data) {
  const { keyword, params, parentSchema, instancePath } = error;
  const { where, field } = locate(instancePath, data);
  const hint = parentSchema?.['x-message'];
  const subject = field ? `« ${field} »` : 'Le contenu';
  const prefix = where ? `${where} : ` : '';
  const segments = instancePath.split('/');
  const reminder = segments.some((s) => ['start', 'end', 'description'].includes(s));

  // Une clé d'objet refusée (ex. nom de type de lien) : ajv signale la clé, pas la valeur.
  if (error.propertyName !== undefined) {
    if (keyword === 'propertyNames') return null; // résumé redondant avec l'erreur précise
    return { message: `${prefix}La clé « ${error.propertyName} » n'est pas un nom valide.`, fix: hint, reminder };
  }

  let message;
  let fix = hint;
  switch (keyword) {
    case 'required': {
      const missing = params.missingProperty;
      const inside = field ? ` dans ${subject}` : '';
      message = `${prefix}Le champ « ${missing} » est obligatoire${inside}.`;
      const property = parentSchema?.properties?.[missing];
      fix = property?.['x-message'] ?? property?.description ?? 'Ajoutez ce champ (voir le schéma correspondant dans schema/).';
      return { message, fix, reminder: reminder || ['start', 'end', 'description'].includes(missing) };
    }
    case 'additionalProperties': {
      const allowed = Object.keys(parentSchema?.properties ?? {});
      message = `${prefix}Le champ « ${params.additionalProperty} » n'existe pas${field ? ` dans ${subject}` : ' dans ce type de fichier'}.`;
      fix = allowed.length
        ? `Supprimez-le ou corrigez son orthographe. Champs autorisés : ${allowed.join(', ')}.`
        : 'Supprimez-le ou corrigez son orthographe.';
      return { message, fix, reminder };
    }
    case 'type': {
      const expected = [].concat(params.type).map((t) => TYPES_FR[t] ?? t).join(' ou ');
      message = `${prefix}${subject} doit être ${expected} (valeur trouvée : ${short(error.data)}).`;
      break;
    }
    case 'pattern':
      message = `${prefix}${subject} a un format invalide (valeur trouvée : ${short(error.data)}).`;
      break;
    case 'minLength':
      message = `${prefix}${subject} ne peut pas être vide.`;
      break;
    case 'maxLength':
      message = `${prefix}${subject} est trop long (${String(error.data).length} caractères, ${params.limit} au plus).`;
      break;
    case 'minimum':
      message = `${prefix}${subject} doit valoir au moins ${params.limit} (valeur trouvée : ${short(error.data)}).`;
      break;
    case 'maximum':
      message = `${prefix}${subject} doit valoir au plus ${params.limit} (valeur trouvée : ${short(error.data)}).`;
      break;
    case 'minItems':
      message = `${prefix}${subject} doit contenir au moins ${params.limit} élément${params.limit > 1 ? 's' : ''}.`;
      break;
    case 'maxItems':
      message = `${prefix}${subject} contient trop d'éléments (${params.limit} au plus).`;
      break;
    case 'minProperties':
      message = `${prefix}${subject} ne peut pas être vide.`;
      break;
    case 'uniqueItems':
      message = `${prefix}${subject} contient deux fois la même valeur (éléments n° ${params.i + 1} et n° ${params.j + 1}).`;
      break;
    case 'enum':
      message = `${prefix}${subject} doit être l'une de ces valeurs : ${params.allowedValues.map((v) => `« ${v} »`).join(', ')} (valeur trouvée : ${short(error.data)}).`;
      break;
    case 'const':
      message = `${prefix}${subject} doit valoir ${JSON.stringify(params.allowedValue)} (valeur trouvée : ${short(error.data)}).`;
      break;
    default:
      message = `${prefix}${subject} : ${error.message}.`;
  }
  return { message, fix, reminder };
}
