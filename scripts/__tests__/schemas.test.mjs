// Vérifie que chaque schéma est compilable et qu'il accepte / refuse ce qu'il faut.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createAjv, getValidator, loadSchemas } from '../lib/schemas.mjs';

const ajv = createAjv();
const start = { book: 'tome-1', chapter: 1 };

// Pour chaque schéma : un exemple valide, et un exemple invalide avec la raison.
const samples = {
  saga: {
    ok: { schemaVersion: 1, id: 'ma-saga', demo: true, authors: ['un-auteur'], defaultEdition: 'fr-original' },
    ko: { schemaVersion: 2, id: 'ma-saga', authors: [], defaultEdition: 'fr-original' },
  },
  'saga-text': {
    ok: { title: 'Ma saga', description: 'Une saga.' },
    ko: { title: '   ', description: 'Une saga.' },
  },
  author: {
    ok: { id: 'un-auteur', born: 1975 },
    ko: { id: 'Un Auteur' },
  },
  'author-text': {
    ok: { name: 'Un Auteur', bio: 'Biographie.' },
    ko: { name: 'Un Auteur' },
  },
  edition: {
    ok: {
      id: 'fr-original', language: 'fr', publisher: 'Éditions X', year: 2012, based_on: null,
      created_by: ['demo-contributor'], translators: ['Marie Dupont'],
      books: [{ id: 'tome-1', title: 'Tome un', chapters: 10 }],
    },
    ko: {
      id: 'fr-original', language: 'francais', publisher: 'Éditions X', year: 2012, based_on: null,
      created_by: ['jean@example.org'], books: [{ id: 'tome-1', title: 'Tome un', chapters: 0 }],
    },
  },
  character: {
    ok: { id: 'aria', start, end: null },
    ko: { id: 'aria', start: { book: 'tome-1', chapter: 0 } },
  },
  'character-text': {
    ok: { name: 'Aria', aliases: ['la Louve'], description: 'Archère.' },
    ko: { name: 'Aria' },
  },
  relation: {
    ok: { id: 'a-b-ally-1', from: 'a', to: 'b', type: 'ally', start, end: { book: 'tome-1', chapter: 5 } },
    ko: { id: 'a-b-ally-1', from: 'a', to: 'b', start },
  },
  relations: {
    ok: [{ id: 'a-b-ally-1', from: 'a', to: 'b', type: 'ally', start, end: null }],
    ko: { id: 'pas-un-tableau' },
  },
  note: {
    ok: { id: 'n-7k2p9', about: { type: 'character', id: 'aria' }, start },
    ko: { id: 'n-7k2p9', about: { type: 'lieu', id: 'aria' }, start },
  },
  position: {
    ok: start,
    ko: { book: 'tome-1', chapter: 1.5 },
  },
  'relation-types': {
    ok: { ally: { category: 'social', directed: false } },
    ko: { ally: { category: 'magic', directed: false } },
  },
  'relation-types-text': {
    ok: { ally: { label: 'est allié(e) avec' } },
    ko: { ally: {} },
  },
};

test('tous les schémas ont un exemple de test', () => {
  const names = Object.keys(loadSchemas()).filter((n) => n !== 'common');
  assert.deepEqual(names.sort(), Object.keys(samples).sort(),
    'Chaque schéma (sauf « common ») doit avoir un exemple valide et un exemple invalide dans ce test.');
});

for (const [name, { ok, ko }] of Object.entries(samples)) {
  test(`schéma « ${name} » : accepte un exemple valide`, () => {
    const validate = getValidator(ajv, name);
    assert.equal(validate(ok), true, JSON.stringify(validate.errors));
  });
  test(`schéma « ${name} » : refuse un exemple invalide`, () => {
    const validate = getValidator(ajv, name);
    assert.equal(validate(ko), false);
  });
}

test('position « end » accepte null mais refuse une chaîne', () => {
  const validate = getValidator(ajv, 'character');
  assert.equal(validate({ id: 'a', start, end: null }), true);
  assert.equal(validate({ id: 'a', start, end: 'tome-1' }), false);
});

test('les erreurs portent le message d\'aide « x-message » du schéma', () => {
  const validate = getValidator(ajv, 'character');
  validate({ id: 'Aria', start });
  const error = validate.errors[0];
  assert.match(error.parentSchema['x-message'], /minuscules/);
});
