// Règles 3, 4 et 5 : positions valides, « end » après « start », et pas de lien / note avant son sujet.
import { dataOf, allEditions } from '../dataset.mjs';
import { positionStatus, rankOf, describePosition } from '../positions.mjs';

const LABEL = { character: 'Le personnage', relation: 'Le lien', note: 'La note' };

/** Tous les éléments datés d'une édition : { kind, id, file, start, end }. */
function datedItems(ed) {
  const items = [];
  for (const entry of ed.characters.values()) {
    const c = dataOf(entry);
    if (c) items.push({ kind: 'character', id: c.id, file: entry.file, start: c.start, end: c.end ?? null });
  }
  for (const r of dataOf(ed.relations) ?? []) {
    items.push({ kind: 'relation', id: r.id, file: ed.relations.file, start: r.start, end: r.end ?? null, relation: r });
  }
  for (const entry of ed.notes.values()) {
    const n = dataOf(entry);
    if (n) items.push({ kind: 'note', id: n.id, file: entry.file, start: n.start, end: null, note: n });
  }
  return items;
}

export function checkPositions(dataset, add) {
  for (const { ed } of allEditions(dataset)) {
    const editionData = dataOf(ed.edition);
    if (!editionData) continue; // sans les tomes, on ne peut pas juger les positions
    const { books } = editionData;
    const bookIds = books.map((b) => `« ${b.id} » (${b.chapters} chapitres)`).join(', ');

    // Règle 3 : le tome existe et le chapitre est dans ses limites.
    const seenBooks = new Set();
    for (const book of books) {
      if (seenBooks.has(book.id)) {
        add(ed.edition.file, 'duplicate.book', `Le tome « ${book.id} » est déclaré deux fois dans « books ».`,
          { fix: 'Chaque tome a un identifiant unique dans une édition.' });
      }
      seenBooks.add(book.id);
    }
    const items = datedItems(ed);
    for (const item of items) {
      for (const field of ['start', 'end']) {
        const position = item[field];
        if (!position) continue;
        const status = positionStatus(books, position);
        if (status === 'book-unknown') {
          add(item.file, 'position.book-unknown',
            `${LABEL[item.kind]} « ${item.id} » : « ${field} » désigne le tome « ${position.book} », qui n'existe pas dans l'édition « ${ed.id} ».`,
            { fix: `Utilisez un tome de cette édition : ${bookIds}.` });
        } else if (status === 'chapter-out-of-range') {
          const book = books.find((b) => b.id === position.book);
          add(item.file, 'position.chapter-out-of-range',
            `${LABEL[item.kind]} « ${item.id} » : « ${field} » désigne le chapitre ${position.chapter} du tome « ${book.id} », qui n'a que ${book.chapters} chapitre${book.chapters > 1 ? 's' : ''} dans l'édition « ${ed.id} ».`,
            { fix: `Les chapitres sont ceux de CETTE édition (de 1 à ${book.chapters}) : une autre édition découpe peut-être autrement.` });
        }
      }
    }

    // Règle 4 : « end » strictement après « start ».
    for (const item of items) {
      if (!item.end) continue;
      const start = rankOf(books, item.start);
      const end = rankOf(books, item.end);
      if (start !== null && end !== null && end <= start) {
        add(item.file, 'order.end-not-after-start',
          `${LABEL[item.kind]} « ${item.id} » : « end » (${describePosition(item.end)}) n'est pas après « start » (${describePosition(item.start)}).`,
          { fix: '« end » est le moment où le lecteur apprend la fin (mort, départ, rupture) : il vient strictement après « start ».', reminder: true });
      }
    }

    // Règle 5 : un lien ne commence pas avant ses personnages, une note pas avant son sujet.
    const characters = new Map(items.filter((i) => i.kind === 'character').map((i) => [i.id, i]));
    const relations = new Map(items.filter((i) => i.kind === 'relation').map((i) => [i.id, i]));
    for (const item of items) {
      const start = rankOf(books, item.start);
      if (start === null) continue;
      if (item.kind === 'relation') {
        for (const side of ['from', 'to']) {
          const character = characters.get(item.relation[side]);
          const characterStart = character && rankOf(books, character.start);
          if (characterStart !== null && characterStart !== undefined && start < characterStart) {
            add(item.file, 'order.relation-before-character',
              `Le lien « ${item.id} » commence (${describePosition(item.start)}) avant que le lecteur ne découvre « ${character.id} » (${describePosition(character.start)}).`,
              { fix: 'Un lien ne peut pas être connu avant les deux personnages qu\'il relie : avancez le « start » du lien, ou reculez celui du personnage si vous vous êtes trompé.', reminder: true });
          }
        }
      }
      if (item.kind === 'note') {
        const subject = item.note.about.type === 'character' ? characters.get(item.note.about.id) : relations.get(item.note.about.id);
        const subjectStart = subject && rankOf(books, subject.start);
        if (subjectStart !== null && subjectStart !== undefined && start < subjectStart) {
          add(item.file, 'order.note-before-subject',
            `La note « ${item.id} » commence (${describePosition(item.start)}) avant son sujet « ${subject.id} » (${describePosition(subject.start)}).`,
            { fix: 'Une note complète un élément déjà connu du lecteur : avancez son « start » au moins jusqu\'à celui du sujet.', reminder: true });
        }
      }
    }
  }
}
