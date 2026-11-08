import { writeFileSync } from "node:fs";
import { daysFromCivil, formatDay } from "@cdj/core";
import { contenuScenario, dailyRush, diamantDuJour, empreinteContenu, encoderRediffusion, enregistrer, entree, entreesDuBot, jouer, jouerJusqua, jouerLePilote, choixParDefaut, RUSH_BOT_VERSION, RUSH_GENERATOR_VERSION, RUSH_SIM_VERSION, seuilsDe, type Changement, type Choix } from "../src/index";

// Le golden de Rush : `npm run golden:rush -w @cdj/rush-sim`. Dix jours (l'empreinte de leur contenu) et trois rediffusions de référence (le pilote, un joueur agité, une partie vide) et deux scénarios (le golem, l'arène à 30 monstres) joués 3 000 ticks.
// Il ne se régénère jamais sans monter la version concernée (`RUSH_SIM_VERSION` pour les rediffusions, `RUSH_GENERATOR_VERSION` pour le contenu).
const jours = Array.from({ length: 10 }, (_, i) => daysFromCivil(2026, 11, 2) + i * 3);

const jourRef = jours[0]!;
const contenu = dailyRush(jourRef);
// Un joueur qui court en rond, frappe (le coup est tenu : il enchaîne), esquive et vise sans jamais viser juste : il exerce les monstres, les ondes, les dégâts et la visée (lot BR0b : une visée sur deux, l'autre sans visée).
const joueurAgite: Changement[] = Array.from({ length: 400 }, (_, i) => ({ tick: i * 9, e: entree((i * 5) % 32, i % 3 === 0, i % 7 === 0, i % 2 === 0 ? (i * 3) % 32 : -1) }));
const pilote = jouerLePilote(contenu);
const beaucoup = jouerLePilote(contenu, undefined, Infinity, "beaucoup");
// Lot BR4 : le Diamant du jour de référence (la partie la plus rapide des trois stratégies : le fantôme), avec ses choix de cartes.
const diamant = entreesDuBot(contenu);
// Lot BR5 : la compétence se choisit avant de partir (un événement d'entrée) : le joueur agité prend le bond, la partie vide le tourbillon.
const reds = [
  { nom: "pilote", changements: pilote.changements, choix: pilote.choix, competence: pilote.competence },
  { nom: "beaucoup", changements: beaucoup.changements, choix: beaucoup.choix, competence: beaucoup.competence },
  { nom: "diamant", changements: diamant.changements, choix: diamant.choix, competence: diamant.competence },
  { nom: "agite", changements: joueurAgite, choix: choixParDefaut(contenu, joueurAgite, 0, undefined, 1), competence: 1 },
  { nom: "vide", changements: [] as Changement[], choix: [] as Choix[], competence: 0 },
].map((r) => ({ nom: r.nom, date: formatDay(jourRef), g: contenu.g, code: enregistrer(contenu, r.changements, r.choix, r.competence), resultat: jouer(contenu, r.changements, undefined, r.choix, r.competence) }));
// Les scénarios ne se rejouent pas par le serveur : leur résultat, au bit près, est gardé pour les trois navigateurs.
// Lot BR2 : le scénario du golem avec toutes les améliorations (le tourbillon, l'onde d'épée, l'esquive tranchante, les paliers de force) exerce leurs effets au bit près.
const TOUT = ["lame-lourde", "lame-lourde", "allonge", "cadence", "moulinet", "onde-epee", "bottes-legeres", "esquive-longue", "esquive-vive", "esquive-tranchante", "coeur-en-plus", "vol-de-vie", "brise-pierre", "aimant", "rage-vive", "maitrise", "echo", "signature"];
// Lot BR3 : un scénario par boss (la reine, le grand-duc, le bélier, le chêne ; le golem est « boss »), en phase 2 pour deux d'entre eux.
const BOSS_REFS = [["reine", 1, false], ["grand-duc", 2, true], ["belier", 3, false], ["chene", 4, true]] as const;
// Lot BR5 : la horde (30 gélatons, 10 gelées, des vases) avec chacune des trois compétences, et le bond sur le mannequin : la jauge des scénarios part pleine, le pilote lance la compétence dès qu'il y a de quoi la lancer.
const COMPETENCES_REFS = [["horde-tourbillon", "horde", 0], ["horde-bond", "horde", 1], ["horde-bouclier", "horde", 2], ["boss-bouclier", "boss", 2]] as const;
type Ligne = readonly [nom: string, scenario: "boss" | "arene" | "cartes" | "horde" | "camp" | "epreuve" | "bestiaire-monstres", ameliorations: readonly string[], boss: number, phase2: boolean, competence: number, nomRef: string];
const lignes: Ligne[] = [
  ["boss", "boss", [], 0, false, 0, "boss"],
  ["arene", "arene", [], 0, false, 0, "arene"],
  ["boss", "boss", TOUT, 0, false, 0, "boss-ameliore"],
  ["cartes", "cartes", ["soin"], 0, false, 0, "cartes"],
  ...BOSS_REFS.map(([nom, b, p2]): Ligne => [nom, "boss", [], b, p2, 0, `boss-${nom}`]),
  ...COMPETENCES_REFS.map(([nom, sc, comp]): Ligne => [nom, sc, [], 0, false, comp, nom]),
  // Lot BR6 : un camp de cracheurs, de chamans, de totems et de porte-boucliers (dont un élite), la salle d'épreuve du jour (le pilote la joue), le bestiaire des monstres (figé).
  ["camp", "camp", [], 0, false, 1, "camp"],
  ["epreuve", "epreuve", [], 0, false, 0, "epreuve"],
  ["bestiaire-monstres", "bestiaire-monstres", [], 0, false, 0, "bestiaire-monstres"],
];
const scenarios = lignes.map(([, nom, ameliorations, boss, phase2, competence, nomRef]) => {
  const ennemis = nom === "camp" ? [3, 4, 5, 6] : [];
  const c = contenuScenario(nom, { monstres: nom === "arene" ? 30 : 0, ameliorations: [...ameliorations], nv: 5, boss, phase2, competence, ennemis, elite: nom === "camp" });
  const r = jouerLePilote(c, undefined, 3000);
  return { nom: nomRef, scenario: nom, monstres: c.monstres, ennemis, elite: nom === "camp", ameliorations: [...ameliorations], nv: nom === "cartes" ? 5 : 0, boss, phase2, competence, code: encoderRediffusion({ sim: RUSH_SIM_VERSION, g: c.g, contenu: { scenario: nom }, changements: r.changements, choix: r.choix }), ticks: 3000, ...(({ empreinte, resultat }) => ({ empreinte, resultat }))(jouerJusqua(c, r.changements, 3000, undefined, r.choix)) };
});

const sortie = {
  _: "Golden de Rush (lot K4f). Régénérer : npm run golden:rush -w @cdj/rush-sim, seulement en montant la version concernée.",
  sim: RUSH_SIM_VERSION,
  generateur: RUSH_GENERATOR_VERSION,
  // Lot BR4 : le pilote fait partie des règles du classement (les médailles en viennent) : la version du pilote, et pour chaque jour sa stratégie du Diamant et les quatre seuils.
  pilote: RUSH_BOT_VERSION,
  jours: jours.map((j) => {
    const c = dailyRush(j);
    return { date: formatDay(j), empreinte: empreinteContenu(c), diamant: diamantDuJour(c).strategie, seuils: seuilsDe(c) };
  }),
  rediffusions: reds,
  scenarios,
};
writeFileSync(new URL("../test/fixtures/golden-rush.json", import.meta.url), JSON.stringify(sortie, null, 2) + "\n");
console.log("golden écrit :", reds.map((r) => `${r.nom}=${r.resultat.ticks}${r.resultat.victoire ? "V" : "D"}`).join(" "));
