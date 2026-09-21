// Fichiers indispensables : saga.json, edition.json, relations.json.
import { displayPath } from '../dataset.mjs';

export function checkStructure(dataset, add) {
  for (const [sagaId, saga] of dataset.sagas) {
    if (!saga.saga) {
      add(displayPath(`${sagaId}/`), 'structure.missing-file',
        `Le fichier « saga.json » de la saga « ${sagaId} » est introuvable.`,
        { fix: `Créez data/${sagaId}/saga.json (voir data/couronne-de-brume/saga.json comme modèle).` });
    }
    for (const [editionId, ed] of saga.editions) {
      const dir = displayPath(`${sagaId}/editions/${editionId}/`);
      if (!ed.edition) {
        add(dir, 'structure.missing-file', `Le fichier « edition.json » de l'édition « ${editionId} » est introuvable.`,
          { fix: `Créez ${dir}edition.json (le plus simple : « npm run new-edition »).` });
      }
      if (!ed.relations) {
        add(dir, 'structure.missing-file', `Le fichier « relations.json » de l'édition « ${editionId} » est introuvable.`,
          { fix: `Créez ${dir}relations.json avec « [] » s'il n'y a pas encore de lien.` });
      }
    }
  }
}
