import type { Catalogues } from "./i18n";

// Lot U6 : les textes de « Ta course » (`tacourse.ts`). Un catalogue à part, chargé **à la demande** avec la barre (jamais dans le premier chargement d'une page ni d'un jeu). Le composant ne nomme aucun jeu : le nom d'un jeu
// (« Rejouer Track »), d'une médaille et d'un joueur sont des paramètres. Parité des deux langues : packages/ui/test/catalogues.test.ts.
const fr = {
  "tacourse.titre": "Ta course",
  "tacourse.passerPremier": "{ecart} pour passer 1er",
  "tacourse.doubler": "{ecart} pour doubler {nom}",
  "tacourse.avanceSur": "{ecart} d'avance sur {nom}",
  "tacourse.perte": "{nom} te prend {ecart} sur {jeu}",
  "tacourse.medaille": "Prochaine médaille : {medaille}, à {ecart}",
  "tacourse.rejouer": "Rejouer {jeu}",
  "tacourse.jouer": "Jouer",
  "tacourse.groupeCompte": "Ton temps compte : tu es {rang} de ton groupe",
  "tacourse.groupeNonCompte": "Ton temps ne compte pas encore : seuls les 3 meilleurs comptent",
} as const;

const en: Catalogues<typeof fr>["en"] = {
  "tacourse.titre": "Your race",
  "tacourse.passerPremier": "{ecart} to take 1st",
  "tacourse.doubler": "{ecart} to pass {nom}",
  "tacourse.avanceSur": "{ecart} ahead of {nom}",
  "tacourse.perte": "{nom} beats you by {ecart} in {jeu}",
  "tacourse.medaille": "Next medal: {medaille}, {ecart} away",
  "tacourse.rejouer": "Replay {jeu}",
  "tacourse.jouer": "Play",
  "tacourse.groupeCompte": "Your time counts: you are {rang} in your group",
  "tacourse.groupeNonCompte": "Your time doesn't count yet: only the 3 best do",
};

export const CATALOGUE_TACOURSE = { fr, en };
