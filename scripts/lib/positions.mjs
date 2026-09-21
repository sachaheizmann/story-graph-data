// Positions de lecture : { book, chapter }. L'ordre est le rang du tome dans « books », puis le chapitre.

/** 'ok', 'book-unknown' (tome absent de l'édition) ou 'chapter-out-of-range'. */
export function positionStatus(books, position) {
  const book = books.find((b) => b.id === position.book);
  if (!book) return 'book-unknown';
  if (position.chapter < 1 || position.chapter > book.chapters) return 'chapter-out-of-range';
  return 'ok';
}

/** Nombre comparable (plus grand = plus tard dans la lecture), ou null si la position est invalide. */
export function rankOf(books, position) {
  if (!position || positionStatus(books, position) !== 'ok') return null;
  return books.findIndex((b) => b.id === position.book) * 1_000_000 + position.chapter;
}

export const describePosition = (position) => `${position.book}, chapitre ${position.chapter}`;
