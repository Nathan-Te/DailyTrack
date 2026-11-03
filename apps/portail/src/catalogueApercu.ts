import type { Catalogues } from "@cdj/ui";

// Lot I6 (plateforme) : l'aperçu quand on colle le lien du portail (Open Graph : titre, description, texte de l'image ; `index.html`). Lu **seulement à
// la construction** (`vite.config.ts` pré-remplit les balises en français) : jamais dans le paquet du portail. Le français sert au lancement, l'anglais
// est prêt pour plus tard. Ton de Du Jour (charte § 7) : chaleureux, simple, court. Parité : packages/ui/test/catalogues.test.ts.
const fr = {
  "apercu.titre": "Du Jour — les jeux du jour",
  "apercu.description": "Chaque jour, un circuit Track et un niveau Jump, les mêmes pour tout le monde. Joue, compare, partage ta journée.",
  "apercu.image": "Le logo DU JOUR et deux cartouches posées sur l'étagère : Track et Jump.",
  // Lot N2 : la page /nouveautes/
  "apercu.nouveautes.titre": "Nouveautés — Du Jour",
  "apercu.nouveautes.description": "Ce qui change dans Du Jour, Track et Jump : les nouveautés, mise à jour par mise à jour, en français et en anglais.",
  // Lot F2 : la page /amis/ (le lien d'invitation qu'on partage y mène)
  "apercu.messages.titre": "Mes messages — Du Jour",
  "apercu.messages.description": "Tes messages à l'éditeur de Du Jour et ses réponses.",
  "apercu.groupe.titre": "Rejoins mon groupe sur Du Jour",
  "apercu.groupe.description": "Un circuit Track et un niveau Jump chaque jour, les mêmes pour tout le monde. Rejoins mon groupe : notre classement est la moyenne de nos 3 meilleurs.",
  "apercu.amis.titre": "Rejoins-moi sur Du Jour",
  "apercu.amis.description": "Un circuit Track et un niveau Jump chaque jour, les mêmes pour tout le monde. Ajoutons-nous en amis pour comparer nos temps.",
} as const;

const en: Catalogues<typeof fr>["en"] = {
  "apercu.titre": "Du Jour — today's games",
  "apercu.description": "Every day, one Track circuit and one Jump level, the same for everyone. Play, compare, share your day.",
  "apercu.image": "The DU JOUR logo and two cartridges on the shelf: Track and Jump.",
  "apercu.nouveautes.titre": "What's new — Du Jour",
  "apercu.nouveautes.description": "What changes in Du Jour, Track and Jump: updates one by one, in French and in English.",
  "apercu.messages.titre": "My messages — Du Jour",
  "apercu.messages.description": "Your messages to the Du Jour publisher, and the replies.",
  "apercu.groupe.titre": "Join my group on Du Jour",
  "apercu.groupe.description": "One Track circuit and one Jump level every day, the same for everyone. Join my group: our ranking is the average of our 3 best.",
  "apercu.amis.titre": "Join me on Du Jour",
  "apercu.amis.description": "One Track circuit and one Jump level every day, the same for everyone. Let's add each other as friends to compare our times.",
};

export const CATALOGUE_APERCU = { fr, en };
