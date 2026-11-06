import { writeFileSync } from "node:fs";
import { daysFromCivil, formatDay } from "@cdj/core";
import { contenuScenario, dailyRush, empreinteContenu, encoderRediffusion, enregistrer, entree, jouer, jouerJusqua, jouerLePilote, choixParDefaut, RUSH_GENERATOR_VERSION, RUSH_SIM_VERSION, type Changement, type Choix } from "../src/index";

// Le golden de Rush : `npm run golden:rush -w @cdj/rush-sim`. Dix jours (l'empreinte de leur contenu) et trois rediffusions de référence (le pilote, un joueur agité, une partie vide) et deux scénarios (le golem, l'arène à 30 monstres) joués 3 000 ticks.
// Il ne se régénère jamais sans monter la version concernée (`RUSH_SIM_VERSION` pour les rediffusions, `RUSH_GENERATOR_VERSION` pour le contenu).
const jours = Array.from({ length: 10 }, (_, i) => daysFromCivil(2026, 11, 2) + i * 3);

const jourRef = jours[0]!;
const contenu = dailyRush(jourRef);
// Un joueur qui court en rond, frappe (le coup est tenu : il enchaîne), esquive et vise sans jamais viser juste : il exerce les monstres, les ondes, les dégâts et la visée (lot BR0b : une visée sur deux, l'autre sans visée).
const joueurAgite: Changement[] = Array.from({ length: 400 }, (_, i) => ({ tick: i * 9, e: entree((i * 5) % 32, i % 3 === 0, i % 7 === 0, i % 2 === 0 ? (i * 3) % 32 : -1) }));
const pilote = jouerLePilote(contenu);
const beaucoup = jouerLePilote(contenu, undefined, Infinity, "beaucoup");
const reds = [
  { nom: "pilote", changements: pilote.changements, choix: pilote.choix },
  { nom: "beaucoup", changements: beaucoup.changements, choix: beaucoup.choix },
  { nom: "agite", changements: joueurAgite, choix: choixParDefaut(contenu, joueurAgite) },
  { nom: "vide", changements: [] as Changement[], choix: [] as Choix[] },
].map((r) => ({ nom: r.nom, date: formatDay(jourRef), g: contenu.g, code: enregistrer(contenu, r.changements, r.choix), resultat: jouer(contenu, r.changements, undefined, r.choix) }));
// Les scénarios ne se rejouent pas par le serveur : leur résultat, au bit près, est gardé pour les trois navigateurs.
// Lot BR2 : le scénario du golem avec toutes les améliorations (le tourbillon, l'onde d'épée, l'esquive tranchante, les paliers de force) exerce leurs effets au bit près.
const TOUT = ["lame-lourde", "lame-lourde", "allonge", "cadence", "tourbillon", "onde-epee", "bottes-legeres", "esquive-longue", "esquive-vive", "esquive-tranchante", "coeur-en-plus", "vol-de-vie", "brise-pierre", "aimant"];
const scenarios = ([["boss", [] as string[]], ["arene", [] as string[]], ["boss", TOUT], ["cartes", ["soin"]]] as const).map(([nom, ameliorations], i) => {
  const c = contenuScenario(nom, { monstres: nom === "arene" ? 30 : 0, ameliorations, nv: 5 });
  const r = jouerLePilote(c, undefined, 3000);
  return { nom: i === 2 ? "boss-ameliore" : nom, scenario: nom, monstres: c.monstres, ameliorations: [...ameliorations], nv: nom === "cartes" ? 5 : 0, code: encoderRediffusion({ sim: RUSH_SIM_VERSION, g: c.g, contenu: { scenario: nom }, changements: r.changements, choix: r.choix }), ticks: 3000, ...(({ empreinte, resultat }) => ({ empreinte, resultat }))(jouerJusqua(c, r.changements, 3000, undefined, r.choix)) };
});

const sortie = {
  _: "Golden de Rush (lot K4f). Régénérer : npm run golden:rush -w @cdj/rush-sim, seulement en montant la version concernée.",
  sim: RUSH_SIM_VERSION,
  generateur: RUSH_GENERATOR_VERSION,
  jours: jours.map((j) => ({ date: formatDay(j), empreinte: empreinteContenu(dailyRush(j)) })),
  rediffusions: reds,
  scenarios,
};
writeFileSync(new URL("../test/fixtures/golden-rush.json", import.meta.url), JSON.stringify(sortie, null, 2) + "\n");
console.log("golden écrit :", reds.map((r) => `${r.nom}=${r.resultat.ticks}${r.resultat.victoire ? "V" : "D"}`).join(" "));
