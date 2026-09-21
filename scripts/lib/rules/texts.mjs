// Règles 7 et 8 : la langue source est complète, aucun texte orphelin. Plus les notes et les libellés de types.
import { dataOf, allEditions, displayPath } from '../dataset.mjs';
import { NOTE_MAX_LENGTH } from '../constants.mjs';

export function checkTexts(dataset, add) {
  const types = dataOf(dataset.relationTypes);

  for (const { sagaId, ed } of allEditions(dataset)) {
    const editionData = dataOf(ed.edition);
    const dir = `${sagaId}/editions/${ed.id}`;

    // Règle 7 : dans la langue source de l'édition, tout personnage et toute note ont leur texte.
    if (editionData) {
      const language = editionData.language;
      for (const id of ed.characters.keys()) {
        if (!ed.characterTexts.get(language)?.has(id)) {
          add(displayPath(`${dir}/text/${language}/characters/${id}.json`), 'texts.missing',
            `Le personnage « ${id} » n'a pas de texte en « ${language} », la langue source de l'édition « ${ed.id} ».`,
            { fix: `Créez ce fichier avec { "name": "…", "description": "…" } (ou lancez « npm run new-character »).`, reminder: true });
        }
      }
      for (const id of ed.notes.keys()) {
        if (!ed.noteTexts.get(language)?.has(id)) {
          add(displayPath(`${dir}/text/${language}/notes/${id}.md`), 'texts.missing',
            `La note « ${id} » n'a pas de texte en « ${language} », la langue source de l'édition « ${ed.id} ».`,
            { fix: 'Créez ce fichier Markdown : quelques phrases écrites avec vos propres mots (ou lancez « npm run new-note »).' });
        }
      }
    }

    // Règle 8 : chaque texte correspond à un identifiant existant (toutes langues).
    for (const [language, texts] of ed.characterTexts) {
      for (const [id, entry] of texts) {
        if (!ed.characters.has(id)) {
          add(entry.file, 'orphan.text',
            `Ce texte (« ${language} ») ne correspond à aucun personnage : il n'y a pas de characters/${id}.json dans l'édition « ${ed.id} ».`,
            { fix: `Renommez ce fichier si l'identifiant est mal écrit, ou supprimez-le. Personnages existants : ${[...ed.characters.keys()].join(', ') || '(aucun)'}.` });
        }
      }
    }
    for (const [language, texts] of ed.noteTexts) {
      for (const [id, entry] of texts) {
        if (!ed.notes.has(id)) {
          add(entry.file, 'orphan.text',
            `Ce texte (« ${language} ») ne correspond à aucune note : il n'y a pas de notes/${id}.json dans l'édition « ${ed.id} ».`,
            { fix: "Renommez ce fichier si l'identifiant est mal écrit, ou supprimez-le." });
        }
      }
    }

    // Les notes : non vides, courtes.
    for (const texts of ed.noteTexts.values()) {
      for (const entry of texts.values()) {
        const length = [...entry.data.trim()].length;
        if (length === 0) {
          add(entry.file, 'notes.text-empty', 'Cette note est vide.',
            { fix: 'Écrivez quelques phrases avec vos propres mots, ou supprimez la note (fichier .json et fichier .md).' });
        } else if (length > NOTE_MAX_LENGTH) {
          add(entry.file, 'notes.text-too-long',
            `Cette note est trop longue (${length} caractères, ${NOTE_MAX_LENGTH} au plus).`,
            { fix: 'Une note est un fait court, écrit avec vos propres mots (jamais un extrait du livre). Découpez-la en plusieurs notes, chacune avec son propre « start ».' });
        }
      }
    }
  }

  // Sagas et auteurs : au moins un texte, et pas de texte d'auteur orphelin.
  for (const [sagaId, saga] of dataset.sagas) {
    if (saga.saga && saga.texts.size === 0) {
      add(saga.saga.file, 'texts.no-language',
        `La saga « ${sagaId} » n'a aucun texte (titre et description).`,
        { fix: `Créez data/${sagaId}/text/fr/saga.json avec { "title": "…", "description": "…" }, sans spoiler.`, reminder: true });
    }
  }
  for (const [authorId, entry] of dataset.authors) {
    if (!dataset.authorTexts.has(authorId)) {
      add(entry.file, 'texts.no-language', `L'auteur « ${authorId} » n'a aucun texte (nom et biographie).`,
        { fix: `Créez data/authors/text/fr/${authorId}.json avec { "name": "…", "bio": "…" }.` });
    }
  }
  for (const [authorId, texts] of dataset.authorTexts) {
    if (dataset.authors.has(authorId)) continue;
    for (const [language, entry] of texts) {
      add(entry.file, 'orphan.text',
        `Ce texte (« ${language} ») ne correspond à aucun auteur : il n'y a pas de data/authors/${authorId}.json.`,
        { fix: "Renommez ce fichier si l'identifiant est mal écrit, ou supprimez-le." });
    }
  }

  // Types de liens : libellés. Orphelins et « reverse_label » interdit sur un type non orienté (toutes langues) ;
  // complet (label, et reverse_label pour les types orientés) dans chaque langue source d'une édition.
  if (types) {
    for (const [language, entry] of dataset.relationTypesText) {
      const labels = dataOf(entry);
      if (!labels) continue;
      for (const [type, text] of Object.entries(labels)) {
        if (!(type in types)) {
          add(entry.file, 'orphan.text',
            `Ce libellé (« ${language} ») concerne le type « ${type} », qui n'existe pas dans relation-types.json.`,
            { fix: `Corrigez le nom du type ou supprimez ce libellé. Types connus : ${Object.keys(types).join(', ')}.` });
        } else if (text.reverse_label !== undefined && !types[type].directed) {
          add(entry.file, 'texts.reverse-label-undirected',
            `Le type « ${type} » n'est pas orienté : il n'a pas de « reverse_label ».`,
            { fix: 'Supprimez « reverse_label » : pour un lien symétrique, le même libellé se lit dans les deux sens.' });
        }
      }
    }

    const sourceLanguages = new Set(allEditions(dataset).map(({ ed }) => dataOf(ed.edition)?.language).filter(Boolean));
    for (const language of [...sourceLanguages].sort()) {
      const path = displayPath(`_common/text/${language}/relation-types.json`);
      const entry = dataset.relationTypesText.get(language);
      if (!entry) {
        add(path, 'texts.relation-types-missing',
          `Il manque les libellés des types de liens en « ${language} », langue source d'au moins une édition.`,
          { fix: `Créez ce fichier avec, pour chaque type, { "label": "…" } et, pour les types orientés, un « reverse_label » (voir data/_common/text/fr/relation-types.json).` });
        continue;
      }
      const labels = dataOf(entry);
      if (!labels) continue;
      for (const [type, definition] of Object.entries(types)) {
        if (!labels[type]) {
          add(entry.file, 'texts.label-missing',
            `Il manque le libellé du type « ${type} » en « ${language} », langue source d'au moins une édition.`,
            { fix: `Ajoutez "${type}": { "label": "…"${definition.directed ? ', "reverse_label": "…"' : ''} }.` });
        } else if (definition.directed && labels[type].reverse_label === undefined) {
          add(entry.file, 'texts.reverse-label-missing',
            `Le type orienté « ${type} » n'a pas de « reverse_label » en « ${language} », langue source d'au moins une édition.`,
            { fix: 'Ajoutez le libellé inverse, utilisé pour afficher le lien du point de vue de l\'autre personnage (par exemple « a pour parent » pour parent_of).' });
        }
      }
    }
  }
}
