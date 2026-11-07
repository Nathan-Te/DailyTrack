import { demarrerManette, type EcranManette, type OptionsManette } from "@cdj/ui/src/manette";

// Lot M1 (plateforme) : les pages du portail se pilotent à la manette (`packages/ui/src/manette.ts`, la seule logique de la plateforme, chargée à la première manette).
// **Chaque page déclare son action principale** (où le focus se pose à l'arrivée) : une ligne par page, à l'appel de sa propre entrée. B revient par la flèche « ‹ » de
// la barre (`.dj-barre-jeu__retour`) ; sur l'accueil, qui n'en a pas, B ne fait rien. L'administration (`/admin/`) est exclue : clavier et souris.
// Les pages des mentions légales (`/mentions-legales/`, `/legal/`) sont **statiques et sans aucun script** (règle de fidélité, `apps/portail/test/mentions.test.ts`) : elles
// ne chargent pas le menu à la manette — limite écrite au README du lot M1, décision de Nathan.
export const PAGES_MANETTE = {
  // Lot U1 : « Jouer » de la première cartouche (un jeu épinglé passe en tête) ; la navigation du haut ou la barre d'onglets du bas (LB / RB) et la cloche sont atteintes à la croix, comme tout lien.
  accueil: ".dj-cartouche .dj-bouton", // « Jouer » de la première cartouche
  classement: '[role="tab"][aria-selected="true"]', // l'onglet de la vue affichée ; LB / RB changent d'onglet
  profil: "#pseudo-lien", // lot U3 : « Changer de pseudo » (il ouvre le champ du pseudo) ; le crayon de la photo est atteint à la croix
  nouveautes: ".dj-barre-jeu__retour",
  // Lot F2 : « Mes amis » → le champ du pseudo à ajouter, ou « Accepter » quand une invitation est affichée ; la feuille d'un joueur (A valide, B ferme) est ajoutée par `optionsPage` (classement).
  amis: ".dj-carte-invitation .dj-bouton, .dj-ajout-ami__champ", // lot U3 : « Voir le profil » d'un ami ouvre la feuille d'un joueur (comme au classement)
  // Lot C1 : « Mes messages » → le premier message, ou le champ de réponse d'un fil ouvert.
  messages: ".messages-fil__ouvrir, .messages-reponse__champ",
  // Lot C1, partie C : la page d'un groupe → « Rejoindre le groupe » quand une invitation est affichée, sinon « Partager le lien d'invitation » d'un membre, sinon le lien de retour.
  groupe: "#groupe-rejoindre, .groupe-actions .dj-bouton, .dj-barre-jeu__retour",
} as const;

/**
 * La feuille d'un joueur (toucher une ligne du classement, lot F2) : A valide « Ajouter en ami » / « Retirer », B ferme. La même ligne que `ECRAN_MANETTE_FEUILLE` de `@cdj/ui/src/amis`
 * (testée égale, `test/manette.test.ts`) : elle n'est pas importée ici, ce qui ramènerait les composants des amis dans le menu à la manette de chaque page.
 */
export const ECRAN_FEUILLE: EcranManette = { ecran: ".dj-feuille", principal: ".dj-feuille__principal, .dj-feuille__fermer", retour: ".dj-feuille__fermer" };

/** Le dialogue « Un bug ? Une idée ? » (lot C1), ouvert depuis le pied de n'importe quelle page : A valide, B ferme. La même ligne que `ECRAN_MANETTE_RETOUR` de `@cdj/ui/src/retours` (testée égale, `test/manette.test.ts`) : elle n'est pas importée ici, ce qui ramènerait le dialogue dans le menu à la manette. */
export const ECRAN_RETOUR: EcranManette = { ecran: ".dj-retour", principal: ".dj-retour__texte", retour: ".dj-retour__fermer" };

/** Lot U1 : la feuille de la cloche (nouveautés et messages), ouverte depuis la barre de l'accueil : A ouvre la ligne, B ferme. Lot U4 : la même sur toutes les pages (`clochePage.ts`). */
export const ECRAN_CLOCHE: EcranManette = { ecran: ".salle-feuille", principal: ".salle-feuille__ligne, .salle-feuille__fermer", retour: ".salle-feuille__fermer" };

/** Ce que le menu à la manette lit pour une page (chargé avec lui, à la première manette) ; le classement et (lot U3) « Amis et groupes » y ajoutent la feuille d'un joueur. */
export const optionsPage = (page: keyof typeof PAGES_MANETTE): OptionsManette => ({
  page: true,
  ecrans: [{ ecran: ":root", principal: PAGES_MANETTE[page] }, ECRAN_RETOUR, ...(page === "classement" || page === "amis" ? [ECRAN_FEUILLE] : []), ECRAN_CLOCHE],
});

/** Le module d'une page pour `activerManette` : ses déclarations et le moteur (un seul `import()` au premier chargement). */
export const pour = (page: keyof typeof PAGES_MANETTE) => ({ demarrerManette, OPTIONS_MANETTE: optionsPage(page) });
