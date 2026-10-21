import type { Catalogues } from "@cdj/ui";

// Lot I6 (plateforme) : l'aperçu quand on colle le lien de Jump (Open Graph : titre, description, texte de l'image ; `index.html`). Lu **seulement à la
// construction** (`vite.config.ts` pré-remplit les balises en français) : jamais dans le paquet du jeu, il ne pèse pas sur le premier chargement. Le français
// sert au lancement, l'anglais est prêt pour plus tard. Ton de Jump (charte § 7) : drôle et un peu cruel. Parité : packages/ui/test/catalogues.test.ts.
const fr = {
  "apercu.titre": "Jump — Du Jour",
  "apercu.description": "Un niveau par jour, le même pour tous. Les scies tournent déjà. Tu vas mourir. Beaucoup.",
  "apercu.image": "L'étiquette jaune de Jump : JUMP, le petit personnage carré et une scie.",
} as const;

const en: Catalogues<typeof fr>["en"] = {
  "apercu.titre": "Jump — Du Jour",
  "apercu.description": "One level a day, the same for everyone. The saws are already spinning. You will die. A lot.",
  "apercu.image": "The yellow Jump label: JUMP, the little square character and a saw.",
};

export const CATALOGUE_APERCU = { fr, en };
