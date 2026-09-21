// Chargement des schémas JSON (dossier schema/) et création des validateurs ajv.
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';
import { SCHEMA_DIR } from './paths.mjs';

export { ROOT_DIR, SCHEMA_DIR } from './paths.mjs';

/** Lit tous les schémas : { nom: schéma }, où le nom est celui du fichier sans « .schema.json ». */
export function loadSchemas(schemaDir = SCHEMA_DIR) {
  const schemas = {};
  for (const file of readdirSync(schemaDir).sort()) {
    if (!file.endsWith('.schema.json')) continue;
    const name = file.replace(/\.schema\.json$/, '');
    schemas[name] = JSON.parse(readFileSync(path.join(schemaDir, file), 'utf8'));
  }
  return schemas;
}

/**
 * Crée une instance ajv qui connaît tous les schémas.
 * - « x-message » : notre mot-clé maison, un message d'aide en français
 *   affiché quand la valeur est refusée (il ne valide rien lui-même).
 * - « verbose » : ajv joint à chaque erreur le morceau de schéma fautif,
 *   ce qui permet de retrouver ce message d'aide.
 */
export function createAjv(schemas = loadSchemas()) {
  const ajv = new Ajv2020({ allErrors: true, strict: true, verbose: true, allowUnionTypes: true });
  ajv.addKeyword('x-message');
  for (const schema of Object.values(schemas)) ajv.addSchema(schema);
  return ajv;
}

/** Renvoie la fonction de validation d'un schéma (par son nom : « character », « edition »…). */
export function getValidator(ajv, name) {
  const validate = ajv.getSchema(`${name}.schema.json`);
  if (!validate) throw new Error(`Schéma inconnu : « ${name} ». Vérifiez le dossier schema/.`);
  return validate;
}
