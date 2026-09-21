// Constantes partagées par les scripts.

/** Marqueur laissé par les outils « new-* » : le contrôle refuse un fichier qui le contient encore. */
export const PLACEHOLDER = 'À COMPLÉTER';

/** Longueur maximale d'une note, en caractères (on écrit des faits courts, pas des extraits du livre). */
export const NOTE_MAX_LENGTH = 600;

/** Rappel affiché avec les erreurs qui touchent aux positions et aux descriptions. */
export const REVEALED_REMINDER =
  "« start » (et « end ») est le moment où le lecteur l'APPREND, jamais le moment où c'est vrai dans l'histoire. " +
  'Une description ne contient que ce qui est connu à son « start » : le reste va dans des notes datées.';
