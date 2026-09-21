// Avertissements : ce qui est probablement une erreur, mais pas assez sûr pour bloquer la validation.
import { dataOf, allEditions } from '../dataset.mjs';
import { describePosition } from '../positions.mjs';

const samePosition = (a, b) => a && b && a.book === b.book && a.chapter === b.chapter;

/**
 * Un lien FAMILIAL qui se termine exactement quand un de ses deux personnages « finit » (mort, départ).
 * La mort d'un personnage se note avec le « end » du PERSONNAGE ; le lien familial reste : Edrin meurt,
 * son mariage avec Maelis ne prend pas fin pour autant.
 */
export function checkWarnings(dataset, add) {
  const types = dataOf(dataset.relationTypes);
  if (!types) return;

  for (const { sagaId, ed } of allEditions(dataset)) {
    const relations = dataOf(ed.relations);
    if (!relations) continue;
    for (const relation of relations) {
      if (!relation.end || types[relation.type]?.category !== 'family') continue;
      for (const side of ['from', 'to']) {
        const character = dataOf(ed.characters.get(relation[side]));
        if (!character || !samePosition(character.end, relation.end)) continue;
        add(ed.relations.file, 'family.end-at-death',
          `Le lien familial « ${relation.id} » (${relation.type}) se termine (${describePosition(relation.end)}) au moment exact où le lecteur apprend la mort ou le départ de « ${character.id} ».`,
          {
            severity: 'warning',
            fix: `Un décès ne met pas fin à un lien familial : il se note avec le « end » du PERSONNAGE (data/${sagaId}/editions/${ed.id}/characters/${character.id}.json), et le lien n'a pas de « end ». `
              + 'Exemple : Edrin meurt (« end » du personnage « edrin »), mais son mariage avec Maelis reste. '
              + "Si ce lien s'est vraiment rompu (divorce, reniement…), ignorez cet avertissement.",
            reminder: true,
          });
      }
    }
  }
}
