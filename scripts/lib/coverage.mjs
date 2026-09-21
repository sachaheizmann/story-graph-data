// « npm run coverage » : quel pourcentage des textes est traduit, pour chaque édition et chaque langue.
import { createAjv } from './schemas.mjs';
import { dataOf, loadDataset } from './dataset.mjs';

const percent = (done, total) => (total === 0 ? 100 : Math.round((100 * done) / total));

/** Langues à afficher : la langue source d'abord, puis les autres par ordre alphabétique. */
const orderLanguages = (languages, source) => [...languages].sort((a, b) => (a === source ? -1 : b === source ? 1 : a.localeCompare(b)));

/**
 * Calcule la couverture de traduction.
 * @returns {{editions: object[], relationTypes: object[]}}
 */
export function computeCoverage(dataDir) {
  const dataset = loadDataset(dataDir, createAjv());
  const editions = [];
  const sourceLanguages = new Set();

  for (const [sagaId, saga] of [...dataset.sagas].sort(([a], [b]) => a.localeCompare(b))) {
    for (const [editionId, ed] of [...saga.editions].sort(([a], [b]) => a.localeCompare(b))) {
      const source = dataOf(ed.edition)?.language;
      if (source) sourceLanguages.add(source);
      const characters = [...ed.characters.keys()].sort();
      const notes = [...ed.notes.keys()].sort();
      const languages = new Set([...ed.characterTexts.keys(), ...ed.noteTexts.keys(), ...(source ? [source] : [])]);

      editions.push({
        saga: sagaId,
        edition: editionId,
        sourceLanguage: source ?? null,
        characterCount: characters.length,
        noteCount: notes.length,
        languages: orderLanguages(languages, source).map((language) => {
          const missingCharacters = characters.filter((id) => !ed.characterTexts.get(language)?.has(id));
          const missingNotes = notes.filter((id) => !ed.noteTexts.get(language)?.has(id));
          const done = characters.length - missingCharacters.length + notes.length - missingNotes.length;
          const total = characters.length + notes.length;
          return {
            language,
            source: language === source,
            done,
            total,
            percent: percent(done, total),
            characters: { done: characters.length - missingCharacters.length, total: characters.length },
            notes: { done: notes.length - missingNotes.length, total: notes.length },
            missing: { characters: missingCharacters, notes: missingNotes },
          };
        }),
      });
    }
  }

  // Libellés des types de liens : un « label » par type, plus un « reverse_label » par type orienté.
  const types = dataOf(dataset.relationTypes) ?? {};
  const needed = Object.entries(types).flatMap(([type, def]) => [`${type}.label`, ...(def.directed ? [`${type}.reverse_label`] : [])]);
  const relationTypeLanguages = new Set([...dataset.relationTypesText.keys(), ...sourceLanguages]);
  const relationTypes = orderLanguages(relationTypeLanguages, [...sourceLanguages].sort()[0]).map((language) => {
    const labels = dataOf(dataset.relationTypesText.get(language)) ?? {};
    const missing = needed.filter((key) => {
      const [type, field] = key.split('.');
      return labels[type]?.[field] === undefined;
    });
    return {
      language,
      source: sourceLanguages.has(language),
      done: needed.length - missing.length,
      total: needed.length,
      percent: percent(needed.length - missing.length, needed.length),
      missing,
    };
  });

  return { editions, relationTypes };
}

const bar = (value) => `${'█'.repeat(Math.round(value / 10))}${'░'.repeat(10 - Math.round(value / 10))}`;

/** Texte lisible du résultat ; `list` ajoute la liste de ce qui reste à traduire. */
export function formatCoverage(result, { list = false } = {}) {
  const lines = ['Couverture des traductions (textes traduits / textes à traduire)', ''];
  const line = (entry, detail) => `  ${entry.language.padEnd(3)} ${bar(entry.percent)} ${String(entry.percent).padStart(3)} %  (${entry.done}/${entry.total})${entry.source ? '  langue source' : ''}${detail ? `  ${detail}` : ''}`;

  for (const edition of result.editions) {
    lines.push(`${edition.saga} / ${edition.edition} : ${edition.characterCount} personnage${edition.characterCount > 1 ? 's' : ''}, ${edition.noteCount} note${edition.noteCount > 1 ? 's' : ''}`);
    if (edition.languages.length === 0) lines.push('  (aucune langue : cette édition est incomplète, lancez « npm run check »)');
    for (const entry of edition.languages) {
      lines.push(line(entry, `personnages ${entry.characters.done}/${entry.characters.total}, notes ${entry.notes.done}/${entry.notes.total}`));
      if (list && (entry.missing.characters.length > 0 || entry.missing.notes.length > 0)) {
        if (entry.missing.characters.length > 0) lines.push(`      à traduire, personnages : ${entry.missing.characters.join(', ')}`);
        if (entry.missing.notes.length > 0) lines.push(`      à traduire, notes : ${entry.missing.notes.join(', ')}`);
      }
    }
    lines.push('');
  }

  lines.push('Types de liens (communs à toutes les sagas)');
  for (const entry of result.relationTypes) {
    lines.push(line(entry, ''));
    if (list && entry.missing.length > 0) lines.push(`      à traduire : ${entry.missing.join(', ')}`);
  }
  if (!list) lines.push('', 'Ajoutez --list pour voir précisément ce qui reste à traduire : npm run coverage -- --list');
  return lines.join('\n');
}
