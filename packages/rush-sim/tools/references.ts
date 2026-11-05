import { writeFileSync } from "node:fs";
import { daysFromCivil, formatDay } from "@cdj/core";
import { contenuScenario, dailyRush, empreinteContenu, encoderRediffusion, enregistrer, entree, jouer, jouerJusqua, jouerLePilote, RUSH_SIM_VERSION, type Changement } from "../src/index";

// Le golden de Rush : `npm run golden:rush -w @cdj/rush-sim`. Dix jours (l'empreinte de leur contenu) et trois rediffusions de référence (le pilote, un joueur agité, une partie vide) et deux scénarios (le golem, l'arène à 30 monstres) joués 3 000 ticks.
// Il ne se régénère jamais sans monter la version concernée (`RUSH_SIM_VERSION` pour les rediffusions, `RUSH_GENERATOR_VERSION` pour le contenu).
const jours = Array.from({ length: 10 }, (_, i) => daysFromCivil(2026, 11, 2) + i * 3);

const jourRef = jours[0]!;
const contenu = dailyRush(jourRef);
// Un joueur qui court en rond, frappe et esquive sans jamais viser : il exerce les monstres, les ondes et les dégâts.
const joueurAgite: Changement[] = Array.from({ length: 400 }, (_, i) => ({ tick: i * 9, e: entree((i * 5) % 32, i % 3 === 0, i % 7 === 0) }));
const reds = [
  { nom: "pilote", changements: jouerLePilote(contenu).changements },
  { nom: "agite", changements: joueurAgite },
  { nom: "vide", changements: [] as Changement[] },
].map((r) => ({ nom: r.nom, date: formatDay(jourRef), g: contenu.g, code: enregistrer(contenu, r.changements), resultat: jouer(contenu, r.changements) }));
// Les scénarios ne se rejouent pas par le serveur : leur résultat, au bit près, est gardé pour les trois navigateurs.
const scenarios = (["boss", "arene"] as const).map((nom) => {
  const c = contenuScenario(nom, { monstres: nom === "arene" ? 30 : 0 });
  const r = jouerLePilote(c, undefined, 3000);
  return { nom, scenario: nom, monstres: c.monstres, code: encoderRediffusion({ sim: RUSH_SIM_VERSION, g: c.g, contenu: { scenario: nom }, changements: r.changements }), ticks: 3000, ...(({ empreinte, resultat }) => ({ empreinte, resultat }))(jouerJusqua(c, r.changements, 3000)) };
});

const sortie = {
  _: "Golden de Rush (lot K4f). Régénérer : npm run golden:rush -w @cdj/rush-sim, seulement en montant la version concernée.",
  sim: 1,
  generateur: 1,
  jours: jours.map((j) => ({ date: formatDay(j), empreinte: empreinteContenu(dailyRush(j)) })),
  rediffusions: reds,
  scenarios,
};
writeFileSync(new URL("../test/fixtures/golden-rush.json", import.meta.url), JSON.stringify(sortie, null, 2) + "\n");
console.log("golden écrit :", reds.map((r) => `${r.nom}=${r.resultat.ticks}${r.resultat.victoire ? "V" : "D"}`).join(" "));
