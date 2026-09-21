// Règle 2 : les références pointent vers des éléments qui existent.
import { dataOf, allEditions } from '../dataset.mjs';

export function checkReferences(dataset, add) {
  const types = dataOf(dataset.relationTypes);

  for (const [sagaId, saga] of dataset.sagas) {
    const sagaData = dataOf(saga.saga);
    if (sagaData) {
      for (const authorId of sagaData.authors) {
        if (!dataset.authors.has(authorId)) {
          add(saga.saga.file, 'ref.author-unknown',
            `L'auteur « ${authorId} » n'existe pas.`,
            { fix: `Créez data/authors/${authorId}.json et son texte data/authors/text/<langue>/${authorId}.json, ou corrigez « authors ».` });
        }
      }
      if (!saga.editions.get(sagaData.defaultEdition)?.edition) {
        add(saga.saga.file, 'ref.default-edition-unknown',
          `L'édition par défaut « ${sagaData.defaultEdition} » n'existe pas dans cette saga.`,
          { fix: `Choisissez l'un des dossiers de data/${sagaId}/editions/ : ${[...saga.editions.keys()].join(', ') || '(aucun)'}.` });
      }
    }
  }

  for (const { sagaId, saga, ed } of allEditions(dataset)) {
    const editionData = dataOf(ed.edition);
    if (editionData?.based_on !== undefined && editionData.based_on !== null) {
      if (!saga.editions.get(editionData.based_on)?.edition) {
        add(ed.edition.file, 'ref.based-on-unknown',
          `« based_on » désigne l'édition « ${editionData.based_on} », qui n'existe pas dans la saga « ${sagaId} ».`,
          { fix: `« based_on » doit être l'identifiant d'une autre édition de la MÊME saga (${[...saga.editions.keys()].filter((k) => k !== ed.id).join(', ') || 'aucune autre pour l\'instant'}), ou null.` });
      }
    }

    const relations = dataOf(ed.relations);
    if (relations) {
      for (const relation of relations) {
        for (const side of ['from', 'to']) {
          if (!ed.characters.has(relation[side])) {
            add(ed.relations.file, 'ref.character-unknown',
              `Le lien « ${relation.id} » : « ${side} » désigne « ${relation[side]} », qui n'est pas un personnage de l'édition « ${ed.id} ».`,
              { fix: `Créez data/${sagaId}/editions/${ed.id}/characters/${relation[side]}.json (« npm run new-character ») ou corrigez l'identifiant.` });
          }
        }
        if (relation.from === relation.to) {
          add(ed.relations.file, 'relations.self-link',
            `Le lien « ${relation.id} » relie « ${relation.from} » à lui-même.`,
            { fix: '« from » et « to » doivent être deux personnages différents.' });
        }
        if (types && !(relation.type in types)) {
          add(ed.relations.file, 'ref.type-unknown',
            `Le lien « ${relation.id} » a un type inconnu : « ${relation.type} ».`,
            { fix: `Types connus : ${Object.keys(types).join(', ')}. Ajouter un type est une décision du mainteneur (voir docs/MAINTAINER.md).` });
        }
      }
    }

    for (const noteEntry of ed.notes.values()) {
      const note = dataOf(noteEntry);
      if (!note) continue;
      if (note.about.type === 'character' && !ed.characters.has(note.about.id)) {
        add(noteEntry.file, 'ref.subject-unknown',
          `La note « ${note.id} » porte sur le personnage « ${note.about.id} », qui n'existe pas dans l'édition « ${ed.id} ».`,
          { fix: 'Corrigez « about.id » ou créez le personnage.' });
      }
      // Impossible de juger les notes sur un lien si relations.json est absent ou invalide.
      if (note.about.type === 'relation' && relations && !relations.some((r) => r.id === note.about.id)) {
        add(noteEntry.file, 'ref.subject-unknown',
          `La note « ${note.id} » porte sur le lien « ${note.about.id} », qui n'existe pas dans relations.json.`,
          { fix: 'Corrigez « about.id » avec l\'« id » exact du lien.' });
      }
    }
  }

  // Cycle dans les « based_on » : A est basée sur B qui est basée sur A…
  for (const saga of dataset.sagas.values()) {
    for (const [editionId, ed] of saga.editions) {
      const chain = [editionId];
      let current = dataOf(ed.edition)?.based_on;
      while (current && !chain.includes(current) && dataOf(saga.editions.get(current)?.edition)) {
        chain.push(current);
        current = dataOf(saga.editions.get(current).edition).based_on;
      }
      if (current === editionId && chain.slice().sort()[0] === editionId) {
        add(ed.edition.file, 'ref.based-on-cycle',
          `Les éditions se basent les unes sur les autres en boucle : ${[...chain, editionId].join(' → ')}.`,
          { fix: 'Une édition est la copie adaptée d\'une édition plus ancienne : mettez « based_on » à null pour l\'originale.' });
      }
    }
  }
}
