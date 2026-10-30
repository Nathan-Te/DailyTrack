import type { Catalogues } from "./i18n";

// Lot P (plateforme) : les textes de l'interrupteur des jeux — la page « Bientôt » d'un jeu pas encore ouvert et le bandeau d'un aperçu (`interrupteur.ts`). **Un catalogue à part, chargé à la
// demande avec ces deux écrans** (jamais dans le premier chargement d'un jeu : le catalogue commun y est, et chaque clé de plus y pèse). La langue est celle de la page (`<html lang>`).
// Le badge « Brouillon » des cartouches du portail est dans le catalogue du portail (`portail.brouillon`). Parité des deux langues : packages/ui/test/catalogues.test.ts.
const fr = {
  "bientot.titre": "Bientôt",
  "bientot.texte": "{nom} n'est pas encore ouvert. Reviens bientôt !",
  "bientot.retour": "‹ Du Jour",
  "apercu.bandeau": "Aperçu — pas encore public",
  "apercu.brouillon": "Brouillon",
} as const;

const en: Catalogues<typeof fr>["en"] = {
  "bientot.titre": "Coming soon",
  "bientot.texte": "{nom} isn't open yet. Come back soon!",
  "bientot.retour": "‹ Du Jour",
  "apercu.bandeau": "Preview — not public yet",
  "apercu.brouillon": "Draft",
};

export const CATALOGUE_INTERRUPTEUR = { fr, en };
