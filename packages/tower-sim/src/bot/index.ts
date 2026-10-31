// Lot T3 — le bot de l'auteur : un point d'entrée à part (`@cdj/tower-sim/bot`), chargé À LA DEMANDE (Web Worker du jeu, outils) — jamais dans le premier chargement du jeu.
export { arreter, bot, type Compteurs, commandesDeLaMer, commandesDuCoup, type Coup, coupsDe, jouerBot, jouerBotRobuste, noteEssai, OPTIONS_BOT, type OptionsBot, type ResultatBot, type ResultatRobuste, ROTATIONS, VARIANTES_BOT } from "./bot";
export * from "./constantes";
export { preparerJour, verifierJourPrepare } from "./preparer";
