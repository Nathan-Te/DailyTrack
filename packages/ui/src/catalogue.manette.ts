// Lot M1 (plateforme) : les textes de la bande d'aide de la manette (`manette.ts`). **Un catalogue à part, chargé à la demande avec le module** (rien au premier
// chargement d'un jeu ni du portail : le module n'est chargé que si une manette est branchée). La langue est celle de la page (`<html lang>`). Parité des deux
// langues : packages/ui/test/catalogues.test.ts.
const fr = {
  "manette.valider": "Valider",
  "manette.retour": "Retour",
  "manette.onglets": "Onglets",
  "manette.aide.aria": "Aide de la manette : A valide, B revient, LB et RB changent d'onglet.",
  "manette.aide.aria.sans": "Aide de la manette : A valide, B revient.",
};

const en: typeof fr = {
  "manette.valider": "Confirm",
  "manette.retour": "Back",
  "manette.onglets": "Tabs",
  "manette.aide.aria": "Gamepad help: A confirms, B goes back, LB and RB switch tabs.",
  "manette.aide.aria.sans": "Gamepad help: A confirms, B goes back.",
};

export const CATALOGUE_MANETTE = { fr, en };
