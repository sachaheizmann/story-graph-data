// Règle 6 : pas de doublon d'identifiant ni de lien, ordre canonique des types non orientés, pas de cycle de parenté.
import { dataOf, allEditions } from '../dataset.mjs';
import { rankOf, describePosition } from '../positions.mjs';

export function checkUniqueness(dataset, add) {
  const types = dataOf(dataset.relationTypes);

  for (const { ed } of allEditions(dataset)) {
    const relations = dataOf(ed.relations);
    if (!relations) continue;
    const books = dataOf(ed.edition)?.books;

    // Identifiants de liens en double.
    const firstSeen = new Map();
    relations.forEach((relation, index) => {
      if (firstSeen.has(relation.id)) {
        add(ed.relations.file, 'duplicate.id',
          `L'identifiant de lien « ${relation.id} » est utilisé deux fois (liens n° ${firstSeen.get(relation.id) + 1} et n° ${index + 1}).`,
          { fix: 'Chaque lien a un « id » unique dans l\'édition : ajoutez un numéro (aria-kael-ally-1, aria-kael-ally-2…).' });
      } else {
        firstSeen.set(relation.id, index);
      }
    });

    // Ordre canonique des types non orientés : from < to (alphabétique).
    if (types) {
      for (const relation of relations) {
        if (types[relation.type] && types[relation.type].directed === false && relation.from > relation.to) {
          add(ed.relations.file, 'order.undirected-canonical',
            `Le lien « ${relation.id} » est de type « ${relation.type} » (non orienté) : « from » (« ${relation.from} ») doit précéder « to » (« ${relation.to} ») dans l'ordre alphabétique.`,
            { fix: `Inversez-les (from : « ${relation.to} », to : « ${relation.from} »), ou lancez « npm run format » qui le fait automatiquement. Cela évite le doublon aria→kael / kael→aria.` });
        }
      }
    }

    // Doublons de liens : même from / to / type sur des périodes qui se chevauchent (la fin est exclue).
    if (books) {
      const INFINITY = Number.MAX_SAFE_INTEGER;
      const span = (r) => {
        const start = rankOf(books, r.start);
        const end = r.end ? rankOf(books, r.end) : INFINITY;
        return start === null || end === null ? null : { start, end };
      };
      for (let i = 0; i < relations.length; i += 1) {
        for (let j = i + 1; j < relations.length; j += 1) {
          const a = relations[i];
          const b = relations[j];
          if (a.from !== b.from || a.to !== b.to || a.type !== b.type || a.id === b.id) continue;
          const sa = span(a);
          const sb = span(b);
          if (!sa || !sb || !(sa.start < sb.end && sb.start < sa.end)) continue;
          const identical = JSON.stringify([a.start, a.end ?? null]) === JSON.stringify([b.start, b.end ?? null]);
          add(ed.relations.file, 'duplicate.relation',
            identical
              ? `Les liens « ${a.id} » et « ${b.id} » sont identiques (mêmes personnages, même type « ${a.type} », mêmes positions).`
              : `Les liens « ${a.id} » et « ${b.id} » (type « ${a.type} », ${a.from} → ${a.to}) se chevauchent : ${describePosition(a.start)} → ${a.end ? describePosition(a.end) : 'sans fin'} et ${describePosition(b.start)} → ${b.end ? describePosition(b.end) : 'sans fin'}.`,
            { fix: 'Supprimez le doublon. Si la relation change au fil de l\'histoire, faites deux liens qui se suivent : le premier avec un « end », le second qui commence à cette position.' });
        }
      }
    }

    // Pas de cycle dans parent_of (personne n'est son propre ancêtre).
    const parents = new Map(); // parent -> enfants
    for (const r of relations) {
      if (r.type !== 'parent_of' || r.from === r.to) continue;
      if (!parents.has(r.from)) parents.set(r.from, new Set());
      parents.get(r.from).add(r.to);
    }
    const state = new Map(); // 1 = en cours d'exploration, 2 = terminé
    const reported = new Set();
    const stack = [];
    const visit = (node) => {
      state.set(node, 1);
      stack.push(node);
      for (const child of parents.get(node) ?? []) {
        if (state.get(child) === 1) {
          const cycle = stack.slice(stack.indexOf(child));
          const key = [...cycle].sort().join('|');
          if (!reported.has(key)) {
            reported.add(key);
            add(ed.relations.file, 'family.parent-cycle',
              `Les liens « parent_of » forment une boucle : ${[...cycle, child].join(' → ')}. Quelqu'un serait son propre ancêtre.`,
              { fix: '« parent_of » va du parent vers l\'enfant (from = le parent). Vérifiez le sens d\'un des liens de cette boucle.' });
          }
        } else if (!state.get(child)) {
          visit(child);
        }
      }
      stack.pop();
      state.set(node, 2);
    };
    for (const node of [...parents.keys()].sort()) if (!state.get(node)) visit(node);
  }
}
