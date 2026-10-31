import { demarrerManette, type OptionsManette } from "@cdj/ui/src/manette";

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
} as const;

/** Ce que le menu à la manette lit pour une page (chargé avec lui, à la première manette). */
export const optionsPage = (page: keyof typeof PAGES_MANETTE): OptionsManette => ({ page: true, ecrans: [{ ecran: ":root", principal: PAGES_MANETTE[page] }] });

/** Le module d'une page pour `activerManette` : ses déclarations et le moteur (un seul `import()` au premier chargement). */
export const pour = (page: keyof typeof PAGES_MANETTE) => ({ demarrerManette, OPTIONS_MANETTE: optionsPage(page) });
