import { setLangue } from "../src/i18n";

// Lot I5 : les tests de Jump lisent les textes en français (la langue par défaut du jeu). Sous Node, `navigator.languages` est celui de la machine
// (souvent `en-US`) : sans ceci, la langue détectée serait l'anglais (piège noté au lot I4). Importé pour son effet, en tête des tests qui lisent un texte.
void setLangue("fr", { ecrire: false });
