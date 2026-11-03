import { demarrerManette, type EcranManette, type OptionsManette } from "@cdj/ui/src/manette";

// Lot M1 (plateforme) : les pages du portail se pilotent à la manette (`packages/ui/src/manette.ts`, la seule logique de la plateforme, chargée à la première manette).
// **Chaque page déclare son action principale** (où le focus se pose à l'arrivée) : une ligne par page, à l'appel de sa propre entrée. B revient par la flèche « ‹ » de
// la barre (`.dj-barre-jeu__retour`) ; sur l'accueil, qui n'en a pas, B ne fait rien. L'administration (`/admin/`) est exclue : clavier et souris.
// Les pages des mentions légales (`/mentions-legales/`, `/legal/`) sont **statiques et sans aucun script** (règle de fidélité, `apps/portail/test/mentions.test.ts`) : elles
// ne chargent pas le menu à la manette — limite écrite au README du lot M1, décision de Nathan.
export const PAGES_MANETTE = {
  accueil: ".dj-cartouche .dj-bouton", // « Jouer » de la première cartouche (Track)
  classement: '[role="tab"][aria-selected="true"]', // l'onglet de la vue affichée ; LB / RB changent d'onglet
  profil: "input", // le champ du pseudo ; A ouvre la saisie
  nouveautes: ".dj-barre-jeu__retour",
  // Lot F2 : « Mes amis » → le champ du pseudo à ajouter, ou « Accepter » quand une invitation est affichée ; la feuille d'un joueur (A valide, B ferme) est ajoutée par `optionsPage` (classement).
  amis: ".dj-carte-invitation .dj-bouton, .dj-ajout-ami__champ",
  // Lot C1 : « Mes messages » → le premier message, ou le champ de réponse d'un fil ouvert.
  messages: ".messages-fil__ouvrir, .messages-reponse__champ",
} as const;

/**
 * La feuille d'un joueur (toucher une ligne du classement, lot F2) : A valide « Ajouter en ami » / « Retirer », B ferme. La même ligne que `ECRAN_MANETTE_FEUILLE` de `@cdj/ui/src/amis`
 * (testée égale, `test/manette.test.ts`) : elle n'est pas importée ici, ce qui ramènerait les composants des amis dans le menu à la manette de chaque page.
 */
export const ECRAN_FEUILLE: EcranManette = { ecran: ".dj-feuille", principal: ".dj-feuille__principal, .dj-feuille__fermer", retour: ".dj-feuille__fermer" };

/** Le dialogue « Un bug ? Une idée ? » (lot C1), ouvert depuis le pied de n'importe quelle page : A valide, B ferme. La même ligne que `ECRAN_MANETTE_RETOUR` de `@cdj/ui/src/retours` (testée égale, `test/manette.test.ts`) : elle n'est pas importée ici, ce qui ramènerait le dialogue dans le menu à la manette. */
export const ECRAN_RETOUR: EcranManette = { ecran: ".dj-retour", principal: ".dj-retour__texte", retour: ".dj-retour__fermer" };

/** Ce que le menu à la manette lit pour une page (chargé avec lui, à la première manette) ; le classement y ajoute la feuille d'un joueur. */
export const optionsPage = (page: keyof typeof PAGES_MANETTE): OptionsManette => ({
  page: true,
  ecrans: [{ ecran: ":root", principal: PAGES_MANETTE[page] }, ECRAN_RETOUR, ...(page === "classement" ? [ECRAN_FEUILLE] : [])],
});

/** Le module d'une page pour `activerManette` : ses déclarations et le moteur (un seul `import()` au premier chargement). */
export const pour = (page: keyof typeof PAGES_MANETTE) => ({ demarrerManette, OPTIONS_MANETTE: optionsPage(page) });
