// Lot T3 — le bot de l'auteur : un point d'entrée à part (`@cdj/tower-sim/bot`), chargé À LA DEMANDE (Web Worker du jeu, outils) — jamais dans le premier chargement du jeu.
export { bot, type Compteurs, commandesDuCoup, type Coup, coupInterdit, coupsDe, essayerBot, jouerBot, jouerBotRobuste, noteEssai, OPTIONS_BOT, type OptionsBot, type ResultatBot, type ResultatRobuste, ROTATIONS, VARIANTES_BOT } from "./bot";
export * from "./constantes";
export { examinerJourPrepare, preparerJour, verifierJourPrepare } from "./preparer";
