import type { Catalogues } from "@cdj/ui";

// Lot I6 (plateforme) : l'aperçu quand on colle le lien de Track (Open Graph : titre, description, texte de l'image ; `index.html`). Lu **seulement à la
// construction** (`vite.config.ts` pré-remplit les balises en français) : jamais dans le paquet du jeu, il ne pèse pas sur le premier chargement. Le français
// sert au lancement, l'anglais est prêt pour plus tard. Ton de Track (charte § 7) : sec, les chiffres d'abord. Parité : packages/ui/test/catalogues.test.ts.
const fr = {
  "apercu.titre": "Track — Du Jour",
  "apercu.description": "Un circuit par jour, le même pour tous. Un tour, un chrono, le fantôme du premier à battre.",
  "apercu.image": "L'étiquette de Track : asphalte, bandes de livrée orange, TRACK en capitales.",
} as const;

const en: Catalogues<typeof fr>["en"] = {
  "apercu.titre": "Track — Du Jour",
  "apercu.description": "One circuit a day, the same for everyone. One lap, one time, the leader's ghost to beat.",
  "apercu.image": "The Track label: asphalt, orange livery stripes, TRACK in capitals.",
};

export const CATALOGUE_APERCU = { fr, en };
