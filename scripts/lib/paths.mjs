// Emplacements des dossiers du dépôt.
import { fileURLToPath } from 'node:url';
import path from 'node:path';

export const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const SCHEMA_DIR = path.join(ROOT_DIR, 'schema');
export const DATA_DIR = path.join(ROOT_DIR, 'data');
